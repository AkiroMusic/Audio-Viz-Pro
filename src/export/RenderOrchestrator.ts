/**
 * RenderOrchestrator
 *
 * 高层离线渲染编排器。
 * 封装 RenderPipeline，管理渲染状态机，将进度写入 Zustand Store。
 *
 * 状态机：idle → preparing → rendering → encoding → done
 */

import { RenderPipeline, type RenderProgress } from './RenderPipeline'
import type { RenderConfig, RenderState } from '../types'
import { getBitrateString, getResolutionSize } from '../types'
import { useStore } from '../store/useStore'

export class RenderOrchestrator {
  private pipeline: RenderPipeline | null = null
  private _cancelled = false

  /** 从 Store 读取当前 renderConfig，开始渲染 */
  async startRender(audioFile: File): Promise<void> {
    const store = useStore.getState()
    const config = store.renderConfig
    const { params, currentVisualizer } = store

    this._cancelled = false
    this.pipeline = new RenderPipeline()

    const updateState = (partial: Partial<RenderState>) => {
      useStore.getState().setRenderState(partial)
    }

    try {
      // Phase: preparing
      updateState({ stage: 'preparing', progress: 0, stageLabel: 'preparing' })

      const [width, height] = getResolutionSize(config.resolution)
      const bitrate = getBitrateString(config)

      // Phase: rendering (驱动 RenderPipeline)
      updateState({ stage: 'rendering', progress: 0, stageLabel: 'rendering' })

      const url = await this.pipeline.render(
        {
          audioFile,
          visualizerType: currentVisualizer,
          params,
          fps: config.fps,
          width,
          height,
          bitrate,
        },
        (progress: RenderProgress) => {
          if (this._cancelled) return

          const stageMap: Record<string, RenderState['stage']> = {
            decoding: 'preparing',
            rendering: 'rendering',
            encoding: 'encoding',
            done: 'done',
          }

          updateState({
            stage: stageMap[progress.stage] || 'rendering',
            progress: progress.progress,
            stageLabel: progress.stage,
          })
        },
        (canvas) => {
          useStore.getState().setRenderCanvas(canvas)
        },
      )

      if (this._cancelled) {
        URL.revokeObjectURL(url)
        return
      }

      // Phase: done
      updateState({ stage: 'done', progress: 1, stageLabel: 'done', outputUrl: url })
    } catch (err) {
      if ((err as Error)?.message === 'Render cancelled') {
        updateState({ stage: 'idle', progress: 0, stageLabel: '' })
      } else {
        const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
        updateState({ stage: 'error', progress: 0, stageLabel: '', error: msg })
      }
    } finally {
      this.pipeline = null
    }
  }

  /** 取消当前渲染 */
  cancel(): void {
    this._cancelled = true
    this.pipeline?.cancel()
    this.pipeline = null
    useStore.getState().setRenderCanvas(null)
    useStore.getState().setRenderState({
      stage: 'idle',
      progress: 0,
      stageLabel: '',
      error: undefined,
      outputUrl: undefined,
    })
  }

  /** 重置状态为 idle */
  reset(): void {
    useStore.getState().setRenderState({
      stage: 'idle',
      progress: 0,
      stageLabel: '',
      error: undefined,
      outputUrl: undefined,
    })
  }
}
