export type VisualizerType =
  | 'frequencyBars'
  | 'radialSpectrum'
  | 'oscilloscope'
  | 'aurora'
  | 'waterfall'
  | 'lissajous'

export type RenderMode = 'canvas2d' | 'webgl'

export type ColorTheme =
  | 'neon'
  | 'fire'
  | 'ocean'
  | 'aurora'
  | 'mono'
  | 'plasma'
  | 'custom'

export interface VisualizerParams {
  fftSize: 256 | 512 | 1024 | 2048 | 4096
  smoothing: number
  sensitivity: number
  colorTheme: ColorTheme
  customColors: string[]
  backgroundColor: string
  backgroundOpacity: number
  glowIntensity: number
  mirrorMode: boolean
  rotationSpeed: number
  particleCount: number
  lineWidth: number
  barSpacing: number
  noiseIntensity: number
  radialThickness: number
  auroraLayers: number
  terrainResolution: number
  helixSegments: number
  galaxyArms: number
  freqDistribution: number
  freqTilt: number
  seamSmoothing: number
}

export interface Preset {
  id: string
  name: string
  visualizer: VisualizerType
  params: VisualizerParams
  createdAt: number
}

export type RecordingState = 'idle' | 'recording' | 'processing' | 'done'

export interface AudioState {
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  fileName: string
  isMicActive: boolean
}

// ── Render（离线渲染）配置 ──

export type RenderResolution = '1080p' | '2k' | '4k'

export type RenderBitrate = 'low' | 'medium' | 'high' | 'custom'

export interface RenderConfig {
  /** 输出分辨率 */
  resolution: RenderResolution
  /** 目标帧率 */
  fps: 30 | 60
  /** 码率档位 */
  bitratePreset: RenderBitrate
  /** 自定义码率（仅 bitratePreset === 'custom' 时使用），如 '8M' */
  customBitrate?: string
  /** 输出文件路径（Electron 原生对话框选择） */
  outputPath?: string
  /** 视频编码器 */
  codec: 'vp9'
}

export const DEFAULT_RENDER_CONFIG: RenderConfig = {
  resolution: '1080p',
  fps: 60,
  bitratePreset: 'medium',
  codec: 'vp9',
}

/** 根据码率档位返回 ffmpeg 码率字符串 */
export function getBitrateString(config: RenderConfig): string {
  switch (config.bitratePreset) {
    case 'low':    return '2M'
    case 'medium': return '4M'
    case 'high':   return '8M'
    case 'custom': return config.customBitrate || '4M'
  }
}

/** 根据分辨率返回 [width, height] */
export function getResolutionSize(resolution: RenderResolution): [number, number] {
  switch (resolution) {
    case '1080p': return [1920, 1080]
    case '2k':    return [2560, 1440]
    case '4k':    return [3840, 2160]
  }
}

export type RenderStage = 'idle' | 'preparing' | 'rendering' | 'encoding' | 'done' | 'error'

export interface RenderState {
  stage: RenderStage
  /** 总体进度 0-1 */
  progress: number
  /** 当前阶段描述 */
  stageLabel: string
  /** 错误信息 */
  error?: string
  /** 输出文件 URL */
  outputUrl?: string
}