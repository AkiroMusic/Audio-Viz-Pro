# AudioViz Pro

A powerful audio visualization desktop application built with React, TypeScript, and Electron. Features 10 stunning visualizer effects, real-time audio analysis, deep customization, preset system, and video/GIF/screenshot export.

一款使用 React、TypeScript 和 Electron 构建的强大音频可视化桌面应用。包含 10 种惊艳的可视化效果、实时音频分析、深度定制、预设系统，以及视频 / GIF / 截图导出功能。

[English](#english) | [中文](#中文)

---

## Features

## 功能特性

- **Audio Input** — Local file upload (drag & drop or click) + live microphone input
- **音频输入** — 本地文件上传（拖拽或点击）+ 麦克风实时输入
- **10 Visualizer Effects** — 6 Canvas 2D + 4 WebGL (Three.js), seamless runtime switching
- **10 种可视化效果** — 6 种 Canvas 2D + 4 种 WebGL (Three.js)，运行时无缝切换
- **Deep Customization** — 20+ adjustable parameters: color themes, speed, sensitivity, FFT size, effects
- **高度定制化** — 20+ 项可调参数：颜色主题、速度、灵敏度、FFT 大小、特效参数
- **Preset System** — Save / load / delete custom presets, 7 built-in presets included
- **预设系统** — 保存 / 加载 / 删除自定义预设，内置 7 个预设
- **Video Export** — Record visualizations as WebM video with audio (via FFmpeg)
- **视频导出** — 录制可视化为 WebM 视频（含音频，通过 FFmpeg 编码）
- **GIF Export** — Record short animated GIFs with gif.js
- **GIF 导出** — 录制短动画 GIF（gif.js 编码）
- **Screenshot** — One-click PNG capture
- **截图** — 一键 PNG 截图
- **Bilingual UI** — English / Chinese language switching
- **双语界面** — 中文 / 英文语言切换
- **Global Shortcuts** — Keyboard controls for playback, switching, capture, and more
- **全局快捷键** — 键盘控制播放、切换、截图等

### Visualizer Effects

### 可视化效果

#### Canvas 2D (6)

#### Canvas 2D（6 种）

| Effect | Description |
|--------|-------------|
| Frequency Bars | Classic frequency bar chart with glow, mirror mode |
| Radial Spectrum | Circular radial frequency display with rotation |
| Oscilloscope | Real-time waveform with retro grid, dual-channel |
| Aurora | Flowing aurora bands with multi-layer Bezier curves |
| Waterfall | Scrolling spectrogram heatmap with frequency labels |
| Lissajous | Left/right channel XY waveform with gradient stroke |

| 效果 | 描述 |
|------|------|
| 频率条形图 | 经典频率条形图，支持发光效果和镜像模式 |
| 辐射光谱 | 圆形放射状频率图，带旋转动画 |
| 波形示波器 | 实时波形显示，复古风格网格，双声道 |
| 极光 | 流动极光带，多层贝塞尔曲线 |
| 频谱瀑布 | 滚动频谱热力图，带频率刻度标注 |
| 李萨如 | 左右声道 XY 波形图，渐变描边 |

#### WebGL (4, Three.js)

#### WebGL（4 种，Three.js）

| Effect | Description |
|--------|-------------|
| Particle Storm | Audio-driven 3D particle system with lifecycle |
| Frequency Terrain | Frequency data terrain mesh with dynamic lighting |
| DNA Helix | Double helix structure with CatmullRomCurve3 path |
| Galaxy Spiral | Logarithmic spiral galaxy with core particles |

| 效果 | 描述 |
|------|------|
| 粒子风暴 | 音频驱动的 3D 粒子系统，带生命周期 |
| 3D 地形 | 频率数据地形网格，动态光照 |
| DNA 螺旋 | 双螺旋结构，CatmullRomCurve3 路径 |
| 星系螺旋 | 对数螺旋星系，核心粒子系统 |

### Tech Stack

### 技术栈

| Technology | Version |
|------------|---------|
| React | 18.3.x |
| TypeScript | 6.0.x |
| Vite | 8.0.x |
| Electron | 43.x |
| Three.js | 0.184.x |
| Tailwind CSS | 3.4.x |
| Zustand | 4.5.x |
| gif.js | 0.2.0 |
| ffmpeg-static | 5.3.x |

| 技术 | 版本 |
|------|------|
| React | 18.3.x |
| TypeScript | 6.0.x |
| Vite | 8.0.x |
| Electron | 43.x |
| Three.js | 0.184.x |
| Tailwind CSS | 3.4.x |
| Zustand | 4.5.x |
| gif.js | 0.2.0 |
| ffmpeg-static | 5.3.x |

### Getting Started

### 快速开始

```bash
# Install dependencies
npm install

# Start development server (browser)
npm run dev

# Start Electron dev mode
npm run dev:electron

# Build for production
npm run build

# Build Electron desktop app
npm run build:electron
```

### Keyboard Shortcuts

### 快捷键

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `Left` / `Right` | Seek backward / forward 5s |
| `Up` / `Down` | Volume up / down |
| `A` / `D` | Previous / Next visualizer |
| `C` | Cycle color theme |
| `R` | Random color |
| `M` | Toggle mirror mode |
| `F` | Toggle fullscreen |
| `S` | Screenshot |
| `Esc` | Close panels |

| 按键 | 功能 |
|------|------|
| `Space` | 播放 / 暂停 |
| `Left` / `Right` | 快退 / 快进 5 秒 |
| `Up` / `Down` | 增大 / 减小音量 |
| `A` / `D` | 上一个 / 下一个可视化 |
| `C` | 循环切换颜色主题 |
| `R` | 随机颜色 |
| `M` | 开关镜像模式 |
| `F` | 全屏切换 |
| `S` | 截图 |
| `Esc` | 关闭面板 |

### Export

### 导出功能

| Type | Format | Method |
|------|--------|--------|
| Screenshot | PNG | canvas.toBlob() |
| Video | WebM (VP9) | canvas.captureStream + MediaRecorder + FFmpeg |
| GIF | GIF | gif.js encoding, 3/5/10s, 10/15/20 fps |

| 类型 | 格式 | 实现方式 |
|------|------|----------|
| 截图 | PNG | canvas.toBlob() |
| 视频 | WebM (VP9) | canvas.captureStream + MediaRecorder + FFmpeg |
| GIF | GIF | gif.js 编码，3/5/10 秒，10/15/20 fps |

### Project Structure

### 项目结构

```
audio-viz-pro/
├── electron/              # Electron main process
│   ├── main.ts            # Main process entry
│   ├── preload.ts         # Context bridge API
│   └── ffmpeg-bridge.ts   # FFmpeg native bridge
├── src/
│   ├── audio/             # Web Audio API engine
│   ├── visualizers/       # 10 visualizer implementations
│   │   ├── canvas/        # 6 Canvas 2D visualizers
│   │   └── webgl/         # 4 WebGL (Three.js) visualizers
│   ├── export/            # Video/GIF/image export
│   ├── components/        # React UI components
│   ├── store/             # Zustand state management
│   ├── hooks/             # Custom React hooks
│   ├── locales/           # i18n translations
│   ├── types/             # TypeScript type definitions
│   ├── constants.ts       # Visualizer list, themes, defaults
│   └── utils.ts           # Utility functions
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

### License

### 许可证

MIT

MIT 许可证
