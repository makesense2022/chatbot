# Deepseek 聊天助手

一个简单的基于 React 和 Deepseek API 的聊天应用。

## 功能

- 直接与 Deepseek 大语言模型对话
- 流式响应输出（打字机效果）
- 联网搜索功能（提供最新互联网信息）
- 整洁的用户界面
- Markdown 支持

## 快速开始

### 前提条件

- Node.js 18.0.0 或更高版本
- 一个有效的 Deepseek API 密钥
- (可选) Google Custom Search API 配置（提供更好的联网搜索体验）

### 安装

1. 克隆此仓库
2. 安装依赖：

```bash
npm install
# 或
yarn
# 或
pnpm install
```

3. 配置环境变量：
   - 复制示例环境变量文件：`cp .env.example .env`
   - 在`.env`文件中填入您的 Deepseek API 密钥
   - 如需使用联网搜索功能，请在`.env`文件中添加 Google Custom Search API 配置

### 开发

```bash
npm run dev
# 或
yarn dev
# 或
pnpm dev
```

### 构建

```bash
npm run build
# 或
yarn build
# 或
pnpm build
```

## 技术栈

- React
- TypeScript
- Vite
- Tailwind CSS
- lucide-react (图标)
- react-markdown (Markdown 渲染)

## 特性说明

### 联网搜索功能

本应用提供联网搜索功能，让模型能够获取最新的互联网信息：

- 当启用联网搜索时，系统会先搜索用户的问题，然后将搜索结果与用户问题一起发送给 Deepseek
- 搜索结果会显示在用户消息旁边，提供透明的信息来源
- 可以通过界面上的开关轻松启用或禁用联网搜索功能

#### 搜索 API 选项

应用支持以下搜索选项:

1. **Google Custom Search API** (推荐，需要配置)

   - 提供更精准的搜索结果
   - 每天 100 次免费查询，超出需付费
   - 需要配置 API 密钥和搜索引擎 ID

2. **DuckDuckGo 搜索** (备选，无需配置)
   - 完全免费
   - 无需 API 密钥
   - 如果 Google Custom Search 未配置或请求失败，将自动使用此选项

#### 配置 Google Custom Search API (可选)

配置步骤：

1. 创建 Google Custom Search Engine

   - 访问 [Google Programmable Search Engine](https://programmablesearchengine.google.com/about/)
   - 点击"创建搜索引擎"并按照指导完成
   - 获取搜索引擎 ID (cx)

2. 获取 Google API 密钥

   - 访问 [Google Cloud Console](https://console.cloud.google.com/)
   - 创建项目并启用 Custom Search API
   - 生成 API 密钥

3. 将配置添加到项目的 `.env` 文件中：

```
VITE_GOOGLE_API_KEY=您的Google API密钥
VITE_GOOGLE_CSE_ID=您的自定义搜索引擎ID
```

**注意**: 即使不配置 Google Custom Search API，搜索功能也能通过 DuckDuckGo 正常工作，但结果可能不如 Google 精准。

### 联网搜索与跨域 (CORS) 问题

本应用提供了多种解决联网搜索跨域问题的方案：

1. **本地代理服务器** (推荐)

   项目包含一个简单的代理服务器，运行它可以解决跨域问题：

   ```bash
   # 安装依赖
   npm install express cors axios

   # 启动代理服务器
   node proxy-server.js
   ```

   服务器会在 http://localhost:3001 运行，应用会自动使用此服务器作为首选联网方式。

2. **公共 CORS 代理**

   如果本地代理不可用，应用会自动尝试使用公共 CORS 代理服务：

   - corsproxy.io
   - cors-anywhere.herokuapp.com
   - api.allorigins.win

3. **后备搜索结果**

   如果所有代理方法都失败，应用会提供一个后备方案，确保用户体验不会中断。

---

DuckDuckGo 搜索不需要 API 密钥，是完全免费的解决方案，但由于浏览器的同源策略限制，需要使用代理服务器解决跨域问题。

### 流式响应

本应用使用 Deepseek API 的流式响应功能，实现类似打字机的实时输出效果：

- 当用户发送消息后，AI 的回复会逐字显示
- 使用 `fetch` API 的流处理功能
- 实现方式：
  ```javascript
  fetch("https://api.deepseek.com/v1/chat/completions", {
    // ...其他配置
    body: JSON.stringify({
      // ...其他参数
      stream: true,
    }),
  });
  ```

## 环境变量与安全

本项目使用环境变量存储 API 密钥，请注意：

- 不要将包含真实 API 密钥的 `.env` 文件提交到版本控制系统
- 项目已将 `.env` 文件添加到 `.gitignore` 中
- 使用 `.env.example` 作为模板，不包含真实密钥
- 在本地开发和部署时，始终基于 `.env.example` 创建自己的 `.env` 文件

环境变量说明：

```
VITE_DEEPSEEK_API_KEY=您的Deepseek密钥
VITE_GOOGLE_API_KEY=您的Google API密钥 (可选)
VITE_GOOGLE_CSE_ID=您的Google自定义搜索引擎ID (可选)
```

如果在生产环境部署，建议：

- 使用环境变量注入而非文件存储密钥
- 考虑使用后端代理服务调用 Deepseek API，避免在前端暴露密钥
- 使用加密存储服务或密钥管理系统

## 注意事项

- 此应用直接调用 Deepseek API，请注意 API 使用限制和费用
- API 密钥存储在前端环境变量中，生产环境中应考虑更安全的方式存储和使用密钥
