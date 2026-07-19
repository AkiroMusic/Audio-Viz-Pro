/**
 * RenderPipeline
 *
 * 离线渲染管线编排器。
 *
 * 流程：
 *   1. 用户选择音频文件 + 可视化类型 + 参数 + FPS/分辨率
 *   2. OfflineAudioProcessor 预计算 FFT 帧
 *   3. 创建隐藏 canvas + 可视化实例
 *   4. 用 MockAudioEngine 逐帧驱动可视化（比实时快，无 rAF 延时）
 *   5. 逐帧捕获 RGB24 像素，通过 IPC 管道推送给主进程原生 ffmpeg
 *   6. ffmpeg 编码完成 → 读取输出文件 → 返回 blob URL
 */

import { OfflineAudioProcessor, type OfflineFrame } from './OfflineAudioProcessor'
import { BaseVisualizer } from '../visualizers/BaseVisualizer'
import type { VisualizerParams, VisualizerType } from '../types'

// ── Visualizer 工厂（与 VisualizerStage.tsx 同步） ──

import { FrequencyBars } from '../visualizers/canvas/FrequencyBars'
import { RadialSpectrum } from '../visualizers/canvas/RadialSpectrum'
import { Oscilloscope } from '../visualizers/canvas/Oscilloscope'
import { Aurora } from '../visualizers/canvas/Aurora'
import { Waterfall } from '../visualizers/canvas/Waterfall'
import { Lissajous } from '../visualizers/canvas/Lissajous'

function createVisualizerInstance(type: VisualizerType, canvas: HTMLCanvasElement): BaseVisualizer {
  switch (type) {
    case 'frequencyBars':   return new FrequencyBars(canvas)
    case 'radialSpectrum':  return new RadialSpectrum(canvas)
    case 'oscilloscope':    return new Oscilloscope(canvas)
    case 'aurora':          return new Aurora(canvas)
    case 'waterfall':       return new Waterfall(canvas)
    case 'lissajous':       return new Lissajous(canvas)
    default:                return new FrequencyBars(canvas)
  }
}

// ── MockAudioEngine ──
// 让 visualizer 的 renderFrame() 直接使用预计算数据，无需真实 AudioContext

class MockAudioEngine {
  freqDataL!: Uint8Array
  freqDataR!: Uint8Array
  timeDataL!: Float32Array
  timeDataR!: Float32Array
  private _energy = 0

  applyParams(_p: VisualizerParams): void {
    // 离线模式无需配置 AnalyserNode
  }

  update(_sensitivity: number): void {
    // 离线模式直接由 setFrame 设置数据，无需从 AnalyserNode 读取
  }

  getEnergy(): number {
    return this._energy
  }

  /** 逐帧设置数据（替代 engine.update()） */
  setFrame(frame: OfflineFrame): void {
    this.freqDataL = frame.freqData
    this.freqDataR = frame.freqData   // 离线合并为单声道
    this.timeDataL = frame.timeData
    this.timeDataR = frame.timeData

    // 缓存 energy
    const d = frame.freqData
    if (d.length > 0) {
      let sum = 0
      for (let i = 0; i < d.length; i++) sum += d[i]
      this._energy = sum / (d.length * 255)
    } else {
      this._energy = 0
    }
  }
}

// ── Canvas 像素捕获器（返回 RGBA 像素副本） ──

function createPixelCapture(canvas: HTMLCanvasElement): () => Uint8Array {
  const w = canvas.width
  const h = canvas.height
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = w
  tempCanvas.height = h
  const tempCtx = tempCanvas.getContext('2d')!
  const bufSize = w * h * 4

  return () => {
    // drawImage 可读取 WebGL canvas（preserveDrawingBuffer: true 保证始终有效）
    tempCtx.drawImage(canvas, 0, 0)
    const imageData = tempCtx.getImageData(0, 0, w, h)
    // 返回副本而非视图 — 避免 getImageData 内部缓冲区复用导致的数据竞争
    return new Uint8Array(imageData.data.buffer.slice(0, bufSize))
  }
}

// ── RGBA → RGB24 转换 ──
// Canvas 输出 RGBA（4字节/像素），ffmpeg 输入需要 RGB24（3字节/像素）

function rgbaToRgb24(rgba: Uint8Array, pixelCount: number): Uint8Array {
  const rgb = new Uint8Array(pixelCount * 3)
  for (let i = 0, j = 0, k = 0; i < pixelCount; i++) {
    rgb[j++] = rgba[k++] // R
    rgb[j++] = rgba[k++] // G
    rgb[j++] = rgba[k++] // B
    k++                    // skip A
  }
  return rgb
}

// ── 类型 ──

export interface RenderOptions {
  /** 音频文件 */
  audioFile: File
  /** 可视化类型 */
  visualizerType: VisualizerType
  /** 可视化参数 */
  params: VisualizerParams
  /** 目标帧率 */
  fps: number
  /** 输出宽度（像素） */
  width: number
  /** 输出高度（像素） */
  height: number
  /** 视频码率 */
  bitrate?: string
}

export interface RenderProgress {
  /** 总体进度 0-1 */
  progress: number
  /** 当前阶段 */
  stage: 'decoding' | 'rendering' | 'encoding' | 'done'
  /** 渲染帧进度 */
  frameProgress?: number
  /** 编码进度 */
  encodeProgress?: number
}

// ── RenderPipeline ──

export class RenderPipeline {
  private _cancelled = false
  private _audioTempPath: string | null = null
  private _outputPath: string | null = null
  private processor = new OfflineAudioProcessor()

  /** 取消渲染：终止 ffmpeg 进程 + 清理临时文件 */
  cancel(): void {
    this._cancelled = true
    window.electronAPI?.renderCancel().catch(() => {})
    this._cleanupTempFiles()
  }

  /**
   * 执行一次完整的离线渲染
   * @returns blob URL（调用方负责 URL.revokeObjectURL）
   */
  async render(options: RenderOptions, onProgress?: (p: RenderProgress) => void, onCanvasReady?: (canvas: HTMLCanvasElement | null) => void): Promise<string> {
    this._cancelled = false
    const { audioFile, visualizerType, params, fps, width, height, bitrate } = options

    const api = window.electronAPI
    if (!api) throw new Error('Electron API not available — cannot render outside Electron')

    // ── Phase 1: 解码并预计算 FFT ──
    onProgress?.({ progress: 0, stage: 'decoding' })

    const audioResult = await this.processor.process(
      audioFile,
      params.fftSize,
      fps,
      (p) => onProgress?.({ progress: p * 0.3, stage: 'decoding' }),
      params.smoothing,
    )

    if (this._cancelled) throw new Error('Render cancelled')

    // ── 写入音频临时文件 ──
    const audioArrayBuffer = await audioFile.arrayBuffer()
    this._audioTempPath = await api.writeTempFile(audioArrayBuffer, audioFile.name || 'audio')

    if (this._cancelled) throw new Error('Render cancelled')

    // ── 创建隐藏 canvas + visualizer ──
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.style.position = 'fixed'
    canvas.style.top = '-9999px'
    canvas.style.left = '-9999px'
    document.body.appendChild(canvas)
    onCanvasReady?.(canvas)

    let visualizer: BaseVisualizer | null = null
    let unsubProgress: (() => void) | null = null

    try {
      visualizer = createVisualizerInstance(visualizerType, canvas)
      const engine = new MockAudioEngine()
      const frames = audioResult.frames
      const totalFrames = frames.length

      // 创建可复用的像素捕获器
      const capturePixel = createPixelCapture(canvas)

      // ── 启动原生 ffmpeg（立即返回，后台运行） ──
      // outputPath 必须是绝对路径 — 使用 writeTempFile 确保路径在临时目录内
      const outputPath = await api.writeTempFile(new ArrayBuffer(0), `audioviz-render-${Date.now()}.webm`)
      const renderConfig = {
        width,
        height,
        fps,
        bitrate: bitrate || '4M',
        audioPath: this._audioTempPath,
        outputPath,
      }

      const startResult = await api.renderStart(renderConfig, totalFrames)
      if (!startResult.success) {
        throw new Error(`Failed to start ffmpeg: ${startResult.error}`)
      }

      // ── 监听 ffmpeg 编码进度（用于 encoding 阶段） ──
      const totalDurationSec = audioResult.duration
      unsubProgress = api.onRenderProgress((progress) => {
        if (this._cancelled) return
        // ffmpeg 输出的 time 格式 HH:MM:SS.CC
        if (progress.time) {
          const parts = progress.time.split(':')
          const sec = parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2])
          const encodeProgress = totalDurationSec > 0 ? sec / totalDurationSec : 0
          onProgress?.({
            progress: 0.75 + encodeProgress * 0.25,
            stage: 'encoding',
            encodeProgress,
          })
        }
      })

      // 预分配 sensitivity 增益 buffer
      const needSensitivity = params.sensitivity !== 1.0
      let dataCopy: Uint8Array | null = null
      if (needSensitivity) {
        dataCopy = new Uint8Array(frames[0]?.freqData.length || 256)
      }

      const pixelCount = width * height

      // ── Phase 2+3: 逐帧渲染并通过 IPC 推送 RGB24 到 ffmpeg ──
      onProgress?.({ progress: 0.3, stage: 'rendering' })

      for (let i = 0; i < totalFrames; i++) {
        if (this._cancelled) throw new Error('Render cancelled')

        const frame = frames[i]
        engine.setFrame(frame)

        // 应用 sensitivity gain
        if (needSensitivity && dataCopy) {
          dataCopy = new Uint8Array(frame.freqData.length)
          const gain = params.sensitivity
          const src = frame.freqData
          for (let b = 0; b < src.length; b++) {
            dataCopy[b] = (src[b] * gain) > 255 ? 255 : (src[b] * gain) < 0 ? 0 : Math.round(src[b] * gain)
          }
          engine.freqDataL = dataCopy
          engine.freqDataR = dataCopy
        }

        // 渲染单帧到 canvas
        visualizer.renderOneFrame(engine, params, frame.timestamp * 1000)

        // 捕获 RGBA → 转换为 RGB24 → 通过 IPC 推送给 ffmpeg
        const rgba = capturePixel()
        const rgb24 = rgbaToRgb24(rgba, pixelCount)

        const frameResult = await api.renderFrame(rgb24.buffer.slice(0, rgb24.byteLength) as ArrayBuffer)
        if (!frameResult.success) {
          throw new Error(`Frame ${i + 1}/${totalFrames} encode failed: ${frameResult.error}`)
        }

        // 每 30 帧让出主线程 + 报告进度
        if (i % 30 === 0) {
          await new Promise<void>(r => setTimeout(r, 0))

          const renderProgress = 0.3 + (i / totalFrames) * 0.4
          onProgress?.({
            progress: renderProgress,
            stage: i < totalFrames - 1 ? 'rendering' : 'encoding',
            frameProgress: i / totalFrames,
          })
        }
      }

      if (this._cancelled) throw new Error('Render cancelled')

      // ── Phase 4: 关闭 stdin，等待 ffmpeg 编码完成 ──
      onProgress?.({ progress: 0.75, stage: 'encoding' })

      const finishResult = await api.renderFinish()
      unsubProgress?.()

      if (!finishResult.success) {
        throw new Error(`ffmpeg encoding failed: ${finishResult.error}`)
      }

      if (this._cancelled) throw new Error('Render cancelled')
      if (!finishResult.outputPath) {
        throw new Error('ffmpeg finished but no output path returned')
      }

      this._outputPath = finishResult.outputPath

      // ── 读取输出文件 → 创建 blob URL ──
      const outputData = await api.readFile(finishResult.outputPath)
      const blob = new Blob([outputData], { type: 'video/webm' })
      const url = URL.createObjectURL(blob)

      // 清理临时文件
      this._cleanupTempFiles()

      this._audioTempPath = null
      this._outputPath = null
      onProgress?.({ progress: 1, stage: 'done' })
      return url
    } catch (err) {
      unsubProgress?.()
      throw err
    } finally {
      // 确保清理临时文件
      this._cleanupTempFiles()
      this._audioTempPath = null
      this._outputPath = null
      if (visualizer) {
        visualizer.stop()
        visualizer = null
      }
      if (canvas.parentNode) {
        onCanvasReady?.(null)
        document.body.removeChild(canvas)
      }
    }
  }

  /** 清理临时文件（best-effort） */
  private _cleanupTempFiles(): void {
    const api = window.electronAPI
    if (!api) return
    if (this._audioTempPath) {
      api.cleanupTempFile(this._audioTempPath).catch(() => {})
    }
    if (this._outputPath) {
      api.cleanupTempFile(this._outputPath).catch(() => {})
    }
  }
}
