import { BaseVisualizer } from '../BaseVisualizer'
import type { VisualizerParams } from '../../types'
import { AudioEngine } from '../../audio/AudioEngine'
import { hexToRgbStr } from '../../utils'

export class Lissajous extends BaseVisualizer {
  renderFrame(engine: AudioEngine, params: VisualizerParams, _ts: number): void {
    const canvas = this.canvas
    const ctx = canvas.getContext('2d')!
    const { width: W, height: H } = canvas
    const timeDataL = engine.timeDataL
    const timeDataR = engine.timeDataR
    const colorFn = this.getColorFn(params)

    // 背景
    ctx.fillStyle = `rgba(${hexToRgbStr(params.backgroundColor)}, ${params.backgroundOpacity})`
    ctx.fillRect(0, 0, W, H)

    const cx = W / 2
    const cy = H / 2
    const amplitude = Math.min(W, H) * 0.4

    // 绘制中心十字线
    ctx.beginPath()
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)'
    ctx.lineWidth = 1
    ctx.moveTo(cx - amplitude, cy)
    ctx.lineTo(cx + amplitude, cy)
    ctx.moveTo(cx, cy - amplitude)
    ctx.lineTo(cx, cy + amplitude)
    ctx.stroke()

    // 绘制李萨如图形
    ctx.beginPath()
    ctx.lineWidth = params.lineWidth

    for (let i = 0; i < timeDataL.length; i++) {
      const x = cx + timeDataL[i] * amplitude
      const y = cy + timeDataR[i] * amplitude
      const color = colorFn(i / timeDataL.length)

      if (i === 0) {
        ctx.moveTo(x, y)
        ctx.strokeStyle = color
      } else {
        ctx.lineTo(x, y)
      }
    }

    // 使用渐变描边
    const grad = ctx.createLinearGradient(cx - amplitude, cy, cx + amplitude, cy)
    for (let i = 0; i <= 10; i++) {
      grad.addColorStop(i / 10, colorFn(i / 10))
    }
    ctx.strokeStyle = grad
    this.applyGlow(ctx, colorFn(0.5), params.glowIntensity)
    ctx.stroke()
    this.clearGlow(ctx)

    // 绘制点
    ctx.beginPath()
    for (let i = 0; i < timeDataL.length; i++) {
      const x = cx + timeDataL[i] * amplitude
      const y = cy + timeDataR[i] * amplitude
      ctx.moveTo(x + 2, y)
      ctx.arc(x, y, 2, 0, Math.PI * 2)
    }
    ctx.fillStyle = colorFn(0.7)
    ctx.fill()
  }
}