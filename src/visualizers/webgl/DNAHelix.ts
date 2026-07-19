import * as THREE from 'three'
import { BaseVisualizer } from '../BaseVisualizer'
import type { VisualizerParams } from '../../types'
import { AudioEngine } from '../../audio/AudioEngine'

export class DNAHelix extends BaseVisualizer {
  private renderer!: THREE.WebGLRenderer
  private scene!: THREE.Scene
  private camera!: THREE.PerspectiveCamera
  private helixGroup!: THREE.Group
  private strand1Mesh!: THREE.Mesh
  private strand2Mesh!: THREE.Mesh
  private basePairMeshes: THREE.Mesh[] = []
  private positions1!: Float32Array
  private positions2!: Float32Array
  private initialized = false
  private time = 0
  private currentSegments = 50

  private posArray1!: Float32Array
  private normalArray1!: Float32Array
  private posArray2!: Float32Array
  private normalArray2!: Float32Array
  private material1!: THREE.MeshBasicMaterial
  private material2!: THREE.MeshBasicMaterial

  private curve1!: THREE.CatmullRomCurve3
  private curve2!: THREE.CatmullRomCurve3
  private frPoints1: THREE.Vector3[] = []
  private frPoints2: THREE.Vector3[] = []
  private frTangents1: THREE.Vector3[] = []
  private frTangents2: THREE.Vector3[] = []
  private frNormals1: THREE.Vector3[] = []
  private frNormals2: THREE.Vector3[] = []
  private frBinormals1: THREE.Vector3[] = []
  private frBinormals2: THREE.Vector3[] = []
  private readonly RADIAL = 8

  private _axis = new THREE.Vector3(0, 1, 0)
  private _dir = new THREE.Vector3()
  private _tmpVec = new THREE.Vector3()
  private _initNormal = new THREE.Vector3()

  private ensureFrameStorage(count: number): void {
    while (this.frPoints1.length <= count) {
      this.frPoints1.push(new THREE.Vector3())
      this.frPoints2.push(new THREE.Vector3())
      this.frTangents1.push(new THREE.Vector3())
      this.frTangents2.push(new THREE.Vector3())
      this.frNormals1.push(new THREE.Vector3())
      this.frNormals2.push(new THREE.Vector3())
      this.frBinormals1.push(new THREE.Vector3())
      this.frBinormals2.push(new THREE.Vector3())
    }
  }

  private buildTubeGeometry(segments: number): {
    geometry: THREE.BufferGeometry
    posArray: Float32Array
    normalArray: Float32Array
  } {
    const vs = segments + 1
    const rs = this.RADIAL + 1
    const vertCount = vs * rs
    const posArray = new Float32Array(vertCount * 3)
    const normalArray = new Float32Array(vertCount * 3)
    const uvArray = new Float32Array(vertCount * 2)

    for (let i = 0; i < vs; i++) {
      for (let j = 0; j < rs; j++) {
        const idx = i * rs + j
        uvArray[idx * 2] = i / segments
        uvArray[idx * 2 + 1] = j / this.RADIAL
      }
    }

    const indices: number[] = []
    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < this.RADIAL; j++) {
        const a = i * rs + j
        const b = i * rs + j + 1
        const c = (i + 1) * rs + j
        const d = (i + 1) * rs + j + 1
        indices.push(a, b, c)
        indices.push(b, d, c)
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(posArray, 3))
    geo.setAttribute('normal', new THREE.BufferAttribute(normalArray, 3))
    geo.setAttribute('uv', new THREE.BufferAttribute(uvArray, 2))
    geo.setIndex(indices)

    return { geometry: geo, posArray, normalArray }
  }

  private updateTubeVertices(
    controlPositions: Float32Array,
    segments: number,
    curve: THREE.CatmullRomCurve3,
    posArray: Float32Array,
    normalArray: Float32Array,
    radius: number,
    frPoints: THREE.Vector3[],
    frTangents: THREE.Vector3[],
    frNormals: THREE.Vector3[],
    frBinormals: THREE.Vector3[]
  ): void {
    const pts = curve.points
    for (let i = 0; i < segments; i++) {
      pts[i].set(
        controlPositions[i * 3],
        controlPositions[i * 3 + 1],
        controlPositions[i * 3 + 2]
      )
    }

    const vs = segments + 1
    const rs = this.RADIAL + 1

    for (let i = 0; i < vs; i++) {
      const t = i / segments
      curve.getPoint(t, frPoints[i])
      curve.getTangent(t, frTangents[i]).normalize()
    }

    const firstTangent = frTangents[0]
    const ax = Math.abs(firstTangent.x)
    const ay = Math.abs(firstTangent.y)
    const az = Math.abs(firstTangent.z)
    if (ax <= ay && ax <= az) this._initNormal.set(1, 0, 0)
    else if (ay <= ax && ay <= az) this._initNormal.set(0, 1, 0)
    else this._initNormal.set(0, 0, 1)

    const firstBinormal = this._tmpVec.crossVectors(firstTangent, this._initNormal).normalize()
    frNormals[0].crossVectors(firstTangent, firstBinormal).normalize()
    frBinormals[0].copy(firstBinormal)

    for (let i = 1; i < vs; i++) {
      const prevT = frTangents[i - 1]
      const currT = frTangents[i]
      this._tmpVec.addVectors(prevT, currT)
      if (this._tmpVec.length() > Number.EPSILON) {
        this._tmpVec.normalize()
        const rd = 2 * frNormals[i - 1].dot(this._tmpVec)
        frNormals[i].copy(frNormals[i - 1]).sub(this._tmpVec.clone().multiplyScalar(rd))
        const bd = 2 * frBinormals[i - 1].dot(this._tmpVec)
        frBinormals[i].copy(frBinormals[i - 1]).sub(this._tmpVec.clone().multiplyScalar(bd))
      } else {
        frNormals[i].copy(frNormals[i - 1])
        frBinormals[i].copy(frBinormals[i - 1])
      }
    }

    for (let i = 0; i < vs; i++) {
      const p = frPoints[i]
      const n = frNormals[i]
      const b = frBinormals[i]
      for (let j = 0; j < rs; j++) {
        const theta = (j / this.RADIAL) * Math.PI * 2
        const cos = Math.cos(theta)
        const sin = Math.sin(theta)
        const idx = (i * rs + j) * 3
        const rx = cos * n.x + sin * b.x
        const ry = cos * n.y + sin * b.y
        const rz = cos * n.z + sin * b.z
        posArray[idx] = p.x + rx * radius
        posArray[idx + 1] = p.y + ry * radius
        posArray[idx + 2] = p.z + rz * radius
        const len = 1 / Math.sqrt(rx * rx + ry * ry + rz * rz)
        normalArray[idx] = rx * len
        normalArray[idx + 1] = ry * len
        normalArray[idx + 2] = rz * len
      }
    }
  }

  renderFrame(engine: AudioEngine, params: VisualizerParams, _ts: number): void {
    const data = engine.freqDataL
    const colorFn = this.getColorFn(params)

    if (!this.initialized || this.currentSegments !== params.helixSegments) {
      this.cleanup()
      this.initThree(params.helixSegments)
    }

    this.time += params.rotationSpeed * 0.02

    const segments = params.helixSegments
    const height = 30
    const radius = 3

    for (let i = 0; i < segments; i++) {
      const t = i / segments
      const y = (t - 0.5) * height
      const freqIdx = Math.floor(t * data.length)
      const energyAtPoint = data[freqIdx] / 255
      const wobble = energyAtPoint * 0.5

      const angle = t * Math.PI * 4 + this.time

      this.positions1[i * 3] = Math.cos(angle) * (radius + wobble)
      this.positions1[i * 3 + 1] = y
      this.positions1[i * 3 + 2] = Math.sin(angle) * (radius + wobble)

      this.positions2[i * 3] = Math.cos(angle + Math.PI) * (radius + wobble)
      this.positions2[i * 3 + 1] = y
      this.positions2[i * 3 + 2] = Math.sin(angle + Math.PI) * (radius + wobble)
    }

    this.updateTubeVertices(
      this.positions1, segments, this.curve1,
      this.posArray1, this.normalArray1, 0.12,
      this.frPoints1, this.frTangents1, this.frNormals1, this.frBinormals1
    )
    this.strand1Mesh.geometry.attributes.position.needsUpdate = true
    this.strand1Mesh.geometry.attributes.normal.needsUpdate = true
    this.strand1Mesh.geometry.computeBoundingSphere()
    this.material1.color.set(colorFn(0.3))

    this.updateTubeVertices(
      this.positions2, segments, this.curve2,
      this.posArray2, this.normalArray2, 0.12,
      this.frPoints2, this.frTangents2, this.frNormals2, this.frBinormals2
    )
    this.strand2Mesh.geometry.attributes.position.needsUpdate = true
    this.strand2Mesh.geometry.attributes.normal.needsUpdate = true
    this.strand2Mesh.geometry.computeBoundingSphere()
    this.material2.color.set(colorFn(0.7))

    const basePairStep = 3
    const neededPairs = Math.ceil(segments / basePairStep)
    while (this.basePairMeshes.length < neededPairs) {
      const geo = new THREE.CylinderGeometry(0.06, 0.06, 1, 4)
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff })
      const mesh = new THREE.Mesh(geo, mat)
      this.helixGroup.add(mesh)
      this.basePairMeshes.push(mesh)
    }
    while (this.basePairMeshes.length > neededPairs) {
      const mesh = this.basePairMeshes.pop()!
      ;(mesh.material as THREE.Material).dispose()
      mesh.geometry.dispose()
      this.helixGroup.remove(mesh)
    }

    let pairIdx = 0
    for (let i = 0; i < segments; i += basePairStep) {
      const i3 = i * 3
      const dx = this.positions2[i3] - this.positions1[i3]
      const dy = this.positions2[i3 + 1] - this.positions1[i3 + 1]
      const dz = this.positions2[i3 + 2] - this.positions1[i3 + 2]
      const length = Math.sqrt(dx * dx + dy * dy + dz * dz)

      const mesh = this.basePairMeshes[pairIdx]
      mesh.position.set(
        (this.positions1[i3] + this.positions2[i3]) * 0.5,
        (this.positions1[i3 + 1] + this.positions2[i3 + 1]) * 0.5,
        (this.positions1[i3 + 2] + this.positions2[i3 + 2]) * 0.5
      )
      mesh.scale.y = length

      const freqIdx = Math.floor((i / segments) * data.length)
      ;(mesh.material as THREE.MeshBasicMaterial).color.set(colorFn(data[freqIdx] / 255))

      this._dir.set(dx, dy, dz).normalize()
      mesh.quaternion.setFromUnitVectors(this._axis, this._dir)

      pairIdx++
    }

    this.helixGroup.rotation.y += params.rotationSpeed * 0.005

    this.renderer.render(this.scene, this.camera)
  }

  private initThree(segments: number): void {
    this.currentSegments = segments
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    })
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(
      this.canvas.width / window.devicePixelRatio,
      this.canvas.height / window.devicePixelRatio
    )

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(60, this.canvas.width / this.canvas.height, 0.1, 1000)
    this.camera.position.set(0, 0, 35)
    this.camera.lookAt(0, 0, 0)

    this.helixGroup = new THREE.Group()
    this.scene.add(this.helixGroup)

    this.positions1 = new Float32Array(segments * 3)
    this.positions2 = new Float32Array(segments * 3)

    this.ensureFrameStorage(segments + 1)

    const pts1: THREE.Vector3[] = []
    const pts2: THREE.Vector3[] = []
    for (let i = 0; i < segments; i++) {
      pts1.push(new THREE.Vector3())
      pts2.push(new THREE.Vector3())
    }
    this.curve1 = new THREE.CatmullRomCurve3(pts1)
    this.curve2 = new THREE.CatmullRomCurve3(pts2)

    const tube1 = this.buildTubeGeometry(segments)
    const tube2 = this.buildTubeGeometry(segments)
    this.posArray1 = tube1.posArray
    this.normalArray1 = tube1.normalArray
    this.posArray2 = tube2.posArray
    this.normalArray2 = tube2.normalArray

    this.material1 = new THREE.MeshBasicMaterial({ color: 0xffffff })
    this.material2 = new THREE.MeshBasicMaterial({ color: 0xffffff })

    this.strand1Mesh = new THREE.Mesh(tube1.geometry, this.material1)
    this.strand2Mesh = new THREE.Mesh(tube2.geometry, this.material2)
    this.helixGroup.add(this.strand1Mesh)
    this.helixGroup.add(this.strand2Mesh)

    this.basePairMeshes = []
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
    this.helixGroup.children.forEach(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        ;(child.material as THREE.Material).dispose()
      }
    })
    this.helixGroup.clear()
    this.basePairMeshes = []
    this.renderer.dispose()
    this.initialized = false
  }
}
