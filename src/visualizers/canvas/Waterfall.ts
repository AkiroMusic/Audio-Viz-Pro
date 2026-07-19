import { BaseVisualizer } from '../BaseVisualizer'
import type { VisualizerParams } from '../../types'
import { AudioEngine } from '../../audio/AudioEngine'
import { hexToRgbStr, logFrequencyMap, averageBins } from '../../utils'

export class Waterfall extends BaseVisualizer {
  private buffer: HTMLCanvasElement | null = null
  private bufferCtx: CanvasRenderingContext2D | null = null
  private lastW = 0
  private lastH = 0
  private _colorCache = new Map<number, [number, number, number]>()
  private _lastColorFn: ((t: number) => string) | null = null
  private _topGrad: CanvasGradient | null = null
  private _vignetteGrad: CanvasGradient | null = null
  private _blurCounter = 0

  renderFrame(engine: AudioEngine, params: VisualizerParams, _ts: number): void {
    const canvas = this.canvas
    const ctx = canvas.getContext('2d')!
    const { width: W, height: H } = canvas
    const data = engine.freqDataL
    const colorFn = this.getColorFn(params)

    // Clear color cache if color function changed
    if (colorFn !== this._lastColorFn) {
      this._colorCache.clear()
      this._lastColorFn = colorFn
    }

    const safeW = Math.max(1, Math.floor(W))
    const safeH = Math.max(1, Math.floor(H))

    if (!this.buffer || this.lastW !== safeW || this.lastH !== safeH) {
      this.buffer = document.createElement('canvas')
      this.buffer.width = safeW
      this.buffer.height = safeH
      this.bufferCtx = this.buffer.getContext('2d')!
      this.lastW = safeW
      this.lastH = safeH
      this._topGrad = null
      this._vignetteGrad = null
    }

    const bufCtx = this.bufferCtx
    if (!bufCtx) return

    // Shift existing content down by 5 rows
    const existing = bufCtx.getImageData(0, 0, safeW, safeH - 5)
    bufCtx.putImageData(existing, 0, 5)
    bufCtx.clearRect(0, 0, safeW, 5)

    // Write new frequency row at top with enhanced contrast
    const newRow = bufCtx.createImageData(safeW, 1)
    const pixels = newRow.data

    for (let x = 0; x < safeW; x++) {
      const { startBin, endBin } = logFrequencyMap(x, safeW, params.fftSize, 44100, params.freqDistribution)
      const rawValue = averageBins(data, startBin, endBin) / 255
      // Non-linear contrast: boost brights, crush darks
      const value = Math.pow(rawValue, 0.7)

      // Use cached color to avoid regex parsing
      const cacheKey = Math.round(value * 255)
      let rgb = this._colorCache.get(cacheKey)
      if (!rgb) {
        const match = colorFn(value).match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
        rgb = match
          ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])]
          : [50, 50, 50]
        // Limit cache size
        if (this._colorCache.size > 256) this._colorCache.clear()
        this._colorCache.set(cacheKey, rgb)
      }

      const offset = x * 4
      pixels[offset] = rgb[0]
      pixels[offset + 1] = rgb[1]
      pixels[offset + 2] = rgb[2]
      pixels[offset + 3] = 255
    }

    bufCtx.putImageData(newRow, 0, 0)

    // Draw buffer to main canvas
    ctx.clearRect(0, 0, safeW, safeH)
    ctx.drawImage(this.buffer, 0, 0)

    // ── Glow pass: only every 2nd frame to reduce blur cost ──
    this._blurCounter++
    if (this._blurCounter % 2 === 0) {
      ctx.globalCompositeOperation = 'lighter'
      ctx.filter = 'blur(3px)'
      ctx.globalAlpha = 0.25
      ctx.drawImage(this.buffer, 0, 0)
      ctx.filter = 'none'
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
    }

    // ── Highlight the top row (newest data) ──
    if (!this._topGrad) {
      this._topGrad = ctx.createLinearGradient(0, 0, 0, 12)
      this._topGrad.addColorStop(0, 'rgba(255, 255, 255, 0.15)')
      this._topGrad.addColorStop(1, 'rgba(255, 255, 255, 0)')
    }
    ctx.fillStyle = this._topGrad
    ctx.fillRect(0, 0, safeW, 12)

    // ── Subtle vignette ──
    if (!this._vignetteGrad) {
      this._vignetteGrad = ctx.createRadialGradient(safeW / 2, safeH / 2, safeW * 0.3, safeW / 2, safeH / 2, safeW * 0.8)
      this._vignetteGrad.addColorStop(0, 'rgba(0,0,0,0)')
      this._vignetteGrad.addColorStop(1, 'rgba(0,0,0,0.35)')
    }
    ctx.fillStyle = this._vignetteGrad
    ctx.fillRect(0, 0, safeW, safeH)

    // ── Grid lines (horizontal time markers) ──
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
    ctx.lineWidth = 1
    for (let i = 1; i < 10; i++) {
      const y = (safeH / 10) * i
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(safeW, y)
      ctx.stroke()
    }
    // Vertical frequency reference lines
    const freqLines = [0.1, 0.25, 0.5, 0.75]
    for (const pos of freqLines) {
      const x = safeW * pos
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, safeH)
      ctx.stroke()
    }

    // ── Frequency labels ──
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.font = '10px monospace'
    ctx.textAlign = 'left'

    const frequencies = [
      { label: '20Hz', pos: 0.02 },
      { label: '100Hz', pos: 0.1 },
      { label: '1kHz', pos: 0.25 },
      { label: '10kHz', pos: 0.6 },
    ]

    for (const freq of frequencies) {
      const y = safeH * freq.pos
      ctx.fillText(freq.label, 8, y + 3)
      ctx.beginPath()
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
      ctx.moveTo(0, y)
      ctx.lineTo(50, y)
      ctx.stroke()
    }
  }

  protected cleanup(): void {
    this.buffer = null
    this.bufferCtx = null
    this._colorCache.clear()
    this._topGrad = null
    this._vignetteGrad = null
  }
}
