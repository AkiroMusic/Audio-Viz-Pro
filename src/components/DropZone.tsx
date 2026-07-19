import React, { useState, useEffect } from 'react'
import { useLanguage } from '../hooks/useLanguage'

interface DropZoneProps {
  onFileDrop: (file: File) => void
}

export const DropZone: React.FC<DropZoneProps> = ({ onFileDrop }) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const { t } = useLanguage()

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault()
      setIsDragOver(true)
    }

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault()
      if (e.relatedTarget === null) {
        setIsDragOver(false)
      }
    }

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      
      const files = e.dataTransfer?.files
      if (files && files.length > 0) {
        const file = files[0]
        if (file.type.startsWith('audio/')) {
          onFileDrop(file)
        }
      }
    }

    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('drop', handleDrop)

    return () => {
      window.removeEventListener('dragenter', handleDragEnter)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('drop', handleDrop)
    }
  }, [onFileDrop])

  if (!isDragOver) return null

  return (
    <div className="fixed inset-0 bg-violet-500/10 backdrop-blur-sm z-40 flex items-center justify-center pointer-events-none">
      <div className="text-center">
        <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-violet-500/30 to-blue-500/30 rounded-3xl flex items-center justify-center border border-violet-500/30">
          <svg className="w-10 h-10 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <p className="text-xl font-semibold text-white">{t.dropZone.dropToLoad}</p>
        <p className="text-sm text-gray-400 mt-2">{t.dropZone.supportedFormats}</p>
      </div>
    </div>
  )
}