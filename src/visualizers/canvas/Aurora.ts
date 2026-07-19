import { BaseVisualizer } from '../BaseVisualizer'
import type { VisualizerParams } from '../../types'
import { AudioEngine } from '../../audio/AudioEngine'
import { hexToRgbStr } from '../../utils'

/* ── Internal types ─────────────────────────────────────────────────────── */

interface AuroraBand {
  points: { x: number; y: number; vy: number; baseY: number }[]
  alpha: number
  freqStart: number
  freqEnd: number
  phaseOffset: number
  speed: number
}

interface AuroraParticle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  bandIndex: number
  size: number
  prevPositions: { x: number; y: number }[]
}

interface CurtainRay {
  x: number
  baseY: number
  length: number
  alpha: number
  life: number
  maxLife: number
  color: string
}

interface Star {
  x: number
  y: number
  size: number
  brightness: number
  twinkleSpeed: number
}

/* ── Helpers ────────────────────────────────────────────────────────────── */

interface RGB { r: number; g: number; b: number }

/** Parse an 'rgb(r,g,b)' string into an RGB object. */
function parseRgb(str: string): RGB {
  const m = str.match(/(\d+)/g)
  return { r: Number(m?.[0] ?? 0), g: Number(m?.[1] ?? 0), b: Number(m?.[2] ?? 0) }
}

/** Shift hue slightly and scale brightness.  hueShift ∈ [-30..30], bright ∈ [0..2]. */
function shiftColor(c: RGB, hueShift: number, bright: number): RGB {
  // Minimal HSV-like shift: move R/G/B channels in opposite directions
  const r2 = Math.min(255, Math.max(0, c.r * bright + hueShift * 0.6))
  const g2 = Math.min(255, Math.max(0, c.g * bright))
  const b2 = Math.min(255, Math.max(0, c.b * bright - hueShift * 0.5))
  return { r: Math.round(r2), g: Math.round(g2), b: Math.round(b2) }
}

function rgbStr(c: RGB): string {
  return `rgb(${c.r},${c.g},${c.b})`
}

function rgbaStr(c: RGB, a: number): string {
  return `rgba(${c.r},${c.g},${c.b},${a})`
}

function brighten(c: RGB, factor: number): RGB {
  return {
    r: Math.min(255, Math.round(c.r * factor)),
    g: Math.min(255, Math.round(c.g * factor)),
    b: Math.min(255, Math.round(c.b * factor)),
  }
}

/* ── Main visualizer ────────────────────────────────────────────────────── */

export class Aurora extends BaseVisualizer {
  private bands: AuroraBand[] = []
  private particles: AuroraParticle[] = []
  private curtainRays: CurtainRay[] = []
  private stars: Star[] = []
  private initialized = false
  private currentLayers = 5
  private time = 0
  private energyHistory: number[] = []
  private beatThreshold = 1.3
  private lastBeatTime = 0
  private beatIntensity = 0

  /* ── Initialisation ─────────────────────────────────────────────────── */

  private initStars(W: number, H: number): void {
    this.stars = []
    const count = Math.floor((W * H) / 3000)
    for (let i = 0; i < count; i++) {
      this.stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        size: 0.5 + Math.random() * 1.5,
        brightness: 0.3 + Math.random() * 0.7,
        twinkleSpeed: 0.5 + Math.random() * 2,
      })
    }
  }

  private initBands(W: number, H: number, layerCount: number): void {
    this.bands = []
    this.particles = []
    this.curtainRays = []
    this.currentLayers = layerCount
    this.initStars(W, H)

    const pointsPerBand = 36

    for (let b = 0; b < layerCount; b++) {
      const points: AuroraBand['points'] = []
      const baseY = H * 0.3 + b * H * 0.06

      for (let i = 0; i < pointsPerBand; i++) {
        const x = (i / (pointsPerBand - 1)) * W
        const wave =
          Math.sin(i * 0.4 + b * 0.8) * 25 +
          Math.sin(i * 0.15 + b * 1.2) * 12
        points.push({ x, y: baseY + wave, vy: 0, baseY: baseY + wave })
      }

      this.bands.push({
        points,
        alpha: Math.max(0.08, 0.35 - b * 0.025),
        freqStart: Math.floor((b / layerCount) * 150),
        freqEnd: Math.floor(((b + 1) / layerCount) * 150),
        phaseOffset: b * 1.7 + Math.random() * 0.5,
        speed: 0.8 + Math.random() * 0.6,
      })
    }
  }

  /* ── Perlin-like wave function (3 overlapping sines) ────────────────── */

  private wave(
    phase: number,
    time: number,
    speed: number,
    amplitude: number,
  ): number {
    return (
      Math.sin(phase + time * speed) * amplitude +
      Math.sin(phase * 2.3 + time * speed * 0.7) * amplitude * 0.4 +
      Math.sin(phase * 0.7 + time * speed * 1.3) * amplitude * 0.2
    )
  }

  /* ── Build a smooth quadratic curve path through points ─────────────── */

  private buildCurvePath(
    target: CanvasRenderingContext2D | Path2D,
    points: { x: number; y: number }[],
  ): void {
    target.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2
      const yc = (points[i].y + points[i + 1].y) / 2
      target.quadraticCurveTo(points[i].x, points[i].y, xc, yc)
    }
    target.lineTo(
      points[points.length - 1].x,
      points[points.length - 1].y,
    )
  }

  /* ── Main render loop ───────────────────────────────────────────────── */

  private detectBeat(energy: number): boolean {
    this.energyHistory.push(energy)
    if (this.energyHistory.length > 30) this.energyHistory.shift()

    const avg = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length
    const now = performance.now()

    if (energy > avg * this.beatThreshold && now - this.lastBeatTime > 200) {
      this.lastBeatTime = now
      this.beatIntensity = 1.0
      return true
    }
    return false
  }

  renderFrame(engine: AudioEngine, params: VisualizerParams, _ts: number): void {
    const canvas = this.canvas
    const ctx = canvas.getContext('2d')!
    const { width: W, height: H } = canvas
    const data = engine.freqDataL
    const colorFn = this.getColorFn(params)

    // Re-init when layer count changes
    if (
      !this.initialized ||
      this.bands.length === 0 ||
      this.currentLayers !== params.auroraLayers
    ) {
      this.initBands(W, H, params.auroraLayers)
      this.initialized = true
    }

    this.time += 0.016

    // ── 1. Clear with semi-transparent background ──────────────────────
    ctx.fillStyle = `rgba(${hexToRgbStr(params.backgroundColor)}, ${params.backgroundOpacity})`
    ctx.fillRect(0, 0, W, H)

    // ── Draw stars ────────────────────────────────────────────────────
    for (const star of this.stars) {
      const twinkle = 0.5 + 0.5 * Math.sin(this.time * star.twinkleSpeed + star.x)
      const alpha = star.brightness * twinkle * 0.8
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
      ctx.beginPath()
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
      ctx.fill()
    }

    // ── 2. Calculate per-band energy ───────────────────────────────────
    const energies: number[] = []
    for (let b = 0; b < this.bands.length; b++) {
      const band = this.bands[b]
      let sum = 0
      for (let i = band.freqStart; i < band.freqEnd && i < data.length; i++) {
        sum += data[i]
      }
      energies.push(sum / Math.max(1, (band.freqEnd - band.freqStart) * 255))
    }

    // Detect beat from overall energy
    const overallEnergy = energies.reduce((a, b) => a + b, 0) / energies.length
    this.detectBeat(overallEnergy)
    this.beatIntensity *= 0.92 // decay

    // ── 3. Draw curtain rays BEHIND bands ──────────────────────────────
    ctx.globalCompositeOperation = 'lighter'

    for (let i = this.curtainRays.length - 1; i >= 0; i--) {
      const ray = this.curtainRays[i]
      ray.life++
      if (ray.life > ray.maxLife) {
        this.curtainRays.splice(i, 1)
        continue
      }
      const fade = 1 - ray.life / ray.maxLife
      const baseRgb = parseRgb(ray.color)

      const grad = ctx.createLinearGradient(ray.x, ray.baseY, ray.x, ray.baseY + ray.length)
      grad.addColorStop(0, rgbaStr(brighten(baseRgb, 1.3), ray.alpha * fade * 0.6))
      grad.addColorStop(0.4, rgbaStr(baseRgb, ray.alpha * fade * 0.3))
      grad.addColorStop(1, rgbaStr(baseRgb, 0))

      ctx.fillStyle = grad
      ctx.fillRect(ray.x - 3, ray.baseY, 6, ray.length)
    }

    // ── 4. Update & draw each aurora band ──────────────────────────────
    for (let b = 0; b < this.bands.length; b++) {
      const band = this.bands[b]
      const energy = energies[b]
      const t = this.bands.length > 1 ? b / (this.bands.length - 1) : 0
      const bandColor = colorFn(t)
      const bandRgb = parseRgb(bandColor)
      const waveAmp = 30 + energy * 60 + this.beatIntensity * 40

      // ── 4a. Update control points with organic multi-frequency motion
      for (let i = 0; i < band.points.length; i++) {
        const pt = band.points[i]
        const phase = i * 0.25 + band.phaseOffset
        const targetY =
          pt.baseY +
          this.wave(phase, this.time, band.speed, waveAmp) +
          energy * H * 0.25 * Math.sin(phase + this.time * 2)
        pt.vy += (targetY - pt.y) * 0.06
        pt.vy *= 0.9
        pt.y += pt.vy
      }

      // ── 4b. Vertical gradient fill with colour shift ─────────────────
      const spread = 50 + energy * 100
      const midY = band.points[Math.floor(band.points.length / 2)].y

      const topRgb = shiftColor(bandRgb, -25, 0.7)
      const bottomRgb = shiftColor(bandRgb, 20, 0.45)
      const fillAlpha = band.alpha * (0.5 + energy * 0.5)

      const grad = ctx.createLinearGradient(0, midY - spread, 0, midY + spread)
      grad.addColorStop(0, rgbaStr(topRgb, 0))
      grad.addColorStop(0.15, rgbaStr(topRgb, fillAlpha * 0.4))
      grad.addColorStop(0.35, rgbaStr(bandRgb, fillAlpha * 0.7))
      grad.addColorStop(0.5, rgbaStr(brighten(bandRgb, 1.2), fillAlpha))
      grad.addColorStop(0.65, rgbaStr(bandRgb, fillAlpha * 0.7))
      grad.addColorStop(0.85, rgbaStr(bottomRgb, fillAlpha * 0.35))
      grad.addColorStop(1, rgbaStr(bottomRgb, 0))

      const bandPath = new Path2D()
      this.buildCurvePath(bandPath, band.points)
      ctx.fillStyle = grad
      ctx.fill(bandPath)

      // ── 4c. Bright core line (additive) ──────────────────────────────
      const coreRgb = brighten(bandRgb, 1.5)
      this.applyGlow(ctx, rgbStr(coreRgb), params.glowIntensity * (0.5 + energy * 0.5))
      ctx.strokeStyle = rgbaStr(coreRgb, 0.7 + energy * 0.3)
      ctx.lineWidth = 1 + energy * 2
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      this.buildCurvePath(ctx, band.points)
      ctx.stroke()
      this.clearGlow(ctx)

      // ── 4d. Spawn curtain rays during high energy ────────────────────
      if (energy > 0.2 && Math.random() < (energy * 0.12 + this.beatIntensity * 0.15)) {
        const idx = Math.floor(Math.random() * band.points.length)
        const pt = band.points[idx]
        this.curtainRays.push({
          x: pt.x,
          baseY: pt.y,
          length: 60 + Math.random() * 180,
          alpha: 0.08 + energy * 0.12,
          life: 0,
          maxLife: 35 + Math.random() * 65,
          color: bandColor,
        })
      }

      // ── 4e. Spawn sparkle particles ──────────────────────────────────
      const spawnBoost = 1 + this.beatIntensity * 2
      if (energy > 0.08 && Math.random() < energy * 0.5 * spawnBoost && this.particles.length < 500) {
        const idx = Math.floor(Math.random() * band.points.length)
        const pt = band.points[idx]
        this.particles.push({
          x: pt.x + (Math.random() - 0.5) * 30,
          y: pt.y + (Math.random() - 0.5) * 14,
          vx: (Math.random() - 0.5) * 1.2,
          vy: -0.4 - Math.random() * 2.2,
          life: 0,
          maxLife: 50 + Math.random() * 110,
          bandIndex: b,
          size: 2.5 + Math.random() * 3.5,
          prevPositions: [],
        })
      }
    }

    // ── 5. Update & draw sparkle particles ──────────────────────────────
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life++
      p.x += p.vx
      p.y += p.vy
      p.vy -= 0.012

      if (p.life > p.maxLife) {
        this.particles.splice(i, 1)
        continue
      }

      const fade = 1 - p.life / p.maxLife
      const pt = p.bandIndex < this.bands.length ? p.bandIndex : 0
      const t2 = this.bands.length > 1 ? pt / (this.bands.length - 1) : 0
      const c = parseRgb(colorFn(t2))

      // Store previous positions for trail
      p.prevPositions.push({ x: p.x, y: p.y })
      if (p.prevPositions.length > 3) p.prevPositions.shift()

      // Draw trail (2-3 previous positions, decreasing alpha)
      for (let j = 0; j < p.prevPositions.length; j++) {
        const prev = p.prevPositions[j]
        const trailFade = ((j + 1) / p.prevPositions.length) * fade * 0.35
        ctx.beginPath()
        ctx.arc(prev.x, prev.y, p.size * 0.6 * trailFade, 0, Math.PI * 2)
        ctx.fillStyle = rgbaStr(c, trailFade)
        ctx.fill()
      }

      // Draw main particle
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * fade, 0, Math.PI * 2)
      ctx.fillStyle = rgbaStr(brighten(c, 1.4), fade * 0.9)
      ctx.fill()
    }

    // ── 6. Reset composite ─────────────────────────────────────────────
    ctx.globalCompositeOperation = 'source-over'
  }

  /* ── Cleanup ────────────────────────────────────────────────────────── */

  protected cleanup(): void {
    this.initialized = false
    this.bands = []
    this.particles = []
    this.curtainRays = []
    this.stars = []
    this.energyHistory = []
    this.beatIntensity = 0
  }
}
