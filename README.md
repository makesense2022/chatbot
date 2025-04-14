# Deepseek 聊天助手

一个简单的基于 React 和 Deepseek API 的聊天应用。

## 功能

- 直接与 Deepseek 大语言模型对话
- 流式响应输出（打字机效果）
- 整洁的用户界面
- Markdown 支持

## 快速开始

### 前提条件

- Node.js 18.0.0 或更高版本
- 一个有效的 Deepseek API 密钥

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

如果在生产环境部署，建议：

- 使用环境变量注入而非文件存储密钥
- 考虑使用后端代理服务调用 Deepseek API，避免在前端暴露密钥
- 使用加密存储服务或密钥管理系统

## 注意事项

- 此应用直接调用 Deepseek API，请注意 API 使用限制和费用
- API 密钥存储在前端环境变量中，生产环境中应考虑更安全的方式存储和使用密钥
