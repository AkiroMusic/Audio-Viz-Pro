import React, { useRef, useCallback, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { AudioEngine } from '../audio/AudioEngine'
import { BeatDetector } from '../audio/BeatDetector'
import { VisualizerStage } from './VisualizerStage'
import { AudioPlayer } from './AudioPlayer'
import { LeftPanel } from './LeftPanel'
import { RightPanel } from './RightPanel'
import { ExportPanel } from './ExportPanel'
import { PresetPanel } from './PresetPanel'
import { RenderDialog } from './RenderDialog'
import { DropZone } from './DropZone'
import { useKeyboard } from '../hooks/useKeyboard'
import { useAutoHideUI } from '../hooks/useAutoHideUI'

const audioEngine = new AudioEngine()
const beatDetector = new BeatDetector()

export const App: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const blobUrlRef = useRef<string | null>(null)
  const beatRef = useRef<boolean>(false)
  const flashRef = useRef<HTMLDivElement>(null)

  const {
    isUIVisible,
    showExportPanel,
    setShowExportPanel,
    showPresetPanel,
    setShowPresetPanel,
    showRenderDialog,
    setShowRenderDialog,
    setAudio,
    params,
  } = useStore()

  useKeyboard(audioRef)
  useAutoHideUI()

  const handleLoadFile = useCallback((file: File) => {
    const audio = audioRef.current
    if (!audio) return

    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    const url = URL.createObjectURL(file)
    blobUrlRef.current = url
    audio.src = url
    audio.load()

    setAudio({ fileName: file.name })

    audioEngine.init(audio).then(() => {
      audioEngine.resume()
    })
  }, [setAudio])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleCanPlay = () => {
      setAudio({ duration: audio.duration })
    }

    audio.addEventListener('canplay', handleCanPlay)
    return () => audio.removeEventListener('canplay', handleCanPlay)
  }, [setAudio])

  useEffect(() => {
    const stage = document.querySelector('canvas')
    if (stage) {
      canvasRef.current = stage as HTMLCanvasElement
    }
  }, [])

  // Beat detection loop
  useEffect(() => {
    let frameId: number
    const detectBeat = (timestamp: number) => {
      const energy = audioEngine.getEnergy()
      beatDetector.update(energy, timestamp)
      beatRef.current = beatDetector.isBeat
      if (flashRef.current) {
        flashRef.current.style.opacity = beatDetector.isBeat ? '1' : '0'
      }
      frameId = requestAnimationFrame(detectBeat)
    }
    frameId = requestAnimationFrame(detectBeat)
    return () => cancelAnimationFrame(frameId)
  }, [])

  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <VisualizerStage audioEngine={audioEngine} audioRef={audioRef} />

      <audio ref={audioRef} preload="auto" />

      <DropZone onFileDrop={handleLoadFile} />

      <LeftPanel
        className="panel-transition"
        style={{ opacity: isUIVisible ? 1 : 0, pointerEvents: isUIVisible ? 'auto' : 'none' }}
      />
      <RightPanel
        className="panel-transition"
        style={{ opacity: isUIVisible ? 1 : 0, pointerEvents: isUIVisible ? 'auto' : 'none' }}
        onExportClick={() => setShowExportPanel(true)}
        onRenderClick={() => setShowRenderDialog(true)}
      />
      <AudioPlayer
        audioEngine={audioEngine}
        audioRef={audioRef}
        onLoadFile={handleLoadFile}
        className="panel-transition"
        style={{ opacity: isUIVisible ? 1 : 0, pointerEvents: isUIVisible ? 'auto' : 'none' }}
      />

      {/* Beat flash overlay */}
      <div ref={flashRef} className="fixed inset-0 bg-white/5 pointer-events-none z-30 transition-opacity" style={{ opacity: 0 }} />

      {showExportPanel && (
        <ExportPanel
          onClose={() => setShowExportPanel(false)}
          canvasRef={canvasRef}
          audioRef={audioRef}
        />
      )}
      {showPresetPanel && (
        <PresetPanel onClose={() => setShowPresetPanel(false)} />
      )}
      {showRenderDialog && (
        <RenderDialog onClose={() => setShowRenderDialog(false)} audioRef={audioRef} />
      )}
    </div>
  )
}