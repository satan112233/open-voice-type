import { app } from 'electron'
import { spawn } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import https from 'node:https'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as tar from 'tar'

const MODEL_NAME = 'sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17'
const MODEL_ARCHIVE = `${MODEL_NAME}.tar.bz2`
const MODEL_URLS = [
  `https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/${MODEL_ARCHIVE}`,
  `https://ghfast.top/https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/${MODEL_ARCHIVE}`
]
const SHERPA_TIMEOUT_MS = 60_000

let activeSherpaProcess: ReturnType<typeof spawn> | null = null

function getResourcesSherpaDir(): string {
  const appRoot = process.env.APP_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  return app.isPackaged
    ? path.join(process.resourcesPath, 'sherpa-onnx')
    : path.join(appRoot, 'resources', 'sherpa-onnx')
}

function getSherpaOfflinePath(): string {
  return path.join(getResourcesSherpaDir(), 'sherpa-onnx-offline.exe')
}

function getModelBaseDir(): string {
  return path.join(app.getPath('userData'), 'sherpa-onnx')
}

function getModelDir(): string {
  return path.join(getModelBaseDir(), MODEL_NAME)
}

function getArchivePath(): string {
  return path.join(getModelBaseDir(), MODEL_ARCHIVE)
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existingSize = existsSync(dest) ? statSync(dest).size : 0
    const file = createWriteStream(dest, { flags: existingSize > 0 ? 'a' : 'w' })
    const headers: Record<string, string> = {
      'User-Agent': 'open-voice-type/1.0'
    }
    if (existingSize > 0) {
      headers['Range'] = `bytes=${existingSize}-`
    }

    https
      .get(
        url,
        { timeout: 120_000, headers },
        (response) => {
          if (response.statusCode === 302 || response.statusCode === 301 || response.statusCode === 307 || response.statusCode === 308) {
            const location = response.headers.location
            if (!location) {
              file.close()
              reject(new Error('模型下载重定向缺少 Location'))
              return
            }
            file.close()
            const redirectUrl = new URL(location, url).toString()
            downloadFile(redirectUrl, dest).then(resolve).catch(reject)
            return
          }
          if (response.statusCode !== 200 && response.statusCode !== 206) {
            file.close()
            reject(new Error(`模型下载失败，HTTP ${response.statusCode}`))
            return
          }

          if (existingSize > 0 && response.statusCode !== 206) {
            file.close()
            rmSync(dest, { force: true })
            downloadFile(url, dest).then(resolve).catch(reject)
            return
          }

          const total = parseInt(response.headers['content-length'] || '0', 10)
          const alreadyDownloaded = response.statusCode === 206 ? existingSize : 0
          let downloaded = 0
          let lastLoggedPercent = -1

          response.on('data', (chunk: Buffer) => {
            downloaded += chunk.length
            if (total > 0) {
              const percent = Math.floor(((alreadyDownloaded + downloaded) / (alreadyDownloaded + total)) * 100)
              if (percent !== lastLoggedPercent && percent % 10 === 0) {
                lastLoggedPercent = percent
                console.log(`[sherpa] downloading model ${percent}%`)
              }
            }
          })
          response.pipe(file)
          file.on('finish', () => {
            file.close(() => resolve())
          })
        }
      )
      .on('error', (err) => {
        file.close()
        reject(err)
      })
  })
}

async function extractTarBz2(archivePath: string, destDir: string): Promise<void> {
  ensureDir(destDir)
  await tar.extract({
    file: archivePath,
    cwd: destDir
  })
}

async function ensureModel(): Promise<string> {
  const modelDir = getModelDir()
  if (existsSync(modelDir) && readdirSync(modelDir).length > 0) {
    return modelDir
  }

  const bundledModelDir = path.join(getResourcesSherpaDir(), MODEL_NAME)
  if (existsSync(bundledModelDir) && readdirSync(bundledModelDir).length > 0) {
    return bundledModelDir
  }

  ensureDir(getModelBaseDir())
  const archivePath = getArchivePath()
  let lastError: Error | undefined

  for (const url of MODEL_URLS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await downloadFile(url, archivePath)
        await extractTarBz2(archivePath, getModelBaseDir())
        rmSync(archivePath, { force: true })
        return modelDir
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 2000 * attempt))
        } else {
          if (existsSync(archivePath)) {
            rmSync(archivePath, { force: true })
          }
        }
      }
    }
  }

  throw new Error(
    `模型下载失败：${lastError?.message || '所有下载源均不可用'}。请手动下载 ${MODEL_ARCHIVE} 并解压到 ${getModelBaseDir()}`
  )
}

function findModelFiles(modelDir: string): { tokens: string; senseVoiceModel: string } {
  const files = readdirSync(modelDir)
  const tokens = files.find((f) => f === 'tokens.txt')
  const senseVoiceModel = files.find((f) => f.startsWith('model') && f.endsWith('.onnx'))
  if (!tokens || !senseVoiceModel) {
    throw new Error(`模型目录 ${modelDir} 中缺少 tokens.txt 或 model*.onnx 文件`)
  }
  return {
    tokens: path.join(modelDir, tokens),
    senseVoiceModel: path.join(modelDir, senseVoiceModel)
  }
}

function runSherpa(sherpaPath: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    activeSherpaProcess = spawn(sherpaPath, args, { windowsHide: true })
    let stdout = ''
    let stderr = ''

    const timeout = setTimeout(() => {
      if (activeSherpaProcess && !activeSherpaProcess.killed) {
        activeSherpaProcess.kill()
      }
      reject(new Error('语音识别超时，请重试'))
    }, SHERPA_TIMEOUT_MS)

    activeSherpaProcess.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    activeSherpaProcess.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    activeSherpaProcess.on('close', (code) => {
      activeSherpaProcess = null
      clearTimeout(timeout)

      if (code !== 0) {
        reject(new Error(stderr.trim() || `sherpa-onnx-offline 退出码 ${code}`))
        return
      }

      const raw = stdout.trim()
      if (!raw) {
        reject(new Error('语音识别未返回文本'))
        return
      }

      let text = raw
      if (raw.startsWith('{')) {
        try {
          const parsed = JSON.parse(raw) as { text?: string }
          text = parsed.text ?? ''
        } catch {
          // keep raw
        }
      }

      resolve(text)
    })

    activeSherpaProcess.on('error', (err) => {
      activeSherpaProcess = null
      clearTimeout(timeout)
      reject(err)
    })
  })
}

export async function transcribeWithSherpa(base64Audio: string): Promise<string> {
  const sherpaPath = getSherpaOfflinePath()
  if (!existsSync(sherpaPath)) {
    throw new Error(
      `未找到 Sherpa-onnx 识别组件：${sherpaPath}。请从 sherpa-onnx release 下载 Windows 二进制并放到 resources/sherpa-onnx/。`
    )
  }

  const modelDir = await ensureModel()
  const { tokens, senseVoiceModel } = findModelFiles(modelDir)

  const tempDir = app.getPath('temp')
  const timestamp = Date.now()
  const wavPath = path.join(tempDir, `ovt-sherpa-recording-${timestamp}.wav`)

  try {
    writeFileSync(wavPath, Buffer.from(base64Audio, 'base64'))

    const args = [
      `--tokens=${tokens}`,
      `--sense-voice-model=${senseVoiceModel}`,
      '--sense-voice-use-itn=1',
      '--num-threads=4',
      '--debug=0',
      wavPath
    ]

    const text = await runSherpa(sherpaPath, args)
    if (!text) {
      throw new Error('未检测到语音，请靠近麦克风重试')
    }
    return text
  } finally {
    try {
      rmSync(wavPath, { force: true })
    } catch {
      // ignore cleanup errors
    }
  }
}
