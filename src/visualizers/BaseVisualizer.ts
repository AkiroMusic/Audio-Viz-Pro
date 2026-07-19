import type { VisualizerParams } from '../types'
import { COLOR_THEMES } from '../constants'
import { AudioEngine } from '../audio/AudioEngine'

/**
 * 离线渲染管线 & 实时渲染共用的最小接口。
 * 只暴露可视化需要的公开属性/方法，让 MockAudioEngine 可结构兼容。
 */
export interface AudioEngineProvider {
  freqDataL: Uint8Array
  freqDataR: Uint8Array
  timeDataL: Float32Array
  timeDataR: Float32Array
  applyParams(params: VisualizerParams): void
  update(sensitivity: number): void
  getEnergy(): number
}

export abstract class BaseVisualizer {
  protected canvas: HTMLCanvasElement
  protected animFrameId: number = 0
  protected isRunning = false
  protected currentParams: VisualizerParams | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  // 子类必须实现：每帧渲染逻辑
  protected abstract renderFrame(
    engine: AudioEngineProvider,
    params: VisualizerParams,
    timestamp: number
  ): void

  // 外部更新参数引用（让滑块调节实时生效）
  setParams(params: VisualizerParams): void {
    this.currentParams = params
  }

  // 启动渲染循环
  start(engine: AudioEngine, params: VisualizerParams): void {
    this.currentParams = params
    this.isRunning = true
    const loop = (ts: number) => {
      if (!this.isRunning) return
      const p = this.currentParams
      if (!p) return
      engine.applyParams(p)
      engine.update(p.sensitivity)
      this.renderFrame(engine, p, ts)
      this.animFrameId = requestAnimationFrame(loop)
    }
    this.animFrameId = requestAnimationFrame(loop)
  }

  // 停止并清理
  stop(): void {
    this.isRunning = false
    cancelAnimationFrame(this.animFrameId)
    this.cleanup()
  }

  /**
   * 单帧渲染（用于离线渲染管线，绕开 rAF 循环）
   * 直接调用子类的 renderFrame 实现
   */
  renderOneFrame(engine: AudioEngineProvider, params: VisualizerParams, timestamp: number): void {
    this.renderFrame(engine, params, timestamp)
  }

  // 子类可重写：释放 WebGL 资源等
  protected cleanup(): void {}

  // 子类可重写：处理窗口大小变化
  onResize(width: number, height: number): void {
    this.canvas.width = width * window.devicePixelRatio
    this.canvas.height = height * window.devicePixelRatio
    this.canvas.style.width = width + 'px'
    this.canvas.style.height = height + 'px'
  }

  // 工具：获取颜色函数
  protected getColorFn(params: VisualizerParams): (t: number) => string {
    if (params.colorTheme === 'custom') {
      // 自定义颜色：在 3 个自定义颜色间插值
      const colors = params.customColors
      return (t: number) => {
        const n = colors.length - 1
        const i = Math.min(Math.floor(t * n), n - 1)
        const f = t * n - i
        // 解析 hex 并插值
        const c0 = hexToRgb(colors[i])
        const c1 = hexToRgb(colors[i + 1])
        const r = Math.round(c0[0] + (c1[0] - c0[0]) * f)
        const g = Math.round(c0[1] + (c1[1] - c0[1]) * f)
        const b = Math.round(c0[2] + (c1[2] - c0[2]) * f)
        return `rgb(${r},${g},${b})`
      }
    }
    return COLOR_THEMES[params.colorTheme]
  }

  // 工具：绘制发光效果（使用阴影，外部调用后需 clearGlow）
  protected applyGlow(ctx: CanvasRenderingContext2D, color: string, intensity: number): void {
    if (intensity <= 0) return
    ctx.shadowColor = color
    ctx.shadowBlur = Math.min(intensity * 3, 40)
  }

  protected clearGlow(ctx: CanvasRenderingContext2D): void {
    ctx.shadowBlur = 0
    ctx.shadowColor = 'transparent'
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}