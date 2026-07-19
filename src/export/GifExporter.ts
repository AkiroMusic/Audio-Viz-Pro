import GIF from 'gif.js/dist/gif'

export class GifExporter {
  private isRecordingFlag = false
  private startTime = 0
  private canvas: HTMLCanvasElement | null = null
  private duration = 5000
  private fps = 15
  private totalFrames = 0
  private progressValue = 0
  private frames: ImageData[] = []
  private tempCanvas: HTMLCanvasElement | null = null
  private tempCtx: CanvasRenderingContext2D | null = null
  private static readonly MAX_FRAMES = 150

  startRecording(canvas: HTMLCanvasElement, duration: number, fps: number): void {
    this.canvas = canvas
    this.duration = duration
    this.fps = fps
    this.startTime = Date.now()
    this.isRecordingFlag = true
    this.frames = []
    this.progressValue = 0
    this.totalFrames = Math.min(Math.ceil((duration / 1000) * fps), GifExporter.MAX_FRAMES)

    // Create reusable temp canvas once
    const W = canvas.width
    const H = canvas.height
    if (!this.tempCanvas || this.tempCanvas.width !== W || this.tempCanvas.height !== H) {
      this.tempCanvas = document.createElement('canvas')
      this.tempCanvas.width = W
      this.tempCanvas.height = H
      this.tempCtx = this.tempCanvas.getContext('2d')!
    }
  }

  captureFrame(): void {
    if (!this.isRecordingFlag || !this.canvas || !this.tempCanvas || !this.tempCtx) return

    // Enforce frame limit to prevent OOM
    if (this.frames.length >= GifExporter.MAX_FRAMES) return

    this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height)
    this.tempCtx.drawImage(this.canvas, 0, 0)
    const imageData = this.tempCtx.getImageData(0, 0, this.tempCanvas.width, this.tempCanvas.height)
    this.frames.push(imageData)
  }

  isComplete(): boolean {
    if (!this.isRecordingFlag) return false
    return this.frames.length >= this.totalFrames || (Date.now() - this.startTime) >= this.duration
  }

  getProgress(): number {
    if (!this.isRecordingFlag) return 0
    const frameProgress = this.totalFrames > 0 ? this.frames.length / this.totalFrames : 0
    const timeProgress = (Date.now() - this.startTime) / this.duration
    this.progressValue = Math.min(1, Math.max(frameProgress, timeProgress))
    return this.progressValue
  }

  stopRecording(): Promise<Blob | null> {
    this.isRecordingFlag = false
    this.tempCanvas = null
    this.tempCtx = null

    const capturedFrames = this.frames
    this.frames = []

    if (!this.canvas || capturedFrames.length === 0) return Promise.resolve(null)

    const W = this.canvas.width
    const H = this.canvas.height

    return new Promise((resolve) => {
      const gif = new GIF({
        workers: 2,
        quality: 10,
        width: W,
        height: H,
        workerScript: '/gif.worker.js',
        background: '#0a0a0f',
      })

      const framesToEncode = capturedFrames.length
      const delay = Math.round(1000 / this.fps)

      for (let i = 0; i < framesToEncode; i++) {
        gif.addFrame(capturedFrames[i], { copy: true, delay })
      }

      gif.on('progress', (p: number) => {
        this.progressValue = p
      })

      gif.on('finished', (blob: Blob) => {
        resolve(blob)
      })

      gif.render()
    })
  }

  async downloadGif(filename = 'audioviz.gif'): Promise<void> {
    const blob = await this.stopRecording()
    if (!blob) return

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
}
