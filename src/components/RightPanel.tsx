import React, { useCallback } from 'react'
import { useStore, type PanelVisibility } from '../store/useStore'
import type { ColorTheme } from '../types'
import { randomColor } from '../utils'
import { useLanguage } from '../hooks/useLanguage'

interface RightPanelProps {
  className?: string
  style?: React.CSSProperties
  onExportClick: () => void
  onRenderClick: () => void
}

function cycleVisibility(current: PanelVisibility): PanelVisibility {
  if (current === 'full') return 'collapsed'
  if (current === 'collapsed') return 'hidden'
  return 'full'
}

export const RightPanel: React.FC<RightPanelProps> = ({ className = '', style, onExportClick, onRenderClick }) => {
  const { params, setParams, currentVisualizer, rightPanelVisibility, setRightPanelVisibility } = useStore()
  const { t } = useLanguage()

  const colorThemes: { id: ColorTheme; name: string; colors: string[] }[] = [
    { id: 'neon', name: t.themes.neon, colors: ['#8b5cf6', '#06b6d4', '#ec4899'] },
    { id: 'fire', name: t.themes.fire, colors: ['#ef4444', '#f97316', '#eab308'] },
    { id: 'ocean', name: t.themes.ocean, colors: ['#1e3a8a', '#0891b2', '#10b981'] },
    { id: 'aurora', name: t.themes.aurora, colors: ['#10b981', '#3b82f6', '#8b5cf6'] },
    { id: 'mono', name: t.themes.mono, colors: ['#f8fafc', '#64748b', '#0f172a'] },
    { id: 'plasma', name: t.themes.plasma, colors: ['#7c3aed', '#ec4899', '#facc15'] },
  ]

  const isAurora = currentVisualizer === 'aurora'
  const isRadial = currentVisualizer === 'radialSpectrum'
  const isFreqBars = currentVisualizer === 'frequencyBars'

  const handleToggle = useCallback(() => {
    setRightPanelVisibility(cycleVisibility(rightPanelVisibility))
  }, [rightPanelVisibility, setRightPanelVisibility])

  const width = rightPanelVisibility === 'full' ? '280px' : rightPanelVisibility === 'collapsed' ? '56px' : '0px'
  const isHidden = rightPanelVisibility === 'hidden'

  return (
    <>
      {/* Floating toggle — always visible even when panel is hidden */}
      {!isHidden && (
        <button
          onClick={handleToggle}
          className="fixed top-4 z-50 p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-500 hover:text-white bg-gray-950/80 backdrop-blur-sm border border-white/5"
          style={{ right: rightPanelVisibility === 'full' ? '268px' : '44px' }}
          title={rightPanelVisibility === 'full' ? 'Collapse panel' : 'Expand panel'}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Right edge drawer handle — always visible */}
      <button
        onClick={() => setRightPanelVisibility(isHidden ? 'full' : 'hidden')}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-50 px-1 py-4 bg-white/5 hover:bg-white/10 backdrop-blur-sm border border-white/10 border-r-0 rounded-l-lg transition-all duration-200 text-gray-500 hover:text-violet-400 group"
        title={isHidden ? 'Show right panel' : 'Hide right panel'}
      >
        <svg className="w-3 h-3 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div 
        className={`fixed right-0 top-0 bottom-[70px] bg-gradient-to-b from-gray-950/98 to-gray-900/95 backdrop-blur-xl border-l border-white/5 overflow-y-auto overflow-x-hidden transition-all duration-300 ${className}`}
        style={{ 
          ...style, 
          width,
          visibility: isHidden ? 'hidden' : undefined,
          pointerEvents: isHidden ? 'none' : undefined,
        }}
      >
      <div className="p-4">
        {/* 颜色主题 */}
        <div className="mb-6">
          {rightPanelVisibility === 'full' && <h2 className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-3">{t.rightPanel.colorThemes}</h2>}
          <div className={`grid ${rightPanelVisibility !== 'full' ? 'grid-cols-1' : 'grid-cols-3'} gap-2`}>
            {colorThemes.map((theme) => (
              <button
                key={theme.id}
                onClick={() => setParams({ colorTheme: theme.id })}
                title={rightPanelVisibility !== 'full' ? theme.name : undefined}
                className={`p-2.5 rounded-xl border transition-all duration-200 ${
                  params.colorTheme === theme.id
                    ? 'border-violet-500/50 bg-gradient-to-br from-violet-600/10 to-blue-600/10'
                    : 'border-white/10 hover:border-white/20 bg-white/5'
                }`}
              >
                <div className={`flex ${rightPanelVisibility !== 'full' ? 'flex-col' : 'gap-1'} mb-1.5 justify-center`}>
                  {theme.colors.map((color, i) => (
                    <div
                      key={i}
                      className={`${rightPanelVisibility !== 'full' ? 'w-6 h-2' : 'w-4 h-4'} rounded-full shadow-lg`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                {rightPanelVisibility === 'full' && <span className="text-[10px] text-gray-400">{theme.name}</span>}
              </button>
            ))}
          </div>
        </div>

        {/* 展开时显示更多参数 */}
        {rightPanelVisibility === 'full' && (
          <>
            {/* 自定义颜色 */}
            {params.colorTheme === 'custom' && (
              <div className="mb-6">
                <h2 className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-3">{t.rightPanel.customColors}</h2>
                <div className="flex gap-2">
                  {params.customColors.map((color, i) => (
                    <div key={i} className="relative group">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => {
                          const newColors = [...params.customColors]
                          newColors[i] = e.target.value
                          setParams({ customColors: newColors })
                        }}
                        className="w-12 h-12 rounded-xl cursor-pointer border-0 opacity-0 absolute inset-0"
                      />
                      <div 
                        className="w-12 h-12 rounded-xl border border-white/10 group-hover:border-white/30 transition-colors"
                        style={{ backgroundColor: color }}
                      />
                    </div>
                  ))}
                  <button
                    onClick={() => setParams({ customColors: [randomColor(), randomColor(), randomColor()] })}
                    className="w-12 h-12 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors"
                    aria-label={t.rightPanel.randomColor}
                  >
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* 拖尾效果 */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[11px] text-gray-400">{t.rightPanel.trail}</label>
                <input
                  type="number"
                  value={params.backgroundOpacity}
                  onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setParams({ backgroundOpacity: v }) }}
                  className="w-16 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[11px] text-violet-400 font-mono text-right focus:outline-none focus:border-violet-500/50"
                  step={0.01}
                  min={0}
                  max={1}
                />
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={params.backgroundOpacity}
                onChange={(e) => setParams({ backgroundOpacity: parseFloat(e.target.value) })}
                className="w-full accent-violet-500"
              />
            </div>

            {/* 发光强度 */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[11px] text-gray-400">{t.rightPanel.glow}</label>
                <input
                  type="number"
                  value={params.glowIntensity}
                  onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setParams({ glowIntensity: v }) }}
                  className="w-16 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[11px] text-violet-400 font-mono text-right focus:outline-none focus:border-violet-500/50"
                  step={0.5}
                  min={0}
                  max={50}
                />
              </div>
              <input
                type="range"
                min="0"
                max="50"
                step="0.5"
                value={params.glowIntensity}
                onChange={(e) => setParams({ glowIntensity: parseFloat(e.target.value) })}
                className="w-full accent-violet-500"
              />
            </div>

            {/* 线宽 */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[11px] text-gray-400">{t.rightPanel.lineWidth}</label>
                <input
                  type="number"
                  value={params.lineWidth}
                  onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setParams({ lineWidth: v }) }}
                  className="w-16 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[11px] text-violet-400 font-mono text-right focus:outline-none focus:border-violet-500/50"
                  step={0.5}
                  min={0.5}
                  max={20}
                />
              </div>
              <input
                type="range"
                min="0.5"
                max="20"
                step="0.5"
                value={params.lineWidth}
                onChange={(e) => setParams({ lineWidth: parseFloat(e.target.value) })}
                className="w-full accent-violet-500"
              />
            </div>

            {/* 条形间距 */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[11px] text-gray-400">{t.rightPanel.barSpacing}</label>
                <input
                  type="number"
                  value={params.barSpacing}
                  onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setParams({ barSpacing: v }) }}
                  className="w-16 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[11px] text-violet-400 font-mono text-right focus:outline-none focus:border-violet-500/50"
                  step={0.25}
                  min={0}
                  max={20}
                />
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="0.25"
                value={params.barSpacing}
                onChange={(e) => setParams({ barSpacing: parseFloat(e.target.value) })}
                className="w-full accent-violet-500"
              />
            </div>

            {/* 频率分布 */}
            {(isFreqBars || isRadial) && (
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[11px] text-gray-400">{'频率分布 (低←→高)'}</label>
                  <input
                    type="number"
                    value={params.freqDistribution}
                    onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setParams({ freqDistribution: v }) }}
                    className="w-16 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[11px] text-violet-400 font-mono text-right focus:outline-none focus:border-violet-500/50"
                    step={0.01}
                    min={0.05}
                    max={3.0}
                  />
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="3.0"
                  step="0.01"
                  value={params.freqDistribution}
                  onChange={(e) => setParams({ freqDistribution: parseFloat(e.target.value) })}
                  className="w-full accent-violet-500"
                />
              </div>
            )}

            {/* 频率平衡 */}
            {(isFreqBars || isRadial) && (
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[11px] text-gray-400">{'频率平衡 (低←→高)'}</label>
                  <input
                    type="number"
                    value={params.freqTilt}
                    onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setParams({ freqTilt: v }) }}
                    className="w-16 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[11px] text-violet-400 font-mono text-right focus:outline-none focus:border-violet-500/50"
                    step={0.05}
                    min={-1}
                    max={1}
                  />
                </div>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.05"
                  value={params.freqTilt}
                  onChange={(e) => setParams({ freqTilt: parseFloat(e.target.value) })}
                  className="w-full accent-violet-500"
                />
              </div>
            )}

            {/* 镜像模式 */}
            <div className="mb-4 flex items-center justify-between p-3 bg-white/5 rounded-xl">
              <label className="text-[11px] text-gray-400">{t.rightPanel.mirror}</label>
              <button
                onClick={() => setParams({ mirrorMode: !params.mirrorMode })}
                className={`relative w-11 h-6 rounded-full transition-all duration-200 ${
                  params.mirrorMode 
                    ? 'bg-gradient-to-r from-violet-600 to-blue-600' 
                    : 'bg-white/10'
                }`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-lg transition-all duration-200 ${
                  params.mirrorMode ? 'left-6' : 'left-1'
                }`} />
              </button>
            </div>

            {/* 旋转速度 */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[11px] text-gray-400">{t.rightPanel.rotation}</label>
                <input
                  type="number"
                  value={params.rotationSpeed}
                  onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setParams({ rotationSpeed: v }) }}
                  className="w-16 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[11px] text-violet-400 font-mono text-right focus:outline-none focus:border-violet-500/50"
                  step={0.1}
                  min={-10}
                  max={10}
                />
              </div>
              <input
                type="range"
                min="-10"
                max="10"
                step="0.1"
                value={params.rotationSpeed}
                onChange={(e) => setParams({ rotationSpeed: parseFloat(e.target.value) })}
                className="w-full accent-violet-500"
              />
            </div>

            {/* 辐射线宽 */}
            {isRadial && (
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[11px] text-gray-400">{t.rightPanel.radialThickness}</label>
                  <input
                    type="number"
                    value={params.radialThickness}
                    onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setParams({ radialThickness: v }) }}
                    className="w-16 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[11px] text-violet-400 font-mono text-right focus:outline-none focus:border-violet-500/50"
                    step={0.5}
                    min={0.5}
                    max={20}
                  />
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="20"
                  step="0.5"
                  value={params.radialThickness}
                  onChange={(e) => setParams({ radialThickness: parseFloat(e.target.value) })}
                  className="w-full accent-violet-500"
                />
              </div>
            )}

            {/* 极光层数 */}
            {isAurora && (
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[11px] text-gray-400">{t.rightPanel.auroraLayers}</label>
                  <input
                    type="number"
                    value={params.auroraLayers}
                    onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) setParams({ auroraLayers: v }) }}
                    className="w-16 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[11px] text-violet-400 font-mono text-right focus:outline-none focus:border-violet-500/50"
                    step={1}
                    min={1}
                    max={25}
                  />
                </div>
                <input
                  type="range"
                  min="1"
                  max="25"
                  step="1"
                  value={params.auroraLayers}
                  onChange={(e) => setParams({ auroraLayers: parseInt(e.target.value) })}
                  className="w-full accent-violet-500"
                />
              </div>
            )}

            {/* 地形分辨率 */}

            {/* DNA 螺旋段数 */}

            {/* 星系臂数 */}

            {/* 接缝平滑 */}
            {isRadial && (
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[11px] text-gray-400">{'接缝平滑'}</label>
                  <input
                    type="number"
                    value={params.seamSmoothing}
                    onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setParams({ seamSmoothing: v }) }}
                    className="w-16 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[11px] text-violet-400 font-mono text-right focus:outline-none focus:border-violet-500/50"
                    step={0.01}
                    min={0}
                    max={1}
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={params.seamSmoothing}
                  onChange={(e) => setParams({ seamSmoothing: parseFloat(e.target.value) })}
                  className="w-full accent-violet-500"
                />
              </div>
            )}

            {/* 自定义背景色 */}
            <div className="mb-6">
              <label className="text-[11px] text-gray-400 mb-2 block">{t.rightPanel.bgColor}</label>
              <div className="relative group">
                <input
                  type="color"
                  value={params.backgroundColor}
                  onChange={(e) => setParams({ backgroundColor: e.target.value })}
                  className="w-full h-10 rounded-xl cursor-pointer border-0 opacity-0 absolute inset-0"
                />
                <div 
                  className="w-full h-10 rounded-xl border border-white/10 group-hover:border-white/30 transition-colors flex items-center px-3"
                  style={{ backgroundColor: params.backgroundColor }}
                >
                  <span className="text-xs text-white/70 font-mono">{params.backgroundColor}</span>
                </div>
              </div>
            </div>

            {/* 导出按钮 */}
            <button
              onClick={onExportClick}
              className="w-full p-3 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 rounded-xl text-sm text-white font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-violet-500/25"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {t.rightPanel.export}
            </button>

            {/* 离线渲染按钮 */}
            <button
              onClick={onRenderClick}
              className="w-full mt-2 p-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl text-sm text-white font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {t.render?.title ?? '离线渲染'}
            </button>
          </>
        )}
      </div>
      </div>
    </>
  )
}