// 桌宠渲染逻辑：动画状态机 + 交互
// 交互设计：单击轮换5种形态 / 拖拽移动 / 上下摇动触发隐藏款 / 左右摇动解除隐藏款
const img = document.getElementById('pet-img');
const bubble = document.getElementById('bubble');
const bubbleText = document.getElementById('bubble-text');
const bubbleTitle = document.getElementById('bubble-title');

const FRAMES = {
  idle: 'assets/transparent/idle_sit.png',
  happy: 'assets/transparent/happy_sit.png',
  shy: 'assets/transparent/shy_sit.png',
  hello: 'assets/transparent/hello_wave_sit.png',
  sleep: 'assets/transparent/sleeping.png',
  surprised: 'assets/transparent/surprised_sit.png',
  secret: 'assets/transparent/secret_bunny.png'
};

// 单击轮换的 5 种形态（待机 + 4 日常款）
const CYCLE = ['idle', 'happy', 'hello', 'shy', 'sleep'];

let bubbleData = { cycle: {}, drag: [], shy: [], idle: [], hello: [], secretOn: [], secretOff: [], secretTalk: [] };
let isDragging = false;
let isAnimating = false;
let bubbleTimer = null;
let idleChatTimer = null;
let currentForm = 'idle';
let secretMode = false;
// 主动冒泡开关（与托盘菜单联动，重启后从配置恢复，缺省为开）
let autoBubble = true;

// ===== 加载气泡文案配置 =====
async function loadBubbleConfig() {
  try {
    const res = await fetch('bubble.json');
    bubbleData = await res.json();
  } catch (e) {
    console.error('bubble.json load failed', e);
  }
}

function pickRandom(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

// ===== 气泡显示 =====
function showBubble(item, duration = 3500) {
  if (!item) return;
  bubbleTitle.textContent = item.title || '';
  bubbleTitle.style.display = item.title ? 'block' : 'none';
  bubbleText.textContent = item.text || '';
  bubble.classList.add('show');
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => {
    bubble.classList.remove('show');
  }, duration);
}

// ===== 帧切换 =====
function setFrame(name) {
  img.src = FRAMES[name] || FRAMES.idle;
}

// ===== 弹跳动画（不改变形态）=====
function bounce(dur, cb) {
  isAnimating = true;
  img.classList.remove('anim-idle', 'anim-click', 'anim-drag', 'anim-hello', 'anim-secret');
  void img.offsetWidth;
  img.classList.add('anim-click');
  setTimeout(() => {
    img.classList.remove('anim-click');
    img.classList.add('anim-idle');
    isAnimating = false;
    if (cb) cb();
  }, dur);
}

// ===== 隐藏款：进入 / 解除 =====
function activateSecret() {
  secretMode = true;
  img.classList.remove('anim-idle', 'anim-click');
  void img.offsetWidth;
  img.classList.add('anim-secret');
  setFrame('secret');
  showBubble(pickRandom(bubbleData.secretOn), 5000);
  setTimeout(() => {
    img.classList.remove('anim-secret');
    img.classList.add('anim-idle');
  }, 900);
}

function deactivateSecret() {
  secretMode = false;
  // 拖拽中解除时先回到惊讶表情，松手后会切回待机
  setFrame(isDragging ? 'surprised' : 'idle');
  showBubble(pickRandom(bubbleData.secretOff), 4000);
}

// ===== 单击轮换形态 =====
img.addEventListener('click', () => {
  if (isDragging || isAnimating) return;
  if (secretMode) {
    // 隐藏款状态下点击：只卖萌，不换形态
    setFrame('secret');
    bounce(650);
    showBubble(pickRandom(bubbleData.secretTalk), 3000);
    return;
  }
  currentForm = CYCLE[(CYCLE.indexOf(currentForm) + 1) % CYCLE.length];
  setFrame(currentForm);
  bounce(650);
  showBubble(pickRandom(bubbleData.cycle[currentForm]), 3000);
});

// ===== 拖拽移动 + 摇一摇检测 =====
let startX = 0, startY = 0;
// 摇一摇检测：统计滑窗内的"方向反转"事件，配合幅度门限和主轴占比防误触
let dirY = 0, dirX = 0;
let accY = 0, accX = 0;           // 两次反转之间的累计位移（用于幅度门限）
let ySwings = [], xSwings = [];   // {t, amp} 摆动事件
let samples = [];                 // 滑窗内所有移动样本，用于计算主轴位移占比
const NOISE = 5;        // 单步位移噪声门限（px）
const MIN_SWING = 18;   // 单次摆动累计幅度门限（px），太小的摆动不算数
const SHAKE_WINDOW = 1200; // 判定时间窗（毫秒）
const SHAKE_TIMES = 4;  // 窗口内需要达到的摆动次数
const DOMINANCE = 1.5;  // 主轴位移需为副轴的倍数（防斜拖误触）
const MIN_TRAVEL = 60;  // 主轴总位移门限（px）

img.addEventListener('mousedown', (e) => {
  isDragging = false;
  startX = e.screenX;
  startY = e.screenY;
  dirY = 0; dirX = 0;
  accY = 0; accX = 0;
  ySwings = []; xSwings = []; samples = [];
  const onMove = (me) => {
    const dx = me.screenX - startX;
    const dy = me.screenY - startY;
    if (!isDragging && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
      isDragging = true;
      img.classList.remove('anim-idle', 'anim-click', 'anim-secret');
      void img.offsetWidth;
      img.classList.add('anim-drag');
      // 隐藏款状态下保持兔女郎形象，不切换成惊讶款
      setFrame(secretMode ? 'secret' : 'surprised');
      showBubble(pickRandom(bubbleData.drag), 2500);
    }
    if (isDragging && window.petAPI) {
      window.petAPI.moveWindowBy(dx, dy);
      startX = me.screenX;
      startY = me.screenY;

      // --- 摇一摇检测 ---
      const now = performance.now();
      samples.push({ t: now, ax: Math.abs(dx), ay: Math.abs(dy) });
      while (samples.length && samples[0].t < now - SHAKE_WINDOW) samples.shift();
      accY += Math.abs(dy); accX += Math.abs(dx);
      let revY = false, revX = false;
      if (dy > NOISE) { if (dirY === -1) revY = true; dirY = 1; }
      else if (dy < -NOISE) { if (dirY === 1) revY = true; dirY = -1; }
      if (dx > NOISE) { if (dirX === -1) revX = true; dirX = 1; }
      else if (dx < -NOISE) { if (dirX === 1) revX = true; dirX = -1; }
      if (revY) { ySwings.push({ t: now, amp: accY }); accY = 0; }
      if (revX) { xSwings.push({ t: now, amp: accX }); accX = 0; }
      while (ySwings.length && ySwings[0].t < now - SHAKE_WINDOW) ySwings.shift();
      while (xSwings.length && xSwings[0].t < now - SHAKE_WINDOW) xSwings.shift();

      const yBig = ySwings.filter(s => s.amp >= MIN_SWING);
      const xBig = xSwings.filter(s => s.amp >= MIN_SWING);
      const xTotal = samples.reduce((s, x) => s + x.ax, 0);
      const yTotal = samples.reduce((s, x) => s + x.ay, 0);

      // 上下摇 → 触发隐藏款；左右摇 → 解除隐藏款
      // 均要求：摆动次数达标 + 主轴总位移达标 + 主轴位移显著大于副轴
      if (!secretMode && yBig.length >= SHAKE_TIMES && yTotal >= MIN_TRAVEL && yTotal > xTotal * DOMINANCE) {
        ySwings = []; xSwings = []; samples = [];
        activateSecret();
      } else if (secretMode && xBig.length >= SHAKE_TIMES && xTotal >= MIN_TRAVEL && xTotal > yTotal * DOMINANCE) {
        ySwings = []; xSwings = []; samples = [];
        deactivateSecret();
      }
    }
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    if (isDragging) {
      isDragging = false;
      img.classList.remove('anim-drag');
      img.classList.add('anim-idle');
      setFrame(secretMode ? 'secret' : 'idle');
      isAnimating = false;
    }
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  e.preventDefault();
});

// ===== 右键：害羞反应（不改变当前形态）=====
img.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (isDragging || isAnimating) return;
  setFrame('shy');
  bounce(650, () => setFrame(secretMode ? 'secret' : currentForm));
  showBubble(pickRandom(bubbleData.shy), 3000);
});

// ===== 尺寸自适应 =====
function fitImage() {
  const h = Math.round(window.innerHeight * 0.55);
  img.style.height = h + 'px';
  img.style.width = 'auto';
}
window.addEventListener('resize', fitImage);
fitImage();

// ===== 定时冒泡说话（不改变形态；频率 10~25 秒，开关见托盘菜单）=====
function scheduleIdleChat() {
  clearTimeout(idleChatTimer);
  idleChatTimer = setTimeout(() => {
    if (autoBubble) {
      if (!isDragging && !isAnimating) {
        showBubble(pickRandom(bubbleData.idle), 4000);
        if (Math.random() < 0.4) bounce(650);
      }
      scheduleIdleChat();
    }
    // 关闭期间不排下一轮，收到托盘菜单的开启通知后再启动
  }, 10000 + Math.random() * 15000);
}

// ===== 启动：永远以待机形态开始（无状态）=====
(async () => {
  await loadBubbleConfig();
  fitImage();
  currentForm = 'idle';
  secretMode = false;
  setFrame('idle');
  img.classList.add('anim-idle');
  showBubble(pickRandom(bubbleData.hello), 4000);

  // 读取持久化的主动冒泡开关（配置缺省视为开启）
  if (window.petAPI && window.petAPI.getConfig) {
    try {
      const c = await window.petAPI.getConfig();
      autoBubble = c.autoBubble !== false;
    } catch (e) { /* 读取失败用默认值 */ }
  }
  if (autoBubble) scheduleIdleChat();

  // 托盘菜单切换「主动冒泡」后实时生效
  if (window.petAPI && window.petAPI.onAutoBubbleChanged) {
    window.petAPI.onAutoBubbleChanged((enabled) => {
      autoBubble = enabled;
      if (enabled) scheduleIdleChat();
    });
  }
})();
