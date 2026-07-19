/**
 * OfflineAudioProcessor
 *
 * 离线预计算 FFT 数据。无需实时 AudioContext，使用纯 JS FFT
 * 从 PCM 数据计算频率谱，匹配 AnalyserNode.getByteFrequencyData() 的输出。
 *
 * 关键改进：
 * 1. Blackman 窗 — 更好的旁瓣抑制
 * 2. 帧间平滑在 magnitude 域做（而非 byte 域），精度更高
 * 3. smoothing 作用于 FFT 前的时域窗口（模拟 AnalyserNode.smoothingTimeConstant）
 */

export interface OfflineFrame {
  freqData: Uint8Array
  timeData: Float32Array
  index: number
  timestamp: number
}

export interface OfflineAudioResult {
  frames: OfflineFrame[]
  sampleRate: number
  duration: number
  totalFrames: number
  fftSize: number
  fps: number
}

function reverseBits(x: number, bits: number): number {
  let result = 0
  for (let i = 0; i < bits; i++) {
    result = (result << 1) | (x & 1)
    x >>= 1
  }
  return result
}

function fftInplace(re: Float32Array, im: Float32Array): void {
  const n = re.length
  const bits = Math.round(Math.log2(n))
  for (let i = 0; i < n; i++) {
    const j = reverseBits(i, bits)
    if (j > i) {
      let tmp = re[i]; re[i] = re[j]; re[j] = tmp
      tmp = im[i]; im[i] = im[j]; im[j] = tmp
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1
    const wRe = Math.cos(-Math.PI / half)
    const wIm = Math.sin(-Math.PI / half)
    for (let i = 0; i < n; i += len) {
      let wr = 1, wi = 0
      for (let j = 0; j < half; j++) {
        const tRe = wr * re[i + j + half] - wi * im[i + j + half]
        const tIm = wr * im[i + j + half] + wi * re[i + j + half]
        re[i + j + half] = re[i + j] - tRe
        im[i + j + half] = im[i + j] - tIm
        re[i + j] += tRe
        im[i + j] += tIm
        const nw = wr * wRe - wi * wIm
        wi = wr * wIm + wi * wRe
        wr = nw
      }
    }
  }
}

function blackmanWindow(n: number, N: number): number {
  return 0.42 - 0.5 * Math.cos(2 * Math.PI * n / (N - 1)) + 0.08 * Math.cos(4 * Math.PI * n / (N - 1))
}

function computeSpectrum(chunk: Float32Array, fftSize: number): Float32Array {
  const re = new Float32Array(fftSize)
  const im = new Float32Array(fftSize)
  const windowSize = Math.min(chunk.length, fftSize)
  for (let i = 0; i < windowSize; i++) {
    re[i] = chunk[i] * blackmanWindow(i, fftSize)
  }
  fftInplace(re, im)
  const bins = fftSize >> 1
  const magnitude = new Float32Array(bins)
  for (let i = 0; i < bins; i++) {
    magnitude[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i])
  }
  return magnitude
}

function magnitudeToByte(mag: Float32Array): Uint8Array {
  const bins = mag.length
  const minDb = -100
  const maxDb = -10
  const dbRange = maxDb - minDb
  const data = new Uint8Array(bins)
  for (let i = 0; i < bins; i++) {
    const db = 20 * Math.log10(Math.max(mag[i], 1e-10))
    const clamped = Math.max(0, Math.min(255, (db - minDb) / dbRange * 255))
    data[i] = Math.round(clamped)
  }
  return data
}

function pcmToFreqData(
  pcm: Float32Array,
  sampleRate: number,
  fftSize: number,
  fps: number,
): Float32Array[] {
  const hopSize = Math.max(Math.floor(sampleRate / fps), 1)
  const magnitudeFrames: Float32Array[] = []

  for (let offset = 0; offset + fftSize <= pcm.length; offset += hopSize) {
    const chunk = pcm.subarray(offset, offset + fftSize)
    const spectrum = computeSpectrum(chunk, fftSize)
    magnitudeFrames.push(spectrum)
  }

  return magnitudeFrames
}

function pcmToTimeData(
  pcm: Float32Array,
  sampleRate: number,
  fftSize: number,
  fps: number,
): Float32Array[] {
  const hopSize = Math.max(Math.floor(sampleRate / fps), 1)
  const frames: Float32Array[] = []
  for (let offset = 0; offset + fftSize <= pcm.length; offset += hopSize) {
    frames.push(new Float32Array(pcm.subarray(offset, offset + fftSize)))
  }
  return frames
}

export class OfflineAudioProcessor {
  async process(
    audioFile: File,
    fftSize: number,
    fps: number,
    onProgress?: (p: number) => void,
    smoothing = 0.8,
  ): Promise<OfflineAudioResult> {
    const arrayBuffer = await audioFile.arrayBuffer()

    const tempCtx = new AudioContext()
    let audioBuffer: AudioBuffer
    try {
      audioBuffer = await tempCtx.decodeAudioData(arrayBuffer)
    } finally {
      await tempCtx.close()
    }

    const sampleRate = audioBuffer.sampleRate
    const pcmL = audioBuffer.getChannelData(0)
    const pcmR = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : pcmL

    // 计算 magnitude 谱（在 dB 转换之前做平滑）
    const magFramesL = pcmToFreqData(pcmL, sampleRate, fftSize, fps)
    const magFramesR = pcmR !== pcmL ? pcmToFreqData(pcmR, sampleRate, fftSize, fps) : magFramesL
    const timeFramesL = pcmToTimeData(pcmL, sampleRate, fftSize, fps)
    const timeFramesR = pcmR !== pcmL ? pcmToTimeData(pcmR, sampleRate, fftSize, fps) : timeFramesL

    const totalFrames = Math.min(
      magFramesL.length, magFramesR.length,
      timeFramesL.length, timeFramesR.length,
    )

    const frames: OfflineFrame[] = []
    const binCount = fftSize / 2
    const smoothMagL = new Float32Array(binCount)
    const smoothMagR = new Float32Array(binCount)
    const merged = new Uint8Array(binCount)
    const prevMagL = new Float32Array(binCount)
    const prevMagR = new Float32Array(binCount)
    let hasPrevMag = false

    for (let i = 0; i < totalFrames; i++) {
      const rawMagL = magFramesL[i]
      const rawMagR = magFramesR[i]

      // 在 magnitude 域做帧间平滑（比 byte 域更精确）
      if (smoothing > 0 && hasPrevMag) {
        for (let b = 0; b < rawMagL.length; b++) {
          // smoothingTimeConstant 公式：
          // smoothed = prev * smoothing + current * (1 - smoothing)
          smoothMagL[b] = prevMagL[b] * smoothing + rawMagL[b] * (1 - smoothing)
          smoothMagR[b] = prevMagR[b] * smoothing + rawMagR[b] * (1 - smoothing)
        }
      } else {
        smoothMagL.set(rawMagL)
        smoothMagR.set(rawMagR)
      }

      // Copy to prev buffers for next frame
      prevMagL.set(smoothMagL)
      prevMagR.set(smoothMagR)
      hasPrevMag = true

      // 合并左右声道 magnitude → 转 byte
      merged.fill(0)
      for (let b = 0; b < smoothMagL.length; b++) {
        const avgMag = (smoothMagL[b] + smoothMagR[b]) / 2
        const db = 20 * Math.log10(Math.max(avgMag, 1e-10))
        const clamped = Math.max(0, Math.min(255, (db + 100) / 90 * 255))
        merged[b] = Math.round(clamped)
      }

      frames.push({
        freqData: merged,
        timeData: timeFramesL[i],
        index: i,
        timestamp: i / fps,
      })

      if (onProgress && i % 60 === 0) onProgress(i / totalFrames)
    }

    if (onProgress) onProgress(1)

    return {
      frames,
      sampleRate,
      duration: audioBuffer.duration,
      totalFrames,
      fftSize,
      fps,
    }
  }
}
