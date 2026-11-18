<div align="center">
  <img src="assets/readme/icon.png" width="128" alt="兔兔桌宠图标">
</div>

# 兔兔 (Tutu Pet) 🐰

![Electron](https://img.shields.io/badge/Electron-33.x-47848F?logo=electron&logoColor=white)
![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-0078D6?logo=windows&logoColor=white)
![Version](https://img.shields.io/badge/version-1.0.0-8A63D2)

一个可爱的 Windows 2D 卡通桌宠。她会坐在你的桌面上，陪你工作、卖萌、说话，还藏着一个**摇一摇才能解锁的隐藏款**等你发现。

<div align="center">
  <img src="assets/readme/pet-strip.png" alt="形态展示：待机 · 开心 · 挥手 · 害羞 · 睡觉 · 惊讶 · 隐藏款" width="720">
</div>

## ✨ 功能特性

### 桌面互动

| 交互 | 效果 |
|------|------|
| 左键单击 | **轮换 5 种形态**：待机 → 开心 → 挥手 → 害羞 → 睡觉，每点一下换一个 |
| 按住拖拽 | 惊讶挣扎动画，可以把她拖到屏幕任意位置 |
| **拖拽时上下快速摇动** | **解锁隐藏款：黑色兔女郎变身！** |
| 隐藏款状态下左右摇动 | 解除隐藏款，变回普通形象 |
| 右键点击 | 害羞托腮反应（不改变当前形态） |
| 放置不动 10~25 秒 | 随机冒泡说话（可在托盘菜单「主动冒泡」关闭，默认开） |
| 拖动窗口边缘 | 自由调整大小（托盘菜单预设：小 300 / 大 400） |
| 关闭重开 | 记住位置、尺寸和冒泡开关；**每次启动永远以待机形态开始**（无状态） |

> 💡 摇一摇灵敏度经过防误触设计：普通拖拽、缓慢移动、轻微手抖都不会触发隐藏款，需要**明显的快速上下摆动**（1.2 秒内 4 次以上方向反转、单次摆幅 18px 以上）。灵敏度参数在 `renderer.js` 的摇一摇检测区可调。

### 托盘菜单

右键屏幕右下角托盘区的兔兔图标：

| 菜单项 | 说明 |
|------|------|
| **显示兔兔 / 隐藏兔兔** | 菜单项随当前显示状态自动切换，点击即在显示/隐藏之间切换 |
| **尺寸: 小 (300) / 大 (400)** | 两档尺寸预设，点击立即生效并记住 |
| **主动冒泡** | 复选开关，默认开启；关闭后停止随机冒泡，重启后保持上次设置 |
| **退出** | 退出程序 |

## 🚀 快速开始

### 方式一：打包版 exe（推荐）

双击 `dist/兔兔.exe` 即可运行，免安装、免依赖。

- 首次运行 Windows SmartScreen 可能提示未知发布者，点"更多信息 → 仍要运行"即可
- 所有配置自动保存在用户目录，换机器/重解压不丢失

### 方式二：源码运行（需 Node.js）

```bash
npm install
npm start
```

或直接双击 `启动桌宠.bat`。

## ⚙️ 配置说明

配置在 `%APPDATA%\兔兔\config.json`（打包版与源码版共用，自动生成）：

| 字段 | 说明 |
|------|------|
| `width` / `height` | 窗口尺寸 |
| `x` / `y` | 窗口位置 |
| `autoBubble` | 主动冒泡开关，`true` 开启 / `false` 关闭 |

删掉该文件即可恢复全部默认设置。

## 💬 自定义气泡文案

所有台词都在 `bubble.json` 里，按场景分类：

| 字段 | 场景 |
|------|------|
| `cycle` | 单击轮换形态时的台词（按形态分组：idle / happy / hello / shy / sleep） |
| `drag` | 被拖拽时 |
| `shy` | 右键害羞时 |
| `idle` | 发呆冒泡时 |
| `hello` | 启动问候 |
| `secretOn` | 摇出隐藏款时 |
| `secretOff` | 左右摇解除隐藏款时 |
| `secretTalk` | 隐藏款状态下单击时 |

每条格式：`{ "title": "小标题", "text": "正文内容" }`，改完重启桌宠生效。

## 🎨 更换形象

替换 `assets/transparent/` 下的透明 PNG（保持文件名不变即可）：

| 文件 | 用途 |
|------|------|
| `idle_sit.png` | 待机（轮换起点） |
| `happy_sit.png` | 轮换形态：开心 |
| `hello_wave_sit.png` | 轮换形态：挥手 |
| `shy_sit.png` | 轮换形态：害羞 / 右键反应 |
| `sleeping.png` | 轮换形态：睡觉 |
| `surprised_sit.png` | 拖拽反应 |
| `secret_bunny.png` | 隐藏款（兔女郎） |

图片要求：透明背景 PNG，人物完整（从头到脚）。

## 📁 目录结构

```
tutu-pet/
├── main.js              # 主进程：窗口/托盘/配置持久化
├── preload.js           # 进程通信桥
├── renderer.js          # 渲染逻辑：形态轮换/拖拽/摇一摇/定时冒泡
├── index.html           # 界面布局（气泡区+角色区）
├── bubble.json          # 气泡台词配置
├── 启动桌宠.bat          # 源码运行快捷方式
├── icon.ico / icon.png  # 应用图标（托盘也用它）
├── .github/
│   └── workflows/
│       └── build.yml    # GitHub Actions：打 tag 自动构建三平台产物
└── assets/
    ├── transparent/     # 抠图后透明版（程序使用）
    ├── frames/          # 原始立绘（白底）
    ├── raw/             # 参考照片素材
    ├── tray/            # macOS 托盘 template 图标
    ├── readme/          # README 展示图（图标 + 横版形态拼图）
    └── archive/         # 历史版本归档
        ├── v1_q_version/
        ├── v2_realistic_tall/
        └── v3_chibi_stand/
```

## 🛠️ 打包发布

### 本地构建

```bash
npm run dist        # Windows 便携版（本机即可）
npm run dist:mac    # macOS dmg + zip（需在 Mac 上执行）
npm run dist:all    # 三平台全量（需在 Mac 上执行）
```

产物在 `dist/` 目录：Windows 为 `兔兔.exe`（单文件便携版，约 80MB）；macOS 为 `兔兔-1.0.0-x64.dmg` / `兔兔-1.0.0-arm64.dmg`；Linux 为 `兔兔-1.0.0-x64.AppImage`。

> Windows 电脑无法直接构建 macOS 包（electron-builder 官方限制：mac 打包依赖 macOS 系统工具）。

### GitHub Actions 自动构建（推荐）

仓库已内置 `.github/workflows/build.yml`，推送 tag 或手动触发即可在云端构建全平台产物，自己电脑不用动：

```bash
git tag v1.0.0
git push origin v1.0.0
```

- `windows-latest` 打便携版 exe，`macos-latest` 打 dmg/zip（x64 + arm64），`ubuntu-latest` 打 AppImage
- 产物在 Actions 运行页面直接下载；**打 tag 时会自动生成 Release 草稿**并附上全部产物
- 也可以在 Actions 页面选 "Build" → "Run workflow" 随时手动构建

> ⚠️ CI 构建的 mac 包**未签名、未公证**，其他 Mac 首次打开需「右键 → 打开」绕过 Gatekeeper；正式分发需要 Apple Developer 账号做签名公证（拿到证书后可在 workflow 里配置 Secrets）。

## 🐛 常见问题

**打包时报 `winCodeSign` 解压失败（`Cannot create symbolic link`）**

electron-builder 需要创建符号链接来解压签名工具包，而普通 Windows 用户没有该权限。解决办法（任选其一）：

- 以**管理员身份**运行终端再执行打包；或
- 打开 设置 → 系统 → 开发者选项，开启**开发人员模式**后重试

## 技术栈

Electron 33 · 原生 JS 动画 · 无其他运行时依赖
