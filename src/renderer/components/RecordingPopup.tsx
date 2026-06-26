import { useEffect, useRef, useState } from 'react'
import { X, Check } from 'lucide-react'
import type { RecordingState } from '@shared/types'

export function RecordingPopup() {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isTranscribing: false,
    duration: 0,
    audioLevel: 0,
    canCancel: false
  })

  useEffect(() => {
    const unsubscribe = window.electronAPI.onRecordingStateChange((newState) => {
      setState(newState)
    })
    return unsubscribe
  }, [])

  // Only show the pill while actively recording or transcribing. Once the
  // transcription finishes (both flags false) the pill renders nothing, so the
  // panel simply disappears instead of falling back to the recording buttons.
  const visible = state.isRecording || state.isTranscribing

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        margin: 0,
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent'
      }}
    >
      <style>{`
        @keyframes ovt-thinking-wave {
          0%, 70%, 100% { opacity: 0.55; }
          35% { opacity: 1; }
        }
      `}</style>

      {visible && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            padding: '6px 8px',
            backgroundColor: '#000000',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '9999px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)'
          }}
        >
          {state.isTranscribing ? (
            <ThinkingText stage={state.stage} />
          ) : (
            <>
              {/* Cancel — outlined circle */}
              <button
                onClick={() => window.electronAPI.cancelGlobalRecording()}
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '9999px',
                  border: '1.5px solid rgba(255,255,255,0.35)',
                  backgroundColor: 'transparent',
                  color: 'rgba(255,255,255,0.85)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                <X size={15} strokeWidth={2.5} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '2px', height: '30px' }}>
                <SoundWave level={state.audioLevel || 0} />
              </div>

              {/* Confirm — filled light circle */}
              <button
                onClick={() => {
                  if (state.isRecording) {
                    window.electronAPI.confirmGlobalRecording()
                  }
                }}
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '9999px',
                  border: 'none',
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  color: '#000000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                <Check size={16} strokeWidth={3} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// 各转录子阶段对应的浮层文案（沿用英文风格）；缺省回退通用 Thinking。
const STAGE_LABELS: Record<NonNullable<RecordingState['stage']>, string> = {
  recognizing: 'Transcribing',
  optimizing: 'Polishing',
  translating: 'Translating'
}

function ThinkingText({ stage }: { stage?: RecordingState['stage'] }) {
  const label = (stage && STAGE_LABELS[stage]) || 'Thinking'
  const letters = label.split('')
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '30px',
        padding: '0 14px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      {letters.map((ch, i) => (
        <span
          key={`${label}-${i}`}
          style={{
            display: 'inline-block',
            color: 'rgba(255,255,255,0.95)',
            fontSize: '14px',
            fontWeight: 500,
            letterSpacing: '0.5px',
            animation: 'ovt-thinking-wave 1.3s ease-in-out infinite',
            animationDelay: `${i * 0.09}s`
          }}
        >
          {ch}
        </span>
      ))}
    </div>
  )
}

const WAVE_BAR_COUNT = 18

// 每根竖条固定的双正弦相位/频率（模块加载时确定性生成），使每根条以各自节奏
// 起伏，形成自然错落的声波，而不是所有条整体一起涨落。
const WAVE_BARS = Array.from({ length: WAVE_BAR_COUNT }, (_, i) => ({
  f1: 2 + ((i * 3) % 5) * 0.7,
  f2: 3.4 + ((i * 7) % 6) * 0.55,
  p1: (i * 1.7) % (Math.PI * 2),
  p2: (i * 2.9) % (Math.PI * 2)
}))

const WAVE_MIN_H = 3
const WAVE_MAX_EXTRA = 26

function SoundWave({ level }: { level: number }) {
  const refs = useRef<(HTMLDivElement | null)[]>([])
  const levelRef = useRef(level)
  levelRef.current = level

  useEffect(() => {
    let raf = 0
    let smoothLevel = 0
    let startTs = 0

    const loop = (now: number) => {
      if (!startTs) startTs = now
      const t = (now - startTs) / 1000
      // 快起慢落：跟随说话快速上升，停顿时柔和回落，避免竖条突然塌下去。
      const target = levelRef.current
      const coeff = target > smoothLevel ? 0.2 : 0.035
      smoothLevel += (target - smoothLevel) * coeff
      const amp = smoothLevel < 0.001 ? 0 : smoothLevel

      for (let i = 0; i < WAVE_BAR_COUNT; i++) {
        const b = WAVE_BARS[i]
        // 两层正弦叠加 → 0..1 之间非均匀、有生命感的运动。
        const osc = 0.5 + 0.5 * (0.6 * Math.sin(t * b.f1 + b.p1) + 0.4 * Math.sin(t * b.f2 + b.p2))
        const h = WAVE_MIN_H + WAVE_MAX_EXTRA * amp * osc
        const el = refs.current[i]
        if (el) el.style.height = `${h}px`
      }
      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <>
      {WAVE_BARS.map((_, i) => (
        <div
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          style={{
            width: '2px',
            borderRadius: '9999px',
            backgroundColor: 'rgba(255,255,255,0.9)',
            height: `${WAVE_MIN_H}px`
          }}
        />
      ))}
    </>
  )
}
