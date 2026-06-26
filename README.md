<div align="center">

<img src="src/renderer/assets/logo.png" alt="语音输入助手" width="120" height="120" />

# 语音输入助手 · OpenVoiceType

**自然说话，自动成文 —— 开源、本地优先、免费的 AI 语音输入工具**

按住热键说话 · 本地识别 · 大模型成文 · 自动粘贴到任意应用

[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-0078D6?logo=windows&logoColor=white)](#-快速开始)
[![Electron](https://img.shields.io/badge/Electron-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Stars](https://img.shields.io/github/stars/satan112233/open-voice-type?style=social)](https://github.com/satan112233/open-voice-type)

### [⬇️ 下载最新版 Windows 安装包](https://github.com/satan112233/open-voice-type/releases/latest)

[![Download](https://img.shields.io/github/v/release/satan112233/open-voice-type?label=%E4%B8%8B%E8%BD%BD%E6%9C%80%E6%96%B0%E7%89%88&logo=github&color=success&sort=semver)](https://github.com/satan112233/open-voice-type/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/satan112233/open-voice-type/total?label=%E4%B8%8B%E8%BD%BD%E9%87%8F&logo=github)](https://github.com/satan112233/open-voice-type/releases)

</div>

---

## 🌟 为什么选择语音输入助手？

市面上的语音输入，常常让你二选一：要么**够准但要把语音传到云端**（隐私存疑），要么**本地但只会逐字转写**（满屏「嗯、啊、那个」还得自己改）。

**语音输入助手两者兼得。** 它常驻系统托盘，在浏览器、文档、IDE、聊天软件……**任意输入框**按下一个快捷键，开口说话，松手即得整理好的文字——语音默认在你本地识别（**不出本机**），再由你自己的大模型把口语**润色成可以直接发出去的书面文**，自动粘贴到光标处。

> 用说话的速度写作，得到的却是精心打磨过的文字。

---

## ✨ 亮点速览

| | 功能 | 一句话 |
|---|---|---|
| 🎙️ | **全局热键语音输入** | 任意软件里按 `Ctrl+Alt+V`，说完自动粘贴到光标处 |
| 🔒 | **本地优先，隐私可控** | 默认本地 Sherpa-onnx 离线识别，语音不上传 |
| 🧠 | **大模型口语优化** | AI 自动去填充词、识别改口、口述标点转真符号、整理结构 |
| 🌏 | **多语种识别** | SenseVoice 支持中 / 英 / 日 / 韩 / 粤语 |
| ☁️ | **云端识别可选** | 一键切换科大讯飞，按需取舍速度与准确率 |
| 📚 | **个人词典** | 锁定人名、品牌、术语，识别纠错更懂你 |
| 🕒 | **历史记录** | 本地保存、可搜索，并**标注每条用的识别引擎与优化模型** |
| 🛡️ | **稳健不卡死** | 识别 / 优化失败或超时都会自动恢复，绝不卡在「处理中」 |
| 🎨 | **精致交互** | 仿 Typeless 的悬浮录音条，实时声波 + Thinking 动效 |

---

## 🖼️ 界面预览

<!-- 📸 建议补充截图，效果更佳：主界面、录音悬浮条、设置页等。
<div align="center">
  <img src="docs/screenshots/home.png" alt="主界面" width="80%" />
  <br /><br />
  <img src="docs/screenshots/popup.png" alt="录音悬浮条" width="40%" />
</div>
-->

> 📹 一段演示胜过千言：按住 `Ctrl+Alt+V` 说一段带口误的话，屏幕底部弹出悬浮录音条，松手后文字自动出现在你的输入框里。

---

## 📦 核心功能详解

### 🎙️ 全局热键，随处可用

在**任意应用**（浏览器、IM、编辑器、邮件……）按 `Ctrl+Alt+V` 即可开始 / 停止录音。录音时屏幕底部弹出**圆角药丸录音浮层**，带由真实麦克风音量驱动的声波动画，左取消 / 右完成。识别完成后，结果按你设定的**输出模式**处理：直接粘贴到光标处 / 仅复制到剪贴板 / 弹窗确认后再粘贴。

### 🗣️ 多引擎识别（本地优先）

| 引擎 | 说明 | 需要配置 |
| --- | --- | --- |
| **本地 Sherpa-onnx**（默认） | [SenseVoice](https://github.com/k2-fsa/sherpa-onnx) 模型，中/英/日/韩/粤语，**完全离线**、隐私不出本机 | 见下方部署说明 |
| **科大讯飞** | 中文场景云端识别 | AppID / APIKey / APISecret |

### 🧠 口语内容智能优化（DeepSeek / 智谱）

开启后，AI 会把口语化的识别结果润色为自然、清晰、流畅的文本，同时保留你的原意：

- **智能改口识别**：说「三点……不对，是十点」时，只保留最终正确的表述，绝不前后都留。
- **去除填充词**：自动清理「嗯、啊、那个、然后、就是」等口头禅与停顿词。
- **标点口令 & 自动格式化**：说「逗号 / 句号 / 换行 / 新段落」转成真标点，口述的并列要点自动整理成列表。
- **术语纠错**：参考你的个人词典，纠正读音相近但拼写有误的专有名词。

> 接入你自己的大模型 API（**DeepSeek** / **智谱 AI**，均为 OpenAI 兼容接口）。未配置时不启用优化，识别结果原样输出；优化失败或超时会**自动回退到识别原文**，不中断流程。

### 📚 个人词典

在「词典」页录入常说的人名、缩写、品牌、项目代号。开启口语优化后，这些词会作为参考注入大模型 Prompt，帮助纠正同音错字，让结果始终如你所愿。

### 🕒 历史记录

自动保存识别历史（最多 200 条，保留时长可设为永久 / 7 / 30 / 90 天），支持**搜索、复制、删除**。每条记录还会**标注当时用的识别引擎与口语优化模型**，方便你回溯与对比不同模型的效果。

### 🎨 顺手的外观与交互

- **浅色 / 深色 / 跟随系统** 三种主题。
- 无边框窗口 + 自定义标题栏；关闭即最小化到**系统托盘**常驻。
- 仿 Typeless 的录音浮层与设置面板（自定义开关、下拉），交互精致统一。

---

## ⌨️ 快捷键

| 快捷键 | 说明 | 可自定义 |
| --- | --- | :---: |
| `Ctrl + Alt + V` | 开始 / 停止语音输入（应用内 / 外均可） | ✅ |

> 自定义方式：设置 → 语音输入 → 全局热键，点击输入框后按下新组合键即可。

---

## 🚀 快速开始

> 目前主要面向 **Windows 10 / 11**。

### 📥 直接下载使用（推荐）

👉 **[前往 Releases 下载最新版安装包](https://github.com/satan112233/open-voice-type/releases/latest)**

下载 `OpenVoiceType-Setup-*.exe`，双击安装后即可使用。首次使用本地识别时，应用会自动下载 SenseVoice 模型（约 160MB）。

> 想自行构建？见下方「从源码运行」或用 `npm run dist` 打包。

### 🧑‍💻 从源码运行（开发者）

#### 环境要求

- Windows 10 / 11
- Node.js 20+
- （可选）DeepSeek / 智谱 的 API Key —— 用于口语优化，推荐 [DeepSeek](https://platform.deepseek.com/)，便宜好用

#### 安装与运行

```bash
# 克隆项目
git clone https://github.com/satan112233/open-voice-type.git
cd open-voice-type

# 安装依赖
npm install

# 开发模式运行
npm run dev
```

### ⚙️ 配置

应用内「设置」清晰地分为两类：

1. **语音识别引擎** —— 选「本地 Sherpa-onnx」（默认，无需联网）或「科大讯飞」（填入 AppID / APIKey / APISecret，需在讯飞开放平台开通「中英识别大模型」服务）。
2. **口语优化（可选）** —— 打开开关，选择 DeepSeek 或智谱 AI，填入对应 API Key。不填则不启用优化。

### 🔉 本地 Sherpa-onnx 部署（使用本地识别时）

<details>
<summary>展开部署步骤</summary>

1. 从 [sherpa-onnx releases](https://github.com/k2-fsa/sherpa-onnx/releases) 下载 Windows x64 预编译包。
2. 将 `sherpa-onnx-offline.exe` 及其依赖 DLL（`onnxruntime.dll`、`sherpa-onnx-c-api.dll`、`sherpa-onnx-cxx-api.dll` 等）放到项目 `resources/sherpa-onnx/`。
3. 首次使用本地识别时，应用会自动从 GitHub 下载 SenseVoice 模型到用户数据目录（约 160MB）；打包时 `resources/sherpa-onnx/` 会随安装包一起分发。

</details>

> 不想折腾本地引擎？在设置里切换到「科大讯飞」并填入 Key，即可立即使用云端识别。

### 📦 打包为安装程序

```bash
npm run dist   # 生成 Windows 安装程序（.exe），产物在 release/ 目录
```

> 💡 若打包卡在下载 Electron / NSIS 工具（GitHub 连接不稳），改用国内镜像：
> ```bash
> set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
> set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
> npm run dist
> ```

---

## 🛠️ 常用命令

```bash
npm run dev        # 开发模式
npm run typecheck  # 类型检查
npm run build      # 构建生产包
npm run dist       # 打包 Windows 安装程序
```

---

## 🏗️ 技术栈

**Electron** · **electron-vite** · **React 19** · **TypeScript** · **Tailwind CSS** · **Zustand** · **electron-store** · **koffi**（Windows 原生 API，模拟粘贴）· **Sherpa-onnx**（离线语音识别）· **ws**（科大讯飞 WebSocket）· **DeepSeek / 智谱**（口语优化）

---

## 📁 项目结构

```
open-voice-type/
├── src/
│   ├── main/            # Electron 主进程：窗口、托盘、全局热键、转录收尾
│   │   ├── services/    #   sherpa-onnx / iflytek-asr / llm-optimizer
│   │   └── utils/       #   系统粘贴、文本后处理
│   ├── preload/         # Preload 脚本，暴露安全 IPC 桥接
│   ├── renderer/        # React 渲染层（components / stores）
│   └── shared/          # 主 / 渲染共享类型
├── resources/sherpa-onnx/   # 本地识别二进制与模型（运行时下载）
├── electron.vite.config.ts
└── package.json
```

---

## 🤝 参与贡献

欢迎 Issue 与 PR！无论是修 Bug、加功能、完善文档，还是适配更多平台 / 识别引擎，都非常欢迎。先在 Issue 中描述问题或提案，我们一起把它做得更好。详见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

## 📄 许可证

本项目基于 [MIT](./LICENSE) 许可证开源。

---

<div align="center">

如果这个项目帮到了你，欢迎点个 ⭐ Star 支持一下！

</div>
