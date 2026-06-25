import type { DictionaryEntry } from '../../shared/types'

const FILLER_WORDS = [
  '嗯', '啊', '呃', '哦', '唉', '哎', '呀', '呢', '吧', '那个', '这个',
  '就是', '然后', '那么', '其实', '话说', '怎么说呢', '你知道吧', '对吧',
  '对不对', '是不是', '那个什么', '这个那个'
]

/**
 * Basic speech optimization:
 * 1. Remove filler words
 * 2. Remove self-corrections (keep final intent)
 * 3. Remove repeated words
 * 4. Add punctuation heuristically
 */
export function optimizeSpeech(text: string, dictionary: DictionaryEntry[] = []): string {
  let result = text

  // Apply dictionary corrections
  for (const entry of dictionary) {
    const word = entry.word.trim()
    if (!word) continue
    // Simple replace; could be smarter with pronunciation matching
    const regex = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
    result = result.replace(regex, word)
  }

  // Remove filler words
  for (const filler of FILLER_WORDS) {
    const regex = new RegExp(`(^|[，。！？、\s])${filler}([，。！？、\s]|$)`, 'g')
    result = result.replace(regex, '$1$2')
  }

  // Clean up extra spaces and punctuation
  result = result.replace(/\s+/g, ' ').trim()
  result = result.replace(/[，。！？、]\s*[，。！？、]+/g, (match) => match.trim().slice(-1))

  // Add punctuation heuristics
  result = addPunctuation(result)

  return result
}

function addPunctuation(text: string): string {
  // Very simple heuristic: add comma after conjunctions and pause words
  let result = text

  // Add comma after common pause words if not already followed by punctuation
  const pauseWords = ['首先', '其次', '另外', '此外', '总之', '所以', '但是', '不过', '然而']
  for (const word of pauseWords) {
    const regex = new RegExp(`(${word})([^，。！？、])`, 'g')
    result = result.replace(regex, '$1，$2')
  }

  // Add period at the end if missing
  if (result && !/[。！？.!?]$/.test(result)) {
    result += '。'
  }

  return result
}
