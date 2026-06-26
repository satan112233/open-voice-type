export type Theme = 'light' | 'dark' | 'system'
export type OutputMode = 'paste' | 'copy' | 'confirm'
export type AsrProvider = 'sherpa' | 'zhipu' | 'iflytek'

// 边说边翻译支持的目标语言。label 用于设置页下拉显示，name 注入翻译 prompt。
export const TRANSLATION_LANGUAGES = [
  { code: 'en', label: 'English', name: '英语' },
  { code: 'zh', label: '中文', name: '中文' },
  { code: 'ja', label: '日本語', name: '日语' },
  { code: 'ko', label: '한국어', name: '韩语' },
  { code: 'fr', label: 'Français', name: '法语' },
  { code: 'de', label: 'Deutsch', name: '德语' },
  { code: 'es', label: 'Español', name: '西班牙语' }
] as const

export type TranslationLangCode = (typeof TRANSLATION_LANGUAGES)[number]['code']

export interface Settings {
  version: number
  theme: Theme
  shortcut: string
  outputMode: OutputMode
  asrProvider: AsrProvider
  optimizeSpeech: boolean
  saveHistory: boolean
  historyRetentionDays: number | 'forever'
  sherpaModelPath?: string
  zhipuApiKey?: string
  deepseekApiKey?: string
  iflytekAppId?: string
  iflytekApiKey?: string
  iflytekApiSecret?: string
  llmProvider?: 'deepseek' | 'zhipu'
  llmApiKey?: string
  llmBaseUrl?: string
  llmModel?: string
  enableLlmOptimization: boolean
  // 边说边翻译：独立全局热键（默认 Ctrl+Alt+F）触发，输出目标语言译文。
  translationShortcut?: string
  translationTargetLang?: TranslationLangCode
  // 录音输入设备（空字符串表示使用系统默认麦克风）。
  audioInputDeviceId?: string
}

export interface HistoryItem {
  id: string
  text: string
  rawText?: string
  duration: number
  createdAt: number
  asrProvider?: AsrProvider
  llmProvider?: 'deepseek' | 'zhipu'
  // 该条为「边说边翻译」生成时记录的目标语言；普通语音输入则为 undefined。
  translationTargetLang?: TranslationLangCode
}

export interface DictionaryEntry {
  id: string
  word: string
  note?: string
  autoLearned?: boolean
}

export interface RecordingState {
  isRecording: boolean
  isTranscribing: boolean
  duration: number
  audioLevel?: number
  canCancel: boolean
}

export interface TranscribeAudioRequest {
  audioBase64: string
  language?: 'auto' | 'zh' | 'en'
}

export interface TranscribeAudioResult {
  text: string
}

export interface TranscriptionResult {
  text: string
  rawText?: string
  duration: number
}

export interface ElectronAPI {
  // Settings
  getSettings: () => Promise<Settings>
  setSettings: (settings: Partial<Settings>) => Promise<void>

  // History
  getHistory: () => Promise<HistoryItem[]>
  addHistory: (item: Omit<HistoryItem, 'id'>) => Promise<HistoryItem>
  deleteHistoryItem: (id: string) => Promise<void>
  clearHistory: () => Promise<void>

  // Dictionary
  getDictionary: () => Promise<DictionaryEntry[]>
  setDictionary: (entries: DictionaryEntry[]) => Promise<void>

  // Transcription
  transcribeAudio: (request: TranscribeAudioRequest) => Promise<TranscribeAudioResult>

  // Recording state sync
  onRecordingStateChange: (callback: (state: RecordingState) => void) => () => void
  sendRecordingState: (state: RecordingState) => void

  // Global recording commands (voice window only)
  onStartGlobalRecording: (callback: (deviceId?: string) => void) => () => void
  onStopGlobalRecording: (callback: () => void) => () => void
  onCancelGlobalRecording: (callback: () => void) => () => void
  cancelGlobalRecording: () => Promise<void>
  confirmGlobalRecording: () => Promise<void>
  sendGlobalVoiceResult: (text: string) => void
  notifyTranscriptionFailed: (reason?: string) => void

  // Window controls
  minimizeWindow: () => Promise<void>
  closeWindow: () => Promise<void>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
