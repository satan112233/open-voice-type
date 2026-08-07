export type Theme = 'light' | 'dark' | 'system'
export type OutputMode = 'paste' | 'copy'
export type AsrProvider = 'sherpa' | 'iflytek' | 'aliyun'

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

// Kimi（api.kimi.com/coding）可用的模型 ID，均已实测可调用。highspeed 最快（<1s）为默认；
// k3 系列带深度推理，延迟高（8–13s），口语优化场景不推荐。
export const KIMI_MODELS = [
  { id: 'kimi-for-coding-highspeed', label: 'kimi-for-coding-highspeed（最快，默认）' },
  { id: 'kimi-for-coding', label: 'kimi-for-coding' },
  { id: 'k3-256k', label: 'k3-256k（长上下文，较慢）' },
  { id: 'k3', label: 'k3（深度推理，最慢）' }
] as const

// DeepSeek 可用的模型 ID，均已实测可调用。flash 最快（<1s）为默认；pro 更强但稍慢（~2s）。
export const DEEPSEEK_MODELS = [
  { id: 'deepseek-v4-flash', label: 'deepseek-v4-flash（最快，默认）' },
  { id: 'deepseek-v4-pro', label: 'deepseek-v4-pro（更强，稍慢）' }
] as const

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
  // DeepSeek 模型 ID（空则用预设默认 deepseek-v4-flash），可选值见 DEEPSEEK_MODELS。
  deepseekModel?: string
  // Kimi（Moonshot AI）API Key（sk-xxx）。
  kimiApiKey?: string
  // Kimi 模型 ID（空则用预设默认 kimi-for-coding-highspeed），可选值见 KIMI_MODELS。
  kimiModel?: string
  // 本地模型配置（Ollama / llama.cpp / vLLM 等 OpenAI 兼容服务）。
  localBaseUrl?: string
  localModel?: string
  localApiKey?: string
  iflytekAppId?: string
  iflytekApiKey?: string
  iflytekApiSecret?: string
  // 阿里云百炼（DashScope）API Key（sk-xxx），用于 Qwen3-ASR-Flash 语音识别。
  aliyunApiKey?: string
  llmProvider?: 'deepseek' | 'zhipu' | 'kimi' | 'local'
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
  llmProvider?: 'deepseek' | 'zhipu' | 'kimi' | 'local'
  // 实际使用的大模型名（本地模型时记录具体模型，如 qwen2.5:14b）。
  llmModel?: string
  // 该条为「边说边翻译」生成时记录的目标语言；普通语音输入则为 undefined。
  translationTargetLang?: TranslationLangCode
}

export interface DictionaryEntry {
  id: string
  word: string
  note?: string
  autoLearned?: boolean
}

// 转录子阶段，用于在录音浮层 Thinking 区分进度：识别中 / 口语优化中 / 翻译中。
export type TranscribeStage = 'recognizing' | 'optimizing' | 'translating'

export interface RecordingState {
  isRecording: boolean
  isTranscribing: boolean
  duration: number
  audioLevel?: number
  canCancel: boolean
  // 仅 isTranscribing 时有意义；由主进程随真实处理阶段推进，缺省回退为通用 Thinking。
  stage?: TranscribeStage
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
  clearDictionary: () => Promise<void>

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
  // renderer 触达 60s 录音上限自停时通知 main，让其推进状态机并装上转录看门狗。
  notifyRecordingAutoStopped: () => void

  // Window controls
  minimizeWindow: () => Promise<void>
  closeWindow: () => Promise<void>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
