import { BaseVisualizer } from '../BaseVisualizer'
import type { VisualizerParams } from '../../types'
import { AudioEngine } from '../../audio/AudioEngine'
import { hexToRgbStr, logFrequencyMap, averageBins, smoothFrequencyData } from '../../utils'

export class FrequencyBars extends BaseVisualizer {
  private _gradCache = new Map<string, CanvasGradient>()
  private _lastBgColor = ''
  private _lastBgOpacity = -1

  renderFrame(engine: AudioEngine, params: VisualizerParams, _ts: number): void {
    const canvas = this.canvas
    const ctx = canvas.getContext('2d')!
    const { width: W, height: H } = canvas
    const data = engine.freqDataL
    const smoothed = smoothFrequencyData(data)
    const colorFn = this.getColorFn(params)

    ctx.fillStyle = `rgba(${hexToRgbStr(params.backgroundColor)}, ${params.backgroundOpacity})`
    ctx.fillRect(0, 0, W, H)

    const count = Math.min(data.length, params.mirrorMode ? Math.floor(W / 4) : Math.floor(W / 2))
    const barW = (W / count) * (1 - params.barSpacing * 0.05)
    const gap = (W / count) - barW
    const bgRgb = hexToRgbStr(params.backgroundColor)

    // Pre-compute tilt multipliers (avoid Math.pow in loop)
    const tiltBase = Math.pow(2, params.freqTilt)
    const tiltInvBase = 1 / tiltBase

    for (let i = 0; i < count; i++) {
      const { startBin, endBin } = logFrequencyMap(i, count, params.fftSize, 44100, params.freqDistribution)
      const value = averageBins(smoothed, startBin, endBin) / 255

      // Apply frequency tilt using pre-computed powers
      const tiltPos = i / count
      const tiltMultiplier = tiltBase * Math.pow(tiltInvBase * tiltBase, tiltPos)
      const tiltedValue = Math.min(1, value * tiltMultiplier)

      const barH = tiltedValue * H * 0.9
      const x = i * (barW + gap)

      if (barH > 1) {
        const color = colorFn(i / count)

        // Pre-glow pass: only for high values to reduce draw calls
        if (params.glowIntensity > 0 && value > 0.15) {
          ctx.globalAlpha = 0.15 + value * 0.15
          ctx.fillStyle = color
          const glowExpand = params.glowIntensity * 0.8
          ctx.fillRect(x - glowExpand, H - barH - glowExpand, barW + glowExpand * 2, barH + glowExpand * 2)
          ctx.globalAlpha = 1
        }

        // Main bar - reuse gradient or create new one
        const gradKey = `${color}_${bgRgb}`
        let grad = this._gradCache.get(gradKey)
        if (!grad) {
          grad = ctx.createLinearGradient(0, H - barH, 0, H)
          grad.addColorStop(0, color)
          grad.addColorStop(1, `rgba(${bgRgb}, 0.3)`)
          // Cache limited entries
          if (this._gradCache.size > 32) this._gradCache.clear()
          this._gradCache.set(gradKey, grad)
        }
        ctx.fillStyle = grad
        ctx.fillRect(x, H - barH, barW, barH)

        if (params.mirrorMode) {
          ctx.fillRect(W - x - barW, H - barH, barW, barH)
        }
      }
    }
  }
}
