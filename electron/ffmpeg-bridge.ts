/**
 * FFmpegBridge
 *
 * 通过 child_process.spawn 调用原生 ffmpeg，stdin pipe 逐帧喂入 RGB24 数据。
 *
 * 内存模型：
 *   - JS Heap: 只有当前帧 (~6MB 1080p / ~25MB 4K)
 *   - MEMFS: 无
 *   - 临时文件: 无
 *   - ffmpeg 内部缓冲: ~50-100MB（恒定）
 *
 * 数据流：Frame → stdin → ffmpeg → output.webm
 *
 * 使用方式（三步）：
 *   1. bridge.spawnFfmpeg(config, totalFrames, onProgress)  — 立即返回
 *   2. bridge.writeFrame(data) × N                           — 逐帧调用
 *   3. bridge.finishStdin()                                  — 关闭 stdin
 *      await bridge.waitForFinish()                          — 等 ffmpeg 退出
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs'

// 使用 createRequire 在运行时加载 ffmpeg-static，绕过 bundler（Rolldown 会内联 CJS 模块导致 __dirname 缺失）
const _require = createRequire(import.meta.url)

export interface RenderConfig {
  width: number
  height: number
  fps: number
  bitrate: string
  audioPath: string
  outputPath: string
}

export interface RenderProgress {
  frame: number
  fps: number
  time: string
  speed: string
}

export class FFmpegBridge {
  private process: ChildProcess | null = null
  private _finishPromise: Promise<string> | null = null
  private _finishResolve: ((value: string) => void) | null = null
  private _finishReject: ((reason: Error) => void) | null = null
  private _stderrBuffer = ''

  private getFfmpegBinary(): string {
    const binPath = _require('ffmpeg-static') as string | null
    if (!binPath) {
      throw new Error('ffmpeg-static: binary path is null. The ffmpeg binary may not have been downloaded.')
    }
    if (!fs.existsSync(binPath)) {
      throw new Error(`ffmpeg-static: binary not found at ${binPath}`)
    }
    return binPath
  }

  /**
   * 启动 ffmpeg 进程。立即返回，不等待退出。
   * 调用方需后续调用 writeFrame → finishStdin → waitForFinish 完成整个流程。
   */
  spawnFfmpeg(
    config: RenderConfig,
    _totalFrames: number,
    onProgress?: (progress: RenderProgress) => void,
  ): void {
    const ffmpegBin = this.getFfmpegBinary()
    this._stderrBuffer = ''

    const { width, height, fps, bitrate, audioPath, outputPath } = config

    const args = [
      '-y',
      '-f', 'rawvideo',
      '-pix_fmt', 'rgb24',
      '-s', `${width}x${height}`,
      '-r', `${fps}`,
      '-i', 'pipe:0',
      '-i', audioPath,
      '-c:v', 'libvpx',
      '-b:v', bitrate,
      '-deadline', 'realtime',
      '-cpu-used', '4',
      '-c:a', 'libopus',
      '-shortest',
      outputPath,
    ]

    this.process = spawn(ffmpegBin, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    this._finishPromise = new Promise<string>((resolve, reject) => {
      this._finishResolve = resolve
      this._finishReject = reject
    })

    this.process.stderr?.on('data', (chunk: Buffer) => {
      this._handleStderr(chunk.toString(), onProgress)
    })

    this.process.on('error', (err) => {
      this.process = null
      this._finishReject?.(new Error(`ffmpeg spawn failed: ${err.message}`))
    })

    this.process.on('close', (code) => {
      this.process = null
      if (code === 0) {
        this._finishResolve?.(outputPath)
      } else {
        this._finishReject?.(new Error(`ffmpeg exited with code ${code}.\n${this._stderrBuffer}`))
      }
    })
  }

  /**
   * 向 ffmpeg stdin 写入一帧 RGB24 数据。
   */
  writeFrame(rgb24Data: Buffer | Uint8Array): void {
    if (!this.process?.stdin) {
      throw new Error('No ffmpeg process running')
    }
    this.process.stdin.write(rgb24Data)
  }

  /**
   * 关闭 stdin，通知 ffmpeg 所有帧已送入。
   */
  finishStdin(): void {
    if (this.process?.stdin) {
      this.process.stdin.end()
    }
  }

  /**
   * 等待 ffmpeg 进程退出。必须在 finishStdin() 之后调用。
   * @returns 输出文件路径
   */
  waitForFinish(): Promise<string> {
    if (!this._finishPromise) {
      return Promise.reject(new Error('No ffmpeg process started'))
    }
    return this._finishPromise
  }

  /**
   * 强制终止 ffmpeg 进程。
   */
  cancelRender(): void {
    if (this.process) {
      this.process.kill()
      this.process = null
    }
    this._finishResolve = null
    this._finishReject = null
    this._finishPromise = null
  }

  get isRunning(): boolean {
    return this.process !== null && !this.process.killed
  }

  private _handleStderr(data: string, onProgress?: (progress: RenderProgress) => void): void {
    this._stderrBuffer += data

    const lines = this._stderrBuffer.split('\r')
    this._stderrBuffer = lines.pop() ?? ''

    for (const l of lines) {
      const frameMatch = l.match(/frame=\s*(\d+)/)
      const fpsMatch = l.match(/fps=\s*([\d.]+)/)
      const timeMatch = l.match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/)
      const speedMatch = l.match(/speed=\s*([\d.]+)x/)

      if (frameMatch) {
        onProgress?.({
          frame: parseInt(frameMatch[1], 10),
          fps: fpsMatch ? parseFloat(fpsMatch[1]) : 0,
          time: timeMatch?.[1] ?? '',
          speed: speedMatch ? `${speedMatch[1]}x` : '',
        })
      }
    }
  }
}
