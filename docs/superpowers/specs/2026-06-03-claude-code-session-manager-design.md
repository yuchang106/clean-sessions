# Claude Code 会话管理器 — 设计文档

## 概述

构建一个管理 Claude Code 会话信息的 Web 应用程序，通过浏览器可视化地查看和管理所有 Claude Code 会话数据。

## 技术栈

| 层 | 技术 | 版本 |
|---|---|---|
| 前端框架 | Next.js | 16 (App Router) |
| UI 库 | React | 19 |
| 类型系统 | TypeScript | 5 |
| 样式 | TailwindCSS | 4 |
| 后端 | Next.js API Routes (Node.js fs) | - |

## 目标

- 读取 `~/.claude/` 目录下的所有会话数据
- 展示会话列表（显示/标题、Session ID、时间戳、项目）
- 可视化查看会话 JSONL 内容
- 删除会话及关联文件（JSONL 文件、session-env 目录、history.jsonl 记录）

## 页面路由

| 路径 | 说明 |
|---|---|
| `/` | 首页 — 会话列表 |
| `/sessions/[id]` | 会话详情页面 |

## API 路由

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/sessions` | 获取所有会话列表 |
| GET | `/api/sessions/[id]` | 获取单个会话详情 |
| GET | `/api/sessions/[id]/raw` | 获取原始 JSONL |
| DELETE | `/api/sessions/[id]` | 删除会话 |

## 数据流

### 列表页
1. 页面加载 → `fetch('/api/sessions')`
2. API 读取 `~/.claude/history.jsonl`
3. 逐行解析 JSONL，按 `sessionId` 聚合，取最新的 `display` 作为标题
4. 返回排序后的会话列表 JSON
5. 页面渲染表格（显示/标题、Session ID、时间戳、项目、操作按钮）

### 详情页
1. 页面加载 → `fetch('/api/sessions/[id]')`
2. API 在所有项目的目录中查找 `[id].jsonl`
3. 按行解析 JSONL，提取消息序列
4. 分类消息类型（用户、助手、系统、附件）
5. 返回消息列表 JSON（含类型、内容、时间戳）
6. 页面以聊天风格气泡展示消息

### 删除流程
1. 点击删除 → 弹出确认对话框
2. 确认 → `DELETE /api/sessions/[id]`
3. API Route 依次执行：
   a. 删除 `projects/*/[id].jsonl` 文件
   b. 删除 `session-env/[id]/` 目录
   c. 读取 `history.jsonl` → 过滤掉该 `sessionId` 的所有行 → 重写文件
4. 返回删除结果 → 前端刷新列表

## UI 组件树

```
src/
├── app/
│   ├── layout.tsx                   # 根布局（全局样式、字体）
│   ├── page.tsx                     # 首页 — 会话列表
│   └── sessions/
│       └── [id]/
│           └── page.tsx             # 会话详情页
├── components/
│   ├── SessionStats.tsx             # 统计卡片（总会话、项目数、今日会话、占用空间）
│   ├── SessionFilter.tsx            # 项目筛选标签
│   ├── SessionTable.tsx             # 会话表格
│   ├── Pagination.tsx              # 分页控件
│   ├── DeleteDialog.tsx            # 删除确认弹窗（含进度反馈）
│   └── ErrorBoundary.tsx           # 错误边界
│   sessions/
│   ├── SessionHeader.tsx           # 会话信息头部
│   ├── MessageBubble.tsx           # 消息气泡组件
│   ├── MessageFilter.tsx           # 消息类型筛选
│   └── RawJsonViewer.tsx           # 原始 JSONL 查看器
├── lib/
│   ├── sessions.ts                 # 会话数据读取/删除逻辑
│   ├── history.ts                  # history.jsonl 操作
│   └── types.ts                    # TypeScript 类型定义
└── api/
    └── sessions/
        ├── route.ts                # GET /api/sessions 列表
        └── [id]/
            ├── route.ts            # GET/DELETE /api/sessions/[id]
            └── raw/route.ts        # GET /api/sessions/[id]/raw
```

## 数据模型

```typescript
// 会话列表条目
interface SessionSummary {
  sessionId: string;
  display: string;       // 标题（取自 history.jsonl 的最新 display）
  timestamp: number;     // 时间戳
  project: string;       // 项目路径
}

// 会话详情
interface SessionDetail {
  sessionId: string;
  display: string;
  project: string;
  timestamp: number;
  messageCount: number;
  fileSize: number;
  messages: SessionMessage[];
}

// 消息条目
interface SessionMessage {
  type: 'user' | 'assistant' | 'system' | 'attachment' | 'mode' | 'file-history';
  role?: string;
  content?: string;
  timestamp?: string;
  uuid?: string;
  raw: string;           // 原始 JSON 行
}

// 统计信息
interface SessionStats {
  total: number;
  projects: number;
  todayCount: number;
  totalSize: string;
}

// 删除结果
interface DeleteResult {
  success: boolean;
  deleted: {
    jsonl: boolean;
    sessionEnv: boolean;
    historyEntries: number;  // 删除的 history.jsonl 条目数
  };
  error?: string;
}
```

## UI 设计风格

- **风格**: 现代数据面板 (Dashboard) 风格
- **颜色**: 浅色主题为主，暗色代码块
- **统计卡片**: 4 个顶部分布（总会话、项目数、今日会话、占用空间）
- **筛选**: 标签式项目快速筛选
- **表格**: 分页表格，带搜索功能
- **详情页**: 聊天风格消息气泡，彩色编码区分消息类型
- **删除**: 确认弹窗 + 进度反馈 + 结果提示

### 消息颜色编码

| 类型 | 颜色 | 标识 |
|---|---|---|
| 用户 (User) | 蓝色 `#3b82f6` | U |
| 助手 (Assistant) | 绿色 `#10b981` | A |
| 系统 (System) | 紫色 `#8b5cf6` | S |
| 工具/附件 (Tool) | 橙色 `#f59e0b` | T |

## 状态覆盖

### 列表页
- **加载中**: 骨架屏 / 加载动画
- **空状态**: 无会话时的提示
- **错误状态**: API 读取失败的提示和重试
- **正常**: 分页列表展示

### 详情页
- **加载中**: 骨架屏
- **未找到**: 会话不存在的提示
- **正常**: 消息列表展示
- **原始 JSONL**: 可切换查看

### 删除
- **确认**: 弹窗展示删除内容清单
- **进度**: 逐步反馈进度条
- **成功**: ✅ 完成提示
- **错误**: ❌ 错误详情 + 重试/跳过/取消 选项
