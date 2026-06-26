# CLAUDE.md

本文件为在此仓库工作的 AI/开发者提供项目指南。

## 项目简介

**open-voice-type（语音输入助手）** —— 仿 Typeless 的本地优先 AI 语音输入工具（Electron + React，主要面向 Windows）。
核心流程：全局热键 `Ctrl+Alt+V` 录音 → 语音识别（ASR）→ 口语优化（大模型）→ 自动粘贴到当前输入框。

## 技术栈

- **桌面**：Electron + electron-vite + electron-builder
- **前端**：React + TypeScript + Tailwind CSS + Zustand
- **存储**：electron-store（`settings` / `history` / `dictionary` 三个 key）
- **本地 ASR**：Sherpa-onnx（调 `sherpa-onnx-offline.exe` 子进程）
- **云 ASR**：科大讯飞「中英识别大模型」WebSocket（`ws` 库）
- **口语优化**：DeepSeek / 智谱 AI，OpenAI 兼容 `chat/completions`

## 开发命令

```bash
npm run dev        # 启动开发（electron-vite dev）
npm run build      # typecheck + 构建
npm run typecheck  # 仅类型检查
npm run dist       # 打包 Windows 安装包
```

**重要**：renderer（`src/renderer/**`）改动走 Vite HMR 即时生效；**main / preload / shared 类型**改动需**重启 dev server**才生效（electron-vite 不一定自动重启 Electron）。

## 打包与发布

**打包**：`npm run dist`，产物在 `release/`：安装包 `语音输入助手 Setup <版本>.exe`（约 110MB）、`latest.yml`、`.blockmap`。`release/`、`dist`、`dist-electron`、`node_modules` 均已 gitignore。版本号取自 `package.json` 的 `version`。

**打包后白屏/图裂的坑（dev 正常 ≠ 打包正常）**：① renderer 构建输出在 `dist/`（不是 electron-vite 默认的 `dist-electron/renderer/`），主进程生产环境用 `loadRenderer()` 走 `win.loadFile(dist/index.html, {query:{mode}})` 加载，**别拼 `file://` 字符串**（Windows 反斜杠 + query 会解析出错）。② renderer 里引用图片等静态资源**必须 `import`**（如 `import logo from './assets/logo.png'`），不能写源码路径字符串，否则打包后资源丢失。③ 改完打包务必真装/真验（可用 win-unpacked exe + 远程调试 + CDP 检查 DOM）。详见记忆 `packaging-asset-paths`。

**国内打包下载超时**：electron-builder 首次打包要从 GitHub 拉 Electron 本体与 winCodeSign/NSIS，国内常超时。仓库根已有 `.npmrc` 把这些二进制指向 npmmirror 镜像（`registry` + `electron_mirror` + `electron_builder_binaries_mirror`）根治，**勿删**。

**发布到 GitHub Release**（本机无 `gh` CLI，用 REST API）：
1. 取 token（git 凭据里的 `ghp_` PAT，有 push 权限）：
   ```bash
   TOKEN=$(printf "host=github.com\nprotocol=https\n\n" | git credential fill | sed -n 's/^password=//p')
   ```
2. 建 release：`POST /repos/<owner>/<repo>/releases`，body 含 `tag_name`(如 `v0.1.0`)、`target_commitish:"main"`（GitHub 自动建 tag）、`name`、`body`、`draft:false`。
3. 传资产：`POST https://uploads.github.com/repos/<owner>/<repo>/releases/<id>/assets?name=<ASCII名>`，`-H "Content-Type: application/octet-stream" --data-binary @"<exe路径>"`。**资产名用 ASCII**（如 `OpenVoiceType-Setup-0.1.0.exe`）避免中文/空格问题；本地源文件名仍是中文无妨。
4. 发版仅改版本号与 release body 即可复用。

> 提示：若本机用 FastGithub/DevSidecar 等本地反代加速 GitHub（域名被劫持到 `127.0.0.1` 并用自签 CA），命令行 `curl` 需加 **`--ssl-no-revoke`**，否则报 `CRYPT_E_NO_REVOCATION_CHECK`。未用反代则不需要。

## 架构

**多窗口设计**（`src/main/index.ts`）：
- `mainWindow` — 主界面（无边框，关闭即隐藏到托盘）
- `voiceWindow` — 1×1 隐藏窗口，承载 `MediaRecorder` 录音（主进程无法直接录音）
- `recordingPopup` — 屏幕底部悬浮录音条（仿 Typeless）
- `Tray` — 系统托盘

**renderer 路由靠 URL 参数**（`src/renderer/main.tsx`）：`?mode=voice` 录音面板、`?mode=popup` 悬浮条、无参数为主 App。浏览器开发态会 mock `window.electronAPI`。

**一次语音输入的数据流**：
```
热键 → main.toggleRecording → 显示 popup + 通知 voiceWindow 录音
  → MediaRecorder 录音 → 转 16kHz 单声道 WAV(base64)
  → IPC 'transcribe-audio' → main 按 asrProvider 分发（sherpa / iflytek）
  → handleTranscriptionResult：口语优化(可选) → 存历史 → 粘贴/复制
```

**口语优化**：`handleTranscriptionResult` 中，若 `enableLlmOptimization` 且对应供应商 API Key 已填 → 调 `optimizeWithLlm`（`src/main/services/llm-optimizer-service.ts`）；失败回退识别原文，不中断粘贴。baseUrl/model 来自该文件的 `LLM_PROVIDERS` 预设。system prompt 在该文件的 `SYSTEM_PROMPT`，已对标 Typeless 多次迭代（盘古之白留白、断句分段、语法纠错并保留语气）；可由用户主导继续演进，但请**谨慎改动**，并始终保持「无实质内容则输出空字符串」为最后一条规则。

**录音条状态机（易误改，谨慎）**：popup 的转录态由 main 的 `globalPhase`（`idle`/`recording`/`transcribing`）独占控制——`ipcMain.on('recording-state')` 只在 `recording` 阶段才用 voiceWindow 状态驱动 popup（实时声波）。Thinking 必须覆盖「ASR + 口语优化」全过程，并在 `handleTranscriptionResult` 里于**粘贴/复制之前**就关闭（`globalPhase='idle'` + hide），让"思考结束"先于"出字"。详见记忆 `recording-popup-flow`。声波由 `RecordingPopup.tsx` 的 `SoundWave` 自驱动（每根条独立相位、音量控制振幅）。转录卡死兜底（仅自动）：ASR 失败/空 → `notifyTranscriptionFailed`(`global-voice-failed`) 即时收尾；LLM fetch 20s AbortController 超时回退原文；main 端 45s 看门狗强制收尾；收尾统一走 `finishTranscribing()`，并丢弃超时后迟到的结果。

## 目录要点

- `src/main/` — 主进程：`index.ts`（窗口/IPC/快捷键/转录收尾）、`services/`（`sherpa-onnx-service` / `iflytek-asr-service` / `llm-optimizer-service`）、`utils/`（`system-input` 模拟粘贴、`speech-optimizer` 规则式后处理-当前未接入主流程）
- `src/preload/index.ts` — contextBridge 暴露 `electronAPI`
- `src/renderer/` — UI：页面（Home/History/Dictionary/Settings）+ 录音组件（VoiceRecordingPanel/RecordingPopup）+ Zustand stores
- `src/shared/types/` — 前后端共享类型

## 关键约定

- **参考姊妹项目**：`D:\workspace\my-work\translation-assistant` 是同源项目，讯飞、LLM 口语优化等均从它移植；做类似功能优先参考它。
- **设置数据模型**：`Settings` 里 `llmModel/llmApiKey/llmBaseUrl` 及 `openai*` 为**弃用字段**（保留不破坏存量），实际口语优化以 `LLM_PROVIDERS` 预设 + `llmProvider`/按供应商的 key（`deepseekApiKey`/`zhipuApiKey`）为准。
- **口语优化取舍**：只用大模型，无基础规则档；个人词典纠正仅在口语优化开启时通过 prompt 注入生效。
- **历史记录模型标注**：`HistoryItem.asrProvider` / `llmProvider` 存的是**生成时的模型快照**（在 `handleTranscriptionResult` 写入，非读当前设置），否则改设置会让旧记录标签失真；`llmProvider` 仅在口语优化真正成功时记录，HistoryPage 按字段存在显示标签、缺失则不显示。
- UI 改动由用户自行验证，不必自行开浏览器截图。
