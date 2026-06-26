import { useEffect, useState } from 'react'
import { Copy, Trash2, Clock, Search, X, Mic, Sparkles, Languages } from 'lucide-react'
import { TRANSLATION_LANGUAGES, type HistoryItem } from '@shared/types'

const ASR_LABELS: Record<string, string> = {
  sherpa: '本地 Sherpa',
  iflytek: '科大讯飞',
  aliyun: '阿里云百炼',
  zhipu: '智谱'
}

const LLM_LABELS: Record<string, string> = {
  deepseek: 'DeepSeek',
  zhipu: '智谱 AI'
}

const LANG_LABELS: Record<string, string> = Object.fromEntries(
  TRANSLATION_LANGUAGES.map((l) => [l.code, l.label])
)

export function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  const loadHistory = async () => {
    const items = await window.electronAPI.getHistory()
    setHistory(items)
  }

  useEffect(() => {
    loadHistory()
  }, [])

  const filteredHistory = history.filter((item) =>
    item.text.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text)
  }

  const handleDelete = async (id: string) => {
    await window.electronAPI.deleteHistoryItem(id)
    await loadHistory()
  }

  const handleClear = async () => {
    await window.electronAPI.clearHistory()
    await loadHistory()
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">历史记录</h1>
        <button
          onClick={handleClear}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-500/10"
        >
          <Trash2 className="h-4 w-4" />
          清空
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索历史记录..."
          className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] py-2 pl-9 pr-9 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--primary-color)] focus:outline-none"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {filteredHistory.length === 0 ? (
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-8 text-center">
            <p className="text-[var(--text-secondary)]">{searchQuery ? '没有匹配的历史记录' : '暂无历史记录'}</p>
          </div>
        ) : (
          filteredHistory.map((item) => (
            <div
              key={item.id}
              className="group rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 shadow-[var(--card-shadow)] transition-all hover:border-[var(--primary-color)]/30"
            >
              <p className="mb-2 text-[var(--text-primary)]">{item.text}</p>
              {item.rawText && item.rawText !== item.text && (
                <p className="mb-2 text-sm text-[var(--text-tertiary)] line-through">{item.rawText}</p>
              )}
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-tertiary)]">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(item.createdAt)}
                  </span>
                  <span>{item.duration} 秒</span>
                  {item.asrProvider && (
                    <span className="flex items-center gap-1 rounded-md bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-[var(--text-secondary)]">
                      <Mic className="h-3 w-3" />
                      {ASR_LABELS[item.asrProvider] ?? item.asrProvider}
                    </span>
                  )}
                  {item.llmProvider && (
                    <span className="flex items-center gap-1 rounded-md bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-[var(--text-secondary)]">
                      <Sparkles className="h-3 w-3" />
                      {LLM_LABELS[item.llmProvider] ?? item.llmProvider}
                    </span>
                  )}
                  {item.translationTargetLang && (
                    <span className="flex items-center gap-1 rounded-md bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-[var(--text-secondary)]">
                      <Languages className="h-3 w-3" />
                      译·{LANG_LABELS[item.translationTargetLang] ?? item.translationTargetLang}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => handleCopy(item.text)}
                    className="rounded-md p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                    title="复制"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="rounded-md p-1.5 text-[var(--text-secondary)] hover:bg-red-500/10 hover:text-red-500"
                    title="删除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
