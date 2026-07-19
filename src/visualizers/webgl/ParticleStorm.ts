import * as THREE from 'three'
import { BaseVisualizer } from '../BaseVisualizer'
import type { VisualizerParams } from '../../types'
import { AudioEngine } from '../../audio/AudioEngine'

export class ParticleStorm extends BaseVisualizer {
  private renderer!: THREE.WebGLRenderer
  private scene!: THREE.Scene
  private camera!: THREE.PerspectiveCamera
  private particles!: THREE.Points
  private positions!: Float32Array
  private colors!: Float32Array
  private velocities!: Float32Array
  private lifetimes!: Float32Array
  private initialized = false

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
    this.camera = new THREE.PerspectiveCamera(70, this.canvas.width / this.canvas.height, 0.1, 1000)
    this.camera.position.z = 60

    const geometry = new THREE.BufferGeometry()
    this.positions = new Float32Array(count * 3)
    this.colors = new Float32Array(count * 3)
    this.velocities = new Float32Array(count * 3)
    this.lifetimes = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      this.resetParticle(i)
      this.lifetimes[i] = Math.random()
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3))

    const material = new THREE.PointsMaterial({
      size: 0.6,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })

    this.particles = new THREE.Points(geometry, material)
    this.scene.add(this.particles)
    this.initialized = true
  }

  private resetParticle(i: number): void {
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = Math.random() * 5

    this.positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r
    this.positions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r
    this.positions[i * 3 + 2] = Math.cos(phi) * r

    const speed = 0.2 + Math.random() * 0.5
    this.velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed
    this.velocities[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed
    this.velocities[i * 3 + 2] = Math.cos(phi) * speed

    this.lifetimes[i] = Math.random()
  }

  renderFrame(engine: AudioEngine, params: VisualizerParams, _ts: number): void {
    const data = engine.freqDataL
    const count = params.particleCount
    const colorFn = this.getColorFn(params)

    if (!this.initialized) {
      this.initThree(count)
    }

    const noiseScale = params.noiseIntensity
    const overallEnergy = engine.getEnergy()

    for (let i = 0; i < count; i++) {
      const freqIndex = Math.floor((i / count) * data.length)
      const energy = data[freqIndex] / 255

      this.lifetimes[i] += 0.005 + energy * 0.02
      if (this.lifetimes[i] > 1) {
        this.resetParticle(i)
      }

      const burstForce = energy * 3 * noiseScale
      const speedMult = 1 + burstForce

      this.positions[i * 3] += this.velocities[i * 3] * speedMult
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * speedMult
      this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * speedMult

      const dist = Math.sqrt(
        this.positions[i * 3] ** 2 +
        this.positions[i * 3 + 1] ** 2 +
        this.positions[i * 3 + 2] ** 2
      )

      if (dist > 60 || this.lifetimes[i] > 1) {
        this.resetParticle(i)
      }

      const lifeFade = 1 - this.lifetimes[i]
      const c = new THREE.Color(colorFn(i / count))
      const brightness = 0.15 + energy * 0.85
      this.colors[i * 3] = c.r * brightness * lifeFade
      this.colors[i * 3 + 1] = c.g * brightness * lifeFade
      this.colors[i * 3 + 2] = c.b * brightness * lifeFade
    }

    const geo = this.particles.geometry as THREE.BufferGeometry
    geo.attributes.position.needsUpdate = true
    geo.attributes.color.needsUpdate = true

    this.particles.rotation.y += params.rotationSpeed * 0.002
    this.particles.rotation.x += overallEnergy * 0.01

    this.renderer.render(this.scene, this.camera)
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
    this.renderer.dispose()
    this.initialized = false
  }
}
