import * as THREE from 'three'
import { BaseVisualizer } from '../BaseVisualizer'
import type { VisualizerParams } from '../../types'
import { AudioEngine } from '../../audio/AudioEngine'

export class GalaxySpiral extends BaseVisualizer {
  private renderer!: THREE.WebGLRenderer
  private scene!: THREE.Scene
  private camera!: THREE.PerspectiveCamera
  private particles!: THREE.Points
  private coreParticles!: THREE.Points
  private positions!: Float32Array
  private colors!: Float32Array
  private corePositions!: Float32Array
  private coreColors!: Float32Array
  private initialized = false
  private time = 0

  renderFrame(engine: AudioEngine, params: VisualizerParams, _ts: number): void {
    const data = engine.freqDataL
    const colorFn = this.getColorFn(params)

    if (!this.initialized) {
      this.initThree(params.particleCount)
    }

    this.time += params.rotationSpeed * 0.008

    let bassEnergy = 0
    for (let i = 0; i < 10 && i < data.length; i++) {
      bassEnergy += data[i]
    }
    bassEnergy = bassEnergy / (10 * 255)

    let midEnergy = 0
    const midStart = Math.floor(data.length * 0.3)
    const midEnd = Math.floor(data.length * 0.6)
    for (let i = midStart; i < midEnd; i++) {
      midEnergy += data[i]
    }
    midEnergy = midEnergy / Math.max(1, (midEnd - midStart) * 255)

    let highEnergy = 0
    const highStart = Math.floor(data.length * 0.7)
    for (let i = highStart; i < data.length; i++) {
      highEnergy += data[i]
    }
    highEnergy = highEnergy / Math.max(1, (data.length - highStart) * 255)

    const count = params.particleCount
    const arms = params.galaxyArms

    // Spiral arm particles
    for (let i = 0; i < count; i++) {
      const freqIdx = Math.floor((i / count) * data.length)
      const energyAtParticle = data[freqIdx] / 255

      const armIndex = i % arms
      const baseAngle = (armIndex * Math.PI * 2) / arms
      const t = (i / count)
      const theta = t * Math.PI * 6 + this.time + baseAngle
      const r = 1.5 + t * 18

      const spiralSpread = 0.3 + energyAtParticle * 0.4
      const angleJitter = (Math.random() - 0.5) * spiralSpread
      const rJitter = (Math.random() - 0.5) * 0.8

      const finalR = r + rJitter
      const finalTheta = theta + angleJitter

      let x = Math.cos(finalTheta) * finalR
      let z = Math.sin(finalTheta) * finalR
      let y = (Math.random() - 0.5) * (1.5 + energyAtParticle * 2) * (1 + t * 0.5)

      if (midEnergy > 0.35) {
        const turbulence = midEnergy * params.noiseIntensity * 3
        x += (Math.random() - 0.5) * turbulence
        z += (Math.random() - 0.5) * turbulence
      }

      this.positions[i * 3] = x
      this.positions[i * 3 + 1] = y
      this.positions[i * 3 + 2] = z

      const c = new THREE.Color(colorFn((t + energyAtParticle * 0.3) % 1))
      const brightness = 0.2 + energyAtParticle * 0.8
      this.colors[i * 3] = c.r * brightness
      this.colors[i * 3 + 1] = c.g * brightness
      this.colors[i * 3 + 2] = c.b * brightness
    }

    // Core particles - bright center
    const coreCount = Math.min(300, Math.floor(count * 0.15))
    for (let i = 0; i < coreCount; i++) {
      const angle = Math.random() * Math.PI * 2
      const r = Math.random() * 2 * (1 + bassEnergy * 0.5)
      const y = (Math.random() - 0.5) * 1.5

      this.corePositions[i * 3] = Math.cos(angle) * r
      this.corePositions[i * 3 + 1] = y
      this.corePositions[i * 3 + 2] = Math.sin(angle) * r

      const brightness = 0.6 + bassEnergy * 0.4
      this.coreColors[i * 3] = brightness
      this.coreColors[i * 3 + 1] = brightness * 0.9
      this.coreColors[i * 3 + 2] = brightness * 0.7
    }

    const geo = this.particles.geometry as THREE.BufferGeometry
    geo.attributes.position.needsUpdate = true
    geo.attributes.color.needsUpdate = true

    const coreGeo = this.coreParticles.geometry as THREE.BufferGeometry
    coreGeo.attributes.position.needsUpdate = true
    coreGeo.attributes.color.needsUpdate = true

    this.particles.rotation.y = this.time * (0.8 + bassEnergy * 1.5)
    this.coreParticles.rotation.y = this.time * (1 + bassEnergy * 2)

    this.renderer.render(this.scene, this.camera)
  }

  private initThree(count: number): void {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    })
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(this.canvas.width / window.devicePixelRatio, this.canvas.height / window.devicePixelRatio)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(60, this.canvas.width / this.canvas.height, 0.1, 1000)
    this.camera.position.set(0, 25, 35)
    this.camera.lookAt(0, 0, 0)

    // Spiral arm particles
    const geometry = new THREE.BufferGeometry()
    this.positions = new Float32Array(count * 3)
    this.colors = new Float32Array(count * 3)

    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))

    const material = new THREE.PointsMaterial({
      size: 0.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })

    this.particles = new THREE.Points(geometry, material)
    this.scene.add(this.particles)

    // Core particles
    const coreCount = Math.min(300, Math.floor(count * 0.15))
    const coreGeometry = new THREE.BufferGeometry()
    this.corePositions = new Float32Array(coreCount * 3)
    this.coreColors = new Float32Array(coreCount * 3)

    coreGeometry.setAttribute('position', new THREE.BufferAttribute(this.corePositions, 3))
    coreGeometry.setAttribute('color', new THREE.BufferAttribute(this.coreColors, 3))

    const coreMaterial = new THREE.PointsMaterial({
      size: 0.4,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })

    this.coreParticles = new THREE.Points(coreGeometry, coreMaterial)
    this.scene.add(this.coreParticles)

    // Subtle ambient light
    const ambientLight = new THREE.AmbientLight(0x222244, 0.3)
    this.scene.add(ambientLight)

    this.initialized = true
  }

  onResize(width: number, height: number): void {
    super.onResize(width, height)
    if (!this.initialized) return
    this.renderer.setSize(width, height)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  protected cleanup(): void {
    if (!this.initialized) return
    const geo = this.particles.geometry as THREE.BufferGeometry
    geo.dispose()
    ;(this.particles.material as THREE.Material).dispose()
    const coreGeo = this.coreParticles.geometry as THREE.BufferGeometry
    coreGeo.dispose()
    ;(this.coreParticles.material as THREE.Material).dispose()
    this.renderer.dispose()
    this.initialized = false
  }
}
