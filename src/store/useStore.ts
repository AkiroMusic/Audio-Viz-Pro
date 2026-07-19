import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { VisualizerType, VisualizerParams, AudioState, Preset, RecordingState, RenderConfig, RenderState } from '../types'
import { DEFAULT_PARAMS, BUILTIN_PRESETS } from '../constants'
import { DEFAULT_RENDER_CONFIG } from '../types'

export type PanelVisibility = 'full' | 'collapsed' | 'hidden'

const NUMERIC_PARAM_KEYS: (keyof VisualizerParams)[] = [
  'smoothing', 'sensitivity', 'particleCount', 'noiseIntensity',
  'backgroundOpacity', 'glowIntensity', 'lineWidth', 'barSpacing',
  'freqDistribution', 'freqTilt', 'rotationSpeed', 'radialThickness', 'auroraLayers',
  'terrainResolution', 'helixSegments', 'galaxyArms', 'seamSmoothing',
]

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

interface AppState {
  currentVisualizer: VisualizerType
  setVisualizer: (v: VisualizerType) => void
  
  params: VisualizerParams
  setParams: (p: Partial<VisualizerParams>) => void
  resetParams: () => void
  
  audio: AudioState
  setAudio: (a: Partial<AudioState>) => void
  
  presets: Preset[]
  savePreset: (name: string) => void
  loadPreset: (id: string) => void
  smoothLoadPreset: (id: string) => void
  deletePreset: (id: string) => void
  
  recordingState: RecordingState
  setRecordingState: (s: RecordingState) => void
  
  isUIVisible: boolean
  setUIVisible: (v: boolean) => void
  showExportPanel: boolean
  setShowExportPanel: (v: boolean) => void
  showPresetPanel: boolean
  setShowPresetPanel: (v: boolean) => void
  showShortcutsHelp: boolean
  setShowShortcutsHelp: (v: boolean) => void
  
  isBeat: boolean
  setBeat: (v: boolean) => void
  
  leftPanelVisibility: PanelVisibility
  setLeftPanelVisibility: (v: PanelVisibility) => void
  rightPanelVisibility: PanelVisibility
  setRightPanelVisibility: (v: PanelVisibility) => void

  // ── Render（离线渲染） ──
  renderConfig: RenderConfig
  setRenderConfig: (c: Partial<RenderConfig>) => void
  renderState: RenderState
  setRenderState: (s: Partial<RenderState>) => void
  showRenderDialog: boolean
  setShowRenderDialog: (v: boolean) => void
  renderCanvas: HTMLCanvasElement | null
  setRenderCanvas: (canvas: HTMLCanvasElement | null) => void
}

let _presetAnimFrameId: number | null = null

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentVisualizer: 'frequencyBars',
      setVisualizer: (v) => set({ currentVisualizer: v }),
      
      params: { ...DEFAULT_PARAMS },
      setParams: (p) => set((s) => ({ params: { ...s.params, ...p } })),
      resetParams: () => set({ params: { ...DEFAULT_PARAMS } }),
      
      audio: {
        isPlaying: false, currentTime: 0, duration: 0,
        volume: 1.0, fileName: '', isMicActive: false,
        audioDevices: [], selectedDeviceId: '',
      },
      setAudio: (a) => set((s) => ({ audio: { ...s.audio, ...a } })),
      
      presets: [],
      savePreset: (name) => {
        const { currentVisualizer, params, presets } = get()
        const preset: Preset = {
          id: Date.now().toString(),
          name,
          visualizer: currentVisualizer,
          params: { ...params },
          createdAt: Date.now(),
        }
        set({ presets: [...presets, preset] })
      },
      loadPreset: (id) => {
        const allPresets = [...get().presets]
        const preset = allPresets.find(p => p.id === id)
        if (preset) {
          set({ currentVisualizer: preset.visualizer, params: { ...preset.params } })
        }
      },
      smoothLoadPreset: (id) => {
        const allPresets = [...BUILTIN_PRESETS, ...get().presets]
        const preset = allPresets.find(p => p.id === id)
        if (!preset) return

        const targetParams = { ...preset.params }
        const currentParams = { ...get().params }

        // Set visualizer immediately
        set({ currentVisualizer: preset.visualizer })

        // Set non-numeric params immediately
        const immediateUpdates: Partial<VisualizerParams> = {
          colorTheme: targetParams.colorTheme,
          customColors: targetParams.customColors,
          backgroundColor: targetParams.backgroundColor,
          mirrorMode: targetParams.mirrorMode,
          fftSize: targetParams.fftSize,
        }
        set((s) => ({ params: { ...s.params, ...immediateUpdates } }))

        // Animate numeric params with easeOut over 300ms
        if (_presetAnimFrameId !== null) {
          cancelAnimationFrame(_presetAnimFrameId)
          _presetAnimFrameId = null
        }
        const DURATION = 300
        let startTime: number | null = null

        const animate = (timestamp: number) => {
          if (startTime === null) startTime = timestamp
          const elapsed = timestamp - startTime
          const progress = Math.min(elapsed / DURATION, 1)
          const eased = easeOut(progress)

          const interpolated: Partial<VisualizerParams> = {}
          for (const key of NUMERIC_PARAM_KEYS) {
            const from = currentParams[key] as number
            const to = targetParams[key] as number
            const value = from + (to - from) * eased
            ;(interpolated as Record<string, number>)[key] =
              Number.isInteger(to) ? Math.round(value) : parseFloat(value.toFixed(4))
          }
          set((s) => ({ params: { ...s.params, ...interpolated } }))

          if (progress < 1) {
            _presetAnimFrameId = requestAnimationFrame(animate)
          } else {
            _presetAnimFrameId = null
          }
        }
        _presetAnimFrameId = requestAnimationFrame(animate)
      },
      deletePreset: (id) => set((s) => ({ presets: s.presets.filter(p => p.id !== id) })),
      
      recordingState: 'idle',
      setRecordingState: (s) => set({ recordingState: s }),
      
      isUIVisible: true,
      setUIVisible: (v) => set({ isUIVisible: v }),
      showExportPanel: false,
      setShowExportPanel: (v) => set({ showExportPanel: v }),
      showPresetPanel: false,
      setShowPresetPanel: (v) => set({ showPresetPanel: v }),
      showShortcutsHelp: false,
      setShowShortcutsHelp: (v) => set({ showShortcutsHelp: v }),
      
      isBeat: false,
      setBeat: (v) => set({ isBeat: v }),
      
      leftPanelVisibility: 'full' as PanelVisibility,
      setLeftPanelVisibility: (v) => set({ leftPanelVisibility: v }),
      rightPanelVisibility: 'full' as PanelVisibility,
      setRightPanelVisibility: (v) => set({ rightPanelVisibility: v }),

      // ── Render（离线渲染） ──
      renderConfig: { ...DEFAULT_RENDER_CONFIG },
      setRenderConfig: (c) => set((s) => ({ renderConfig: { ...s.renderConfig, ...c } })),
      renderState: { stage: 'idle', progress: 0, stageLabel: '' },
      setRenderState: (rs) => set((s) => ({ renderState: { ...s.renderState, ...rs } })),
      showRenderDialog: false,
      setShowRenderDialog: (v) => set({ showRenderDialog: v }),
      renderCanvas: null,
      setRenderCanvas: (canvas) => set({ renderCanvas: canvas }),
    }),
    {
      name: 'audioviz-storage',
      partialize: (state) => ({ 
        presets: state.presets, 
        params: state.params,
        leftPanelVisibility: state.leftPanelVisibility,
        rightPanelVisibility: state.rightPanelVisibility,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<AppState>
        // Migrate old collapsed booleans to new visibility states
        let leftVis: PanelVisibility = 'full'
        let rightVis: PanelVisibility = 'full'
        if (persisted?.leftPanelVisibility) {
          leftVis = persisted.leftPanelVisibility
        } else if ((persisted as Record<string, unknown>)?.leftPanelCollapsed) {
          leftVis = 'collapsed'
        }
        if (persisted?.rightPanelVisibility) {
          rightVis = persisted.rightPanelVisibility
        } else if ((persisted as Record<string, unknown>)?.rightPanelCollapsed) {
          rightVis = 'collapsed'
        }
        return {
          ...currentState,
          ...persisted,
          leftPanelVisibility: leftVis,
          rightPanelVisibility: rightVis,
          params: { ...DEFAULT_PARAMS, ...(persisted?.params || {}) },
        }
      },
    }
  )
)