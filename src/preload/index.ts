import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI, RecordingState } from '../shared/types'

const api: ElectronAPI = {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSettings: (settings) => ipcRenderer.invoke('set-settings', settings),

  getHistory: () => ipcRenderer.invoke('get-history'),
  addHistory: (item) => ipcRenderer.invoke('add-history', item),
  deleteHistoryItem: (id) => ipcRenderer.invoke('delete-history-item', id),
  clearHistory: () => ipcRenderer.invoke('clear-history'),

  getDictionary: () => ipcRenderer.invoke('get-dictionary'),
  setDictionary: (entries) => ipcRenderer.invoke('set-dictionary', entries),

  transcribeAudio: (request) => ipcRenderer.invoke('transcribe-audio', request),

  onRecordingStateChange: (callback) => {
    const handler = (_: unknown, state: RecordingState) => callback(state)
    ipcRenderer.on('recording-state-change', handler)
    return () => ipcRenderer.removeListener('recording-state-change', handler)
  },

  onStartGlobalRecording: (callback) => {
    const handler = (_: unknown, deviceId?: string) => callback(deviceId)
    ipcRenderer.on('start-global-recording', handler)
    return () => ipcRenderer.removeListener('start-global-recording', handler)
  },

  onStopGlobalRecording: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('stop-global-recording', handler)
    return () => ipcRenderer.removeListener('stop-global-recording', handler)
  },

  onCancelGlobalRecording: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('cancel-global-recording', handler)
    return () => ipcRenderer.removeListener('cancel-global-recording', handler)
  },

  sendRecordingState: (state) => ipcRenderer.send('recording-state', state),
  sendGlobalVoiceResult: (text) => ipcRenderer.send('global-voice-result', text),
  notifyTranscriptionFailed: (reason) => ipcRenderer.send('global-voice-failed', reason),

  cancelGlobalRecording: () => ipcRenderer.invoke('cancel-global-recording'),
  confirmGlobalRecording: () => ipcRenderer.invoke('confirm-global-recording'),

  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window')
}

contextBridge.exposeInMainWorld('electronAPI', api)
