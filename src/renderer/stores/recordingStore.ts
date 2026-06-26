import { create } from 'zustand'
import type { RecordingState, TranscribeAudioResult } from '@shared/types'

interface RecordingStoreState extends RecordingState {
  transcribedText: string | null
  transcriptionError: string | null
  startRecording: (deviceId?: string) => Promise<void>
  stopRecording: () => void
  cancelRecording: () => void
  toggleRecording: () => void
  setTranscribedText: (text: string | null) => void
  setTranscriptionError: (error: string | null) => void
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const bytesPerSample = 2
  const blockAlign = 1 * bytesPerSample
  const dataSize = samples.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  const pcm = new Int16Array(buffer, 44, samples.length)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }

  return buffer
}

async function convertBlobToWavBase64(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer()
  const audioContext = new AudioContext()
  const decoded = await audioContext.decodeAudioData(arrayBuffer)
  await audioContext.close()

  const targetSampleRate = 16000
  const offlineContext = new OfflineAudioContext(1, Math.ceil(decoded.duration * targetSampleRate), targetSampleRate)
  const source = offlineContext.createBufferSource()
  source.buffer = decoded
  source.connect(offlineContext.destination)
  source.start()

  const rendered = await offlineContext.startRendering()
  const monoSamples = rendered.getChannelData(0)
  const wavBuffer = encodeWav(monoSamples, targetSampleRate)
  return arrayBufferToBase64(wavBuffer)
}

const MAX_RECORDING_SECONDS = 60

let mediaRecorderRef: MediaRecorder | null = null
let audioChunksRef: Blob[] = []
let streamRef: MediaStream | null = null
let timerRef: ReturnType<typeof setInterval> | null = null
let maxDurationTimerRef: ReturnType<typeof setTimeout> | null = null
let cancelPendingRef = false
let audioContextRef: AudioContext | null = null
let analyserRef: AnalyserNode | null = null
let levelRafRef: number | null = null

function stopAudioLevelMeter(): void {
  if (levelRafRef !== null) {
    cancelAnimationFrame(levelRafRef)
    levelRafRef = null
  }
  if (audioContextRef) {
    void audioContextRef.close()
    audioContextRef = null
  }
  analyserRef = null
}

export const useRecordingStore = create<RecordingStoreState>((set) => ({
  isRecording: false,
  isTranscribing: false,
  duration: 0,
  audioLevel: 0,
  canCancel: false,
  transcribedText: null,
  transcriptionError: null,

  setTranscribedText: (text) => set({ transcribedText: text }),
  setTranscriptionError: (error) => set({ transcriptionError: error }),

  stopRecording: () => {
    console.log('[recording store] stopRecording called')
    if (mediaRecorderRef?.state === 'recording') {
      mediaRecorderRef.stop()
    }
    if (streamRef) {
      streamRef.getTracks().forEach((track) => track.stop())
      streamRef = null
    }
    if (timerRef) {
      clearInterval(timerRef)
      timerRef = null
    }
    if (maxDurationTimerRef) {
      clearTimeout(maxDurationTimerRef)
      maxDurationTimerRef = null
    }
    stopAudioLevelMeter()
    set({ isRecording: false, duration: 0, audioLevel: 0, canCancel: false })
  },

  cancelRecording: () => {
    console.log('[recording store] cancelRecording called')
    if (mediaRecorderRef?.state === 'recording') {
      cancelPendingRef = true
      mediaRecorderRef.stop()
    }
    if (streamRef) {
      streamRef.getTracks().forEach((track) => track.stop())
      streamRef = null
    }
    if (timerRef) {
      clearInterval(timerRef)
      timerRef = null
    }
    if (maxDurationTimerRef) {
      clearTimeout(maxDurationTimerRef)
      maxDurationTimerRef = null
    }
    stopAudioLevelMeter()
    set({ isRecording: false, duration: 0, audioLevel: 0, canCancel: false })
  },

  startRecording: async (deviceId?: string) => {
    console.log('[recording store] startRecording called', deviceId ? `deviceId=${deviceId}` : 'default')
    try {
      let stream: MediaStream
      if (deviceId) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: deviceId } }
          })
        } catch (deviceErr) {
          console.warn('[recording store] specified audio device unavailable, falling back to default:', deviceErr)
          stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        }
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      }
      streamRef = stream

      try {
        const audioContext = new AudioContext()
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 256
        audioContext.createMediaStreamSource(stream).connect(analyser)
        audioContextRef = audioContext
        analyserRef = analyser

        const buffer = new Uint8Array(analyser.fftSize)
        let smoothed = 0
        const tick = () => {
          if (!analyserRef) return
          analyserRef.getByteTimeDomainData(buffer)
          let sumSquares = 0
          for (let i = 0; i < buffer.length; i++) {
            const v = (buffer[i] - 128) / 128
            sumSquares += v * v
          }
          const rms = Math.sqrt(sumSquares / buffer.length)
          const raw = rms < 0.015 ? 0 : Math.min(1, (rms - 0.015) * 6)
          const level = Math.pow(raw, 0.6)
          const coeff = level > smoothed ? 0.18 : 0.03
          smoothed = smoothed * (1 - coeff) + level * coeff
          if (smoothed < 0.001) smoothed = 0
          set({ audioLevel: smoothed })
          levelRafRef = requestAnimationFrame(tick)
        }
        levelRafRef = requestAnimationFrame(tick)
      } catch (meterErr) {
        console.warn('[recording store] audio level meter unavailable:', meterErr)
      }

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : ''

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)

      mediaRecorderRef = mediaRecorder
      audioChunksRef = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        useRecordingStore.getState().stopRecording()
        if (cancelPendingRef) {
          cancelPendingRef = false
          audioChunksRef = []
          return
        }
        if (audioChunksRef.length === 0) {
          useRecordingStore.getState().setTranscriptionError('未录制到音频')
          window.electronAPI.notifyTranscriptionFailed('未录制到音频')
          return
        }

        const audioBlob = new Blob(audioChunksRef, { type: mediaRecorder.mimeType || 'audio/webm' })
        set({ isTranscribing: true, canCancel: false })
        try {
          const audioBase64 = await convertBlobToWavBase64(audioBlob)
          const result: TranscribeAudioResult = await window.electronAPI.transcribeAudio({ audioBase64, language: 'zh' })
          const text = result.text?.trim()
          if (!text) {
            window.electronAPI.notifyTranscriptionFailed('识别结果为空')
            return
          }
          useRecordingStore.getState().setTranscribedText(text)
        } catch (err) {
          console.error('语音转文字失败:', err)
          useRecordingStore.getState().setTranscriptionError(err instanceof Error ? err.message : '语音转文字失败')
          window.electronAPI.notifyTranscriptionFailed(err instanceof Error ? err.message : '语音转文字失败')
        } finally {
          set({ isTranscribing: false })
        }
      }

      mediaRecorder.start()
      set({ isRecording: true, duration: 0, canCancel: true })

      timerRef = setInterval(() => {
        set((state) => ({ duration: state.duration + 1 }))
      }, 1000)

      maxDurationTimerRef = setTimeout(() => {
        if (mediaRecorderRef?.state === 'recording') {
          // 先通知主进程 renderer 触达 60s 上限自停，让其推进状态机并装上看门狗，
          // 再停录音。否则主进程 globalPhase 会卡在 'recording'，结果被丢弃且 Thinking 卡死。
          window.electronAPI.notifyRecordingAutoStopped?.()
          mediaRecorderRef.stop()
        }
      }, MAX_RECORDING_SECONDS * 1000)
    } catch (err) {
      console.error('无法访问麦克风:', err)
      useRecordingStore.getState().setTranscriptionError('无法访问麦克风，请检查权限设置')
    }
  },

  toggleRecording: () => {
    const { isRecording, isTranscribing, startRecording } = useRecordingStore.getState()
    console.log(`[recording store] toggleRecording, isRecording=${isRecording}, isTranscribing=${isTranscribing}`)
    if (isTranscribing) return
    if (isRecording) {
      useRecordingStore.getState().stopRecording()
    } else {
      void startRecording()
    }
  }
}))
