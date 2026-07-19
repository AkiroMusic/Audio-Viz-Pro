import * as THREE from 'three'
import { BaseVisualizer } from '../BaseVisualizer'
import type { VisualizerParams } from '../../types'
import { AudioEngine } from '../../audio/AudioEngine'

export class FrequencyTerrain extends BaseVisualizer {
  private renderer!: THREE.WebGLRenderer
  private scene!: THREE.Scene
  private camera!: THREE.PerspectiveCamera
  private terrain!: THREE.Mesh
  private geometry!: THREE.PlaneGeometry
  private gridHelper!: THREE.GridHelper
  private initialized = false
  private gridSize = 64
  private colors: Float32Array | null = null

  renderFrame(engine: AudioEngine, params: VisualizerParams, _ts: number): void {
    const data = engine.freqDataL
    const colorFn = this.getColorFn(params)

    if (!this.initialized || this.gridSize !== params.terrainResolution) {
      this.cleanup()
      this.initThree(params.terrainResolution)
    }

    const positions = this.geometry.attributes.position.array as Float32Array
    const count = this.gridSize * this.gridSize

    // 复用颜色数组，避免每帧分配
    if (!this.colors || this.colors.length !== count * 3) {
      this.colors = new Float32Array(count * 3)
    }
    const colors = this.colors

    for (let i = 0; i < this.gridSize; i++) {
      for (let j = 0; j < this.gridSize; j++) {
        const idx = i * this.gridSize + j
        const freqIdx = Math.floor((j / this.gridSize) * data.length * 0.8)
        const energy = data[freqIdx] / 255
        const rowFade = 1 - Math.abs(i / this.gridSize - 0.5) * 1.2
        const height = energy * 25 * Math.max(0, rowFade)

        positions[idx * 3 + 2] = height

        const t = height / 25
        const color = new THREE.Color(colorFn(t))
        colors[idx * 3] = color.r
        colors[idx * 3 + 1] = color.g
        colors[idx * 3 + 2] = color.b
      }
    }

    const colorAttr = this.geometry.attributes.color as THREE.BufferAttribute | undefined
    if (colorAttr) {
      colorAttr.array.set(colors)
      colorAttr.needsUpdate = true
    } else {
      this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    }
    this.geometry.computeVertexNormals()

    this.terrain.rotation.z += params.rotationSpeed * 0.001

    this.renderer.render(this.scene, this.camera)
  }

  private initThree(gridSize: number): void {
    this.gridSize = gridSize
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    })
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(this.canvas.width / window.devicePixelRatio, this.canvas.height / window.devicePixelRatio)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(55, this.canvas.width / this.canvas.height, 0.1, 1000)
    this.camera.position.set(0, 35, 45)
    this.camera.lookAt(0, 5, 0)

    this.geometry = new THREE.PlaneGeometry(90, 60, this.gridSize - 1, this.gridSize - 1)

    const material = new THREE.MeshPhongMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      shininess: 30,
      transparent: true,
      opacity: 0.92,
    })

    this.terrain = new THREE.Mesh(this.geometry, material)
    this.terrain.rotation.x = -Math.PI / 2.5
    this.scene.add(this.terrain)

    this.gridHelper = new THREE.GridHelper(90, 20, 0x333355, 0x222244)
    this.gridHelper.position.y = -1
    this.scene.add(this.gridHelper)

    const ambientLight = new THREE.AmbientLight(0x404060, 0.6)
    this.scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(20, 40, 20)
    this.scene.add(directionalLight)

    const pointLight = new THREE.PointLight(0x7c3aed, 0.5, 100)
    pointLight.position.set(0, 20, 0)
    this.scene.add(pointLight)

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
    this.geometry.dispose()
    ;(this.terrain.material as THREE.Material).dispose()
    this.gridHelper.dispose()
    this.scene.children.forEach(child => {
      if (child instanceof THREE.Light) {
        if ('dispose' in child && typeof child.dispose === 'function') {
          (child as THREE.Light & { dispose: () => void }).dispose()
        }
      }
    })
    this.renderer.dispose()
    this.initialized = false
  }
}
