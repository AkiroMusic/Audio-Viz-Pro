import { useEffect } from 'react'
import { useStore } from '../store/useStore'
import { VISUALIZER_LIST } from '../constants'
import { randomColor } from '../utils'

export function useKeyboard(audioRef: React.RefObject<HTMLAudioElement | null>): void {
  const { 
    setVisualizer, 
    currentVisualizer, 
    setParams, 
    params, 
    setShowExportPanel,
    setShowPresetPanel,
    setShowShortcutsHelp
  } = useStore()

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // 忽略输入框内的按键
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      const audio = audioRef.current
      if (!audio) return

      switch (e.code) {
        case 'Space':
          e.preventDefault()
          audio.paused ? audio.play() : audio.pause()
          break
        case 'ArrowLeft':
          e.preventDefault()
          audio.currentTime = Math.max(0, audio.currentTime - 5)
          break
        case 'ArrowRight':
          e.preventDefault()
          audio.currentTime = Math.min(audio.duration, audio.currentTime + 5)
          break
        case 'ArrowUp':
          e.preventDefault()
          audio.volume = Math.min(1, audio.volume + 0.1)
          break
        case 'ArrowDown':
          e.preventDefault()
          audio.volume = Math.max(0, audio.volume - 0.1)
          break
        case 'KeyA': {
          e.preventDefault()
          const currentIndex = VISUALIZER_LIST.findIndex(v => v.id === currentVisualizer)
          const prevIndex = (currentIndex - 1 + VISUALIZER_LIST.length) % VISUALIZER_LIST.length
          setVisualizer(VISUALIZER_LIST[prevIndex].id)
          break
        }
        case 'KeyD': {
          e.preventDefault()
          const currentIndex = VISUALIZER_LIST.findIndex(v => v.id === currentVisualizer)
          const nextIndex = (currentIndex + 1) % VISUALIZER_LIST.length
          setVisualizer(VISUALIZER_LIST[nextIndex].id)
          break
        }
        case 'KeyC': {
          e.preventDefault()
          const themes = ['neon', 'fire', 'ocean', 'aurora', 'mono', 'plasma'] as const
          const currentThemeIndex = themes.indexOf(params.colorTheme as typeof themes[number])
          const nextThemeIndex = (currentThemeIndex + 1) % themes.length
          setParams({ colorTheme: themes[nextThemeIndex] })
          break
        }
        case 'KeyR': {
          e.preventDefault()
          setParams({ 
            colorTheme: 'custom',
            customColors: [randomColor(), randomColor(), randomColor()]
          })
          break
        }
        case 'KeyM':
          e.preventDefault()
          setParams({ mirrorMode: !params.mirrorMode })
          break
        case 'KeyF':
          e.preventDefault()
          if (document.fullscreenElement) {
            document.exitFullscreen()
          } else {
            document.documentElement.requestFullscreen()
          }
          break
        case 'KeyS':
          e.preventDefault()
          // Trigger screenshot via ExportPanel's ImageExporter
          const canvas = document.querySelector('canvas')
          if (canvas) {
            const { exportImage } = await import('../export/ImageExporter')
            exportImage(canvas)
          }
          break
        case 'Escape':
          e.preventDefault()
          setShowExportPanel(false)
          setShowPresetPanel(false)
          setShowShortcutsHelp(false)
          break
        case 'Slash':
          if (e.shiftKey) {
            e.preventDefault()
            setShowShortcutsHelp(true)
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    audioRef, 
    currentVisualizer, 
    params.colorTheme, 
    params.mirrorMode, 
    setVisualizer, 
    setParams,
    setShowExportPanel,
    setShowPresetPanel,
    setShowShortcutsHelp
  ])
}