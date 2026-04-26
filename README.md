# 大模型接口测试面板

一个轻量级的浏览器端 AI API 测试工具，支持多个中转站（Burncloud / Pinova）的文本模型与图像模型调用，无需安装任何依赖，直接打开 `index.html` 即可使用。

## 功能特性

- **多中转站支持**：预置 Burncloud (OpenAI / Anthropic / Gemini 规范) 与 Pinova (OpenAI / Gemini 原生) 五个端点配置
- **文本模型测试**：输入 Prompt，一键发送，实时渲染响应内容
- **图像模型测试**：支持文生图 / 图生图，可拖拽或选择本地图片，自动压缩并生成公网 URL
- **调试日志面板**：完整展示 Request / Response JSON（超长 Base64 自动截断显示，支持一键复制完整内容）
- **Toast 通知**：操作提示实时弹出，含入场 / 离场动画

## 项目结构

```
llm_test/
├── index.html   # 页面结构（Tailwind CSS via CDN）
├── style.css    # 自定义动画与样式
└── main.js      # 全部业务逻辑（适配器配置 + API 调用）
```

## 使用方式

1. 克隆或下载本仓库
2. 用浏览器直接打开 `index.html`（无需任何服务器）
3. 选择中转站规范，输入 API Key，填写模型 ID 与 Prompt，点击发送

## 支持的端点

| 中转站 | 规范 | 文本端点 | 图像端点 |
|--------|------|----------|----------|
| Burncloud | OpenAI | `/chat/completions` | `/chat/completions` |
| Burncloud | Anthropic | `/messages` | `/chat/completions` |
| Burncloud | Gemini | `generateContent` | `generateContent` |
| Pinova | OpenAI | `/chat/completions` | `/chat/completions` |
| Pinova | Gemini 原生 | `generateContent` | `generateContent` |

## 技术栈

- **HTML / CSS / JavaScript**（原生，零依赖）
- **Tailwind CSS** via CDN（UI 样式）
- **tmpfiles.org API**（本地图片自动转公网 URL）
