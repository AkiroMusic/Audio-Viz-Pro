import { app, BrowserWindow, session, dialog, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { FFmpegBridge, type RenderConfig } from './ffmpeg-bridge'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const isDev = !app.isPackaged

function createWindow(): BrowserWindow {
  const preloadPath = path.join(__dirname, 'preload.mjs')

  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  return mainWindow
}

// ── File Dialog IPC ──

ipcMain.handle('select-directory', async () => {
  try {
    const win = BrowserWindow.getAllWindows()[0]
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  } catch (err) {
    console.error('select-directory failed:', err)
    return null
  }
})

ipcMain.handle('save-file', async (_event, data: ArrayBuffer, defaultName: string) => {
  try {
    const win = BrowserWindow.getAllWindows()[0]
    const result = await dialog.showSaveDialog(win, {
      defaultPath: defaultName,
      filters: [{ name: 'Video', extensions: ['webm'] }],
    })
    if (result.canceled || !result.filePath) return null
    fs.writeFileSync(result.filePath, Buffer.from(data))
    return result.filePath
  } catch (err) {
    console.error('save-file failed:', err)
    return null
  }
})

// ── Native FFmpeg Render IPC ──

const ffmpegBridge = new FFmpegBridge()

/**
 * render-start: 启动 ffmpeg 子进程（立即返回）。
 * 进程在后台运行，等待 render-frame 帧数据。
 */
ipcMain.handle('render-start', async (event, config: RenderConfig, totalFrames: number) => {
  const win = BrowserWindow.getAllWindows()[0]

  try {
    ffmpegBridge.spawnFfmpeg(config, totalFrames, (progress) => {
      if (win && !win.isDestroyed()) {
        win.webContents.send('render-progress', progress)
      }
    })
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
})

/**
 * render-frame: 接收一帧 RGB24 数据，写入 ffmpeg stdin。
 */
ipcMain.handle('render-frame', async (_event, data: ArrayBuffer) => {
  try {
    ffmpegBridge.writeFrame(Buffer.from(data))
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
})

/**
 * render-finish: 关闭 stdin，等待 ffmpeg 编码完成并输出 WebM 文件。
 * @returns 成功返回输出文件路径，失败返回错误信息。
 */
ipcMain.handle('render-finish', async () => {
  try {
    ffmpegBridge.finishStdin()
    const outputPath = await ffmpegBridge.waitForFinish()
    return { success: true, outputPath }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
})

/**
 * render-cancel: 强制终止 ffmpeg 进程。
 */
ipcMain.handle('render-cancel', async () => {
  try {
    ffmpegBridge.cancelRender()
    return { success: true }
  } catch (err) {
    console.error('render-cancel failed:', err)
    return { success: true } // best effort
  }
})

// ── Temp File & Read IPC ──

/** 渲染用临时文件目录 */
const RENDER_TMP_DIR = path.join(os.tmpdir(), 'audioviz-render')

/**
 * write-temp-file: 将 ArrayBuffer 写入临时目录，返回文件路径。
 * 用于将渲染器中的音频 File 写到磁盘供 ffmpeg 读取。
 */
ipcMain.handle('write-temp-file', async (_event, data: ArrayBuffer, filename: string) => {
  try {
    fs.mkdirSync(RENDER_TMP_DIR, { recursive: true })
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = path.join(RENDER_TMP_DIR, `${Date.now()}-${safeName}`)
    fs.writeFileSync(filePath, Buffer.from(data))
    return filePath
  } catch (err) {
    console.error('write-temp-file failed:', err)
    throw new Error(`Failed to write temp file: ${err instanceof Error ? err.message : String(err)}`)
  }
})

/**
 * read-file: 读取指定路径的文件并返回 ArrayBuffer。
 * 用于读取 ffmpeg 输出的 WebM 文件传回渲染器创建 blob URL。
 */
ipcMain.handle('read-file', async (_event, filePath: string) => {
  try {
    const buf = fs.readFileSync(filePath)
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  } catch (err) {
    console.error('read-file failed:', err)
    throw new Error(`Failed to read file: ${err instanceof Error ? err.message : String(err)}`)
  }
})

/**
 * cleanup-temp-file: 删除临时文件（best-effort，忽略错误）。
 */
ipcMain.handle('cleanup-temp-file', async (_event, filePath: string) => {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch { /* best effort */ }
  return { success: true }
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
