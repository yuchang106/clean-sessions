# Claude Code 会话管理器

> **关键词：** claude code、会话管理器、Claude Code Session Manager、会话数据可视化

基于 [Next.js](https://nextjs.org) 构建的 Web 应用，用于浏览、查看和管理 Claude Code 的所有本地会话数据。直接读取 `~/.claude/` 目录，无需额外配置。

## 功能特性

- 📋 **会话列表** — 展示所有 Claude Code 会话，支持搜索、项目筛选、分页
- 📊 **统计概览** — 总会话数、项目数、今日会话、占用空间一目了然
- 🔍 **会话详情** — 可视化展示 JSONL 会话内容，智能解析 text / thinking / tool_use / tool_result 等消息块
- 🗑️ **删除会话** — 清理会话文件、session-env 目录，同步更新 history.jsonl
- 🌗 **暗色模式** — 跟随系统自动切换

## 技术栈

| 层 | 技术 | 版本 |
|---|---|---|
| 前端框架 | Next.js | 16 (App Router) |
| UI 库 | React | 19 |
| 类型系统 | TypeScript | 5 |
| 样式 | TailwindCSS | 4 |
| 后端 | Next.js API Routes (Node.js fs) | - |

## 项目结构

```
src/
├── app/
│   ├── layout.tsx              # 根布局
│   ├── page.tsx                # 首页 — 会话列表
│   └── sessions/[id]/page.tsx  # 会话详情页
├── components/
│   ├── SessionStats.tsx        # 统计卡片
│   ├── SessionFilter.tsx       # 项目筛选
│   ├── SessionTable.tsx        # 会话表格
│   ├── Pagination.tsx          # 分页控件
│   ├── DeleteDialog.tsx        # 删除确认弹窗
│   ├── SessionHeader.tsx       # 详情头部
│   ├── MessageBubble.tsx       # 消息气泡（支持内容块渲染）
│   ├── MessageFilter.tsx       # 消息类型筛选
│   └── RawJsonViewer.tsx       # 原始 JSONL 查看器
├── lib/
│   ├── types.ts                # TypeScript 类型定义
│   ├── sessions.ts             # 会话数据读取/删除
│   └── history.ts              # history.jsonl 操作
└── app/api/sessions/
    ├── route.ts                # GET 会话列表
    └── [id]/
        ├── route.ts            # GET 详情 / DELETE 删除
        └── raw/route.ts        # GET 原始 JSONL
```

## API 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/sessions` | 获取所有会话列表（支持 `page`、`pageSize`、`project`、`search` 参数） |
| GET | `/api/sessions/[id]` | 获取单个会话详情（含解析后的消息内容） |
| GET | `/api/sessions/[id]/raw` | 获取原始 JSONL 文件 |
| DELETE | `/api/sessions/[id]` | 删除会话及其关联文件 |

## 数据模型

```typescript
interface SessionSummary {
  sessionId: string;
  display: string;    // 会话标题（取自第一条非命令消息）
  timestamp: number;
  project: string;
}

interface SessionMessage {
  type: 'user' | 'assistant' | 'system' | 'attachment' | 'mode' | 'file-history';
  content?: string;
  contentBlocks?: ContentBlock[];  // 解析后的内容块
  timestamp?: string;
}
```

## UI 设计

- **风格**: 现代数据面板 (Dashboard) 风格，Indigo 主题色
- **统计卡片**: 渐变色悬停效果
- **消息展示**: 按类型彩色编码（用户 🔵 / 助手 🟢 / 系统 🟣 / 工具 🟠）
- **状态覆盖**: 加载骨架屏、空状态提示、错误重试

## 数据流

### 列表页
1. 页面加载 → `fetch('/api/sessions')`
2. API 读取 `~/.claude/history.jsonl`，按 sessionId 聚合，取首条非命令消息为标题
3. 返回排序后的会话列表

### 详情页
1. 页面加载 → `fetch('/api/sessions/[id]')`
2. API 查找 `~/.claude/projects/*/[id].jsonl`，逐行解析 JSONL
3. 智能提取消息内容（解析 content blocks、清理命令标签）
4. 以聊天风格渲染消息列表

### 删除流程
1. 点击删除 → 确认弹窗
2. 确认 → 依次删除 JSONL 文件、session-env 目录，更新 history.jsonl
3. 返回结果 → 刷新列表

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
