import { useEffect, useState } from 'react'
import { Home, History, BookOpen, Settings, Minus, X } from 'lucide-react'
import { useSettingsStore } from './stores/settingsStore'
import { HomePage } from './components/HomePage'
import { HistoryPage } from './components/HistoryPage'
import { DictionaryPage } from './components/DictionaryPage'
import { SettingsPage } from './components/SettingsPage'

type View = 'home' | 'history' | 'dictionary' | 'settings'

const navItems: { id: View; label: string; icon: React.ElementType }[] = [
  { id: 'home', label: '首页', icon: Home },
  { id: 'history', label: '历史记录', icon: History },
  { id: 'dictionary', label: '词典', icon: BookOpen }
]

export default function App() {
  const [activeView, setActiveView] = useState<View>('home')
  const { theme, initialize } = useSettingsStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', prefersDark)
      root.classList.toggle('light', !prefersDark)
    } else {
      root.classList.toggle('dark', theme === 'dark')
      root.classList.toggle('light', theme === 'light')
    }
  }, [theme])

  const renderContent = () => {
    switch (activeView) {
      case 'home':
        return <HomePage />
      case 'history':
        return <HistoryPage />
      case 'dictionary':
        return <DictionaryPage />
      case 'settings':
        return <SettingsPage />
      default:
        return <HomePage />
    }
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg-primary)]">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 border-r border-[var(--border-color)] bg-[var(--bg-secondary)] flex flex-col">
        <div className="app-drag-region flex items-center gap-3 px-5 py-4">
          <img
            src="./src/renderer/assets/logo.png"
            alt="OpenVoiceType"
            className="h-8 w-8 rounded-lg object-cover"
          />
          <span className="font-semibold text-[var(--text-primary)]">语音输入助手</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeView === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`app-no-drag flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="border-t border-[var(--border-color)] p-3">
          <button
            onClick={() => setActiveView('settings')}
            className={`app-no-drag flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              activeView === 'settings'
                ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Settings className="h-4 w-4" />
            设置
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Title bar */}
        <header className="app-drag-region flex h-12 items-center justify-end border-b border-[var(--border-color)] px-4">
          <div className="app-no-drag flex items-center gap-1">
            <button
              onClick={() => window.electronAPI.minimizeWindow()}
              className="rounded-md p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              onClick={() => window.electronAPI.closeWindow()}
              className="rounded-md p-1.5 text-[var(--text-secondary)] hover:bg-red-500 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">{renderContent()}</main>
      </div>
    </div>
  )
}
