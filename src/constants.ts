import type { VisualizerType, VisualizerParams, ColorTheme, Preset } from './types'

export interface VisualizerMeta {
  id: VisualizerType
  name: string
  description: string
  icon: string          // emoji 图标
  renderMode: 'canvas2d' | 'webgl'
  isNew?: boolean
}

export const VISUALIZER_LIST: VisualizerMeta[] = [
  { id: 'frequencyBars',   name: '频率条形',   description: '经典频率条形图，支持发光效果',   icon: 'bars', renderMode: 'canvas2d' },
  { id: 'radialSpectrum',  name: '辐射光谱',   description: '圆形放射状频率图',               icon: 'radial', renderMode: 'canvas2d' },
  { id: 'oscilloscope',    name: '波形示波器', description: '实时波形显示，复古风格',          icon: 'wave', renderMode: 'canvas2d' },
  { id: 'aurora',          name: '极光',       description: '流动的极光带，随音频起伏',        icon: 'aurora', renderMode: 'canvas2d' },
  { id: 'waterfall',       name: '频谱瀑布',   description: '滚动频谱图，时间维度展示',        icon: 'waterfall', renderMode: 'canvas2d' },
  { id: 'lissajous',       name: '李萨如',     description: '左右声道 XY 波形图',            icon: 'lissajous', renderMode: 'canvas2d' },
]

// 颜色主题色值表（每个主题首尾颜色相同，确保 t=0 与 t=1 无缝衔接）
export const COLOR_THEMES: Record<ColorTheme, (t: number) => string> = {
  neon: (t) => {
    const colors = [[124, 58, 237], [0, 200, 255], [255, 0, 200], [124, 58, 237]]
    return interpolateColor(colors, t)
  },
  fire: (t) => {
    const colors = [[220, 20, 10], [255, 120, 0], [255, 220, 0], [220, 20, 10]]
    return interpolateColor(colors, t)
  },
  ocean: (t) => {
    const colors = [[0, 30, 100], [0, 170, 200], [0, 220, 150], [0, 30, 100]]
    return interpolateColor(colors, t)
  },
  aurora: (t) => {
    const colors = [[0, 200, 100], [0, 100, 220], [150, 0, 255], [0, 200, 100]]
    return interpolateColor(colors, t)
  },
  mono: (t) => {
    const v = Math.round(t * 255)
    return `rgb(${v},${v},${v})`
  },
  plasma: (t) => {
    const colors = [[100, 0, 200], [255, 0, 120], [255, 230, 0], [100, 0, 200]]
    return interpolateColor(colors, t)
  },
  custom: (t) => `hsl(${t * 360}, 80%, 60%)`, // 默认自定义（之后被动态替换）
}

function interpolateColor(colors: number[][], t: number): string {
  const n = colors.length - 1
  const i = Math.min(Math.floor(t * n), n - 1)
  const f = t * n - i
  const c0 = colors[i], c1 = colors[i + 1]
  const r = Math.round(c0[0] + (c1[0] - c0[0]) * f)
  const g = Math.round(c0[1] + (c1[1] - c0[1]) * f)
  const b = Math.round(c0[2] + (c1[2] - c0[2]) * f)
  return `rgb(${r},${g},${b})`
}

export const DEFAULT_PARAMS: VisualizerParams = {
  fftSize: 1024,
  smoothing: 0.8,
  sensitivity: 1.0,
  colorTheme: 'neon',
  customColors: ['#7c3aed', '#00c8ff', '#ff00c8'],
  backgroundColor: '#0a0a0f',
  backgroundOpacity: 0.15,
  glowIntensity: 6,
  mirrorMode: false,
  rotationSpeed: 0.3,
  particleCount: 3000,
  lineWidth: 2,
  barSpacing: 1,
  noiseIntensity: 1.0,
  radialThickness: 2,
  auroraLayers: 5,
  terrainResolution: 64,
  helixSegments: 50,
  galaxyArms: 4,
  freqDistribution: 1.0,
  freqTilt: 0,
  seamSmoothing: 0.3,
}

// 内置预设
export const BUILTIN_PRESETS: Preset[] = [
  {
    id: 'neon-bars',
    name: '霓虹条形',
    visualizer: 'frequencyBars',
    params: { ...DEFAULT_PARAMS, colorTheme: 'neon', glowIntensity: 8, backgroundOpacity: 0.1 },
    createdAt: 0,
  },
  {
    id: 'fire-radial',
    name: '火焰光谱',
    visualizer: 'radialSpectrum',
    params: { ...DEFAULT_PARAMS, colorTheme: 'fire', rotationSpeed: 0.5, glowIntensity: 10 },
    createdAt: 0,
  },
  {
    id: 'galaxy-chill',
    name: '星系漫游',
    visualizer: 'frequencyBars',
    params: { ...DEFAULT_PARAMS, colorTheme: 'aurora', rotationSpeed: 0.2, particleCount: 8000 },
    createdAt: 0,
  },
  {
    id: 'dna-plasma',
    name: 'DNA 等离子',
    visualizer: 'frequencyBars',
    params: { ...DEFAULT_PARAMS, colorTheme: 'plasma', rotationSpeed: 1.0, glowIntensity: 7 },
    createdAt: 0,
  },
  {
    id: 'retro-scope',
    name: '复古示波器',
    visualizer: 'oscilloscope',
    params: { ...DEFAULT_PARAMS, colorTheme: 'mono', lineWidth: 1, glowIntensity: 6, backgroundOpacity: 0.05 },
    createdAt: 0,
  },
  {
    id: 'ocean-aurora',
    name: '海洋极光',
    visualizer: 'aurora',
    params: { ...DEFAULT_PARAMS, colorTheme: 'aurora', auroraLayers: 8, glowIntensity: 10, backgroundOpacity: 0.05, sensitivity: 1.5 },
    createdAt: 0,
  },
  {
    id: 'fire-lissajous',
    name: '火焰李萨如',
    visualizer: 'lissajous',
    params: { ...DEFAULT_PARAMS, colorTheme: 'fire', lineWidth: 3, glowIntensity: 8, backgroundOpacity: 0.05 },
    createdAt: 0,
  },
]

// 快捷键说明
export const KEYBOARD_SHORTCUTS = [
  { key: 'Space', desc: '播放/暂停' },
  { key: '← →', desc: '快退/快进 5 秒' },
  { key: '↑ ↓', desc: '增大/减小音量' },
  { key: 'A / D', desc: '上一个 / 下一个可视化' },
  { key: 'C', desc: '切换颜色主题' },
  { key: 'R', desc: '随机颜色' },
  { key: 'M', desc: '开关镜像模式' },
  { key: 'F', desc: '全屏切换' },
  { key: 'S', desc: '截图' },
  { key: 'Escape', desc: '关闭面板' },
]