// 格式化时间（秒 → mm:ss）
export function formatTime(seconds: number): string {
  if (isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// hex 颜色 → "r,g,b" 字符串（用于 rgba() 背景）
export function hexToRgbStr(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r},${g},${b}`
}

// 生成随机 hex 颜色
export function randomColor(): string {
  return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')
}

// 限制值在范围内
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

// 对数频率映射：将线性 FFT bin 映射到对数分布的条形
//
//   freq = minFreq × (maxFreq / minFreq) ^ (t ^ exponent)
//
// exponent > 1 → 更多条给低频（bass-heavy 分布）
// exponent = 1 → 标准对数分布（每根条覆盖相同的倍频程比）
// exponent < 1 → 更多条给高频（treble-heavy 分布）
//
// 市面上标准 EQ / 频谱分析器（如 Foobar2000/Spotify）均使用
// 对数映射，因为人耳感知频率是对数的。
//
// 返回值为浮点 bin 索引，配合 averageBins() 做线性插值，
// 避免多个条形映射到同一个整数 bin 时出现"大块"现象。
//
// 使用缓存避免每帧重复计算 Math.pow()。
interface BinMapping {
  startBin: number
  endBin: number
}
const _binMappingCache = new Map<string, BinMapping[]>()
export function logFrequencyMap(
  barIndex: number,
  barCount: number,
  fftSize: number,
  sampleRate: number,
  exponent = 1.0
): { startBin: number; endBin: number } {
  // Build cache key from unique parameters
  const cacheKey = `${fftSize}_${barCount}_${sampleRate}_${exponent}`
  let mappings = _binMappingCache.get(cacheKey)

  if (!mappings) {
    const minFreq = 20
    const maxFreq = Math.min(20000, sampleRate / 2)
    const binResolution = sampleRate / fftSize
    const maxBin = fftSize / 2 - 1

    mappings = new Array(barCount)
    for (let i = 0; i < barCount; i++) {
      const t0 = Math.pow(i / barCount, exponent)
      const t1 = Math.pow((i + 1) / barCount, exponent)
      const freq0 = minFreq * Math.pow(maxFreq / minFreq, t0)
      const freq1 = minFreq * Math.pow(maxFreq / minFreq, t1)
      const startBin = Math.max(0, freq0 / binResolution)
      const endBin = Math.min(maxBin, Math.max(freq1 / binResolution, startBin + 1))
      mappings[i] = { startBin, endBin }
    }
    _binMappingCache.set(cacheKey, mappings)

    // Evict old entries if cache grows too large (keep last 8)
    if (_binMappingCache.size > 8) {
      const firstKey = _binMappingCache.keys().next().value
      if (firstKey) _binMappingCache.delete(firstKey)
    }
  }

  return mappings[barIndex]
}

// 线性插值平均：在浮点 bin 范围 [start, end) 上对 data 做插值平均。
// 当多个条形映射到同一个整数 bin 时，利用相邻 bin 插值产生平滑过渡，
// 避免大块现象。也支持跨多个 bin 的分数边界。
export function averageBins(data: Uint8Array, start: number, end: number): number {
  if (start >= end || start >= data.length || end <= 0) return 0

  const s = Math.max(0, Math.floor(start))
  const e = Math.min(data.length - 1, Math.floor(end))

  if (s === e) {
    // 落在同一个整数 bin 内：在相邻 bin 间线性插值
    const mid = (start + end) / 2
    const frac = mid - s
    const v0 = data[s]
    const v1 = data[Math.min(s + 1, data.length - 1)]
    return v0 + (v1 - v0) * Math.max(0, Math.min(1, frac))
  }

  let sum = 0
  let weight = 0

  // 第一个（部分）bin
  const firstWeight = s + 1 - start
  sum += data[s] * firstWeight
  weight += firstWeight

  // 中间的完整 bin
  for (let i = s + 1; i < e && i < data.length; i++) {
    sum += data[i]
    weight += 1
  }

  // 最后一个（部分）bin
  if (e < data.length) {
    const lastWeight = end - e
    sum += data[e] * lastWeight
    weight += lastWeight
  }

  return weight > 0 ? sum / weight : 0
}

// 对频率数据应用移动平均平滑，减少频谱中的尖峰和凹陷。
// windowSize: 平滑窗口大小（默认 5 个 bin），passes: 平滑迭代次数（默认 2）。
// 使用缓存 buffer 避免每帧分配内存。
const _smoothTemp = new Uint8Array(4096)
const _smoothResult = new Uint8Array(4096)
export function smoothFrequencyData(
  data: Uint8Array,
  windowSize = 5,
  passes = 2
): Uint8Array {
  const len = data.length
  const result = _smoothResult
  const temp = _smoothTemp

  // First pass: copy input → temp
  temp.set(data)

  for (let p = 0; p < passes; p++) {
    const half = Math.floor(windowSize / 2)
    for (let i = 0; i < len; i++) {
      let sum = 0
      let count = 0
      for (let j = i - half; j <= i + half; j++) {
        if (j >= 0 && j < len) {
          sum += temp[j]
          count++
        }
      }
      result[i] = Math.round(sum / count)
    }
    // Swap buffers for next pass
    temp.set(result)
  }

  return result
}
