import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'

export function useAutoHideUI(): void {
  const { isUIVisible, setUIVisible, audio } = useStore()
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    const resetTimer = () => {
      setUIVisible(true)
      
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
      
      if (audio.isPlaying) {
        timerRef.current = window.setTimeout(() => {
          setUIVisible(false)
        }, 3000)
      }
    }

    const handleMouseMove = () => resetTimer()
    const handleClick = () => resetTimer()

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('click', handleClick)

    // 初始设置
    resetTimer()

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('click', handleClick)
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
  }, [audio.isPlaying, setUIVisible])
}