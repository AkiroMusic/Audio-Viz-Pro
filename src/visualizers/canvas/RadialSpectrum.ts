import { BaseVisualizer } from '../BaseVisualizer'
import type { VisualizerParams } from '../../types'
import { AudioEngine } from '../../audio/AudioEngine'
import { hexToRgbStr, logFrequencyMap, averageBins, smoothFrequencyData } from '../../utils'

export class RadialSpectrum extends BaseVisualizer {
  private rotation = 0
  private _values: number[] = []
  private _blended: number[] = []

  renderFrame(engine: AudioEngine, params: VisualizerParams, _ts: number): void {
    const canvas = this.canvas
    const ctx = canvas.getContext('2d')!
    const { width: W, height: H } = canvas
    const cx = W / 2, cy = H / 2
    const data = engine.freqDataL
    const smoothed = smoothFrequencyData(data)
    const colorFn = this.getColorFn(params)
    const minSide = Math.min(W, H)
    const innerR = minSide * 0.2
    const maxR = minSide * 0.48

    ctx.fillStyle = `rgba(${hexToRgbStr(params.backgroundColor)}, ${params.backgroundOpacity})`
    ctx.fillRect(0, 0, W, H)

    this.rotation += params.rotationSpeed * 0.005
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(this.rotation)

    const count = Math.min(data.length, 256)
    const blendCount = Math.max(1, Math.round(count * params.seamSmoothing * 0.3))

    // Reuse arrays to avoid per-frame allocation
    if (this._values.length < count) {
      this._values = new Array(count)
      this._blended = new Array(count)
    }

    // Pre-compute tilt base (avoid Math.pow in loop)
    const tiltBase = Math.pow(2, params.freqTilt)
    const tiltInvBase = 1 / tiltBase

    // First pass: compute all bar values with frequency tilt
    for (let i = 0; i < count; i++) {
      const { startBin, endBin } = logFrequencyMap(i, count, data.length * 2, 44100, params.freqDistribution)
      let value = averageBins(smoothed, startBin, endBin) / 255
      const tiltPos = i / count
      const tiltMultiplier = tiltBase * Math.pow(tiltInvBase * tiltBase, tiltPos)
      value = Math.min(1, value * tiltMultiplier)
      this._values[i] = value
    }

    // Blend heights at the seam using smoothstep
    this._blended.length = count
    for (let i = 0; i < count; i++) this._blended[i] = this._values[i]

    for (let i = 0; i < blendCount; i++) {
      const opposite = count - 1 - i
      const t = 1 - i / blendCount
      const smooth = t * t * (3 - 2 * t)
      const weight = smooth * 0.35
      this._blended[i] = this._values[i] * (1 - weight) + this._values[opposite] * weight
      this._blended[opposite] = this._values[opposite] * (1 - weight) + this._values[i] * weight
    }

    // Second pass: render bars using blended values and cyclic colors
    // Batch by color to reduce state changes
    let lastColor = ''
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const value = this._blended[i]
      const barLen = value * (maxR - innerR)
      const color = colorFn(i / count)
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)

      if (barLen > 0.5) {
        // Only change strokeStyle when color changes
        if (color !== lastColor) {
          ctx.strokeStyle = color
          lastColor = color
        }

        // Glow: only for prominent values to reduce draw calls
        if (params.glowIntensity > 0 && value > 0.2) {
          ctx.globalAlpha = 0.2 + value * 0.2
          ctx.lineWidth = params.radialThickness + params.glowIntensity * 0.5
          ctx.beginPath()
          ctx.moveTo(cos * innerR, sin * innerR)
          ctx.lineTo(cos * (innerR + barLen), sin * (innerR + barLen))
          ctx.stroke()
          if (params.mirrorMode) {
            ctx.beginPath()
            ctx.moveTo(cos * innerR, -sin * innerR)
            ctx.lineTo(cos * (innerR + barLen), -sin * (innerR + barLen))
            ctx.stroke()
          }
          ctx.globalAlpha = 1
        }

        ctx.lineWidth = params.radialThickness
        ctx.beginPath()
        ctx.moveTo(cos * innerR, sin * innerR)
        ctx.lineTo(cos * (innerR + barLen), sin * (innerR + barLen))
        ctx.stroke()

        if (params.mirrorMode) {
          ctx.beginPath()
          ctx.moveTo(cos * innerR, -sin * innerR)
          ctx.lineTo(cos * (innerR + barLen), -sin * (innerR + barLen))
          ctx.stroke()
        }
      }
    }
    ctx.restore()
  }
}
