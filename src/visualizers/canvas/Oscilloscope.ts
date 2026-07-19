import { BaseVisualizer } from '../BaseVisualizer'
import type { VisualizerParams } from '../../types'
import { AudioEngine } from '../../audio/AudioEngine'
import { hexToRgbStr } from '../../utils'

export class Oscilloscope extends BaseVisualizer {
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

    // 绘制网格线（复古风格）
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.2)'
    ctx.lineWidth = 1
    for (let i = 0; i < 10; i++) {
      const y = (H / 10) * i
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(W, y)
      ctx.stroke()
    }
    for (let i = 0; i < 10; i++) {
      const x = (W / 10) * i
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, H)
      ctx.stroke()
    }

    const amplitude = H * 0.35
    const centerY = H / 2

    // 绘制左声道波形
    ctx.beginPath()
    ctx.strokeStyle = colorFn(0.2)
    ctx.lineWidth = params.lineWidth
    this.applyGlow(ctx, colorFn(0.2), params.glowIntensity)
    
    for (let i = 0; i < timeDataL.length; i++) {
      const x = (i / timeDataL.length) * W
      const y = centerY + timeDataL[i] * amplitude
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    this.clearGlow(ctx)

    // 绘制右声道波形（如果有立体声数据）
    if (engine.timeDataR.length > 0) {
      ctx.beginPath()
      ctx.strokeStyle = colorFn(0.6)
      ctx.lineWidth = params.lineWidth
      this.applyGlow(ctx, colorFn(0.6), params.glowIntensity * 0.7)
      
      for (let i = 0; i < timeDataR.length; i++) {
        const x = (i / timeDataR.length) * W
        const y = centerY + timeDataR[i] * amplitude * 0.8
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      this.clearGlow(ctx)
    }
  }
}