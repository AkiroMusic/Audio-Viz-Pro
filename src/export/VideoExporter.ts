/**
 * VideoExporter
 *
 * 使用 MediaRecorder API 实时录制 canvas 为视频。
 * 支持：分辨率缩放、音频同步、VP9/VP8/fallback 编码自动选择。
 */

export interface VideoExportOptions {
  /** 目标帧率 (30 或 60) */
  frameRate: number
  /** 录制分辨率 */
  resolution: 'original' | '1080p' | '720p'
}

const RESOLUTION_MAP: Record<string, { width: number; height: number }> = {
  '1080p': { width: 1920, height: 1080 },
  '720p':  { width: 1280, height: 720 },
}

export class VideoExporter {
  private mediaRecorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private tempCanvas: HTMLCanvasElement | null = null
  private captureLoopId: number = 0
  private isStopping = false

  /**
   * 选择最合适的 MIME 类型
   */
  private selectMimeType(): string {
    const types = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ]
    for (const t of types) {
      if (MediaRecorder.isTypeSupported(t)) {
        return t
      }
    }
    console.warn('[VideoExporter] No preferred MIME type supported, using default')
    return 'video/webm'
  }

  /**
   * 开始录制
   * @param canvas      可视化画布（源）
   * @param audioElement 音频元素（用于捕获音频轨道）
   * @param options      录制选项（帧率、分辨率）
   */
  startRecording(
    canvas: HTMLCanvasElement,
    audioElement: HTMLAudioElement,
    options: VideoExportOptions = { frameRate: 60, resolution: 'original' },
  ): void {
    this.chunks = []
    this.isStopping = false

    // ── 分辨率缩放 ──
    // 如果选择了非原始分辨率，创建一个临时 canvas 做缩放中转
    const targetRes = RESOLUTION_MAP[options.resolution]
    const useScaling = options.resolution !== 'original' && targetRes

    let captureCanvas: HTMLCanvasElement
    if (useScaling && targetRes) {
      this.tempCanvas = document.createElement('canvas')
      this.tempCanvas.width = targetRes.width
      this.tempCanvas.height = targetRes.height
      captureCanvas = this.tempCanvas
      this.startCaptureLoop(canvas)
    } else {
      this.tempCanvas = null
      captureCanvas = canvas
    }

    // ── 从 canvas 捕获视频流 ──
    if (typeof captureCanvas.captureStream !== 'function') {
      console.error('[VideoExporter] captureStream() not supported in this browser')
      throw new Error('captureStream() not supported — try a modern browser like Chrome or Edge')
    }
    const videoStream = captureCanvas.captureStream(options.frameRate)

    // ── 从 audio 元素捕获音频流 ──
    const mediaEl = audioElement as HTMLMediaElement & { captureStream?: () => MediaStream }
    let audioStream: MediaStream | undefined
    if (typeof mediaEl.captureStream === 'function') {
      try {
        audioStream = mediaEl.captureStream()
      } catch (e) {
        console.warn('[VideoExporter] Audio captureStream() failed:', e)
      }
    }

    let combined: MediaStream
    if (audioStream && audioStream.getAudioTracks().length > 0) {
      combined = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...audioStream.getAudioTracks(),
      ])
    } else {
      console.warn('[VideoExporter] Audio capture not available, recording video only')
      combined = videoStream
    }

    // ── 选择编码格式 ──
    const mimeType = this.selectMimeType()

    // 60fps 需要更高码率
    const bitrate = options.frameRate >= 60 ? 12_000_000 : 8_000_000

    this.mediaRecorder = new MediaRecorder(combined, {
      mimeType,
      videoBitsPerSecond: bitrate,
    })

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.chunks.push(e.data)
    }

    // 每帧收集一次数据（减小延迟）
    this.mediaRecorder.start(Math.round(1000 / options.frameRate))
  }

  /**
   * 持续将源 canvas 画面复制到录制用临时 canvas
   */
  private startCaptureLoop(sourceCanvas: HTMLCanvasElement): void {
    const loop = () => {
      if (!this.tempCanvas || this.isStopping) return
      const ctx = this.tempCanvas.getContext('2d')
      if (!ctx) return
      // 清除 → 绘制（drawImage 会处理缩放）
      ctx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height)
      ctx.drawImage(sourceCanvas, 0, 0, this.tempCanvas.width, this.tempCanvas.height)
      this.captureLoopId = requestAnimationFrame(loop)
    }
    this.captureLoopId = requestAnimationFrame(loop)
  }

  /**
   * 停止录制并下载
   */
  async stopRecording(filename = 'audioviz-recording.webm'): Promise<void> {
    this.isStopping = true

    // 等待一帧确保画布刷新完成（避免丢失最后几帧）
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

    // 停止复制循环
    if (this.captureLoopId) {
      cancelAnimationFrame(this.captureLoopId)
      this.captureLoopId = 0
    }
    this.tempCanvas = null

    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) return resolve()

      // 安全超时：5 秒后强制 resolve，避免 onstop 永远不触发
      const timeout = setTimeout(() => {
        console.warn('[VideoExporter] MediaRecorder stop timeout — forcing resolve')
        resolve()
      }, 5000)

      this.mediaRecorder.onerror = () => {
        clearTimeout(timeout)
        reject(new Error('MediaRecorder error'))
      }

      this.mediaRecorder.onstop = () => {
        clearTimeout(timeout)
        if (this.chunks.length === 0) {
          console.warn('[VideoExporter] No data chunks collected')
          resolve()
          return
        }
        const blob = new Blob(this.chunks, { type: 'video/webm' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        // 延迟回收，确保浏览器拿到 blob 数据
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
        resolve()
      }

      // 停止所有轨道
      if (this.mediaRecorder.stream) {
        this.mediaRecorder.stream.getTracks().forEach(t => t.stop())
      }

      this.mediaRecorder.stop()
    })
  }

  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording'
  }
}