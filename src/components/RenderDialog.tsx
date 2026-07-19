import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { RenderOrchestrator } from '../export/RenderOrchestrator'
import { useLanguage } from '../hooks/useLanguage'
import type { RenderResolution, RenderBitrate } from '../types'
import { getResolutionSize, getBitrateString } from '../types'

interface RenderDialogProps {
  onClose: () => void
  audioRef: React.RefObject<HTMLAudioElement | null>
}

type WizardStep = 1 | 2 | 3 | 4 | 5

const RESOLUTION_LABELS: Record<RenderResolution, { label: string; size: string }> = {
  '1080p': { label: '1080p', size: '1920 × 1080' },
  '2k':    { label: '2K',    size: '2560 × 1440' },
  '4k':    { label: '4K',    size: '3840 × 2160' },
}

const BITRATE_LABELS: Record<RenderBitrate, { zh: string; en: string }> = {
  low:    { zh: '低（2 Mbps）',  en: 'Low (2 Mbps)' },
  medium: { zh: '中（4 Mbps）',  en: 'Medium (4 Mbps)' },
  high:   { zh: '高（8 Mbps）',  en: 'High (8 Mbps)' },
  custom: { zh: '自定义',       en: 'Custom' },
}

const VISUALIZER_NAMES: Record<string, string> = {
  frequencyBars: '频谱柱状图',
  radialSpectrum: '径向频谱',
  oscilloscope: '示波器',
  aurora: '极光',
  waterfall: '瀑布图',
  lissajous: '利萨如图形',
}

export const RenderDialog: React.FC<RenderDialogProps> = ({ onClose, audioRef }) => {
  const { t, language } = useLanguage()
  const {
    renderConfig, setRenderConfig,
    renderState, setRenderState,
    audio,
    renderCanvas,
    currentVisualizer,
  } = useStore()

  const [step, setStep] = useState<WizardStep>(1)
  const [outputDir, setOutputDir] = useState<string>('')
  const [customBitrateInput, setCustomBitrateInput] = useState('8M')
  const orchestratorRef = useRef<RenderOrchestrator | null>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (renderState.stage === 'rendering' || renderState.stage === 'preparing' || renderState.stage === 'encoding') {
        orchestratorRef.current?.cancel()
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Preview canvas rAF loop with proper cleanup
  useEffect(() => {
    const el = previewCanvasRef.current
    if (!el || !renderCanvas) return
    if (renderState.stage !== 'rendering' && renderState.stage !== 'encoding') return

    el.width = renderCanvas.width
    el.height = renderCanvas.height
    const ctx = el.getContext('2d')
    if (!ctx) return

    let rafId: number
    const draw = () => {
      if (renderState.stage === 'rendering' || renderState.stage === 'encoding') {
        ctx.drawImage(renderCanvas, 0, 0, el.width, el.height)
        rafId = requestAnimationFrame(draw)
      }
    }
    rafId = requestAnimationFrame(draw)

    return () => cancelAnimationFrame(rafId)
  }, [renderCanvas, renderState.stage])

  const handleSelectDir = useCallback(async () => {
    const dir = await window.electronAPI?.selectDirectory()
    if (dir) setOutputDir(dir)
  }, [])

  const handleStartRender = useCallback(async () => {
    const audioEl = audioRef.current
    if (!audioEl?.src) return

    setStep(5)

    // 应用自定义码率
    if (renderConfig.bitratePreset === 'custom') {
      setRenderConfig({ customBitrate: customBitrateInput })
    }
    if (outputDir) {
      setRenderConfig({ outputPath: outputDir })
    }

    const orchestrator = new RenderOrchestrator()
    orchestratorRef.current = orchestrator

    // 从 blob URL 读取音频文件
    const response = await fetch(audioEl.src)
    const blob = await response.blob()
    const audioFile = new File([blob], audio.fileName || 'audio')

    await orchestrator.startRender(audioFile)
  }, [audioRef, renderConfig, outputDir, customBitrateInput, setRenderConfig])

  const handleCancel = useCallback(() => {
    orchestratorRef.current?.cancel()
    setStep(4)
  }, [])

  const handleDownload = useCallback(() => {
    if (!renderState.outputUrl) return
    const filename = `${(audio.fileName || 'audio').replace(/\.[^.]+$/, '')}-render.webm`
    const a = document.createElement('a')
    a.href = renderState.outputUrl
    a.download = filename
    a.click()
  }, [renderState.outputUrl, audio.fileName])

  const handleResetAndClose = useCallback(() => {
    orchestratorRef.current?.reset()
    onClose()
  }, [onClose])

  const isLangZh = language === 'zh'
  const tRender = t.render as Record<string, string>

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gradient-to-b from-gray-900 to-gray-950 border border-white/10 rounded-2xl w-[420px] max-h-[80vh] overflow-y-auto shadow-2xl shadow-violet-500/10 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20 [&::-webkit-scrollbar-track]:bg-transparent">
        {/* 头部 */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{tRender.title || 'Render'}</h2>
          <button
            onClick={handleResetAndClose}
            className="p-1.5 hover:bg-white/10 rounded-xl transition-all duration-200 text-gray-400 hover:text-white"
            aria-label={tRender.close || 'Close'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 进度条（步骤指示器） */}
        {step < 5 && (
          <div className="px-4 pt-4">
            <div className="flex gap-1.5">
              {[1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                    s <= step ? 'bg-violet-500' : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] text-gray-500">
              <span>{tRender.step1Title}</span>
              <span>{tRender.step2Title}</span>
              <span>{tRender.step3Title}</span>
              <span>{tRender.step4Title}</span>
            </div>
          </div>
        )}

        <div className="p-4 space-y-4">
          {/* ── Step 1: 输出设置 ── */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-white">{tRender.step1Title}</h3>
              <div>
                <label className="text-[11px] text-gray-400 mb-2 block">{tRender.outputDir}</label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-400 truncate">
                    {outputDir || tRender.outputDirNotSet}
                  </div>
                  <button
                    onClick={handleSelectDir}
                    className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-white transition-all duration-200 whitespace-nowrap"
                  >
                    {tRender.selectDir}
                  </button>
                </div>
              </div>
              <button
                onClick={() => setStep(2)}
                className="w-full p-3 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 rounded-xl text-sm text-white transition-all duration-200 flex items-center justify-center gap-2"
              >
                {tRender.next}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}

          {/* ── Step 2: 分辨率 ── */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-white">{tRender.step2Title}</h3>
              <div className="space-y-2">
                {(Object.keys(RESOLUTION_LABELS) as RenderResolution[]).map((res) => (
                  <button
                    key={res}
                    onClick={() => setRenderConfig({ resolution: res })}
                    className={`w-full p-3 rounded-xl text-sm border transition-all duration-200 flex items-center justify-between ${
                      renderConfig.resolution === res
                        ? 'bg-violet-500/20 border-violet-500/50 text-white'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="font-medium">{RESOLUTION_LABELS[res].label}</span>
                    <span className="text-[11px] opacity-60">{RESOLUTION_LABELS[res].size}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-gray-400 transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  {tRender.back}
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 p-3 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 rounded-xl text-sm text-white transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {tRender.next}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: 帧率 ── */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-white">{tRender.step3Title}</h3>
              <div className="space-y-2">
                {([30, 60] as const).map((fps) => (
                  <button
                    key={fps}
                    onClick={() => setRenderConfig({ fps })}
                    className={`w-full p-3 rounded-xl text-sm border transition-all duration-200 flex items-center justify-between ${
                      renderConfig.fps === fps
                        ? 'bg-violet-500/20 border-violet-500/50 text-white'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="font-medium">{fps} FPS</span>
                    <span className="text-[11px] opacity-60">
                      {fps === 60 ? (isLangZh ? '更流畅' : 'Smoother') : (isLangZh ? '更小文件' : 'Smaller file')}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-gray-400 transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  {tRender.back}
                </button>
                <button
                  onClick={() => setStep(4)}
                  className="flex-1 p-3 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 rounded-xl text-sm text-white transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {tRender.next}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: 码率 ── */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-white">{tRender.step4Title}</h3>
              <div className="space-y-2">
                {(['low', 'medium', 'high', 'custom'] as RenderBitrate[]).map((br) => (
                  <button
                    key={br}
                    onClick={() => setRenderConfig({ bitratePreset: br })}
                    className={`w-full p-3 rounded-xl text-sm border transition-all duration-200 flex items-center justify-between ${
                      renderConfig.bitratePreset === br
                        ? 'bg-violet-500/20 border-violet-500/50 text-white'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span className="font-medium">
                      {isLangZh ? BITRATE_LABELS[br].zh : BITRATE_LABELS[br].en}
                    </span>
                  </button>
                ))}
              </div>
              {renderConfig.bitratePreset === 'custom' && (
                <input
                  type="text"
                  value={customBitrateInput}
                  onChange={(e) => setCustomBitrateInput(e.target.value)}
                  placeholder={tRender.bitrateCustomPlaceholder}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50 transition-colors placeholder:text-gray-600"
                />
              )}
              {/* 当前设置确认 */}
              <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--glass-border)]">
                <h4 className="text-sm font-medium mb-3">当前设置确认</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="opacity-50">分辨率</span>
                    <span className="ml-2">{getResolutionSize(renderConfig.resolution)[0]}×{getResolutionSize(renderConfig.resolution)[1]}</span>
                  </div>
                  <div>
                    <span className="opacity-50">帧率</span>
                    <span className="ml-2">{renderConfig.fps} FPS</span>
                  </div>
                  <div>
                    <span className="opacity-50">可视化器</span>
                    <span className="ml-2">{VISUALIZER_NAMES[currentVisualizer]}</span>
                  </div>
                  <div>
                    <span className="opacity-50">码率</span>
                    <span className="ml-2">{getBitrateString(renderConfig)}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-gray-400 transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  {tRender.back}
                </button>
                <button
                  onClick={handleStartRender}
                  className="flex-1 p-3 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 rounded-xl text-sm text-white transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {tRender.startRender}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 5: 渲染进度 / 完成 ── */}
          {step === 5 && (
            <div className="space-y-4">
              {/* 渲染中 */}
              {(renderState.stage === 'preparing' || renderState.stage === 'rendering' || renderState.stage === 'encoding') && (
                <>
                  {/* 渲染预览 */}
                  {renderCanvas && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium mb-2">渲染预览</h4>
                      <div className="rounded-xl overflow-hidden border border-[var(--glass-border)] bg-black">
                        <canvas
                          ref={previewCanvasRef}
                          style={{ width: '100%', maxHeight: '200px', objectFit: 'contain' }}
                        />
                      </div>
                    </div>
                  )}
                  <h3 className="text-sm font-medium text-white">
                    {renderState.stage === 'preparing' ? tRender.decoding :
                     renderState.stage === 'encoding' ? tRender.encoding :
                     tRender.rendering}
                  </h3>
                  <div className="w-full bg-white/10 rounded-full h-2.5">
                    <div
                      className="bg-gradient-to-r from-violet-600 to-blue-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(renderState.progress * 100, 100)}%` }}
                    />
                  </div>
                  <div className="text-center text-sm text-gray-500">
                    <span className="text-[11px] text-gray-600 uppercase tracking-wider mr-2">
                      {renderState.stageLabel}
                    </span>
                    {renderState.progress < 1 ? `${Math.floor(renderState.progress * 100)}%` : '100%'}
                  </div>
                  <button
                    onClick={handleCancel}
                    className="w-full p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-gray-400 transition-all duration-200"
                  >
                    {tRender.cancelRender}
                  </button>
                </>
              )}

              {/* 完成 */}
              {renderState.stage === 'done' && (
                <div className="text-center space-y-4">
                  <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                    <svg className="w-10 h-10 text-green-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-green-400 text-sm font-medium">{tRender.done}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDownload}
                      className="flex-1 p-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-xl text-sm text-white transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      {tRender.saveVideo}
                    </button>
                    <button
                      onClick={handleResetAndClose}
                      className="flex-1 p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-gray-400 transition-all duration-200"
                    >
                      {tRender.close}
                    </button>
                  </div>
                </div>
              )}

              {/* 错误 */}
              {renderState.stage === 'error' && (
                <div className="text-center space-y-4">
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                    <svg className="w-10 h-10 text-red-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <p className="text-red-400 text-sm font-medium">{tRender.renderFailed}</p>
                    {renderState.error && (
                      <p className="text-red-500/60 text-[11px] mt-1">{renderState.error}</p>
                    )}
                  </div>
                  <button
                    onClick={() => { orchestratorRef.current?.reset(); setStep(4) }}
                    className="w-full p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-gray-400 transition-all duration-200"
                  >
                    {tRender.back}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
