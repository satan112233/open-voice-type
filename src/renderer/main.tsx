import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { VoiceRecordingPanel } from './components/VoiceRecordingPanel'
import { RecordingPopup } from './components/RecordingPopup'
import type { ElectronAPI } from '@shared/types'

// Mock electronAPI for browser-based development/testing
if (!window.electronAPI) {
  window.electronAPI = {
    getSettings: async () => ({
      version: 1,
      theme: 'system',
      shortcut: 'Ctrl+Alt+V',
      outputMode: 'paste',
      asrProvider: 'sherpa',
      optimizeSpeech: true,
      saveHistory: true,
      historyRetentionDays: 'forever',
      llmProvider: 'deepseek',
      enableLlmOptimization: false
    }),
    setSettings: async () => undefined,
    getHistory: async () => [],
    addHistory: async (item) => ({ ...item, id: crypto.randomUUID() }),
    deleteHistoryItem: async () => undefined,
    clearHistory: async () => undefined,
    getDictionary: async () => [],
    setDictionary: async () => undefined,
    transcribeAudio: async () => ({ text: '模拟识别结果' }),
    onRecordingStateChange: () => () => undefined,
    onStartGlobalRecording: () => () => undefined,
    onStopGlobalRecording: () => () => undefined,
    onCancelGlobalRecording: () => () => undefined,
    cancelGlobalRecording: async () => undefined,
    sendRecordingState: () => undefined,
    sendGlobalVoiceResult: () => undefined,
    notifyRecordingAutoStopped: () => undefined,
    minimizeWindow: async () => undefined,
    closeWindow: async () => undefined
  } as unknown as ElectronAPI
}

const params = new URLSearchParams(window.location.search)
const mode = params.get('mode')

const root = createRoot(document.getElementById('root')!)

if (mode === 'voice') {
  root.render(
    <StrictMode>
      <VoiceRecordingPanel />
    </StrictMode>
  )
} else if (mode === 'popup') {
  // The popup lives in a transparent window; clear the default white body
  // background so only the pill itself is visible.
  document.documentElement.style.background = 'transparent'
  document.body.style.background = 'transparent'
  root.render(
    <StrictMode>
      <RecordingPopup />
    </StrictMode>
  )
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}
