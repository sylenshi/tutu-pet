const { app, BrowserWindow, ipcMain, screen, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

// 配置保存到用户数据目录：打包后 __dirname 在 app.asar 内（只读），写那里会 ENOENT
const CONFIG_DIR = app.getPath('userData');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    // 尺寸不持久化：每次启动固定中档，只记住位置和冒泡开关
    return { x: null, y: null, autoBubble: true };
  }
}

function saveConfig(cfg) {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
  } catch (e) {
    // 保存失败只记日志，不影响当前操作，更不能让主进程崩掉
    console.error('保存配置失败:', e.message);
  }
}

let win = null;
let tray = null;
let cfg = loadConfig();

// 把窗口矩形收敛进工作区：保存的位置可能落在已拔掉的副屏、或被拖出屏幕边缘
// （x=-580 这类），不 clamp 的话窗口整个在屏幕外——托盘在、桌宠却看不见
function clampIntoWorkArea(x, y, w, h, wa) {
  return {
    x: Math.min(Math.max(x, wa.x), wa.x + wa.width - w),
    y: Math.min(Math.max(y, wa.y), wa.y + wa.height - h)
  };
}

function createWindow() {
  const display = screen.getPrimaryDisplay();
  // 保存的位置可能落在缩放比例不同的副屏上（如主屏 100% + 副屏 150%），
  // 尺寸必须按窗口实际所在屏幕的缩放换算，否则启动会比托盘预设大一圈
  const hasPos = cfg.x !== undefined && cfg.x !== null && cfg.y !== undefined && cfg.y !== null;
  const openDisplay = hasPos ? screen.getDisplayNearestPoint({ x: cfg.x, y: cfg.y }) : display;
  const wa = openDisplay.workArea;
  // 尺寸语义是物理像素，按屏幕缩放换算成 DIP（150% 屏上 400 物理像素 = 267 DIP）
  const startupSize = Math.round(400 / (openDisplay.scaleFactor || 1));
  // 保存的位置先收敛回该屏工作区，保证窗口至少完整落在可见范围内
  const startPos = hasPos
    ? clampIntoWorkArea(cfg.x, cfg.y, startupSize, startupSize, wa)
    : { x: wa.x + 60, y: Math.max(wa.y, wa.y + wa.height - startupSize - 40) };
  win = new BrowserWindow({
    width: startupSize,
    height: startupSize,
    x: startPos.x,
    y: startPos.y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadFile(path.join(__dirname, 'index.html'));

  // 默认整体鼠标穿透：透明窗口矩形会挡住下方应用的点击，只有光标落在兔兔
  // 身上（渲染进程按像素 alpha 判定）时才临时恢复接收事件
  win.setIgnoreMouseEvents(true);

  // 调试：加载完成后截取窗口内容
  if (process.env.PET_DEBUG === '1') {
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        const image = await win.webContents.capturePage();
        fs.writeFileSync(path.join(CONFIG_DIR, 'debug_window.png'), image.toPNG());
        const b = win.getBounds();
        fs.writeFileSync(path.join(CONFIG_DIR, 'debug_bounds.txt'),
          `bounds: x=${b.x} y=${b.y} w=${b.width} h=${b.height}\nscale: ${require('electron').screen.getPrimaryDisplay().scaleFactor}`);
        console.log('debug captured');
      }, 2500);
    });
  }

  // 点击窗口时提升置顶层级，防止被其他置顶窗口盖住
  win.on('focus', () => {
    win.setAlwaysOnTop(true, 'screen-saver');
  });
  win.on('closed', () => { win = null; });
  // 显示/隐藏状态变化时同步托盘菜单文案
  win.on('show', refreshTrayMenu);
  win.on('hide', refreshTrayMenu);

  // 只记住窗口位置（尺寸不持久化，重启回到固定尺寸）
  const savePos = () => {
    if (!win) return;
    const b = win.getBounds();
    cfg.x = b.x; cfg.y = b.y;
    saveConfig(cfg);
  };
  win.on('moved', savePos);
}

// ===== 尺寸预设（按物理像素语义）=====
// BrowserWindow 的宽高单位是 DIP，高缩放屏（150%/200%）上 400 DIP 会显示成
// 600/800 物理像素，看起来比预期大一圈；托盘预设统一换算成当前屏幕的 DIP
const SIZE_PRESETS = { small: 300, mid: 400, large: 500 };

function currentScale() {
  // 以窗口当前所在屏幕的缩放为准（多显示器缩放不同也能正确换算）
  const d = screen.getDisplayMatching(win.getBounds());
  return d.scaleFactor || 1;
}

function applySize(physical) {
  const dip = Math.round(physical / currentScale());
  setSize(dip, dip);
}

function setSize(w, h) {
  if (!win) return;
  const b = win.getBounds();
  win.setBounds({ x: b.x, y: b.y, width: w, height: h });
  win.webContents.send('size-changed', w, h);
}

// ===== 托盘菜单（按当前状态动态生成）=====
function buildTrayMenu() {
  const visible = win != null && win.isVisible();
  return Menu.buildFromTemplate([
    { label: visible ? '隐藏兔兔' : '显示兔兔', click: () => togglePet() },
    { type: 'separator' },
    { label: '尺寸: 小 (300)', click: () => applySize(SIZE_PRESETS.small) },
    { label: '尺寸: 中 (400)', click: () => applySize(SIZE_PRESETS.mid) },
    { label: '尺寸: 大 (500)', click: () => applySize(SIZE_PRESETS.large) },
    { type: 'separator' },
    { label: '主动冒泡', type: 'checkbox', checked: cfg.autoBubble !== false, click: () => toggleAutoBubble() },
    { type: 'separator' },
    { label: '退出', click: () => { app.isQuitting = true; app.quit(); } }
  ]);
}

function refreshTrayMenu() {
  if (tray != null) tray.setContextMenu(buildTrayMenu());
}

// 显示 / 隐藏兔兔：菜单项在「显示兔兔」「隐藏兔兔」之间随状态切换
function togglePet() {
  if (win == null) {
    createWindow(); // 窗口不在时也能从托盘重新拉起
  } else if (win.isVisible()) {
    win.hide();
  } else {
    win.show();
    win.setAlwaysOnTop(true, 'screen-saver');
  }
  refreshTrayMenu();
}

// 主动冒泡开关：默认开，写入配置重启后保持，并实时通知渲染进程
function toggleAutoBubble() {
  cfg.autoBubble = !(cfg.autoBubble !== false);
  saveConfig(cfg);
  if (win != null) win.webContents.send('auto-bubble-changed', cfg.autoBubble);
  refreshTrayMenu();
}

// ===== 托盘图标：macOS 菜单栏用小尺寸 template 图（系统自动处理黑白/选中态），Windows 用应用图标 =====
function createTrayIcon() {
  if (process.platform === 'darwin') {
    const img = nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray', 'trayTemplate.png'));
    img.setTemplateImage(true);
    return img;
  }
  return path.join(__dirname, 'icon.png');
}

app.whenReady().then(() => {
  createWindow();

  // 系统托盘
  try {
    tray = new Tray(createTrayIcon());
    tray.setToolTip('兔兔桌宠');
    refreshTrayMenu();
    tray.on('double-click', () => togglePet());
  } catch (e) {
    console.log('tray failed:', e.message);
  }

  ipcMain.on('set-size', (e, w, h) => setSize(w, h));
  ipcMain.on('quit-app', () => { app.isQuitting = true; app.quit(); });
  // 渲染进程根据命中检测结果切换穿透状态
  ipcMain.on('set-click-through', (e, ignore) => {
    if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(!!ignore);
  });

  // 光标轮询（50ms）：穿透状态下页面收不到 mousemove（forward 仅 Windows 可靠），
  // 主进程统一轮询光标位置发给渲染进程做命中检测，三平台行为一致
  setInterval(() => {
    if (!win || win.isDestroyed() || !win.isVisible()) return;
    const p = screen.getCursorScreenPoint();
    const b = win.getContentBounds();
    const inside = p.x >= b.x && p.x < b.x + b.width && p.y >= b.y && p.y < b.y + b.height;
    if (inside) win.webContents.send('cursor-position', p.x - b.x, p.y - b.y);
    else win.webContents.send('cursor-outside');
  }, 50);

  ipcMain.on('move-window-by', (e, dx, dy) => {
    if (!win) return;
    const b = win.getBounds();
    const nb = { x: b.x + dx, y: b.y + dy, width: b.width, height: b.height };
    // 拖动位置收敛进目标点所在屏幕的工作区，防止把兔兔拖出屏幕外（越界位置
    // 会被持久化，下次启动窗口就整个在屏幕外了）
    const wa = screen.getDisplayNearestPoint({
      x: nb.x + nb.width / 2, y: nb.y + nb.height / 2
    }).workArea;
    const p = clampIntoWorkArea(nb.x, nb.y, nb.width, nb.height, wa);
    win.setBounds({ x: p.x, y: p.y, width: nb.width, height: nb.height });
  });
  ipcMain.handle('get-config', () => cfg);
});

app.on('window-all-closed', () => {
  if (app.isQuitting) app.quit();
});
