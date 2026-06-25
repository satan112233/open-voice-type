import { create } from 'zustand'
import type { Settings } from '@shared/types'

interface SettingsState {
  settings: Settings | null
  theme: Settings['theme']
  initialize: () => Promise<void>
  updateSettings: (patch: Partial<Settings>) => Promise<void>
}

const DEFAULT_THEME: Settings['theme'] = 'system'

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  theme: DEFAULT_THEME,

  initialize: async () => {
    const settings = await window.electronAPI.getSettings()
    set({ settings, theme: settings.theme })
  },

  updateSettings: async (patch) => {
    await window.electronAPI.setSettings(patch)
    const settings = await window.electronAPI.getSettings()
    set({ settings, theme: settings.theme })
  }
}))
