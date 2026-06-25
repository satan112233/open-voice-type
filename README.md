# 语音输入助手（OpenVoiceType）

An open-source, local-first AI voice dictation app for Windows.

> 自然说话，自动成文 —— 开源、本地、免费的 AI 语音输入法。

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

- 🎙️ **全局热键语音输入**：按住 `Ctrl+Alt+V` 说话，松开后自动转成文字并粘贴到当前输入框。
- 🔒 **本地优先，隐私可控**：默认使用本地 [Sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) + SenseVoice 模型，语音数据不上传。
- ✨ **智能文本后处理**：自动标点、去除填充词、修正口误与重复。
- 📚 **个人词典**：添加自定义词汇，提高专业术语识别准确率。
- 🕒 **历史记录**：本地保存识别历史，支持搜索、复制、删除。
- ⚙️ **云端可选**：可配置 OpenAI Whisper API 作为备选识别引擎。

## Tech Stack

- **Desktop**: Electron + electron-vite
- **Frontend**: React + TypeScript + Tailwind CSS
- **State**: Zustand
- **Storage**: electron-store
- **Local ASR**: Sherpa-onnx (SenseVoice)
- **Cloud ASR**: OpenAI Whisper API

## Development

```bash
# Install dependencies
npm install

# Start in development mode
npm run dev
```

## Build

```bash
# Build production bundles
npm run build

# Package into Windows installer
npm run dist
```

If you are behind a restricted network (e.g. China), use the npmmirror for electron binaries:

```bash
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
npm run dist
```

## Local ASR Setup

OpenVoiceType uses Sherpa-onnx for offline speech recognition. On first run with the local engine selected, the app will attempt to download the SenseVoice model automatically.

You also need to place `sherpa-onnx-offline.exe` and its DLL dependencies in `resources/sherpa-onnx/`. You can download them from the [sherpa-onnx releases](https://github.com/k2-fsa/sherpa-onnx/releases).

Alternatively, configure an OpenAI API Key in settings to use cloud recognition immediately.

## License

[MIT](./LICENSE)
