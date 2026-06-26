import {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  Tray,
  Menu,
  nativeImage,
  screen,
  clipboard,
  shell
} from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'
import Store from 'electron-store'
import { optimizeWithLlm, LLM_PROVIDERS } from './services/llm-optimizer-service'
import { pasteText } from './utils/system-input'
import { transcribeWithSherpa } from './services/sherpa-onnx-service'
import { transcribeWithIflytek } from './services/iflytek-asr-service'
import type {
  DictionaryEntry,
  HistoryItem,
  RecordingState,
  Settings,
  TranscriptionResult,
  TranscribeAudioRequest
} from '../shared/types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
process.env.APP_ROOT = path.join(__dirname, '../..')

const DEFAULT_SETTINGS: Settings = {
  version: 1,
  theme: 'system',
  shortcut: 'Ctrl+Alt+V',
  outputMode: 'paste',
  asrProvider: 'sherpa',
  optimizeSpeech: true,
  saveHistory: true,
  historyRetentionDays: 'forever',
  llmProvider: 'deepseek',
  llmModel: 'deepseek-v4-flash',
  enableLlmOptimization: false
}

const store = new Store<{
  settings: Settings
  history: HistoryItem[]
  dictionary: DictionaryEntry[]
}>({
  defaults: {
    settings: DEFAULT_SETTINGS,
    history: [],
    dictionary: []
  }
})

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let voiceWindow: BrowserWindow | null = null
let recordingPopup: BrowserWindow | null = null

let recordingDuration = 0
let recordingTimer: NodeJS.Timeout | null = null
// popup 转录态的权威阶段：录音阶段才让 voiceWindow 的状态驱动 popup（声波）；
// 进入 transcribing 后由 main 独占控制，直到 handleTranscriptionResult 收尾，
// 以保证 Thinking 覆盖「ASR + 口语优化 + 粘贴」整个过程。
let globalPhase: 'idle' | 'recording' | 'transcribing' = 'idle'
// 转录看门狗：进入 transcribing 后启动；任何环节卡住（ASR 无返回、LLM 挂起、
// 信号丢失）超时后强制收尾，避免 Thinking 永久卡住。
let transcribeWatchdog: NodeJS.Timeout | null = null
const TRANSCRIBE_WATCHDOG_MS = 45_000

const isDev = !app.isPackaged

function getAssetPath(...paths: string[]): string {
  if (isDev) {
    return path.join(process.cwd(), ...paths)
  }
  return path.join(process.resourcesPath, ...paths)
}

// 加载 renderer：dev 走本地 dev server，打包后走构建产物 dist/index.html。
// 注意 renderer 构建输出目录是 dist（见 electron.vite.config.ts），不是 dist-electron/renderer；
// 用 loadFile + query 而非拼 file:// 字符串，避免 Windows 反斜杠路径与查询参数解析问题。
function loadRenderer(win: BrowserWindow, mode?: string): void {
  if (isDev) {
    const base = process.env.ELECTRON_RENDERER_URL || 'http://localhost:5173'
    win.loadURL(mode ? `${base}?mode=${mode}` : base)
    return
  }
  const indexPath = path.join(__dirname, '../../dist/index.html')
  win.loadFile(indexPath, mode ? { query: { mode } } : undefined)
}

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 800,
    minHeight: 560,
    frame: false,
    titleBarStyle: 'hidden',
    show: false,
    icon: getAssetPath('build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  loadRenderer(win)

  win.once('ready-to-show', () => {
    win.show()
  })

  win.on('close', (event) => {
    event.preventDefault()
    win.hide()
  })

  return win
}

function createVoiceWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1,
    height: 1,
    x: -1000,
    y: -1000,
    show: false,
    frame: false,
    transparent: true,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  })

  loadRenderer(win, 'voice')
  return win
}

function createRecordingPopup(): BrowserWindow {
  const { width: screenWidth, height: screenHeight, x: screenX, y: screenY } = screen.getPrimaryDisplay().workArea

  const winWidth = 240
  const winHeight = 72
  const x = Math.round(screenX + (screenWidth - winWidth) / 2)
  const y = Math.round(screenY + screenHeight - 150)

  console.log(`[popup] creating popup at ${x},${y} on display ${screenX},${screenY} ${screenWidth}x${screenHeight}`)

  const win = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x,
    y,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  loadRenderer(win, 'popup')

  win.webContents.on('console-message', (_event, level, message) => {
    console.log(`[popup console ${level}]`, message)
  })

  return win
}

function createTray(): Tray {
  const iconPath = getAssetPath('build', 'icon.ico')
  const trayIcon = nativeImage.createFromPath(iconPath)
  const t = new Tray(trayIcon.resize({ width: 16, height: 16 }))

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示语音输入助手',
      click: () => mainWindow?.show()
    },
    {
      label: '开始语音输入',
      click: () => toggleRecording()
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit()
      }
    }
  ])

  t.setContextMenu(contextMenu)
  t.setToolTip('语音输入助手')
  t.on('click', () => mainWindow?.show())

  return t
}

function sendRecordingState(state: RecordingState): void {
  mainWindow?.webContents.send('recording-state-change', state)
  recordingPopup?.webContents.send('recording-state-change', state)
}

// 统一收尾：清看门狗、复位阶段与时长、隐藏 popup、推空闲状态。幂等，可重复调用。
function finishTranscribing(): void {
  if (transcribeWatchdog) {
    clearTimeout(transcribeWatchdog)
    transcribeWatchdog = null
  }
  globalPhase = 'idle'
  recordingDuration = 0
  recordingPopup?.hide()
  sendRecordingState({
    isRecording: false,
    isTranscribing: false,
    duration: 0,
    audioLevel: 0,
    canCancel: false
  })
}

async function ensureVoiceWindow(): Promise<void> {
  const wasCreated = !voiceWindow || voiceWindow.isDestroyed()
  if (wasCreated) {
    voiceWindow = createVoiceWindow()
  }
  if (wasCreated || voiceWindow!.webContents.isLoading()) {
    await new Promise<void>((resolve) => {
      const onLoad = () => {
        voiceWindow?.webContents.off('did-finish-load', onLoad)
        resolve()
      }
      voiceWindow?.webContents.on('did-finish-load', onLoad)
    })
  }
}

async function ensureRecordingPopup(): Promise<void> {
  const wasCreated = !recordingPopup || recordingPopup.isDestroyed()
  if (wasCreated) {
    recordingPopup = createRecordingPopup()
  }
  if (wasCreated || recordingPopup!.webContents.isLoading()) {
    await new Promise<void>((resolve) => {
      const onLoad = () => {
        recordingPopup?.webContents.off('did-finish-load', onLoad)
        resolve()
      }
      recordingPopup?.webContents.on('did-finish-load', onLoad)
    })
  }
}

async function startGlobalRecording(): Promise<void> {
  console.log('[main] startGlobalRecording called')
  globalPhase = 'recording'
  await ensureVoiceWindow()
  await ensureRecordingPopup()

  console.log('[main] showing recording popup')
  recordingPopup!.show()
  recordingPopup!.setAlwaysOnTop(true, 'screen-saver')
  recordingPopup!.setVisibleOnAllWorkspaces(true)
  console.log('[main] recording popup shown, bounds:', recordingPopup!.getBounds())
  console.log('[main] sending start-global-recording to voice window')
  voiceWindow?.webContents.send('start-global-recording')

  recordingDuration = 0
  sendRecordingState({
    isRecording: true,
    isTranscribing: false,
    duration: 0,
    audioLevel: 0,
    canCancel: true
  })

  if (recordingTimer) {
    clearInterval(recordingTimer)
  }
  recordingTimer = setInterval(() => {
    recordingDuration += 1
    sendRecordingState({
      isRecording: true,
      isTranscribing: false,
      duration: recordingDuration,
      audioLevel: 0,
      canCancel: true
    })
  }, 1000)
}

function stopGlobalRecording(): void {
  console.log('[main] stopGlobalRecording called')
  globalPhase = 'transcribing'

  if (transcribeWatchdog) clearTimeout(transcribeWatchdog)
  transcribeWatchdog = setTimeout(() => {
    if (globalPhase === 'transcribing') {
      console.warn('[main] transcription watchdog fired — force closing Thinking')
      finishTranscribing()
    }
  }, TRANSCRIBE_WATCHDOG_MS)

  if (recordingTimer) {
    clearInterval(recordingTimer)
    recordingTimer = null
  }

  sendRecordingState({
    isRecording: false,
    isTranscribing: true,
    duration: recordingDuration,
    audioLevel: 0,
    canCancel: false
  })

  voiceWindow?.webContents.send('stop-global-recording')
}

function cancelGlobalRecording(): void {
  console.log('[main] cancelGlobalRecording called')
  if (recordingTimer) {
    clearInterval(recordingTimer)
    recordingTimer = null
  }
  voiceWindow?.webContents.send('cancel-global-recording')
  finishTranscribing()
}

async function toggleRecording(): Promise<void> {
  if (globalPhase === 'transcribing') return

  if (globalPhase === 'recording') {
    stopGlobalRecording()
  } else {
    await startGlobalRecording()
  }
}

async function transcribeAudio(base64Audio: string, settings: Settings): Promise<string> {
  if (settings.asrProvider === 'sherpa') {
    return transcribeWithSherpa(base64Audio)
  }

  if (settings.asrProvider === 'iflytek') {
    return transcribeWithIflytek(base64Audio, {
      appId: settings.iflytekAppId || '',
      apiKey: settings.iflytekApiKey || '',
      apiSecret: settings.iflytekApiSecret || ''
    })
  }

  throw new Error(`不支持的语音识别引擎：${settings.asrProvider}`)
}

async function handleTranscriptionResult(text: string): Promise<void> {
  // 看门狗已超时强制收尾后（globalPhase 不再是 transcribing），丢弃迟到的识别结果，避免误粘贴。
  if (globalPhase !== 'transcribing') {
    console.warn('[main] discarding late transcription result (already finished)')
    return
  }
  try {
    const settings = store.get('settings')
    const dictionary = store.get('dictionary')

    let rawText = text
    let optimizedText = text
    // 实际成功用过的口语优化模型（用于历史记录标注）；未优化或失败回退时保持 undefined。
    let usedLlmProvider: 'deepseek' | 'zhipu' | undefined

    const provider = settings.llmProvider || 'deepseek'
    const apiKey = provider === 'zhipu' ? settings.zhipuApiKey : settings.deepseekApiKey
    if (settings.enableLlmOptimization && apiKey?.trim()) {
      try {
        const { baseUrl, model } = LLM_PROVIDERS[provider]
        optimizedText = await optimizeWithLlm(text, { apiKey, baseUrl, model }, dictionary)
        usedLlmProvider = provider
      } catch (error) {
        console.error('[main] LLM optimization failed, falling back to raw text:', error)
        optimizedText = text
      }
    }

    const result: TranscriptionResult = {
      text: optimizedText,
      rawText,
      duration: recordingDuration
    }

    if (settings.saveHistory) {
      const historyItem: HistoryItem = {
        id: crypto.randomUUID(),
        text: optimizedText,
        rawText,
        duration: recordingDuration,
        createdAt: Date.now(),
        asrProvider: settings.asrProvider,
        llmProvider: usedLlmProvider
      }
      const history = store.get('history')
      history.unshift(historyItem)
      if (history.length > 200) history.pop()
      store.set('history', history)
    }

    // 口语优化已完成：先收起 Thinking，再输出内容，让"思考结束"早于"出字"
    finishTranscribing()

    if (settings.outputMode === 'paste') {
      await pasteText(optimizedText)
    } else if (settings.outputMode === 'copy') {
      clipboard.writeText(optimizedText)
    }

    mainWindow?.webContents.send('transcription-result', result)
  } catch (error) {
    console.error('[main] Transcription handling failed:', error)
  } finally {
    finishTranscribing()
  }
}

function registerGlobalShortcut(shortcut: string): void {
  globalShortcut.unregisterAll()

  let accelerator = shortcut
  if (shortcut === 'Right Alt') {
    accelerator = 'Alt+Shift+V'
  }

  const bareModifierPattern = /^(Alt|Ctrl|Control|Shift|Command|Cmd|Super|Meta)$/i
  if (bareModifierPattern.test(accelerator)) {
    console.warn(`[shortcut] Invalid accelerator '${accelerator}', falling back to Ctrl+Alt+V`)
    accelerator = 'Ctrl+Alt+V'
  }

  const registered = globalShortcut.register(accelerator, () => {
    toggleRecording()
  })

  if (!registered) {
    console.warn(`[shortcut] Failed to register global shortcut: ${accelerator}`)
  } else {
    console.log(`[shortcut] Global shortcut registered: ${accelerator}`)
    console.log(`[shortcut] isRegistered check:`, globalShortcut.isRegistered(accelerator))
  }
}

function setupIpc(): void {
  ipcMain.handle('get-settings', () => store.get('settings'))
  ipcMain.handle('set-settings', (_event, settings: Partial<Settings>) => {
    const current = store.get('settings')
    const next = { ...current, ...settings }
    store.set('settings', next)

    if (settings.shortcut !== undefined && settings.shortcut !== current.shortcut) {
      registerGlobalShortcut(next.shortcut)
    }
  })

  ipcMain.handle('get-history', () => store.get('history'))
  ipcMain.handle('add-history', (_event, item: Omit<HistoryItem, 'id'>) => {
    const historyItem: HistoryItem = { ...item, id: crypto.randomUUID() }
    const history = store.get('history')
    history.unshift(historyItem)
    if (history.length > 200) history.pop()
    store.set('history', history)
    return historyItem
  })
  ipcMain.handle('delete-history-item', (_event, id: string) => {
    store.set('history', store.get('history').filter((h) => h.id !== id))
  })
  ipcMain.handle('clear-history', () => {
    store.set('history', [])
  })

  ipcMain.handle('get-dictionary', () => store.get('dictionary'))
  ipcMain.handle('set-dictionary', (_event, entries: DictionaryEntry[]) => {
    store.set('dictionary', entries)
  })

  ipcMain.handle('transcribe-audio', async (_event, request: TranscribeAudioRequest) => {
    const settings = store.get('settings')
    const text = await transcribeAudio(request.audioBase64, settings)
    return { text }
  })

  ipcMain.handle('cancel-global-recording', () => {
    cancelGlobalRecording()
  })

  ipcMain.handle('confirm-global-recording', () => {
    stopGlobalRecording()
  })

  ipcMain.handle('minimize-window', () => {
    mainWindow?.minimize()
  })

  ipcMain.handle('close-window', () => {
    mainWindow?.hide()
  })

  ipcMain.on('recording-state', (_event, state: RecordingState) => {
    // 仅录音阶段用 voiceWindow 的状态驱动 popup（实时声波）；进入转录后忽略，
    // 由 main 独占控制 popup 的 Thinking 显隐，使其覆盖到口语优化完成。
    if (globalPhase === 'recording') {
      sendRecordingState(state)
    }
  })

  ipcMain.on('global-voice-result', (_event, text: string) => {
    console.log('[main] received global-voice-result:', text.slice(0, 50))
    handleTranscriptionResult(text)
  })

  // 录音/识别在 voiceWindow 侧失败或无有效结果时通知 main，立即收尾，
  // 避免 Thinking 干等到看门狗超时。
  ipcMain.on('global-voice-failed', (_event, reason?: string) => {
    console.warn('[main] received global-voice-failed:', reason || '(no reason)')
    if (globalPhase === 'transcribing') {
      finishTranscribing()
    }
  })
}

app.whenReady().then(() => {
  let settings = store.get('settings')

  if (settings.shortcut === 'Right Alt' || settings.shortcut === 'Alt') {
    settings = { ...settings, shortcut: 'Ctrl+Alt+V' }
    store.set('settings', settings)
  }

  mainWindow = createMainWindow()
  tray = createTray()

  setupIpc()
  registerGlobalShortcut(settings.shortcut)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow()
    } else {
      mainWindow?.show()
    }
  })
})

app.on('window-all-closed', () => {
  // Keep running in tray on Windows
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('before-quit', () => {
  mainWindow?.destroy()
  voiceWindow?.destroy()
  recordingPopup?.destroy()
  tray?.destroy()
})

app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
})
