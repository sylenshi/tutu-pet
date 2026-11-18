const { app, BrowserWindow, ipcMain, screen, Menu, Tray } = require('electron');
const path = require('path');
const fs = require('fs');

// 配置保存到用户数据目录：打包后 __dirname 在 app.asar 内（只读），写那里会 ENOENT
const CONFIG_DIR = app.getPath('userData');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    return { width: 200, height: 280, x: null, y: null, autoBubble: true };
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

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const { width: sw, height: sh } = display.workAreaSize;
  win = new BrowserWindow({
    width: cfg.width || 200,
    height: cfg.height || 280,
    x: (cfg.x !== undefined && cfg.x !== null) ? cfg.x : 60,
    y: (cfg.y !== undefined && cfg.y !== null) ? cfg.y : Math.max(0, sh - 240),
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

  // 记住窗口位置和大小
  const savePos = () => {
    if (!win) return;
    const b = win.getBounds();
    cfg.x = b.x; cfg.y = b.y; cfg.width = b.width; cfg.height = b.height;
    saveConfig(cfg);
  };
  win.on('moved', savePos);
  win.on('resized', savePos);
}

function setSize(w, h) {
  if (!win) return;
  const b = win.getBounds();
  win.setBounds({ x: b.x, y: b.y, width: w, height: h });
  cfg.width = w; cfg.height = h;
  saveConfig(cfg);
  win.webContents.send('size-changed', w, h);
}

// ===== 托盘菜单（按当前状态动态生成）=====
function buildTrayMenu() {
  const visible = win != null && win.isVisible();
  return Menu.buildFromTemplate([
    { label: visible ? '隐藏兔兔' : '显示兔兔', click: () => togglePet() },
    { type: 'separator' },
    { label: '尺寸: 小 (300)', click: () => setSize(300, 300) },
    { label: '尺寸: 大 (400)', click: () => setSize(400, 400) },
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

app.whenReady().then(() => {
  createWindow();

  // 系统托盘
  try {
    tray = new Tray(path.join(__dirname, 'icon.png'));
    tray.setToolTip('兔兔桌宠');
    refreshTrayMenu();
    tray.on('double-click', () => togglePet());
  } catch (e) {
    console.log('tray failed:', e.message);
  }

  ipcMain.on('set-size', (e, w, h) => setSize(w, h));
  ipcMain.on('quit-app', () => { app.isQuitting = true; app.quit(); });
  ipcMain.on('move-window-by', (e, dx, dy) => {
    if (!win) return;
    const b = win.getBounds();
    win.setBounds({ x: b.x + dx, y: b.y + dy, width: b.width, height: b.height });
  });
  ipcMain.handle('get-config', () => cfg);
});

app.on('window-all-closed', () => {
  if (app.isQuitting) app.quit();
});
