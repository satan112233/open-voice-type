import { useEffect, useState } from 'react'
import { Mic, Clock, Type, Zap, Shield, Keyboard, BookOpen } from 'lucide-react'
import { useSettingsStore } from '../stores/settingsStore'
import { useRecordingStore } from '../stores/recordingStore'

export function HomePage() {
  const { settings } = useSettingsStore()
  const { isRecording } = useRecordingStore()
  const [stats, setStats] = useState({
    totalTime: 0,
    totalWords: 0,
    savedTime: 0,
    avgSpeed: 0
  })

  useEffect(() => {
    const loadStats = async () => {
      const history = await window.electronAPI.getHistory()
      const totalWords = history.reduce((sum, item) => sum + item.text.length, 0)
      const totalTime = history.reduce((sum, item) => sum + item.duration, 0)
      const savedTime = Math.round(totalWords / 45 * 60)
      const avgSpeed = history.length > 0
        ? Math.round(totalWords / (totalTime / 60 + 1))
        : 0
      setStats({ totalTime, totalWords, savedTime, avgSpeed })
    }
    loadStats()
  }, [isRecording])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins < 60) return `${mins} 分 ${secs} 秒`
    const hours = Math.floor(mins / 60)
    const remainingMins = mins % 60
    return `${hours} 小时 ${remainingMins} 分`
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Hero */}
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
          自然说话，完美书写 — 在任何应用中
        </h1>
        <p className="text-[var(--text-secondary)]">
          按住 {settings?.shortcut || 'Right Alt'} 开始和停止语音输入。
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={Mic} label="总口述时间" value={formatTime(stats.totalTime)} />
        <StatCard icon={Type} label="口述字数" value={`${stats.totalWords} 字`} />
        <StatCard icon={Clock} label="节省时间" value={formatTime(stats.savedTime)} />
        <StatCard icon={Zap} label="平均口述速度" value={`${stats.avgSpeed} 字/分`} />
      </div>

      {/* Quick tips */}
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-[var(--card-shadow)]">
        <h2 className="mb-4 text-base font-semibold text-[var(--text-primary)]">快速开始</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <TipCard
            icon={Keyboard}
            title="按住热键说话"
            description={`默认使用 ${settings?.shortcut || 'Right Alt'}，可在设置中自定义。`}
          />
          <TipCard
            icon={Shield}
            title="保护个人隐私"
            description="语音数据默认由本地模型处理，不会上传到云端。"
          />
          <TipCard
            icon={BookOpen}
            title="添加个人词典"
            description="在词典页添加专有名词，提高识别准确率。"
          />
        </div>
      </div>

      {/* Privacy note */}
      <div className="flex items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-3 text-sm text-[var(--text-secondary)]">
        <Shield className="h-4 w-4 text-[var(--primary-color)]" />
        <span>您的数据保持私密。语音数据默认本地处理，历史记录仅保存在您的设备上。</span>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 shadow-[var(--card-shadow)]">
      <div className="mb-2 flex items-center gap-2 text-[var(--text-secondary)]">
        <Icon className="h-4 w-4" />
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-lg font-semibold text-[var(--text-primary)]">{value}</div>
    </div>
  )
}

function TipCard({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-4">
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary-color)]/10 text-[var(--primary-color)]">
          <Icon className="h-4 w-4" />
        </div>
        <span className="font-medium text-[var(--text-primary)]">{title}</span>
      </div>
      <p className="text-sm text-[var(--text-secondary)]">{description}</p>
    </div>
  )
}
