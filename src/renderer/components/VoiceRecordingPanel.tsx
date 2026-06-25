import { useEffect, useRef } from 'react'
import { useRecordingStore } from '../stores/recordingStore'

export function VoiceRecordingPanel() {
  const {
    isRecording,
    isTranscribing,
    duration,
    audioLevel,
    transcribedText,
    startRecording,
    stopRecording,
    cancelRecording,
    setTranscribedText
  } = useRecordingStore()

  const isRecordingRef = useRef(isRecording)
  const isTranscribingRef = useRef(isTranscribing)

  useEffect(() => {
    isRecordingRef.current = isRecording
  }, [isRecording])

  useEffect(() => {
    isTranscribingRef.current = isTranscribing
  }, [isTranscribing])

  // Listen for global recording commands from main process
  useEffect(() => {
    console.log('[voice panel] registering global recording listeners')
    const unsubscribeStart = window.electronAPI.onStartGlobalRecording(() => {
      console.log('[voice panel] received start-global-recording, isRecording:', isRecordingRef.current, 'isTranscribing:', isTranscribingRef.current)
      if (!isRecordingRef.current && !isTranscribingRef.current) {
        console.log('[voice panel] calling startRecording')
        void startRecording()
      } else {
        console.log('[voice panel] ignoring start-global-recording')
      }
    })

    const unsubscribeStop = window.electronAPI.onStopGlobalRecording(() => {
      console.log('[voice panel] received stop-global-recording')
      if (isRecordingRef.current) {
        stopRecording()
      }
    })

    const unsubscribeCancel = window.electronAPI.onCancelGlobalRecording(() => {
      console.log('[voice panel] received cancel-global-recording')
      if (isRecordingRef.current) {
        cancelRecording()
      }
    })

    return () => {
      unsubscribeStart()
      unsubscribeStop()
      unsubscribeCancel()
    }
  }, [startRecording, stopRecording, cancelRecording])

  // Send recording state updates to popup
  useEffect(() => {
    const state = { isRecording, isTranscribing, duration, audioLevel: audioLevel || 0, canCancel: isRecording }
    window.electronAPI.sendRecordingState(state)
  }, [isRecording, isTranscribing, duration, audioLevel])

  // Push live audio level to popup while recording
  useEffect(() => {
    if (!isRecording) return
    const id = setInterval(() => {
      const s = useRecordingStore.getState()
      window.electronAPI.sendRecordingState({
        isRecording: s.isRecording,
        isTranscribing: s.isTranscribing,
        duration: s.duration,
        audioLevel: s.audioLevel || 0,
        canCancel: s.isRecording
      })
    }, 66)
    return () => clearInterval(id)
  }, [isRecording])

  // Send transcription result back to main process when ready
  useEffect(() => {
    if (transcribedText !== null && !isRecording && !isTranscribing) {
      console.log('[voice panel] sending global voice result:', transcribedText.slice(0, 50))
      window.electronAPI.sendGlobalVoiceResult(transcribedText)
      setTranscribedText(null)
    }
  }, [transcribedText, isRecording, isTranscribing, setTranscribedText])

  return null
}
