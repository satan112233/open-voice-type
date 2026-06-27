import { useEffect, useRef, useState } from 'react'
import { Moon, Sun, Monitor, Keyboard, FileText, Database, Sparkles, Mic, Languages, ChevronDown, Check } from 'lucide-react'
import { useSettingsStore } from '../stores/settingsStore'
import { TRANSLATION_LANGUAGES, type Settings } from '@shared/types'

export function SettingsPage() {
  const { settings, updateSettings } = useSettingsStore()
  const [localShortcut, setLocalShortcut] = useState('')
  const [localTranslationShortcut, setLocalTranslationShortcut] = useState('')
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState('')

  useEffect(() => {
    if (settings) {
      setLocalShortcut(settings.shortcut)
      setLocalTranslationShortcut(settings.translationShortcut || 'Ctrl+Alt+F')
    }
  }, [settings])

  // 枚举可用麦克风；若标签为空，先请求一次权限以获取可读标签。
  useEffect(() => {
    async function loadDevices() {
      try {
        let devices = await navigator.mediaDevices.enumerateDevices()
        const audioInputs = devices.filter((d) => d.kind === 'audioinput')
        if (audioInputs.length > 0 && audioInputs.every((d) => !d.label)) {
          const tmpStream = await navigator.mediaDevices.getUserMedia({ audio: true })
          devices = await navigator.mediaDevices.enumerateDevices()
          tmpStream.getTracks().forEach((t) => t.stop())
        }
        setAudioDevices(devices.filter((d) => d.kind === 'audioinput'))
      } catch (err) {
        console.warn('[SettingsPage] failed to enumerate audio devices:', err)
      }
    }
    void loadDevices()
    navigator.mediaDevices.addEventListener('devicechange', loadDevices)
    return () => navigator.mediaDevices.removeEventListener('devicechange', loadDevices)
  }, [])

  if (!settings) {
    return <div className="p-8 text-center text-[var(--text-secondary)]">加载中...</div>
  }

  // 从键盘事件构造加速器字符串（如 "Ctrl+Alt+F"），无主键时返回 null。
  const buildShortcut = (e: React.KeyboardEvent<HTMLInputElement>): string | null => {
    const keys: string[] = []
    if (e.ctrlKey) keys.push('Ctrl')
    if (e.altKey) keys.push('Alt')
    if (e.shiftKey) keys.push('Shift')
    if (e.metaKey) keys.push('Command')

    const key = e.key
    if (key && !['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
      keys.push(key.length === 1 ? key.toUpperCase() : key)
    }
    return keys.length > 0 ? keys.join('+') : null
  }

  const handleShortcutKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const shortcut = buildShortcut(e)
    if (shortcut) {
      setLocalShortcut(shortcut)
      updateSettings({ shortcut })
    }
  }

  const handleTranslationShortcutKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const shortcut = buildShortcut(e)
    if (shortcut) {
      setLocalTranslationShortcut(shortcut)
      updateSettings({ translationShortcut: shortcut })
    }
  }

  const handleTestLocalLlm = async () => {
    setTestStatus('testing')
    setTestMessage('')

    const baseUrl = (settings.localBaseUrl || 'http://localhost:11434/v1').replace(/\/$/, '')
    const model = settings.localModel || 'qwen2.5:14b'
    const apiKey = settings.localApiKey || 'ollama'

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 5
        })
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error?.message || `HTTP ${response.status}`)
      }

      setTestStatus('success')
      setTestMessage(`连接成功，模型 ${model} 可正常响应`)
    } catch (error) {
      setTestStatus('error')
      setTestMessage(error instanceof Error ? error.message : '连接失败')
    }
  }

  const llmProvider = settings.llmProvider || 'deepseek'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">设置</h1>

      <SettingSection title="外观" icon={Monitor}>
        <div className="flex gap-2">
          <ThemeButton
            active={settings.theme === 'light'}
            onClick={() => updateSettings({ theme: 'light' })}
            icon={Sun}
            label="浅色"
          />
          <ThemeButton
            active={settings.theme === 'dark'}
            onClick={() => updateSettings({ theme: 'dark' })}
            icon={Moon}
            label="深色"
          />
          <ThemeButton
            active={settings.theme === 'system'}
            onClick={() => updateSettings({ theme: 'system' })}
            icon={Monitor}
            label="跟随系统"
          />
        </div>
      </SettingSection>

      <SettingSection title="语音输入" icon={Mic}>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
              全局热键
            </label>
            <div className="relative">
              <Keyboard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input
                type="text"
                value={localShortcut}
                onKeyDown={handleShortcutKeyDown}
                readOnly
                placeholder="按下快捷键..."
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] py-2 pl-9 pr-4 text-sm text-[var(--text-primary)] focus:border-[var(--primary-color)] focus:outline-none"
              />
            </div>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              按住想要的组合键即可设置，推荐使用 Ctrl+Alt+V。
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
              输出模式
            </label>
            <Dropdown
              value={settings.outputMode}
              onChange={(v) => updateSettings({ outputMode: v as Settings['outputMode'] })}
              options={[
                { value: 'paste', label: '直接粘贴到当前输入框' },
                { value: 'copy', label: '仅复制到剪贴板' }
              ]}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
              语音识别引擎
            </label>
            <Dropdown
              value={settings.asrProvider}
              onChange={(v) => updateSettings({ asrProvider: v as Settings['asrProvider'] })}
              options={[
                { value: 'sherpa', label: '本地 Sherpa-onnx' },
                { value: 'iflytek', label: '科大讯飞' },
                { value: 'aliyun', label: '阿里云百炼' }
              ]}
            />
          </div>

          {settings.asrProvider === 'iflytek' && (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
                  科大讯飞 AppID
                </label>
                <input
                  type="text"
                  value={settings.iflytekAppId || ''}
                  onChange={(e) => updateSettings({ iflytekAppId: e.target.value })}
                  placeholder="讯飞开放平台应用的 AppID"
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--primary-color)] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
                  科大讯飞 APIKey
                </label>
                <input
                  type="password"
                  value={settings.iflytekApiKey || ''}
                  onChange={(e) => updateSettings({ iflytekApiKey: e.target.value })}
                  placeholder="APIKey"
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--primary-color)] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
                  科大讯飞 APISecret
                </label>
                <input
                  type="password"
                  value={settings.iflytekApiSecret || ''}
                  onChange={(e) => updateSettings({ iflytekApiSecret: e.target.value })}
                  placeholder="APISecret"
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--primary-color)] focus:outline-none"
                />
              </div>

              <p className="text-xs text-[var(--text-tertiary)]">
                需在讯飞开放平台开通「中英识别大模型」服务并领取额度，三个参数缺一不可。
              </p>
            </>
          )}

          {settings.asrProvider === 'aliyun' && (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
                  阿里云百炼 API Key
                </label>
                <input
                  type="password"
                  value={settings.aliyunApiKey || ''}
                  onChange={(e) => updateSettings({ aliyunApiKey: e.target.value })}
                  placeholder="sk-xxxxxxxx"
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--primary-color)] focus:outline-none"
                />
              </div>

              <p className="text-xs text-[var(--text-tertiary)]">
                需在阿里云百炼平台获取 API Key（sk- 开头）。默认使用 Qwen3-ASR-Flash 模型，识别中英混说效果好，新用户有 10 小时免费额度。
              </p>
            </>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
              麦克风
            </label>
            <Dropdown
              value={settings.audioInputDeviceId || ''}
              onChange={(v) => updateSettings({ audioInputDeviceId: v || undefined })}
              options={[
                { value: '', label: '系统默认麦克风' },
                ...audioDevices.map((d) => ({ value: d.deviceId, label: d.label || `麦克风 ${d.deviceId.slice(0, 8)}...` }))
              ]}
            />
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              选择用于语音输入的录音设备；切换后下次录音生效。
            </p>
          </div>
        </div>
      </SettingSection>

      <SettingSection title="口语优化" icon={Sparkles}>
        <div className="flex items-center justify-between rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-3">
          <div>
            <div className="text-sm font-medium text-[var(--text-primary)]">启用口语优化</div>
            <div className="text-xs text-[var(--text-tertiary)]">语音输入时用大模型整理口语：去填充词、改口纠正、自动标点</div>
          </div>
          <Switch
            checked={settings.enableLlmOptimization}
            onChange={(v) => updateSettings({ enableLlmOptimization: v })}
          />
        </div>
      </SettingSection>

      <SettingSection title="边说边翻译" icon={Languages}>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
              翻译热键
            </label>
            <div className="relative">
              <Keyboard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input
                type="text"
                value={localTranslationShortcut}
                onKeyDown={handleTranslationShortcutKeyDown}
                readOnly
                placeholder="按下快捷键..."
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] py-2 pl-9 pr-4 text-sm text-[var(--text-primary)] focus:border-[var(--primary-color)] focus:outline-none"
              />
            </div>
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              按下该热键录音，松手后直接输出目标语言译文（与语音输入用不同的键）。推荐 Ctrl+Alt+F。
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
              目标语言
            </label>
            <Dropdown
              value={settings.translationTargetLang || 'en'}
              onChange={(v) => updateSettings({ translationTargetLang: v as Settings['translationTargetLang'] })}
              options={TRANSLATION_LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
            />
          </div>

          <p className="text-xs text-[var(--text-tertiary)]">
            翻译复用下方「大模型」所配置的供应商与 API Key，需先填好 Key 才能翻译。
          </p>
        </div>
      </SettingSection>

      <SettingSection title="大模型（口语优化 / 翻译共用）" icon={Sparkles}>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
              供应商
            </label>
            <Dropdown
              value={llmProvider}
              onChange={(v) => updateSettings({ llmProvider: v as Settings['llmProvider'] })}
              options={[
                { value: 'deepseek', label: 'DeepSeek' },
                { value: 'zhipu', label: '智谱 AI' },
                { value: 'local', label: '本地模型（OpenAI 兼容）' }
              ]}
            />
          </div>

          {llmProvider === 'local' ? (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
                  本地服务地址（baseUrl）
                </label>
                <input
                  type="text"
                  value={settings.localBaseUrl || ''}
                  onChange={(e) => updateSettings({ localBaseUrl: e.target.value })}
                  placeholder="http://localhost:11434/v1"
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--primary-color)] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
                  模型名
                </label>
                <input
                  type="text"
                  value={settings.localModel || ''}
                  onChange={(e) => updateSettings({ localModel: e.target.value })}
                  placeholder="qwen2.5:14b"
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--primary-color)] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
                  API Key（可选）
                </label>
                <input
                  type="password"
                  value={settings.localApiKey || ''}
                  onChange={(e) => updateSettings({ localApiKey: e.target.value })}
                  placeholder="Ollama 可留空，llama.cpp 等按需填写"
                  className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--primary-color)] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleTestLocalLlm}
                  disabled={testStatus === 'testing'}
                  className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-tertiary)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {testStatus === 'testing' ? '测试中...' : '测试连接'}
                </button>
                {testStatus !== 'idle' && testStatus !== 'testing' && (
                  <span
                    className={`text-xs ${
                      testStatus === 'success' ? 'text-green-500' : 'text-red-500'
                    }`}
                  >
                    {testMessage}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
                {llmProvider === 'zhipu' ? '智谱 AI' : 'DeepSeek'} API Key
              </label>
              <input
                type="password"
                value={(llmProvider === 'zhipu' ? settings.zhipuApiKey : settings.deepseekApiKey) || ''}
                onChange={(e) =>
                  updateSettings(
                    llmProvider === 'zhipu'
                      ? { zhipuApiKey: e.target.value }
                      : { deepseekApiKey: e.target.value }
                  )
                }
                placeholder="填写所选大模型的 API Key"
                className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--primary-color)] focus:outline-none"
              />
            </div>
          )}

          <p className="text-xs text-[var(--text-tertiary)]">
            DeepSeek、智谱 AI、本地模型均兼容 OpenAI 接口。口语优化与翻译共用此配置；未填 Key 时口语优化不生效、翻译会回退为输出原文。
          </p>
          <p className="text-xs text-[var(--text-tertiary)]">
            本地模型示例：安装 Ollama 后运行 <code className="rounded bg-[var(--bg-tertiary)] px-1 py-0.5">ollama pull qwen2.5:14b</code>，即可选择「本地模型」并默认调用 <code className="rounded bg-[var(--bg-tertiary)] px-1 py-0.5">http://localhost:11434/v1</code>。
          </p>
        </div>
      </SettingSection>

      <SettingSection title="历史记录" icon={Database}>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-3">
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">保存历史记录</div>
              <div className="text-xs text-[var(--text-tertiary)]">识别结果会保存在本地设备上</div>
            </div>
            <Switch
              checked={settings.saveHistory}
              onChange={(v) => updateSettings({ saveHistory: v })}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-[var(--text-primary)]">
              历史记录保留时长
            </label>
            <Dropdown
              value={String(settings.historyRetentionDays)}
              onChange={(v) =>
                updateSettings({
                  historyRetentionDays: (v === 'forever' ? 'forever' : Number(v)) as Settings['historyRetentionDays']
                })
              }
              options={[
                { value: 'forever', label: '永远' },
                { value: '7', label: '7 天' },
                { value: '30', label: '30 天' },
                { value: '90', label: '90 天' }
              ]}
            />
          </div>
        </div>
      </SettingSection>

      <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4 text-sm text-[var(--text-secondary)]">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span>当前版本：v{__APP_VERSION__}</span>
        </div>
      </div>
    </div>
  )
}

function SettingSection({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-[var(--card-shadow)]">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-[var(--primary-color)]" />
        <h2 className="font-semibold text-[var(--text-primary)]">{title}</h2>
      </div>
      {children}
    </div>
  )
}

function ThemeButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ElementType; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
        active
          ? 'border-[var(--primary-color)] bg-[var(--primary-color)]/10 text-[var(--primary-color)]'
          : 'border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none ${
        checked ? 'bg-[var(--primary-color)]' : 'bg-[var(--border-color)]'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

interface DropdownOption {
  value: string
  label: string
}

function Dropdown({
  value,
  options,
  onChange
}: {
  value: string
  options: DropdownOption[]
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const selected = options.find((o) => o.value === value)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between rounded-lg border bg-[var(--bg-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] transition-colors focus:outline-none ${
          open ? 'border-[var(--primary-color)]' : 'border-[var(--border-color)]'
        }`}
      >
        <span>{selected?.label ?? ''}</span>
        <ChevronDown
          className={`h-4 w-4 text-[var(--text-tertiary)] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1.5 overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] py-1 shadow-lg">
          {options.map((o) => {
            const active = o.value === value
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value)
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--bg-tertiary)] ${
                  active ? 'text-[var(--primary-color)]' : 'text-[var(--text-primary)]'
                }`}
              >
                <span>{o.label}</span>
                {active && <Check className="h-4 w-4 text-[var(--primary-color)]" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
