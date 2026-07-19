import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // ── 文件对话框 ──

  /** 打开原生目录选择对话框，返回路径或 null */
  selectDirectory: (): Promise<string | null> => ipcRenderer.invoke('select-directory'),

  /** 将 ArrayBuffer 数据保存到用户选择的路径，返回路径或 null */
  saveFile: (data: ArrayBuffer, defaultName: string): Promise<string | null> =>
    ipcRenderer.invoke('save-file', data, defaultName),

  // ── Native FFmpeg 渲染 ──

  /** 启动 ffmpeg 子进程（立即返回），等待帧数据 */
  renderStart: (config: {
    width: number
    height: number
    fps: number
    bitrate: string
    audioPath: string
    outputPath: string
  }, totalFrames: number): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('render-start', config, totalFrames),

  /** 向 ffmpeg stdin 写入一帧 RGB24 数据 */
  renderFrame: (data: ArrayBuffer): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('render-frame', data),

  /** 关闭 stdin，等待 ffmpeg 编码完成。返回输出文件路径或错误 */
  renderFinish: (): Promise<{ success: boolean; outputPath?: string; error?: string }> =>
    ipcRenderer.invoke('render-finish'),

  /** 强制终止 ffmpeg 进程 */
  renderCancel: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('render-cancel'),

  /** 监听 ffmpeg 编码进度（由 Main 进程推送） */
  onRenderProgress: (callback: (progress: { frame: number; fps: number; time: string; speed: string }) => void) => {
    const handler = (_event: unknown, progress: unknown) => callback(progress as { frame: number; fps: number; time: string; speed: string })
    ipcRenderer.on('render-progress', handler)
    return () => { ipcRenderer.removeListener('render-progress', handler) }
  },

  // ── 临时文件 & 文件读取 ──

  /** 将 ArrayBuffer 写入临时目录，返回文件路径 */
  writeTempFile: (data: ArrayBuffer, filename: string): Promise<string> =>
    ipcRenderer.invoke('write-temp-file', data, filename),

  /** 读取指定路径的文件并返回 ArrayBuffer */
  readFile: (filePath: string): Promise<ArrayBuffer> =>
    ipcRenderer.invoke('read-file', filePath),

  /** 删除临时文件（best-effort） */
  cleanupTempFile: (filePath: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('cleanup-temp-file', filePath),
})
