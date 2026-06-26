import type { DictionaryEntry } from '../../shared/types'

export type LlmProvider = 'deepseek' | 'zhipu'

// DeepSeek / 智谱均为 OpenAI 兼容接口，差异仅在 baseUrl 与默认模型。
export const LLM_PROVIDERS: Record<LlmProvider, { baseUrl: string; model: string }> = {
  deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-flash' },
  zhipu: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' }
}

const SYSTEM_PROMPT = `你是一位智能的语音输入助手。请对以下语音识别得到的口语文本进行整理，让结果自然、清晰、流畅，读起来像用户精心表达的内容一样。

处理原则：
1. 【最重要】识别说话人的"改口/自我修正"：当出现"不对""错了""不是""应该是""我是说""划掉""重说""改为""之前……现在……"等纠正信号时，只保留最后的正确表述，彻底删除被否定、被替换的旧内容，绝不能把前后两种说法都保留下来
2. 移除无意义的填充词、口头禅、停顿词（如"嗯"、"啊"、"那个"、"然后"、"就是"、"你知道吗"等），但不要改变用户的自然语气和表达方式
3. 检测并移除不必要的重复词语，保留用户为了强调而故意重复的内容
4. 修正语音识别可能产生的同音字、相近音错误
5. 理解用户话语背后的真实意图，优化措辞以提高清晰度和流畅性，修正明显的语法错误、用词不当和语序混乱，让句子读起来通顺自然；同时保留说话人本来的语气和个人表达风格，不要改变原意，不要丢失信息，也不要过度改写为刻板的"书面语"
6. 将说出的标点/换行口令转换为真正的符号："逗号""句号""问号""感叹号""冒号""分号""顿号""引号"等转成对应标点；"换行""回车"转成换行；"新段落""另起一段"转成空行分段
7. 断句与分段：把冗长、连续不断的口语切分、重组为通顺清晰的句子；当话题自然转换或内容较长时，合理地划分段落，让整体结构清爽、易读（内容很短时不必强行分段）
8. 在中文与英文、中文与数字之间统一加一个半角空格（即"盘古之白"，中英文留白），让排版更清晰，例如"我有 5 个 iPhone""2024 年发布""营收 100 万元"。但需注意：① 中文标点（，。！？：；、""《》等）与相邻内容之间不加空格；② 数字/字母与紧邻符号粘连的整体不要拆开，如 100%、￥100、v0.1.0、COVID-19、A4；③ 本身已有空格或固定写法的专有名词（如 iPhone 15、Windows 11）保持原样，不要增删其内部空格
9. 自动将口述的列表、步骤、要点整理成清晰、结构化的文本
10. 不要添加原文中没有的信息
11. 不要解释，只输出整理后的文本
12. 如果原始文本没有实质性内容（只有语气词、停顿词、标点符号、特殊符号或为空），请直接输出空字符串，不要生成任何解释或示例回复`

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
  error?: {
    message?: string
  }
}

/**
 * 把个人词典中的词作为"专有名词正确写法"参考块注入 prompt，用于纠正 ASR 把人名、
 * 品牌、专业词识别成读音相近但拼写错误的情况。词典为空时返回空字符串。
 */
function buildDictionaryReference(dictionary?: DictionaryEntry[]): string {
  const terms = (dictionary ?? [])
    .map((entry) => entry.word?.trim())
    .filter((w): w is string => Boolean(w))

  if (terms.length === 0) {
    return ''
  }

  const list = terms.map((t) => `- ${t}`).join('\n')
  return `【术语参考】以下是用户常用专有名词/术语的正确写法。若识别文本中出现读音相近但拼写有误的词，请据此纠正为正确写法；不相关的词不要强行替换：\n${list}\n\n`
}

/**
 * 调用 OpenAI 兼容的 chat/completions 的共享核心：拼 url、20s 超时、错误处理、取首条回复。
 * optimize 与 translate 共用，errorLabel 用于区分报错文案（如「口语优化」「翻译」）。
 */
async function callChatCompletion(
  systemPrompt: string,
  userContent: string,
  config: { apiKey: string; baseUrl: string; model: string },
  errorLabel: string
): Promise<string> {
  const url = config.baseUrl.endsWith('/')
    ? `${config.baseUrl}chat/completions`
    : `${config.baseUrl}/chat/completions`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        temperature: 0.3,
        max_tokens: 2048
      }),
      signal: controller.signal
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`${errorLabel}请求超时`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }

  const data = (await response.json()) as ChatCompletionResponse

  if (!response.ok) {
    throw new Error(`${errorLabel}请求失败：${data.error?.message || response.statusText || response.status}`)
  }

  const content = data.choices?.[0]?.message?.content?.trim()
  if (!content) {
    throw new Error(`${errorLabel}返回结果为空`)
  }

  return content
}

export async function optimizeWithLlm(
  text: string,
  config: { apiKey: string; baseUrl: string; model: string },
  dictionary?: DictionaryEntry[]
): Promise<string> {
  if (!config.apiKey?.trim()) {
    throw new Error('未配置大模型 API Key，无法进行口语优化')
  }

  if (!text.trim()) {
    return text
  }

  const dictionaryReference = buildDictionaryReference(dictionary)
  const userContent = `${dictionaryReference}原始口语文本：\n"""\n${text}\n"""\n\n请直接输出优化后的文本：`

  return callChatCompletion(SYSTEM_PROMPT, userContent, config, '口语优化')
}

/**
 * 边说边翻译的 system prompt：先理解口述意图再翻译成目标语言，输出地道母语表达，只出译文。
 */
function buildTranslatePrompt(targetLangName: string): string {
  return `你是一位智能的语音翻译助手。用户会口述一段话，请把它翻译成${targetLangName}，让译文像母语者精心书写的内容一样自然、地道。

处理原则：
1. 先理解口述意图再翻译：识别说话人的"改口/自我修正"（出现"不对""错了""应该是""我是说""改为"等信号时只翻译最后的正确表述）；移除"嗯""啊""那个""然后"等填充词与无意义的重复；修正语音识别产生的同音字、相近音错误。
2. 译文要符合${targetLangName}母语者的自然表达与习惯，准确传达原意与语气，而不是逐字直译。
3. 若下方提供了术语参考，请据此保证人名、品牌、专有名词的正确译写或保留。
4. 只输出${targetLangName}译文，不要附加任何解释、注释，也不要保留原文。
5. 如果原始文本没有实质性内容（只有语气词、停顿词、标点符号或为空），请直接输出空字符串。`
}

export async function translateWithLlm(
  text: string,
  config: { apiKey: string; baseUrl: string; model: string },
  targetLangName: string,
  dictionary?: DictionaryEntry[]
): Promise<string> {
  if (!config.apiKey?.trim()) {
    throw new Error('未配置大模型 API Key，无法进行翻译')
  }

  if (!text.trim()) {
    return text
  }

  const dictionaryReference = buildDictionaryReference(dictionary)
  const userContent = `${dictionaryReference}原始口语文本：\n"""\n${text}\n"""\n\n请直接输出${targetLangName}译文：`

  return callChatCompletion(buildTranslatePrompt(targetLangName), userContent, config, '翻译')
}
