<div align="center">

# 🎙️ 语音输入助手 · OpenVoiceType

**自然说话，自动成文 —— 开源、本地优先、免费的 AI 语音输入工具**

把你说的每一句口语，实时整理成通顺、带标点的书面文字，并自动粘贴到任何应用里。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows-0078D6.svg)](#-安装与快速开始)
[![Electron](https://img.shields.io/badge/Electron-2C2E3B.svg?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

</div>

---

## 这是什么？

OpenVoiceType 是一款桌面级的 **AI 语音输入法**。在任何输入框里按下全局热键 `Ctrl+Alt+V`，开口说话，松手后它会：

1. **识别**你说的话（默认在你电脑本地完成，语音不上传）；
2. 用**大模型把口语整理成书面文**——去掉「嗯、啊、那个」，听懂你的「改口/口误」只保留最终意思，把口述的「逗号、句号、换行」变成真正的标点，甚至自动整理成条理清晰的列表；
3. 把结果**自动粘贴到光标所在的位置**。

> 用说话的速度写作，但得到的是精心打磨过的文字。

<!-- 📹 建议在此处补充一段演示 GIF：按住热键说一段带口误的话 → 悬浮录音条 → 自动输出整理后的文字。
<p align="center"><img src="docs/demo.gif" alt="OpenVoiceType 演示" width="640"></p>
-->

---

## 为什么选择它？

市面上的语音输入，常常让你二选一：要么**够准但要把语音传到云端**（隐私存疑），要么**本地但只能逐字转写**（满屏口水话还得自己改）。

OpenVoiceType 想两者兼得：

- 🔒 **真·本地优先** —— 默认用本地模型识别，语音数据不出你的电脑。
- 🧠 **不只是转写，而是「成文」** —— 大模型帮你把口语润色成可以直接发出去的文字。
- 🆓 **完全开源免费** —— MIT 协议，没有订阅、没有次数限制，模型 Key 用你自己的。

---

## ✨ 核心特性

| 特性 | 说明 |
|------|------|
| 🎙️ **全局热键，随处可用** | 在浏览器、IM、编辑器、邮件……任意输入框按 `Ctrl+Alt+V` 即可，结果自动粘贴到光标处 |
| 🔒 **本地识别，隐私可控** | 默认使用 [Sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) + SenseVoice 离线模型，语音不上传 |
| 🧠 **大模型口语优化** | 接入 DeepSeek / 智谱 AI，自动去填充词、纠正改口与口误、把口述标点转为真符号、整理列表结构 |
| 🌏 **多语种识别** | SenseVoice 支持中、英、日、韩、粤语 |
| ☁️ **云端识别可选** | 可一键切换到科大讯飞云识别，按需取舍速度与准确率 |
| 📚 **个人词典** | 添加人名、品牌、专业术语，优化时自动纠正同音错字，识别更懂你 |
| 🕒 **历史记录** | 本地保存识别历史，可搜索、复制、删除，并**标注每条用的识别引擎与优化模型** |
| 🎨 **精致交互** | 仿 Typeless 的悬浮录音条，实时声波 + "Thinking" 处理动效 |
| 🛡️ **稳健可靠** | 识别/优化失败或超时都会自动恢复，不会卡在「处理中」 |

---

## 🧠 工作原理

```
   按住 Ctrl+Alt+V 说话
            │
            ▼
   ┌──────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
   │  语音识别 (ASR)   │ ──▶ │   口语优化 (LLM)      │ ──▶ │   自动粘贴       │
   │  本地 Sherpa /    │     │   DeepSeek / 智谱     │     │   到当前输入框   │
   │  科大讯飞         │     │  （可选，失败回退原文）│     │                 │
   └──────────────────┘     └──────────────────────┘     └─────────────────┘
```

- **语音识别**默认在本地完成；口语优化是**可选**的——不配置大模型 Key 时，直接输出识别原文。
- 大模型优化失败或超时会**自动回退到识别原文**，绝不让流程中断或卡死。

---

## 📦 安装与快速开始

> 目前主要面向 **Windows**。

### 从源码运行

```bash
# 1. 克隆仓库
git clone https://github.com/satan112233/open-voice-type.git
cd open-voice-type

# 2. 安装依赖
npm install

# 3. 启动开发模式
npm run dev
```

### 打包成安装程序

```bash
npm run build   # 类型检查 + 构建
npm run dist    # 生成 Windows 安装包（输出到 release/）
```

> 如果你在网络受限的环境（如国内），可使用镜像加速 Electron 相关二进制下载：
> ```bash
> set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
> set ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
> npm run dist
> ```

### 本地识别引擎准备

本地识别依赖 Sherpa-onnx：

- 首次使用本地引擎时，应用会自动下载 SenseVoice 模型。
- 你还需要把 `sherpa-onnx-offline.exe` 及其依赖的 DLL 放到 `resources/sherpa-onnx/`，可从 [sherpa-onnx releases](https://github.com/k2-fsa/sherpa-onnx/releases) 下载 Windows 版本。

> 不想折腾本地引擎？在设置里切换到「科大讯飞」并填入 Key，即可立即使用云端识别。

---

## ⚙️ 配置

应用内「设置」分为两类，清晰直观：

### 1. 语音识别引擎

| 选项 | 需要的配置 |
|------|-----------|
| **本地 Sherpa-onnx**（默认） | 无需联网、无需 Key |
| **科大讯飞** | AppID / APIKey / APISecret（需在讯飞开放平台开通「中英识别大模型」服务） |

### 2. 口语优化（可选，大模型）

打开开关并选择供应商，填入对应 API Key 即可：

| 供应商 | 说明 |
|--------|------|
| **DeepSeek** | OpenAI 兼容接口 |
| **智谱 AI** | OpenAI 兼容接口 |

> 未填写 Key 时不会启用优化，识别结果原样输出。

### 个人词典

在「词典」页添加常用的专有名词、人名、术语。开启口语优化后，这些词会作为参考注入大模型，帮助纠正读音相近但拼写错误的识别结果。

---

## 🔒 隐私

- 语音数据默认由**本地模型**处理，不上传云端。
- 历史记录仅保存在你的设备本地。
- 仅当你**主动选择**云端识别（科大讯飞）或大模型优化（DeepSeek / 智谱）时，相应数据才会发送到对应服务商；API Key 由你自己持有。

---

## 🛠 技术栈

- **桌面框架**：Electron + electron-vite + electron-builder
- **前端**：React 19 + TypeScript + Tailwind CSS
- **状态管理**：Zustand
- **本地存储**：electron-store
- **本地 ASR**：Sherpa-onnx（SenseVoice 模型）
- **云 ASR**：科大讯飞「中英识别大模型」
- **口语优化**：DeepSeek / 智谱（OpenAI 兼容接口）

---

## 🤝 贡献

欢迎提交 Issue 与 Pull Request！无论是修 Bug、加功能、完善文档，还是适配更多平台/识别引擎，都非常欢迎。详见 [CONTRIBUTING.md](./CONTRIBUTING.md)。

如果这个项目对你有帮助，欢迎点一个 ⭐ Star，让更多人发现它。

---

## 📄 License

[MIT](./LICENSE) © OpenVoiceType Contributors
