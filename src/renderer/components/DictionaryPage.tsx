import { useEffect, useState } from 'react'
import { Plus, Trash2, Wand2, Search, X, Edit2, Check } from 'lucide-react'
import type { DictionaryEntry } from '@shared/types'

export function DictionaryPage() {
  const [entries, setEntries] = useState<DictionaryEntry[]>([])
  const [filter, setFilter] = useState<'all' | 'auto' | 'manual'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [newWord, setNewWord] = useState('')
  const [newNote, setNewNote] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editWord, setEditWord] = useState('')

  const loadEntries = async () => {
    const items = await window.electronAPI.getDictionary()
    setEntries(items)
  }

  useEffect(() => {
    loadEntries()
  }, [])

  const handleAdd = async () => {
    if (!newWord.trim()) return

    const entry: DictionaryEntry = {
      id: crypto.randomUUID(),
      word: newWord.trim(),
      note: newNote.trim() || undefined,
      autoLearned: false
    }

    const updated = [...entries, entry]
    await window.electronAPI.setDictionary(updated)
    setNewWord('')
    setNewNote('')
    setIsAdding(false)
    await loadEntries()
  }

  const handleDelete = async (id: string) => {
    const updated = entries.filter((e) => e.id !== id)
    await window.electronAPI.setDictionary(updated)
    await loadEntries()
  }

  const handleStartEdit = (entry: DictionaryEntry) => {
    setEditingId(entry.id)
    setEditWord(entry.word)
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editWord.trim()) return

    const updated = entries.map((e) =>
      e.id === editingId ? { ...e, word: editWord.trim() } : e
    )
    await window.electronAPI.setDictionary(updated)
    setEditingId(null)
    setEditWord('')
    await loadEntries()
  }

  const filteredEntries = entries.filter((entry) => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'auto' && entry.autoLearned) ||
      (filter === 'manual' && !entry.autoLearned)
    const matchesSearch = entry.word.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesFilter && matchesSearch
  })

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">词典</h1>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--primary-color)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--primary-hover)]"
        >
          <Plus className="h-4 w-4" />
          新词
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-1">
          {[
            { key: 'all', label: '所有' },
            { key: 'auto', label: '自动添加', icon: Wand2 },
            { key: 'manual', label: '手动添加', icon: Edit2 }
          ].map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.key}
                onClick={() => setFilter(item.key as typeof filter)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  filter === item.key
                    ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                {item.label}
              </button>
            )
          })}
        </div>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索词典..."
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
      </div>

      {isAdding && (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">词汇</label>
              <input
                type="text"
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                placeholder="例如：张三、ABC 公司、GPT-5"
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--primary-color)] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text-primary)]">备注（可选）</label>
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="说明用途或正确写法"
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--primary-color)] focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsAdding(false)
                  setNewWord('')
                  setNewNote('')
                }}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
              >
                取消
              </button>
              <button
                onClick={handleAdd}
                className="rounded-lg bg-[var(--primary-color)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--primary-hover)]"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {filteredEntries.length === 0 ? (
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-8 text-center">
            <p className="text-[var(--text-secondary)]">{searchQuery ? '没有匹配的词条' : '暂无词典条目'}</p>
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-3 shadow-[var(--card-shadow)]"
            >
              <div className="flex items-center gap-3">
                <Wand2 className={`h-4 w-4 ${entry.autoLearned ? 'text-[var(--primary-color)]' : 'text-[var(--text-tertiary)]'}`} />
                {editingId === entry.id ? (
                  <input
                    type="text"
                    value={editWord}
                    onChange={(e) => setEditWord(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit()
                      if (e.key === 'Escape') {
                        setEditingId(null)
                        setEditWord('')
                      }
                    }}
                    autoFocus
                    className="rounded-md border border-[var(--primary-color)] bg-[var(--bg-primary)] px-2 py-1 text-sm text-[var(--text-primary)] focus:outline-none"
                  />
                ) : (
                  <div>
                    <span className="font-medium text-[var(--text-primary)]">{entry.word}</span>
                    {entry.note && (
                      <p className="text-xs text-[var(--text-tertiary)]">{entry.note}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1">
                {editingId === entry.id ? (
                  <button
                    onClick={handleSaveEdit}
                    className="rounded-md p-1.5 text-green-500 hover:bg-green-500/10"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleStartEdit(entry)}
                    className="rounded-md p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="rounded-md p-1.5 text-[var(--text-secondary)] hover:bg-red-500/10 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
