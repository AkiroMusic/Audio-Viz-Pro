import React, { useCallback } from 'react'
import { useStore, type PanelVisibility } from '../store/useStore'
import { VISUALIZER_LIST, DEFAULT_PARAMS } from '../constants'
import type { VisualizerType } from '../types'
import { useLanguage } from '../hooks/useLanguage'

interface LeftPanelProps {
  className?: string
  style?: React.CSSProperties
}

function cycleVisibility(current: PanelVisibility): PanelVisibility {
  if (current === 'full') return 'collapsed'
  if (current === 'collapsed') return 'hidden'
  return 'full'
}

export function VisualizerIcon({ icon, isActive }: { icon: string; isActive: boolean }) {
  const iconMap: Record<string, React.ReactElement> = {
    bars: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <rect x="3" y="12" width="3" height="9" rx="1" />
        <rect x="8" y="8" width="3" height="13" rx="1" />
        <rect x="13" y="4" width="3" height="17" rx="1" />
        <rect x="18" y="9" width="3" height="12" rx="1" />
      </svg>
    ),
    radial: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <circle cx="12" cy="12" r="3" />
        <circle cx="12" cy="12" r="7" strokeDasharray="4 2" />
        <circle cx="12" cy="12" r="10" strokeDasharray="2 3" />
      </svg>
    ),
    wave: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <path d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0" strokeLinecap="round" />
      </svg>
    ),
    aurora: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <path d="M2 16c4-8 6-12 10-12s6 8 10 4" strokeLinecap="round" />
        <path d="M4 20c3-4 5-8 8-8s5 4 8 2" strokeLinecap="round" opacity="0.5" />
      </svg>
    ),
    waterfall: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <path d="M3 4h18M3 8h18M3 12h18M3 16h18M3 20h18" strokeLinecap="round" opacity="0.3" />
        <path d="M3 4c3 4 5 0 8 4s5 0 8 4 3 0 3 0" strokeLinecap="round" />
      </svg>
    ),
    lissajous: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <path d="M12 4c-4 0-8 4-8 8s4 8 8 8 8-4 8-8-4-8-8-8z" strokeLinecap="round" />
        <path d="M12 4c4 0 8 4 8 8s-4 8-8 8-8-4-8-8 4-8 8-8z" strokeLinecap="round" opacity="0.5" />
      </svg>
    ),
    particles: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <circle cx="8" cy="8" r="1.5" fill="currentColor" />
        <circle cx="16" cy="6" r="1" fill="currentColor" />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
        <circle cx="6" cy="16" r="1" fill="currentColor" />
        <circle cx="18" cy="14" r="1.5" fill="currentColor" />
        <circle cx="14" cy="18" r="1" fill="currentColor" />
      </svg>
    ),
    terrain: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <path d="M3 20l5-8 4 4 6-10 3 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    helix: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <path d="M8 3c0 4 8 4 8 8s-8 4-8 8" strokeLinecap="round" />
        <path d="M16 3c0 4-8 4-8 8s8 4 8 8" strokeLinecap="round" opacity="0.5" />
      </svg>
    ),
    galaxy: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
        <circle cx="12" cy="12" r="2" fill="currentColor" />
        <path d="M12 10c2-4 6-4 8-2s2 6-2 8-8 2-10-2 2-6 4-4" strokeLinecap="round" />
        <path d="M12 14c-2 4-6 4-8 2s-2-6 2-8 8-2 10 2-2 6-4 4" strokeLinecap="round" opacity="0.5" />
      </svg>
    ),
  }

  return (
    <div className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200 ${
      isActive 
        ? 'bg-gradient-to-br from-violet-600/30 to-blue-600/30 text-white shadow-lg shadow-violet-500/20' 
        : 'bg-white/5 text-gray-400 group-hover:bg-white/10 group-hover:text-white'
    }`}>
      {iconMap[icon] || <span className="text-sm">{icon}</span>}
    </div>
  )
}

export const LeftPanel: React.FC<LeftPanelProps> = ({ className = '', style }) => {
  const { 
    currentVisualizer, 
    setVisualizer, 
    params, 
    setParams,
    showPresetPanel,
    setShowPresetPanel,
    showShortcutsHelp,
    setShowShortcutsHelp,
    leftPanelVisibility,
    setLeftPanelVisibility,
  } = useStore()
  const { t, language, setLanguage } = useLanguage()

  const handleToggle = useCallback(() => {
    setLeftPanelVisibility(cycleVisibility(leftPanelVisibility))
  }, [leftPanelVisibility, setLeftPanelVisibility])

  const width = leftPanelVisibility === 'full' ? '260px' : leftPanelVisibility === 'collapsed' ? '56px' : '0px'
  const isHidden = leftPanelVisibility === 'hidden'

  return (
    <>
      {/* Floating toggle — always visible even when panel is hidden */}
      {!isHidden && (
        <button
          onClick={handleToggle}
          className="fixed top-4 z-50 p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-500 hover:text-white bg-gray-950/80 backdrop-blur-sm border border-white/5"
          style={{ left: leftPanelVisibility === 'full' ? '248px' : '44px' }}
          title={leftPanelVisibility === 'full' ? 'Collapse panel' : 'Expand panel'}
        >
          <svg className="w-4 h-4 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Left edge drawer handle — always visible */}
      <button
        onClick={() => setLeftPanelVisibility(isHidden ? 'full' : 'hidden')}
        className="fixed left-0 top-1/2 -translate-y-1/2 z-50 px-1 py-4 bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-white/10 border-l-0 rounded-r-lg transition-all duration-200 text-gray-500 hover:text-violet-400 group"
        title={isHidden ? 'Show left panel' : 'Hide left panel'}
      >
        <svg className="w-3 h-3 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <div 
        className={`fixed left-0 top-0 bottom-[70px] bg-gradient-to-b from-gray-950/98 to-gray-900/95 backdrop-blur-xl border-r border-white/5 overflow-y-auto overflow-x-hidden transition-all duration-300 ${className}`}
        style={{ 
          ...style, 
          width,
          visibility: isHidden ? 'hidden' : undefined,
          pointerEvents: isHidden ? 'none' : undefined,
        }}
      >
        <div className={`p-4 ${leftPanelVisibility !== 'full' ? 'pt-4' : ''}`}>
          <div className="mb-6">
            <h1 className={`font-semibold bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent ${leftPanelVisibility !== 'full' ? 'text-sm' : 'text-lg'}`}>
              {leftPanelVisibility !== 'full' ? 'AV' : t.app.title}
            </h1>
            {leftPanelVisibility === 'full' && <p className="text-[11px] text-gray-500 mt-0.5">{t.app.subtitle}</p>}
          </div>

          {leftPanelVisibility === 'full' && (
            <div className="mb-4 flex gap-1">
              <button
                onClick={() => setLanguage('zh')}
                className={`px-2 py-1 rounded-lg text-[10px] transition-colors ${language === 'zh' ? 'bg-violet-600/30 text-white' : 'text-gray-500 hover:text-white'}`}
              >
                中文
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`px-2 py-1 rounded-lg text-[10px] transition-colors ${language === 'en' ? 'bg-violet-600/30 text-white' : 'text-gray-500 hover:text-white'}`}
              >
                EN
              </button>
            </div>
          )}

          <div className="mb-6">
            {leftPanelVisibility === 'full' && <h2 className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-3">{t.leftPanel.visualizers}</h2>}
            <div className="space-y-1">
              {VISUALIZER_LIST.map((viz) => (
                <button
                  key={viz.id}
                  onClick={() => setVisualizer(viz.id)}
                  title={leftPanelVisibility !== 'full' ? t.visualizers[viz.id].name : undefined}
                  className={`group w-full p-2.5 rounded-xl text-left transition-all duration-200 ${
                    currentVisualizer === viz.id
                      ? 'bg-gradient-to-r from-violet-600/20 to-blue-600/20 border border-violet-500/30'
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className={`flex items-center gap-3 ${leftPanelVisibility !== 'full' ? 'justify-center' : ''}`}>
                    <VisualizerIcon icon={viz.icon} isActive={currentVisualizer === viz.id} />
                    {leftPanelVisibility === 'full' && (
                      <div className="flex-1 min-w-0">
                        <span className={`text-sm font-medium ${
                          currentVisualizer === viz.id ? 'text-white' : 'text-gray-300 group-hover:text-white'
                        }`}>
                          {t.visualizers[viz.id].name}
                        </span>
                        <p className="text-[11px] text-gray-500 truncate">{t.visualizers[viz.id].description}</p>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {leftPanelVisibility === 'full' && (
            <div className="mb-6">
              <h2 className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-3">{t.leftPanel.globalParams}</h2>
              
              <div className="mb-4">
                <label className="text-[11px] text-gray-400 mb-2 block">{t.leftPanel.fftSize}</label>
                <select
                  value={params.fftSize}
                  onChange={(e) => setParams({ fftSize: parseInt(e.target.value) as typeof params.fftSize })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50 transition-colors"
                >
                  <option value="256">256</option>
                  <option value="512">512</option>
                  <option value="1024">1024</option>
                  <option value="2048">2048</option>
                  <option value="4096">4096</option>
                </select>
              </div>

              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[11px] text-gray-400">{t.leftPanel.sensitivity}</label>
                  <input
                    type="number"
                    value={params.sensitivity}
                    onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setParams({ sensitivity: v }) }}
                    className="w-16 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[11px] text-violet-400 font-mono text-right focus:outline-none focus:border-violet-500/50"
                    step={0.01}
                    min={0.01}
                    max={20}
                  />
                </div>
                <input
                  type="range"
                  min="0.01"
                  max="20"
                  step="0.01"
                  value={params.sensitivity}
                  onChange={(e) => setParams({ sensitivity: parseFloat(e.target.value) })}
                  className="w-full accent-violet-500"
                />
              </div>

              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[11px] text-gray-400">{t.leftPanel.smoothing}</label>
                  <input
                    type="number"
                    value={params.smoothing}
                    onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setParams({ smoothing: v }) }}
                    className="w-16 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[11px] text-violet-400 font-mono text-right focus:outline-none focus:border-violet-500/50"
                    step={0.001}
                    min={0}
                    max={0.999}
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.999"
                  step="0.001"
                  value={params.smoothing}
                  onChange={(e) => setParams({ smoothing: parseFloat(e.target.value) })}
                  className="w-full accent-violet-500"
                />
              </div>
            </div>
          )}

          {leftPanelVisibility === 'full' && (
            <div className="space-y-2">
              <button
                onClick={() => setShowPresetPanel(!showPresetPanel)}
                className="w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm text-gray-300 hover:text-white transition-all duration-200 flex items-center gap-2"
              >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              {t.leftPanel.presetManage}
            </button>
            <button
              onClick={() => setShowShortcutsHelp(!showShortcutsHelp)}
              className="w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm text-gray-300 hover:text-white transition-all duration-200 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t.leftPanel.shortcuts}
            </button>
            <button
              onClick={() => setParams(DEFAULT_PARAMS)}
              className="w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm text-gray-300 hover:text-white transition-all duration-200 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {t.leftPanel.resetParams}
            </button>
          </div>
        )}
      </div>
      </div>
    </>
  )
}
