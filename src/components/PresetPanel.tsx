import React, { useState, useCallback } from 'react'
import { useStore } from '../store/useStore'
import { BUILTIN_PRESETS, VISUALIZER_LIST } from '../constants'
import { VisualizerIcon } from './LeftPanel'
import { useLanguage } from '../hooks/useLanguage'

interface PresetPanelProps {
  onClose: () => void
}

function getVisualizerIcon(visualizerId: string): string {
  const viz = VISUALIZER_LIST.find(v => v.id === visualizerId)
  return viz?.icon ?? 'bars'
}

export const PresetPanel: React.FC<PresetPanelProps> = ({ onClose }) => {
  const { 
    presets, 
    savePreset, 
    deletePreset,
    smoothLoadPreset,
  } = useStore()
  const { t } = useLanguage()
  const [newPresetName, setNewPresetName] = useState('')
  const [flashingId, setFlashingId] = useState<string | null>(null)

  const handleSavePreset = () => {
    if (!newPresetName.trim()) return
    savePreset(newPresetName.trim())
    setNewPresetName('')
  }

  const handleLoadPreset = useCallback((id: string) => {
    setFlashingId(id)
    smoothLoadPreset(id)
    setTimeout(() => {
      setFlashingId(null)
      onClose()
    }, 350)
  }, [smoothLoadPreset, onClose])

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gradient-to-b from-gray-900 to-gray-950 border border-white/10 rounded-2xl w-[400px] max-h-[80vh] overflow-hidden shadow-2xl shadow-violet-500/10">
        {/* 头部 */}
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{t.presetManage.title}</h2>
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

        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {/* 保存新预设 */}
          <div className="mb-6">
            <h3 className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-3">{t.presetManage.saveCurrent}</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder={t.presetManage.presetNamePlaceholder}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-violet-500/50 transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
              />
              <button
                onClick={handleSavePreset}
                disabled={!newPresetName.trim()}
                className="px-4 py-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed rounded-xl text-sm text-white transition-all duration-200 shadow-lg shadow-violet-500/25 disabled:shadow-none"
              >
                {t.presetManage.save}
              </button>
            </div>
          </div>

          {/* 内置预设 */}
          <div className="mb-6">
            <h3 className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-3">{t.presetManage.builtin}</h3>
            <div className="space-y-2">
              {BUILTIN_PRESETS.map((preset) => (
                <div
                  key={preset.id}
                  className={`p-3 bg-white/5 rounded-xl flex items-center justify-between border border-white/5 hover:border-white/10 transition-all duration-200 ${
                    flashingId === preset.id ? 'ring-2 ring-violet-500/50 bg-violet-600/10' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <VisualizerIcon icon={getVisualizerIcon(preset.visualizer)} isActive={false} />
                    <div>
                      <div className="text-sm font-medium text-white">{preset.name}</div>
                      <div className="text-[11px] text-gray-500">{preset.visualizer}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleLoadPreset(preset.id)}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/15 rounded-lg text-xs text-white transition-colors"
                  >
                    {t.presetManage.load}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {presets.length > 0 && (
            <div>
              <h3 className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-3">{t.presetManage.myPresets}</h3>
              <div className="space-y-2">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className={`p-3 bg-white/5 rounded-xl flex items-center justify-between border border-white/5 hover:border-white/10 transition-all duration-200 ${
                      flashingId === preset.id ? 'ring-2 ring-violet-500/50 bg-violet-600/10' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <VisualizerIcon icon={getVisualizerIcon(preset.visualizer)} isActive={false} />
                      <div>
                        <div className="text-sm font-medium text-white">{preset.name}</div>
                        <div className="text-[11px] text-gray-500">{preset.visualizer}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleLoadPreset(preset.id)}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/15 rounded-lg text-xs text-white transition-colors"
                      >
                        {t.presetManage.load}
                      </button>
                      <button
                        onClick={() => deletePreset(preset.id)}
                        className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-xs text-red-400 transition-colors"
                      >
                        {t.presetManage.delete}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}