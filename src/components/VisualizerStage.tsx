import React, { useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store/useStore'
import { AudioEngine } from '../audio/AudioEngine'
import { BaseVisualizer } from '../visualizers/BaseVisualizer'
import { FrequencyBars } from '../visualizers/canvas/FrequencyBars'
import { RadialSpectrum } from '../visualizers/canvas/RadialSpectrum'
import { Oscilloscope } from '../visualizers/canvas/Oscilloscope'
import { Aurora } from '../visualizers/canvas/Aurora'
import { Waterfall } from '../visualizers/canvas/Waterfall'
import { Lissajous } from '../visualizers/canvas/Lissajous'
import type { VisualizerType } from '../types'

interface VisualizerStageProps {
  audioEngine: AudioEngine
  audioRef: React.RefObject<HTMLAudioElement | null>
}

function createVisualizer(type: VisualizerType, canvas: HTMLCanvasElement): BaseVisualizer {
  switch (type) {
    case 'frequencyBars':   return new FrequencyBars(canvas)
    case 'radialSpectrum':  return new RadialSpectrum(canvas)
    case 'oscilloscope':    return new Oscilloscope(canvas)
    case 'aurora':          return new Aurora(canvas)
    case 'waterfall':       return new Waterfall(canvas)
    case 'lissajous':       return new Lissajous(canvas)
    default:                return new FrequencyBars(canvas)
  }
}

export const VisualizerStage: React.FC<VisualizerStageProps> = ({ audioEngine, audioRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const vizRef = useRef<BaseVisualizer | null>(null)
  const isPlayingRef = useRef(false)
  const paramsRef = useRef(useStore.getState().params)
  const prevVizTypeRef = useRef<VisualizerType>('frequencyBars')
  
  const { 
    currentVisualizer, 
    params, 
    audio, 
    setAudio
  } = useStore()

  useEffect(() => {
    isPlayingRef.current = audio.isPlaying
  }, [audio.isPlaying])

  useEffect(() => {
    paramsRef.current = params
  }, [params])

  const handleResize = useCallback(() => {
    if (!canvasRef.current) return
    const W = window.innerWidth
    const H = window.innerHeight
    canvasRef.current.width = W * window.devicePixelRatio
    canvasRef.current.height = H * window.devicePixelRatio
    canvasRef.current.style.width = W + 'px'
    canvasRef.current.style.height = H + 'px'
    // Notify current visualizer of resize (for WebGL camera aspect updates)
    if (vizRef.current) {
      vizRef.current.onResize(W, H)
    }
  }, [])

  useEffect(() => {
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [handleResize])

  useEffect(() => {
    const audioEl = audioRef.current
    if (!audioEl) return

    const handleTimeUpdate = () => {
      setAudio({
        currentTime: audioEl.currentTime,
        duration: audioEl.duration,
        isPlaying: !audioEl.paused,
      })
    }

    const handlePlay = () => setAudio({ isPlaying: true })
    const handlePause = () => setAudio({ isPlaying: false })
    const handleEnded = () => setAudio({ isPlaying: false, currentTime: 0 })

    audioEl.addEventListener('timeupdate', handleTimeUpdate)
    audioEl.addEventListener('play', handlePlay)
    audioEl.addEventListener('pause', handlePause)
    audioEl.addEventListener('ended', handleEnded)

    return () => {
      audioEl.removeEventListener('timeupdate', handleTimeUpdate)
      audioEl.removeEventListener('play', handlePlay)
      audioEl.removeEventListener('pause', handlePause)
      audioEl.removeEventListener('ended', handleEnded)
    }
  }, [audioRef, setAudio])

  // 切换可视化
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // 停止旧的可视化
    if (vizRef.current) {
      vizRef.current.stop()
      vizRef.current = null
    }

    // 创建新的可视化
    vizRef.current = createVisualizer(currentVisualizer, canvas)

    // 如果正在播放，启动新的可视化
    if (audio.isPlaying) {
      vizRef.current.start(audioEngine, paramsRef.current)
    }

    prevVizTypeRef.current = currentVisualizer

    return () => {
      if (vizRef.current) {
        vizRef.current.stop()
        vizRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVisualizer])

  // 播放状态变化时启动/停止可视化
  useEffect(() => {
    if (audio.isPlaying && vizRef.current) {
      vizRef.current.start(audioEngine, paramsRef.current)
    } else if (!audio.isPlaying && vizRef.current) {
      vizRef.current.stop()
    }
  }, [audio.isPlaying, audioEngine])

  // 参数变化时同步到运行中的可视化（让滑块调节实时生效）
  useEffect(() => {
    if (vizRef.current) {
      vizRef.current.setParams(params)
    }
  }, [params])

  return (
    <canvas
      key="visualizer-canvas"
      ref={canvasRef}
      className="fixed inset-0"
      style={{ width: '100vw', height: '100vh' }}
    />
  )
}