# Deepseek 聊天助手

一个简单的基于 React 和 Deepseek API 的聊天应用。

## 功能

- 直接与 Deepseek 大语言模型对话
- 流式响应输出（打字机效果）
- 联网搜索功能（提供最新互联网信息）
- 新闻搜索与总结（流式输出）
- 支持 Deepseek Reasoner 模型的思考过程显示
- 聊天历史记录保存与管理
- 支持多会话管理
- 整洁的用户界面
- Markdown 支持

## 快速开始

### 前提条件

- Node.js 18.0.0 或更高版本
- 一个有效的 Deepseek API 密钥
- (可选) Serper.dev 和 SerpApi 密钥（提供更好的联网搜索体验）

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
   - 添加搜索引擎 API 密钥（Serper.dev 和 SerpApi）

### 开发

运行前端应用：

```bash
npm run dev
# 或
yarn dev
# 或
pnpm dev
```

启动代理服务器（解决跨域问题）：

```bash
npm run start
# 或
node proxy-server.js
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
- Express.js (代理服务器)
- lucide-react (图标)
- react-markdown (Markdown 渲染)

## 特性说明

### 联网搜索功能

本应用提供联网搜索功能，让模型能够获取最新的互联网信息：

- 当启用联网搜索时，系统会先搜索用户的问题，然后将搜索结果与用户问题一起发送给 Deepseek
- 搜索结果会显示在用户消息旁边，提供透明的信息来源
- 可以通过界面上的开关轻松启用或禁用联网搜索功能
- 支持新闻搜索与总结，流式输出体验

#### 搜索 API 选项

应用支持以下搜索引擎:

1. **Serper.dev API** (推荐，需要配置)

   - 提供 Google 搜索结果
   - 需要 API 密钥，免费试用额度有限

2. **SerpApi** (备选，需要配置)
   - 提供多种搜索引擎结果
   - 需要 API 密钥，免费试用额度有限

#### 配置搜索引擎 API

1. 获取 Serper.dev API 密钥

   - 访问 [Serper.dev](https://serper.dev/)
   - 注册账号并获取 API 密钥

2. 获取 SerpApi 密钥

   - 访问 [SerpApi](https://serpapi.com/)
   - 注册账号并获取 API 密钥

3. 将配置添加到项目的 `.env` 文件中：

```
SERPER_API_KEY=您的Serper.dev API密钥
SERPAPI_API_KEY=您的SerpApi密钥
```

### 代理服务器增强功能

本项目包含一个增强版代理服务器，支持以下功能：

1. **多搜索引擎支持**

   - 整合 Serper.dev 和 SerpApi
   - 自动失败切换逻辑

2. **内容爬取与解析**

   - 智能爬取搜索结果页面内容
   - 列表页检测和内容提取
   - 内容质量评估算法

3. **网站特殊处理**

   - 针对常见新闻网站（如新浪、腾讯、网易等）的特殊解析规则
   - 提取关键内容而非整个页面

4. **深度爬取功能**
   - 从列表页中识别并提取有价值的内容链接
   - 自动跟踪链接获取完整内容

启动代理服务器：

```bash
node proxy-server.js
```

服务器会在 http://localhost:3001 运行，应用会自动使用此服务器。

### Deepseek Reasoner 模型支持

应用支持 Deepseek 的 Reasoner 模型系列，能够显示模型的思考过程：

- 使用下拉菜单选择不同的模型
- Reasoner 模型会显示额外的"思考过程"部分
- 支持折叠/展开思考过程内容
- 同样支持流式输出思考过程

### 流式响应

本应用使用 Deepseek API 的流式响应功能，实现类似打字机的实时输出效果：

- 当用户发送消息后，AI 的回复会逐字显示
- 新增：搜索与总结功能也支持流式输出
- 新增：支持在流式输出过程中向上滚动查看历史消息
- 新增：添加"回到底部"按钮，方便查看最新内容

### 多会话与历史记录

应用支持保存和管理多个聊天会话：

- 侧边栏展示所有历史对话记录
- 创建新对话、切换对话和删除对话
- 会话自动保存到本地浏览器存储
- 会话标题自动根据对话内容生成
- 重新打开应用时自动加载上次的对话
- 移动设备上支持隐藏/显示侧边栏

## 环境变量与安全

本项目使用环境变量存储所有 API 密钥，请注意：

- 不要将包含真实 API 密钥的 `.env` 文件提交到版本控制系统
- 项目已将 `.env` 文件添加到 `.gitignore` 中
- 使用 `.env.example` 作为模板，不包含真实密钥
- 在本地开发和部署时，始终基于 `.env.example` 创建自己的 `.env` 文件

环境变量说明：

```
# Deepseek API密钥
VITE_DEEPSEEK_API_KEY=您的Deepseek密钥

# 搜索引擎API密钥
SERPER_API_KEY=您的Serper.dev API密钥
SERPAPI_API_KEY=您的SerpApi密钥

# 服务器配置
PORT=3001 (可选，默认为3001)
```

如果在生产环境部署，建议：

- 使用环境变量注入而非文件存储密钥
- 考虑使用后端代理服务调用所有 API，避免在前端暴露密钥
- 使用加密存储服务或密钥管理系统

## 注意事项

- 此应用直接调用 Deepseek API，请注意 API 使用限制和费用
- API 密钥存储在前端环境变量中，生产环境中应考虑更安全的方式存储和使用密钥
- 代理服务器仅用于开发和演示目的，生产环境应考虑更强大的解决方案
