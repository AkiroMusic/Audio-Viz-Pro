import React, { useState, useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { VideoExporter } from '../export/VideoExporter'
import type { VideoExportOptions } from '../export/VideoExporter'
import { exportImage } from '../export/ImageExporter'
import { RenderPipeline } from '../export/RenderPipeline'
import type { RenderProgress } from '../export/RenderPipeline'
import { useLanguage } from '../hooks/useLanguage'

interface ExportPanelProps {
  onClose: () => void
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  audioRef: React.RefObject<HTMLAudioElement | null>
}

export const ExportPanel: React.FC<ExportPanelProps> = ({ onClose, canvasRef, audioRef }) => {
  const { recordingState, setRecordingState } = useStore()
  const { t } = useLanguage()
  const [recordingTime, setRecordingTime] = useState(0)
  const [videoFps, setVideoFps] = useState(60)
  const [videoResolution, setVideoResolution] = useState<'original' | '1080p' | '720p'>('original')
  const [renderState, setRenderState] = useState<'idle' | 'rendering' | 'done'>('idle')
  const [renderProgress, setRenderProgress] = useState(0)
  const [renderFps, setRenderFps] = useState(60)
  const [renderResolution, setRenderResolution] = useState<'1080p' | '720p'>('1080p')
  const [renderCodec, setRenderCodec] = useState<'vp9'>('vp9')
  const [renderStage, setRenderStage] = useState<string>('')
  const pipelineRef = useRef<RenderPipeline | null>(null)

  const videoExporterRef = useRef(new VideoExporter())
  const recordingTimerRef = useRef<number | null>(null)

  // 组件卸载时清理录制计时器
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
    }
  }, [])

  // 组件卸载时清理 DOM 下载横幅
  useEffect(() => {
    return () => {
      document.querySelectorAll('.av-download-banner').forEach(el => el.remove())
    }
  }, [])

  const handleScreenshot = () => {
    if (!canvasRef.current) return
    exportImage(canvasRef.current)
  }

  const handleStartVideoRecording = () => {
    if (!canvasRef.current || !audioRef.current) return
    
    const options: VideoExportOptions = { frameRate: videoFps, resolution: videoResolution }
    videoExporterRef.current.startRecording(canvasRef.current, audioRef.current, options)
    setRecordingState('recording')
    setRecordingTime(0)
    
    recordingTimerRef.current = window.setInterval(() => {
      setRecordingTime((prev) => prev + 1)
    }, 1000)
  }

  const handleStopVideoRecording = async () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
    }
    
    setRecordingState('processing')
    try {
      await videoExporterRef.current.stopRecording()
      setRecordingState('done')
    } catch (err) {
      console.error('Recording failed:', err)
      setRecordingState('idle')
    }
  }

  const handleCancelRender = () => {
    if (pipelineRef.current) {
      pipelineRef.current.cancel()
      pipelineRef.current = null
    }
    setRenderState('idle')
    setRenderProgress(0)
  }

  /** 在 DOM 中插入下载提示条（绕过 React state 更新，确保 100% 触发） */
  const showDownloadBanner = (url: string, filename: string) => {
    // 移除之前残留的
    document.querySelectorAll('.av-download-banner').forEach(el => el.remove())

    const banner = document.createElement('div')
    banner.className = 'av-download-banner'
    banner.style.cssText = [
      'position: fixed',
      'bottom: 24px',
      'right: 24px',
      'z-index: 9999',
      'background: #065f46',
      'border: 1px solid rgba(34,197,94,0.3)',
      'color: #d1fae5',
      'padding: 16px 20px',
      'border-radius: 14px',
      'font-size: 14px',
      'box-shadow: 0 8px 32px rgba(0,0,0,0.4)',
      'display: flex',
      'align-items: center',
      'gap: 12px',
      'max-width: 360px',
    ].join(';')

    banner.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2">
        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <div>
        <div style="font-weight:600;color:#fff;margin-bottom:2px">渲染完成！</div>
        <div style="font-size:11px;color:#6ee7b7;word-break:break-all">${filename}</div>
      </div>
      <button class="av-download-btn" style="
        background:#22c55e;color:#fff;border:none;border-radius:8px;
        padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;
        white-space:nowrap;transition:background 0.15s;
      ">保存</button>
    `

    document.body.appendChild(banner)

    // 下载按钮点击
    banner.querySelector('.av-download-btn')?.addEventListener('click', () => {
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      // 闪烁反馈
      const btn = banner.querySelector('.av-download-btn') as HTMLElement
      if (btn) {
        btn.style.background = '#059669'
        btn.textContent = '✓ 已保存'
      }
    })

    // 自动关闭（5 分钟后清理，避免内存泄漏）
    setTimeout(() => {
      banner.remove()
      URL.revokeObjectURL(url)
    }, 300_000)
  }

  const handleStartRender = async () => {
    const audioEl = audioRef.current
    if (!audioEl || !audioEl.src) return

    setRenderState('rendering')
    setRenderProgress(0)
    setRenderStage('')

    const pipeline = new RenderPipeline()
    pipelineRef.current = pipeline

    try {
      // Read audio file from blob URL
      const response = await fetch(audioEl.src)
      const blob = await response.blob()
      const fileName = useStore.getState().audio.fileName || 'audio'
      const audioFile = new File([blob], fileName)

      const { params, currentVisualizer } = useStore.getState()
      const resolutionMap: Record<string, [number, number]> = { '1080p': [1920, 1080], '720p': [1280, 720] }
      const [width, height] = resolutionMap[renderResolution]

      const url = await pipeline.render({
        audioFile,
        visualizerType: currentVisualizer,
        params,
        fps: renderFps,
        width,
        height,
      }, (p: RenderProgress) => {
        setRenderProgress(p.progress)
        setRenderStage(p.stage)
      })

      // 渲染成功
      const filename = `${(useStore.getState().audio.fileName || 'audio').replace(/\.[^.]+$/, '')}-render.webm`
      pipelineRef.current = null

      // 自动下载
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      // DOM 下载横幅（备用，防止自动下载被拦截）
      showDownloadBanner(url, filename)

      // 显示"完成"状态，1.5 秒后自动重置
      setRenderProgress(1)
      setRenderStage('done')
      setTimeout(() => setRenderState('idle'), 1500)
      } catch (err) {
      pipelineRef.current = null
      if ((err as Error)?.message === 'Render cancelled') {
        setRenderState('idle')
      } else {
        const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
        console.error('Render failed:', err)
        window.alert(`❌ 渲染失败：${msg}`)
        setRenderState('idle')
      }
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gradient-to-b from-gray-900 to-gray-950 border border-white/10 rounded-2xl w-[400px] max-h-[80vh] overflow-y-auto shadow-2xl shadow-violet-500/10 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent">
        {/* 头部 */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{t.export.title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-xl transition-all duration-200 text-gray-400 hover:text-white"
            aria-label={t.export.close}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* 截图导出 */}
          <div>
            <h3 className="text-sm font-medium text-white mb-3">{t.export.screenshot}</h3>
            <button
              onClick={handleScreenshot}
              className="w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm text-white transition-all duration-200 flex items-center justify-center gap-2 border border-white/10 hover:border-white/20"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {t.export.screenshotPng}
            </button>
          </div>

          {/* 视频录制 */}
          <div>
            <h3 className="text-sm font-medium text-white mb-3">{t.export.video}</h3>

            {recordingState === 'idle' && (
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-[11px] text-gray-400 mb-1 block">{t.export.frameRate}</label>
                  <select
                    value={videoFps}
                    onChange={(e) => setVideoFps(parseInt(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50 transition-colors"
                  >
                    <option value="30">30 fps</option>
                    <option value="60">60 fps</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-gray-400 mb-1 block">{t.export.resolution}</label>
                  <select
                    value={videoResolution}
                    onChange={(e) => setVideoResolution(e.target.value as 'original' | '1080p' | '720p')}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50 transition-colors"
                  >
                    <option value="original">{t.export.resOriginal}</option>
                    <option value="1080p">1080p</option>
                    <option value="720p">720p</option>
                  </select>
                </div>
              </div>
            )}

            {recordingState === 'idle' ? (
              <button
                onClick={handleStartVideoRecording}
                className="w-full p-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-xl text-sm text-white transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-red-500/25"
              >
                <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                {t.export.startRecording}
              </button>
            ) : recordingState === 'recording' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 text-red-400">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm font-mono">{Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}</span>
                </div>
                <button
                  onClick={handleStopVideoRecording}
                  className="w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm text-white transition-all duration-200 border border-white/10"
                >
                  {t.export.stopRecording}
                </button>
              </div>
            ) : recordingState === 'processing' ? (
              <div className="text-center text-gray-500 text-sm">{t.export.processing}</div>
            ) : (
              <div className="text-center bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-4">
                <svg className="w-8 h-8 text-green-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-green-400 text-sm font-medium">{t.export.recordingDone}</p>
                <p className="text-green-500/60 text-[10px] mt-1">audioviz-recording.webm</p>
              </div>
            )}
            <p className="text-[10px] text-gray-500 mt-2">{t.export.videoFormat}</p>
          </div>

          {/* 离线渲染 */}
          <div>
            <h3 className="text-sm font-medium text-white mb-3">{t.export.render}</h3>
            <p className="text-[10px] text-gray-500 mb-3">{t.export.renderDesc}</p>

            {renderState === 'idle' && (
              <>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-[11px] text-gray-400 mb-1 block">{t.export.codec}</label>
                    <select
                      value={renderCodec}
                      onChange={(e) => setRenderCodec(e.target.value as 'vp9')}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50 transition-colors"
                    >
                      <option value="vp9">VP9 (WebM)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-400 mb-1 block">{t.export.frameRate}</label>
                    <select
                      value={renderFps}
                      onChange={(e) => setRenderFps(parseInt(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50 transition-colors"
                    >
                      <option value="30">30 fps</option>
                      <option value="60">60 fps</option>
                    </select>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="text-[11px] text-gray-400 mb-1 block">{t.export.resolution}</label>
                  <select
                    value={renderResolution}
                    onChange={(e) => setRenderResolution(e.target.value as '1080p' | '720p')}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50 transition-colors"
                  >
                    <option value="1080p">1080p</option>
                    <option value="720p">720p</option>
                  </select>
                </div>
                <button
                  onClick={handleStartRender}
                  className="w-full p-3 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 rounded-xl text-sm text-white transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-violet-500/25"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {t.export.renderVideo}
                </button>
              </>
            )}

            {renderState === 'rendering' && (
              <div className="space-y-3">
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-violet-600 to-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(renderProgress * 100, 100)}%` }}
                  />
                </div>
                <div className="text-center text-gray-500 text-sm">
                  {renderStage && (
                    <span className="text-gray-600 text-[11px] mr-2 uppercase tracking-wider">{renderStage}</span>
                  )}
                  {renderProgress < 1 ? `${Math.floor(renderProgress * 100)}%` : '100%'}
                </div>
                <button
                  onClick={handleCancelRender}
                  className="w-full p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-gray-400 transition-all duration-200"
                >
                  取消渲染
                </button>
              </div>
            )}


          </div>
        </div>
      </div>
    </div>
  )
}
