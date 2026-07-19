import React, { useRef, useState, useEffect, useCallback } from 'react'
import { useStore } from '../store/useStore'
import { AudioEngine } from '../audio/AudioEngine'
import { formatTime } from '../utils'
import { useLanguage } from '../hooks/useLanguage'

interface AudioPlayerProps {
  audioEngine: AudioEngine
  audioRef: React.RefObject<HTMLAudioElement | null>
  onLoadFile: (file: File) => void
  className?: string
  style?: React.CSSProperties
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioEngine, audioRef, onLoadFile, className = '', style }) => {
  const { audio, setAudio } = useStore()
  const { t } = useLanguage()
  const [volume, setVolume] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [showDeviceSelector, setShowDeviceSelector] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const engineInitRef = useRef(false)
  const deviceSelectorRef = useRef<HTMLDivElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // 文件模式：自动关闭麦克风
      if (audio.isMicActive) {
        audioEngine.disableMic()
        setAudio({ isMicActive: false })
      }
      onLoadFile(file)
    }
  }

  const handleTogglePlay = async () => {
    const audioEl = audioRef.current
    if (!audioEl) return

    // 文件播放模式：自动关闭麦克风
    if (audio.isMicActive) {
      audioEngine.disableMic()
      setAudio({ isMicActive: false })
    }

    if (!engineInitRef.current) {
      await audioEngine.init(audioEl)
      engineInitRef.current = true
    }

    if (audioEl.paused) {
      audioEngine.resume()
      try {
        await audioEl.play()
      } catch (err) {
        console.warn('Playback failed:', err)
      }
    } else {
      audioEl.pause()
    }
  }

  const handleProgressDrag = (clientX: number) => {
    const audioEl = audioRef.current
    if (!audioEl || !progressRef.current || !audioEl.duration) return
    const rect = progressRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const percentage = Math.max(0, Math.min(1, x / rect.width))
    audioEl.currentTime = percentage * audioEl.duration
  }

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true)
    handleProgressDrag(e.clientX)
  }

  const handleProgressMouseUp = () => {
    setIsDragging(false)
  }

  const handleProgressMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      handleProgressDrag(e.clientX)
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    audioEngine.setVolume(newVolume)
  }

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false)
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        handleProgressDrag(e.clientX)
      }
    }
    window.addEventListener('mouseup', handleGlobalMouseUp)
    window.addEventListener('mousemove', handleGlobalMouseMove)
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp)
      window.removeEventListener('mousemove', handleGlobalMouseMove)
    }
  }, [isDragging])

  const handleToggleMic = async () => {
    if (audio.isMicActive) {
      audioEngine.disableMic()
      setAudio({ isMicActive: false })
      setShowDeviceSelector(false)
    } else {
      // 麦克风模式：暂停文件播放
      const audioEl = audioRef.current
      if (audioEl && !audioEl.paused) {
        audioEl.pause()
        setAudio({ isPlaying: false })
      }
      await audioEngine.enableMic(audio.selectedDeviceId || undefined)
      setAudio({ isMicActive: true })
      // Enumerate devices for the selector
      const devices = await audioEngine.getAudioInputDevices()
      setAudio({ audioDevices: devices })
    }
  }

  const handleDeviceChange = async (deviceId: string) => {
    setAudio({ selectedDeviceId: deviceId })
    if (audio.isMicActive) {
      // Restart mic with the new device
      audioEngine.disableMic()
      await audioEngine.enableMic(deviceId || undefined)
      setAudio({ isMicActive: true })
    }
    setShowDeviceSelector(false)
  }

  const toggleDeviceSelector = useCallback(async () => {
    if (!showDeviceSelector && audio.isMicActive) {
      const devices = await audioEngine.getAudioInputDevices()
      setAudio({ audioDevices: devices })
    }
    setShowDeviceSelector(prev => !prev)
  }, [showDeviceSelector, audio.isMicActive, audioEngine, setAudio])

  // Close device selector on outside click
  useEffect(() => {
    if (!showDeviceSelector) return
    const handleClickOutside = (e: MouseEvent) => {
      if (deviceSelectorRef.current && !deviceSelectorRef.current.contains(e.target as Node)) {
        setShowDeviceSelector(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showDeviceSelector])

  const handleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      document.documentElement.requestFullscreen()
    }
  }

  const progress = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0

  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 h-[70px] bg-gradient-to-t from-gray-950/98 to-gray-900/95 backdrop-blur-xl border-t border-white/5 flex items-center px-4 gap-4 ${className}`}
      style={style}
    >
      {/* 文件上传 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="p-2.5 hover:bg-white/10 rounded-xl transition-all duration-200 text-gray-400 hover:text-white"
        aria-label={t.player.uploadFile}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      </button>

      {/* 麦克风 + 设备选择器 */}
      <div className="relative" ref={deviceSelectorRef}>
        <button
          onClick={handleToggleMic}
          className={`p-2.5 rounded-xl transition-all duration-200 ${
            audio.isMicActive 
              ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-lg shadow-violet-500/25' 
              : 'hover:bg-white/10 text-gray-400 hover:text-white'
          }`}
          aria-label={audio.isMicActive ? t.player.disableMic : t.player.enableMic}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </button>

        {/* 设备选择器下拉按钮 */}
        {audio.isMicActive && audio.audioDevices.length > 1 && (
          <button
            onClick={toggleDeviceSelector}
            className="absolute -right-1 top-0 translate-x-full p-1.5 hover:bg-white/10 rounded-r-xl transition-all duration-200 text-gray-500 hover:text-white"
            aria-label={t.player.selectDevice}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}

        {/* 设备选择下拉面板 */}
        {showDeviceSelector && (
          <div className="absolute bottom-full left-0 mb-2 w-64 bg-gray-900/98 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
            <div className="px-3 py-2 border-b border-white/5">
              <span className="text-xs font-medium text-gray-400">{t.player.selectDevice}</span>
            </div>
            <div className="max-h-48 overflow-y-auto py-1">
              <button
                onClick={() => handleDeviceChange('')}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  !audio.selectedDeviceId
                    ? 'bg-violet-600/20 text-violet-300'
                    : 'text-gray-300 hover:bg-white/5'
                }`}
              >
                {t.player.defaultDevice}
              </button>
              {audio.audioDevices.map(device => (
                <button
                  key={device.deviceId}
                  onClick={() => handleDeviceChange(device.deviceId)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors truncate ${
                    audio.selectedDeviceId === device.deviceId
                      ? 'bg-violet-600/20 text-violet-300'
                      : 'text-gray-300 hover:bg-white/5'
                  }`}
                  title={device.label || `Input ${device.deviceId.slice(0, 8)}`}
                >
                  {device.label || `Input ${device.deviceId.slice(0, 8)}`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 播放/暂停 */}
      <button
        onClick={handleTogglePlay}
        className="p-3 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 rounded-full transition-all duration-200 text-white shadow-lg shadow-violet-500/25"
        aria-label={audio.isPlaying ? t.player.pause : t.player.play}
      >
        {audio.isPlaying ? (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* 进度条 */}
      <div className="flex-1 flex items-center gap-3">
        <span className="text-xs font-mono text-gray-500 w-12 text-right">{formatTime(audio.currentTime)}</span>
        <div
          ref={progressRef}
          className="flex-1 h-1.5 bg-white/10 rounded-full cursor-pointer group relative"
          onMouseDown={handleProgressMouseDown}
          onMouseUp={handleProgressMouseUp}
          onMouseMove={handleProgressMouseMove}
        >
          <div
            className="h-full bg-gradient-to-r from-violet-600 to-blue-600 rounded-full relative transition-[width]"
            style={{ width: `${progress}%` }}
          >
            <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg transition-opacity ${isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />
          </div>
        </div>
        <span className="text-xs font-mono text-gray-500 w-12">{formatTime(audio.duration)}</span>
      </div>

      {/* 音量 */}
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
        </svg>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={handleVolumeChange}
          className="w-20 accent-violet-500"
          aria-label={t.player.volume}
        />
      </div>

      {/* 曲目名称 */}
      <div className="text-sm text-gray-500 truncate max-w-[150px]">
        {audio.fileName || t.player.noAudio}
      </div>

      {/* 全屏 */}
      <button
        onClick={handleFullscreen}
        className="p-2.5 hover:bg-white/10 rounded-xl transition-all duration-200 text-gray-400 hover:text-white"
        aria-label={t.player.fullscreen}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      </button>
    </div>
  )
}