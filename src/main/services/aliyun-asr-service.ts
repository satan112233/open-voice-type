// 阿里云百炼（DashScope）语音识别。我们的场景是「录完整段 WAV → 一次性转写」，
// 故走 Qwen3-ASR-Flash 的 DashScope 原生【同步 HTTP】接口（支持 base64 内联音频），
// 而非实时 WebSocket 会话协议——写法与 llm-optimizer-service 的 callChatCompletion 同构。

interface AliyunAsrConfig {
  apiKey: string
}

// 华北2（北京）全局 endpoint，无需 WorkspaceId。
const DASHSCOPE_ASR_URL =
  'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
const ASR_MODEL = 'qwen3-asr-flash'

// DashScope 原生多模态响应：output.choices[0].message.content 通常为 [{ text }]，
// 也兼容服务端直接返回字符串的情况。
interface DashScopeAsrResponse {
  output?: {
    choices?: Array<{
      message?: {
        content?: Array<{ text?: string }> | string
      }
    }>
  }
  code?: string
  message?: string
  request_id?: string
}

function extractText(content: Array<{ text?: string }> | string | undefined): string {
  if (!content) return ''
  if (typeof content === 'string') return content.trim()
  return content
    .map((part) => part?.text ?? '')
    .join('')
    .trim()
}

export async function transcribeWithAliyun(
  audioBase64: string,
  config: AliyunAsrConfig
): Promise<string> {
  if (!config.apiKey?.trim()) {
    throw new Error('未配置阿里云百炼 API Key，请在设置中填写')
  }
  if (!audioBase64) {
    throw new Error('音频数据为空')
  }

  // 录音统一为 16kHz 单声道 16bit WAV（见 recordingStore.ts），故 MIME 固定 audio/wav。
  const dataUri = `data:audio/wav;base64,${audioBase64}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  console.log('[aliyun-asr] requesting model:', ASR_MODEL)

  let response: Response
  try {
    response = await fetch(DASHSCOPE_ASR_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: ASR_MODEL,
        input: {
          messages: [
            {
              role: 'user',
              content: [{ audio: dataUri }]
            }
          ]
        },
        parameters: {
          result_format: 'message',
          // 不强制 asr_options.language，保留语种自动检测，兼顾「边说边翻译」可能的非中文口述。
          asr_options: {
            enable_itn: false
          }
        }
      }),
      signal: controller.signal
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('阿里云语音识别请求超时')
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }

  const data = (await response.json()) as DashScopeAsrResponse

  if (!response.ok) {
    const detail = data.message || response.statusText || String(response.status)
    const code = data.code ? `（${data.code}）` : ''
    throw new Error(`阿里云语音识别失败${code}：${detail}`)
  }

  return extractText(data.output?.choices?.[0]?.message?.content)
}
