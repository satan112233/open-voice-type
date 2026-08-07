import { spawn } from 'child_process'
import path from 'path'
import { app } from 'electron'

export interface FocusInfo {
  controlType: string
  automationId: string
  className: string
  name: string
  runtimeId: string
  hasValue: boolean
  value: string
}

function getHelperPath(): string {
  // 开发环境：直接用 native/build 下的产物
  // 生产环境：electron-builder 会把 native/build 复制到 resources/build
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'build', 'UiaHelper.exe')
  }
  return path.resolve('native/build/UiaHelper.exe')
}

export async function readFocusedInputValue(): Promise<FocusInfo | null> {
  return new Promise((resolve, reject) => {
    const helperPath = getHelperPath()
    const proc = spawn(helperPath, ['--read-focus'], { windowsHide: true })
    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      stdout += data.toString()
    })
    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `UiaHelper exited with code ${code}`))
        return
      }
      try {
        const result = JSON.parse(stdout.trim()) as FocusInfo
        resolve(result)
      } catch {
        reject(new Error(`UiaHelper returned invalid JSON: ${stdout}`))
      }
    })

    proc.on('error', (error) => {
      reject(error)
    })
  })
}

export function watchFocusedInputValue(callback: (info: FocusInfo) => void): () => void {
  const helperPath = getHelperPath()
  const proc = spawn(helperPath, ['--watch-focus'], { windowsHide: true })
  let buffer = ''

  proc.stdout.on('data', (data) => {
    buffer += data.toString()
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        callback(JSON.parse(trimmed) as FocusInfo)
      } catch (error) {
        console.warn('[uia-helper] failed to parse watch output:', trimmed, error)
      }
    }
  })

  proc.stderr.on('data', (data) => {
    console.warn('[uia-helper] stderr:', data.toString())
  })

  proc.on('close', (code) => {
    console.log('[uia-helper] watch process exited with code', code)
  })

  return () => {
    proc.kill()
  }
}
