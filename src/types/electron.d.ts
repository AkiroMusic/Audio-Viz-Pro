/** Electron 原生 API 桥接（由 preload.ts 注入） */
export interface ElectronAPI {
  /** 打开原生目录选择对话框，返回路径或 null */
  selectDirectory: () => Promise<string | null>
  /** 将 ArrayBuffer 数据保存到用户选择的路径，返回路径或 null */
  saveFile: (data: ArrayBuffer, defaultName: string) => Promise<string | null>

  /** 启动 ffmpeg 子进程（立即返回），等待帧数据 */
  renderStart: (config: {
    width: number
    height: number
    fps: number
    bitrate: string
    audioPath: string
    outputPath: string
  }, totalFrames: number) => Promise<{ success: boolean; error?: string }>

  /** 向 ffmpeg stdin 写入一帧 RGB24 数据 */
  renderFrame: (data: ArrayBuffer) => Promise<{ success: boolean; error?: string }>

  /** 关闭 stdin，等待 ffmpeg 编码完成。返回输出文件路径或错误 */
  renderFinish: () => Promise<{ success: boolean; outputPath?: string; error?: string }>

  /** 强制终止 ffmpeg 进程 */
  renderCancel: () => Promise<{ success: boolean }>

  /** 监听 ffmpeg 编码进度（由 Main 进程推送），返回取消监听函数 */
  onRenderProgress: (callback: (progress: { frame: number; fps: number; time: string; speed: string }) => void) => () => void

  /** 将 ArrayBuffer 写入临时目录，返回文件路径 */
  writeTempFile: (data: ArrayBuffer, filename: string) => Promise<string>

  /** 读取指定路径的文件并返回 ArrayBuffer */
  readFile: (filePath: string) => Promise<ArrayBuffer>

  /** 删除临时文件（best-effort） */
  cleanupTempFile: (filePath: string) => Promise<{ success: boolean }>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
