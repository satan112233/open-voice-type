export type Theme = 'light' | 'dark' | 'system'
export type OutputMode = 'paste' | 'copy' | 'confirm'
export type AsrProvider = 'sherpa' | 'zhipu' | 'iflytek'

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
}

export interface HistoryItem {
  id: string
  text: string
  rawText?: string
  duration: number
  createdAt: number
  asrProvider?: AsrProvider
  llmProvider?: 'deepseek' | 'zhipu'
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
  onStartGlobalRecording: (callback: () => void) => () => void
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
