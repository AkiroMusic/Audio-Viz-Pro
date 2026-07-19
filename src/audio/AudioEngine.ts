import type { VisualizerParams } from '../types'
import { useStore } from '../store/useStore'

const DEFAULT_FFT_SIZE = 1024

type EngineMode = 'idle' | 'file' | 'mic'

export class AudioEngine {
  private context: AudioContext | null = null
  private analyserL: AnalyserNode | null = null
  private analyserR: AnalyserNode | null = null
  private gainNode: GainNode | null = null
  private sourceNode: MediaElementAudioSourceNode | null = null
  private splitter: ChannelSplitterNode | null = null
  private merger: ChannelMergerNode | null = null
  private audioElement: HTMLAudioElement | null = null
  private micStream: MediaStream | null = null
  private micSourceNode: MediaStreamAudioSourceNode | null = null
  private mode: EngineMode = 'idle'

  // 频率数据缓冲区
  public freqDataL!: Uint8Array<ArrayBuffer>
  public freqDataR!: Uint8Array<ArrayBuffer>
  public timeDataL!: Float32Array<ArrayBuffer>
  public timeDataR!: Float32Array<ArrayBuffer>

  // Audio graph:
  //
  // Permanent chain (set up once in first init()):
  //   audioEl → mediaElementSource → gainNode → splitter → merger → destination
  //
  // File mode:
  //   splitter(0) → analyserL
  //   splitter(1) → analyserR
  //
  // Mic mode:
  //   micSource → analyserL
  //   micSource → analyserR

  async init(audioElement: HTMLAudioElement): Promise<void> {
    // If mic is active, shut it down first
    if (this.mode === 'mic') {
      this.disableMicInternal()
      useStore.getState().setAudio({ isMicActive: false })
    }

    this.audioElement = audioElement

    if (this.context) {
      // ── Reconnection path ──
      // Context already exists.  Don't try createMediaElementSource again
      // (it would throw).  Instead, safely reconnect analysers to splitter.

      // Disconnect splitter → analyserL/R to avoid duplicate connections
      if (this.splitter && this.analyserL) {
        try { this.splitter.disconnect(this.analyserL) } catch { /* no-op */ }
      }
      if (this.splitter && this.analyserR) {
        try { this.splitter.disconnect(this.analyserR) } catch { /* no-op */ }
      }

      // Disconnect analysers from any other previous source (e.g. micSourceNode)
      if (this.analyserL) {
        try { this.analyserL.disconnect() } catch { /* no-op */ }
      }
      if (this.analyserR) {
        try { this.analyserR.disconnect() } catch { /* no-op */ }
      }

      // Ensure analyser nodes exist (should, but guard for safety)
      if (!this.analyserL) this.analyserL = this.context.createAnalyser()
      if (!this.analyserR) this.analyserR = this.context.createAnalyser()

      // Reconnect analysers to splitter (file path)
      this.splitter!.connect(this.analyserL, 0)
      this.splitter!.connect(this.analyserR, 1)

      this.configureAnalysers(DEFAULT_FFT_SIZE)
    } else {
      // ── First-time path ──
      this.context = new AudioContext()

      // Gain node
      this.gainNode = this.context.createGain()
      this.gainNode.gain.value = 1.0

      // Analyser nodes
      this.analyserL = this.context.createAnalyser()
      this.analyserR = this.context.createAnalyser()
      this.configureAnalysers(DEFAULT_FFT_SIZE)

      // Channel splitter / merger (stereo)
      this.splitter = this.context.createChannelSplitter(2)
      this.merger = this.context.createChannelMerger(2)

      // Build permanent audio graph
      this.sourceNode = this.context.createMediaElementSource(audioElement)
      this.sourceNode.connect(this.gainNode)
      this.gainNode.connect(this.splitter)

      // Analyser feeds (file mode)
      this.splitter.connect(this.analyserL, 0)
      this.splitter.connect(this.analyserR, 1)

      // Output chain
      this.splitter.connect(this.merger, 0, 0)
      this.splitter.connect(this.merger, 1, 1)
      this.merger.connect(this.context.destination)
    }

    this.mode = 'file'
  }

  async enableMic(): Promise<void> {
    if (this.mode === 'mic' && this.micStream) return

    // Ensure AudioContext exists
    if (!this.context) {
      this.context = new AudioContext()
    }

    // Disconnect splitter → analysers (file path)
    if (this.splitter && this.analyserL) {
      try { this.splitter.disconnect(this.analyserL) } catch { /* no-op */ }
    }
    if (this.splitter && this.analyserR) {
      try { this.splitter.disconnect(this.analyserR) } catch { /* no-op */ }
    }

    // Disconnect analysers from any previous source (clean slate)
    if (this.analyserL) {
      try { this.analyserL.disconnect() } catch { /* no-op */ }
    }
    if (this.analyserR) {
      try { this.analyserR.disconnect() } catch { /* no-op */ }
    }

    // Create analysers if they don't exist (first-time mic before file)
    if (!this.analyserL) this.analyserL = this.context.createAnalyser()
    if (!this.analyserR) this.analyserR = this.context.createAnalyser()
    this.configureAnalysers(DEFAULT_FFT_SIZE)

    // Get mic stream
    this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    this.micSourceNode = this.context.createMediaStreamSource(this.micStream)

    // Connect mic → analysers (no destination to avoid echo)
    this.micSourceNode.connect(this.analyserL)
    this.micSourceNode.connect(this.analyserR)

    this.mode = 'mic'
  }

  disableMic(): void {
    this.disableMicInternal()
    useStore.getState().setAudio({ isMicActive: false })
  }

  private disableMicInternal(): void {
    // Disconnect mic source node
    if (this.micSourceNode) {
      try { this.micSourceNode.disconnect() } catch { /* no-op */ }
      this.micSourceNode = null
    }

    // Stop mic stream tracks
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop())
      this.micStream = null
    }

    // Don't null analysers (keep for reuse)
    // Don't change mode here (init() will set it, or caller manages isMicActive)
  }

  private configureAnalysers(fftSize: number, smoothing = 0.8): void {
    if (!this.analyserL || !this.analyserR) return
    this.analyserL.fftSize = fftSize
    this.analyserR.fftSize = fftSize
    this.analyserL.smoothingTimeConstant = smoothing
    this.analyserR.smoothingTimeConstant = smoothing
    this.analyserL.minDecibels = -100
    this.analyserL.maxDecibels = -10
    this.analyserR.minDecibels = -100
    this.analyserR.maxDecibels = -10
    this.freqDataL = new Uint8Array(this.analyserL.frequencyBinCount)
    this.freqDataR = new Uint8Array(this.analyserR.frequencyBinCount)
    this.timeDataL = new Float32Array(fftSize)
    this.timeDataR = new Float32Array(fftSize)
  }

  // ── Called every frame by the visualisation render loop ──

  applyParams(params: VisualizerParams): void {
    if (!this.analyserL || !this.analyserR) return
    const fftSize = params.fftSize
    if (this.analyserL.fftSize !== fftSize) {
      this.configureAnalysers(fftSize, params.smoothing)
    }
    this.analyserL.smoothingTimeConstant = params.smoothing
    this.analyserR.smoothingTimeConstant = params.smoothing
  }

  update(sensitivity: number): void {
    if (!this.analyserL || !this.analyserR) return
    this.analyserL.getByteFrequencyData(this.freqDataL)
    this.analyserR.getByteFrequencyData(this.freqDataR)
    this.analyserL.getFloatTimeDomainData(this.timeDataL)
    this.analyserR.getFloatTimeDomainData(this.timeDataR)

    // Apply sensitivity gain
    if (sensitivity !== 1.0) {
      for (let i = 0; i < this.freqDataL.length; i++) {
        this.freqDataL[i] = Math.min(255, this.freqDataL[i] * sensitivity)
        this.freqDataR[i] = Math.min(255, this.freqDataR[i] * sensitivity)
      }
    }
  }

  getEnergy(): number {
    if (!this.freqDataL || !this.freqDataL.length) return 0
    let sum = 0
    for (let i = 0; i < this.freqDataL.length; i++) {
      sum += this.freqDataL[i]
    }
    return sum / (this.freqDataL.length * 255)
  }

  setVolume(value: number): void {
    if (this.gainNode) this.gainNode.gain.value = Math.max(0, Math.min(2, value))
  }

  getContext(): AudioContext | null { return this.context }
  getDestination(): AudioDestinationNode | null { return this.context?.destination ?? null }

  resume(): void { this.context?.state === 'suspended' && this.context.resume() }

  destroy(): void {
    this.disableMicInternal()
    this.context?.close()
    this.context = null
    this.sourceNode = null
    this.analyserL = null
    this.analyserR = null
    this.gainNode = null
    this.splitter = null
    this.merger = null
    this.audioElement = null
    this.mode = 'idle'
  }
}
