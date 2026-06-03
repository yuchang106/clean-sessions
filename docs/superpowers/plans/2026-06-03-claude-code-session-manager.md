# Claude Code 会话管理器 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个 Web 应用，通过可视化界面管理 Claude Code 的所有会话信息。

**Architecture:** Next.js 16 App Router 实现前后端一体应用。前端使用 React 19 + TailwindCSS 4，后端通过 API Routes 直接操作 ~/.claude/ 下的 JSONL 文件和目录，无需数据库。

**Tech Stack:** Next.js 16, React 19, TypeScript 5, TailwindCSS 4

---

### Task 0: 项目初始化

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `src/app/globals.css`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx` (占位)
- Create: `.gitignore`

- [ ] **Step 1: 使用 create-next-app 初始化项目**

```bash
cd /Users/yzy/workspace/claude-code/webapp/clean-sessions
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack --no-git
```

> 注意：如果提示覆盖现有目录，选择 yes。选择 `--no-git` 因为我们稍后手动初始化。

选择 Next.js 16 最新版本。TailwindCSS 会自动配置为 v4 版本。

- [ ] **Step 2: 验证项目可运行**

```bash
cd /Users/yzy/workspace/claude-code/webapp/clean-sessions
npm run build 2>&1 | tail -5
# 或 npm run dev 并确认无错误
```

- [ ] **Step 3: 初始化 Git 仓库并创建初始提交**

```bash
cd /Users/yzy/workspace/claude-code/webapp/clean-sessions
git init
git checkout -b main
git add .
git commit -m "chore: initialize Next.js 16 project with TypeScript and TailwindCSS"
```

---

### Task 1: 类型定义 (lib/types.ts)

**Files:**
- Create: `src/lib/types.ts`

- [ ] **Step 1: 创建类型定义文件**

```typescript
// src/lib/types.ts

/** history.jsonl 中的一条记录 */
export interface HistoryEntry {
  display: string;
  pastedContents: Record<string, unknown>;
  timestamp: number;
  project: string;
  sessionId: string;
}

/** 会话列表展示条目 */
export interface SessionSummary {
  sessionId: string;
  display: string;
  timestamp: number;
  project: string;
}

/** 会话消息类型 */
export type MessageType = 'user' | 'assistant' | 'system' | 'attachment' | 'mode' | 'file-history';

/** 会话消息条目 */
export interface SessionMessage {
  type: MessageType;
  role?: string;
  content?: string;
  contentPreview?: string;
  timestamp?: string;
  uuid?: string;
  raw: string;
}

/** 会话详情 */
export interface SessionDetail {
  sessionId: string;
  display: string;
  project: string;
  timestamp: number;
  messageCount: number;
  fileSize: number;
  filePath: string;
  messages: SessionMessage[];
}

/** 统计信息 */
export interface SessionStats {
  total: number;
  projects: number;
  todayCount: number;
  totalSize: string;
}

/** 删除结果 */
export interface DeleteResult {
  success: boolean;
  deleted: {
    jsonl: boolean;
    sessionEnv: boolean;
    historyEntries: number;
  };
  error?: string;
}

/** API 列表响应 */
export interface SessionsResponse {
  sessions: SessionSummary[];
  stats: SessionStats;
  total: number;
  page: number;
  pageSize: number;
}
```

---

### Task 2: 核心库 — 读取和解析会话数据 (lib/sessions.ts)

**Files:**
- Create: `src/lib/sessions.ts`

**依赖:** Task 1 的类型定义

- [ ] **Step 1: 实现读取 history.jsonl 并获取会话列表的函数**

```typescript
// src/lib/sessions.ts
import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { rm } from 'fs/promises';
import path from 'path';
import { HistoryEntry, SessionSummary, SessionStats, SessionMessage, SessionDetail } from './types';

const CLAUDE_DIR = path.join(process.env.HOME || '/Users/yzy', '.claude');
const HISTORY_FILE = path.join(CLAUDE_DIR, 'history.jsonl');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');
const SESSION_ENV_DIR = path.join(CLAUDE_DIR, 'session-env');

/**
 * 读取 history.jsonl 并按 sessionId 聚合，取每组最新的 display。
 * 按时间戳降序排列。
 */
export function getAllSessions(): SessionSummary[] {
  if (!existsSync(HISTORY_FILE)) return [];

  const content = readFileSync(HISTORY_FILE, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean);
  
  // 按 sessionId 分组，取最新的记录
  const sessionMap = new Map<string, HistoryEntry>();
  
  for (const line of lines) {
    try {
      const entry: HistoryEntry = JSON.parse(line);
      const existing = sessionMap.get(entry.sessionId);
      if (!existing || entry.timestamp > existing.timestamp) {
        sessionMap.set(entry.sessionId, entry);
      }
    } catch {
      continue; // 跳过解析失败的行
    }
  }

  // 构建 summary 并按时间戳降序
  const sessions: SessionSummary[] = Array.from(sessionMap.values())
    .map(entry => ({
      sessionId: entry.sessionId,
      display: entry.display,
      timestamp: entry.timestamp,
      project: path.basename(entry.project), // 只取项目名
    }))
    .sort((a, b) => b.timestamp - a.timestamp);

  return sessions;
}

/**
 * 获取统计信息
 */
export function getSessionStats(): SessionStats {
  const sessions = getAllSessions();
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const uniqueProjects = new Set(sessions.map(s => s.project));
  const todayCount = sessions.filter(s => s.timestamp >= todayStart.getTime()).length;
  
  // 计算所有 JSONL 文件的总大小
  let totalBytes = 0;
  if (existsSync(PROJECTS_DIR)) {
    const projectDirs = readdirSync(PROJECTS_DIR);
    for (const projectDir of projectDirs) {
      const projectPath = path.join(PROJECTS_DIR, projectDir);
      try {
        const files = readdirSync(projectPath);
        for (const file of files) {
          if (file.endsWith('.jsonl')) {
            totalBytes += statSync(path.join(projectPath, file)).size;
          }
        }
      } catch {
        continue;
      }
    }
  }
  
  const totalSize = totalBytes > 1024 * 1024
    ? `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`
    : `${(totalBytes / 1024).toFixed(1)} KB`;

  return {
    total: sessions.length,
    projects: uniqueProjects.size,
    todayCount,
    totalSize,
  };
}

/**
 * 查找指定 sessionId 的 JSONL 文件路径
 */
export function findSessionFile(sessionId: string): string | null {
  if (!existsSync(PROJECTS_DIR)) return null;
  
  const projectDirs = readdirSync(PROJECTS_DIR);
  for (const projectDir of projectDirs) {
    const projectPath = path.join(PROJECTS_DIR, projectDir);
    const filePath = path.join(projectPath, `${sessionId}.jsonl`);
    if (existsSync(filePath)) {
      return filePath;
    }
  }
  return null;
}

/**
 * 获取会话详情（解析整个 JSONL 文件）
 */
export function getSessionDetail(sessionId: string): SessionDetail | null {
  const filePath = findSessionFile(sessionId);
  if (!filePath) return null;

  // 从 history.jsonl 获取标题
  const allSessions = getAllSessions();
  const summary = allSessions.find(s => s.sessionId === sessionId);

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean);
  
  const stats = statSync(filePath);
  const messages: SessionMessage[] = [];

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      const msg: SessionMessage = {
        type: parsed.type || 'system',
        raw: line,
        timestamp: parsed.timestamp,
        uuid: parsed.uuid,
      };

      if (parsed.type === 'user' && parsed.message) {
        msg.role = 'user';
        msg.content = typeof parsed.message.content === 'string'
          ? parsed.message.content
          : JSON.stringify(parsed.message.content);
      } else if (parsed.type === 'assistant' && parsed.message) {
        msg.role = 'assistant';
        msg.content = typeof parsed.message.content === 'string'
          ? parsed.message.content
          : JSON.stringify(parsed.message.content);
      } else if (parsed.type === 'attachment') {
        msg.role = 'attachment';
        msg.content = parsed.attachment?.content || parsed.attachment?.type || '';
      } else if (parsed.type === 'system') {
        msg.role = parsed.subtype || 'system';
        msg.content = parsed.content || '';
      } else if (parsed.type === 'mode') {
        msg.content = `Mode: ${parsed.mode}`;
      } else if (parsed.type === 'file-history-snapshot') {
        msg.content = 'File history snapshot';
      }

      // 截取内容预览（用于列表展示）
      if (msg.content && msg.content.length > 200) {
        msg.contentPreview = msg.content.substring(0, 200) + '...';
      }

      messages.push(msg);
    } catch {
      // 跳过解析失败的行
      continue;
    }
  }

  return {
    sessionId,
    display: summary?.display || '(无标题)',
    project: summary?.project || '',
    timestamp: summary?.timestamp || 0,
    messageCount: messages.length,
    fileSize: stats.size,
    filePath,
    messages,
  };
}

/**
 * 获取原始 JSONL 内容
 */
export function getSessionRaw(sessionId: string): string | null {
  const filePath = findSessionFile(sessionId);
  if (!filePath) return null;
  return readFileSync(filePath, 'utf-8');
}

/**
 * 删除会话（JSONL 文件、session-env 目录）
 * 注意：history.jsonl 的清理由 history.ts 处理
 */
export async function deleteSessionFiles(sessionId: string): Promise<{ jsonl: boolean; sessionEnv: boolean }> {
  const result = { jsonl: false, sessionEnv: false };

  // 删除 JSONL 文件
  const filePath = findSessionFile(sessionId);
  if (filePath) {
    try {
      await rm(filePath, { force: true });
      result.jsonl = true;
    } catch {
      result.jsonl = false;
    }
  }

  // 删除 session-env 目录
  const envDir = path.join(SESSION_ENV_DIR, sessionId);
  if (existsSync(envDir)) {
    try {
      await rm(envDir, { recursive: true, force: true });
      result.sessionEnv = true;
    } catch {
      result.sessionEnv = false;
    }
  }

  return result;
}
```

---

### Task 3: 核心库 — history.jsonl 操作 (lib/history.ts)

**Files:**
- Create: `src/lib/history.ts`

**依赖:** Task 1 的类型定义

- [ ] **Step 1: 实现从 history.jsonl 中删除指定 sessionId 的函数**

```typescript
// src/lib/history.ts
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

const CLAUDE_DIR = path.join(process.env.HOME || '/Users/yzy', '.claude');
const HISTORY_FILE = path.join(CLAUDE_DIR, 'history.jsonl');

/**
 * 从 history.jsonl 中删除指定 sessionId 的所有条目
 * 返回删除的条目数
 */
export function removeHistoryEntries(sessionId: string): number {
  if (!existsSync(HISTORY_FILE)) return 0;

  const content = readFileSync(HISTORY_FILE, 'utf-8');
  const lines = content.trim().split('\n').filter(Boolean);
  
  const remaining: string[] = [];
  let removedCount = 0;

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.sessionId === sessionId) {
        removedCount++;
      } else {
        remaining.push(line);
      }
    } catch {
      // 保留无法解析的行
      remaining.push(line);
    }
  }

  writeFileSync(HISTORY_FILE, remaining.join('\n') + (remaining.length > 0 ? '\n' : ''), 'utf-8');
  return removedCount;
}
```

---

### Task 4: API Routes — 会话列表接口

**Files:**
- Create: `src/app/api/sessions/route.ts`

**依赖:** Task 2, Task 3

- [ ] **Step 1: 实现 GET /api/sessions — 返回会话列表和统计信息**

```typescript
// src/app/api/sessions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAllSessions, getSessionStats } from '@/lib/sessions';
import { SessionsResponse } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20')));
    const project = searchParams.get('project') || '';
    const search = searchParams.get('search') || '';

    let sessions = getAllSessions();
    const stats = getSessionStats();

    // 按项目筛选
    if (project) {
      sessions = sessions.filter(s => s.project === project);
    }

    // 按关键词搜索（在 display 和 sessionId 中搜索）
    if (search) {
      const keyword = search.toLowerCase();
      sessions = sessions.filter(
        s => s.display.toLowerCase().includes(keyword) || s.sessionId.toLowerCase().includes(keyword)
      );
    }

    const total = sessions.length;
    const start = (page - 1) * pageSize;
    const pagedSessions = sessions.slice(start, start + pageSize);

    const response: SessionsResponse = {
      sessions: pagedSessions,
      stats,
      total,
      page,
      pageSize,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('获取会话列表失败:', error);
    return NextResponse.json(
      { error: '获取会话列表失败', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
```

---

### Task 5: API Routes — 会话详情和删除接口

**Files:**
- Create: `src/app/api/sessions/[id]/route.ts`
- Create: `src/app/api/sessions/[id]/raw/route.ts`

**依赖:** Task 2, Task 3

- [ ] **Step 1: 创建 [id] 路由目录**

```bash
mkdir -p /Users/yzy/workspace/claude-code/webapp/clean-sessions/src/app/api/sessions/\[id\]/raw
```

- [ ] **Step 2: 实现 GET/DELETE /api/sessions/[id]**

```typescript
// src/app/api/sessions/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSessionDetail, deleteSessionFiles } from '@/lib/sessions';
import { removeHistoryEntries } from '@/lib/history';
import { DeleteResult } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const detail = getSessionDetail(id);
    
    if (!detail) {
      return NextResponse.json({ error: '会话未找到' }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    console.error('获取会话详情失败:', error);
    return NextResponse.json(
      { error: '获取会话详情失败', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. 删除 JSONL 文件和 session-env 目录
    const fileResult = await deleteSessionFiles(id);
    
    // 2. 清理 history.jsonl 中的关联条目
    const historyCount = removeHistoryEntries(id);

    const result: DeleteResult = {
      success: true,
      deleted: {
        jsonl: fileResult.jsonl,
        sessionEnv: fileResult.sessionEnv,
        historyEntries: historyCount,
      },
    };

    // 如果什么都没删掉，认为失败
    if (!fileResult.jsonl && !fileResult.sessionEnv && historyCount === 0) {
      result.success = false;
      result.error = '未找到任何关联的会话数据';
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('删除会话失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      } as DeleteResult,
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: 实现 GET /api/sessions/[id]/raw**

```typescript
// src/app/api/sessions/[id]/raw/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSessionRaw } from '@/lib/sessions';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const raw = getSessionRaw(id);
    
    if (!raw) {
      return NextResponse.json({ error: '会话未找到' }, { status: 404 });
    }

    return new NextResponse(raw, {
      headers: {
        'Content-Type': 'application/jsonl',
        'Content-Disposition': `attachment; filename="${id}.jsonl"`,
      },
    });
  } catch (error) {
    console.error('获取原始 JSONL 失败:', error);
    return NextResponse.json(
      { error: '获取原始 JSONL 失败' },
      { status: 500 }
    );
  }
}
```

---

### Task 6: 首页 UI — 统计卡片组件

**Files:**
- Create: `src/components/SessionStats.tsx`

**依赖:** Task 1 的类型定义

- [ ] **Step 1: 创建统计卡片组件**

```tsx
// src/components/SessionStats.tsx
'use client';

import { SessionStats as Stats } from '@/lib/types';

interface SessionStatsProps {
  stats: Stats | null;
  loading: boolean;
}

export default function SessionStats({ stats, loading }: SessionStatsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-2"></div>
            <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    { label: '总会话数', value: stats.total.toString(), icon: '💬' },
    { label: '项目数', value: stats.projects.toString(), icon: '📁' },
    { label: '今日会话', value: stats.todayCount.toString(), icon: '📅' },
    { label: '占用空间', value: stats.totalSize, icon: '📦' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">{card.label}</span>
            <span className="text-lg">{card.icon}</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</div>
        </div>
      ))}
    </div>
  );
}
```

---

### Task 7: 首页 UI — 项目筛选标签组件

**Files:**
- Create: `src/components/SessionFilter.tsx`

- [ ] **Step 1: 创建筛选组件**

```tsx
// src/components/SessionFilter.tsx
'use client';

interface SessionFilterProps {
  projects: string[];
  selectedProject: string;
  onSelect: (project: string) => void;
}

export default function SessionFilter({ projects, selectedProject, onSelect }: SessionFilterProps) {
  if (projects.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <button
        onClick={() => onSelect('')}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          selectedProject === ''
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
        }`}
      >
        全部
      </button>
      {projects.map((project) => (
        <button
          key={project}
          onClick={() => onSelect(project)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            selectedProject === project
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          {project}
        </button>
      ))}
    </div>
  );
}
```

---

### Task 8: 首页 UI — 分页组件

**Files:**
- Create: `src/components/Pagination.tsx`

- [ ] **Step 1: 创建分页组件**

```tsx
// src/components/Pagination.tsx
'use client';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, total, pageSize, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, total);

  // 生成显示的页码
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const delta = 2;
    
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-between mt-4">
      <div className="text-sm text-gray-500 dark:text-gray-400">
        显示 {startItem}-{endItem} 条，共 {total} 条
      </div>
      <div className="flex gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          上一页
        </button>
        {getPageNumbers().map((page, idx) =>
          typeof page === 'string' ? (
            <span key={`ellipsis-${idx}`} className="px-2 py-1.5 text-sm text-gray-400">...</span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                page === currentPage
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {page}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          下一页
        </button>
      </div>
    </div>
  );
}
```

---

### Task 9: 首页 UI — 删除确认弹窗

**Files:**
- Create: `src/components/DeleteDialog.tsx`

**依赖:** Task 1 的类型定义

- [ ] **Step 1: 创建删除确认弹窗（包含进度反馈和结果展示）**

```tsx
// src/components/DeleteDialog.tsx
'use client';

import { useState } from 'react';
import { SessionSummary, DeleteResult } from '@/lib/types';

type DeleteStage = 'confirm' | 'deleting' | 'result';

interface DeleteDialogProps {
  session: SessionSummary;
  onClose: () => void;
  onDeleted: () => void;
}

export default function DeleteDialog({ session, onClose, onDeleted }: DeleteDialogProps) {
  const [stage, setStage] = useState<DeleteStage>('confirm');
  const [result, setResult] = useState<DeleteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setStage('deleting');
    try {
      const res = await fetch(`/api/sessions/${session.sessionId}`, { method: 'DELETE' });
      const data: DeleteResult = await res.json();
      setResult(data);
      if (data.success) {
        setStage('result');
        setTimeout(() => {
          onDeleted();
          onClose();
        }, 1500);
      } else {
        setError(data.error || '删除失败');
        setStage('result');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除请求失败');
      setStage('result');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Confirm Stage */}
        {stage === 'confirm' && (
          <>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">⚠️</span>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">确认删除会话</h2>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">删除后，以下内容将被清理：</p>
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
                  <span className="text-red-500">🗑️</span>
                  <span className="text-gray-700 dark:text-gray-300">会话内容文件 (.jsonl)</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
                  <span className="text-red-500">🗑️</span>
                  <span className="text-gray-700 dark:text-gray-300">会话环境目录 (session-env/)</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
                  <span className="text-amber-500">✏️</span>
                  <span className="text-gray-700 dark:text-gray-300">history.jsonl 记录</span>
                </div>
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm">
                <p className="text-red-800 dark:text-red-300">
                  <strong>会话信息：</strong>
                </p>
                <p className="text-red-700 dark:text-red-400 mt-1">{session.display}</p>
                <p className="text-red-600 dark:text-red-500 font-mono text-xs mt-1">Session: {session.sessionId}</p>
                <p className="text-red-600 dark:text-red-400 text-xs mt-0.5">项目: {session.project}</p>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 flex justify-end gap-3">
              <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                取消
              </button>
              <button onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors">
                确认删除
              </button>
            </div>
          </>
        )}

        {/* Deleting Stage */}
        {stage === 'deleting' && (
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">正在清理会话数据...</h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">删除会话 JSONL 文件</span>
                  <span className="text-green-600 dark:text-green-400">✓ 已完成</span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full w-full bg-green-500 rounded-full"></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">清理 session-env 目录</span>
                  <span className="text-green-600 dark:text-green-400">✓ 已完成</span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full w-full bg-green-500 rounded-full"></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">更新 history.jsonl</span>
                  <span className="text-blue-600 dark:text-blue-400">⏳ 处理中...</span>
                </div>
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full w-3/4 bg-blue-500 rounded-full animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Result Stage */}
        {stage === 'result' && (
          <div className="p-6 text-center">
            {error ? (
              <>
                <div className="text-4xl mb-3">❌</div>
                <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">删除失败</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{error}</p>
                <button onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 mr-2">
                  重试
                </button>
                <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">
                  关闭
                </button>
              </>
            ) : (
              <>
                <div className="text-4xl mb-3">✅</div>
                <h2 className="text-lg font-semibold text-green-600 dark:text-green-400 mb-2">会话已成功删除</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  已清理 {result?.deleted.historyEntries} 项关联数据
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### Task 10: 首页 UI — 主页面组装

**Files:**
- Modify: `src/app/page.tsx`

**依赖:** Task 4, Task 6, Task 7, Task 8, Task 9

- [ ] **Step 1: 实现首页页面，组合所有组件**

```tsx
// src/app/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import SessionStats from '@/components/SessionStats';
import SessionFilter from '@/components/SessionFilter';
import SessionTable from '@/components/SessionTable';
import Pagination from '@/components/Pagination';
import DeleteDialog from '@/components/DeleteDialog';
import { SessionSummary, SessionStats as Stats } from '@/lib/types';

const PAGE_SIZE = 20;

export default function HomePage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedProject, setSelectedProject] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SessionSummary | null>(null);

  // 获取所有项目列表（从当前数据中提取）
  const [projects, setProjects] = useState<string[]>([]);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: PAGE_SIZE.toString(),
      });
      if (selectedProject) params.set('project', selectedProject);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/sessions?${params}`);
      if (!res.ok) throw new Error(`请求失败: ${res.status}`);
      const data = await res.json();
      setSessions(data.sessions);
      setStats(data.stats);
      setTotal(data.total);
      
      // 提取项目列表（只在首次加载时）
      if (projects.length === 0 && data.stats) {
        // 从全部会话中提取 - 需要另一个请求
        const allRes = await fetch('/api/sessions?pageSize=500');
        const allData = await allRes.json();
        const projSet = new Set(allData.sessions.map((s: SessionSummary) => s.project));
        setProjects(Array.from(projSet).sort());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取数据失败');
    } finally {
      setLoading(false);
    }
  }, [page, selectedProject, searchQuery, projects.length]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchSessions();
  };

  const handleDeleted = () => {
    fetchSessions();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Claude Code 会话管理</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">管理所有项目的 Claude Code 会话</p>
          </div>
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索会话..."
              className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-60"
            />
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              搜索
            </button>
          </form>
        </div>

        {/* Stats */}
        <SessionStats stats={stats} loading={loading} />

        {/* Filter */}
        <SessionFilter
          projects={projects}
          selectedProject={selectedProject}
          onSelect={(project) => { setSelectedProject(project); setPage(1); }}
        />

        {/* Error */}
        {error && (
          <div className="p-4 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {error}
            <button onClick={fetchSessions} className="ml-2 underline">重试</button>
          </div>
        )}

        {/* Table */}
        <SessionTable sessions={sessions} loading={loading} onDelete={setDeleteTarget} />

        {/* Pagination */}
        <Pagination
          currentPage={page}
          totalPages={Math.ceil(total / PAGE_SIZE)}
          total={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>

      {/* Delete Dialog */}
      {deleteTarget && (
        <DeleteDialog
          session={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
```

---

### Task 11: 首页 UI — 会话表格组件

**Files:**
- Create: `src/components/SessionTable.tsx`

**依赖:** Task 1 的类型定义

- [ ] **Step 1: 创建会话表格组件**

```tsx
// src/components/SessionTable.tsx
'use client';

import Link from 'next/link';
import { SessionSummary } from '@/lib/types';

interface SessionTableProps {
  sessions: SessionSummary[];
  loading: boolean;
  onDelete: (session: SessionSummary) => void;
}

export default function SessionTable({ sessions, loading, onDelete }: SessionTableProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 space-y-4 animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/5"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/5"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/6"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/6"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/12"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
        <div className="text-4xl mb-3">📭</div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">暂无会话</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">没有找到匹配的会话记录</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">显示/标题</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Session ID</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">时间</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">项目</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-36">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {sessions.map((session) => (
              <tr key={session.sessionId} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-xs">
                    {session.display}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <code className="text-xs font-mono text-gray-500 dark:text-gray-400">
                    {session.sessionId.substring(0, 8)}...{session.sessionId.substring(session.sessionId.length - 4)}
                  </code>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(session.timestamp).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                    {session.project}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <Link
                      href={`/sessions/${session.sessionId}`}
                      className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                    >
                      详情
                    </Link>
                    <button
                      onClick={() => onDelete(session)}
                      className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

### Task 12: 详情页 UI — 会话头部

**Files:**
- Create: `src/components/SessionHeader.tsx`

- [ ] **Step 1: 创建会话详情头部信息组件**

```tsx
// src/components/SessionHeader.tsx
'use client';

import Link from 'next/link';
import { SessionDetail } from '@/lib/types';

interface SessionHeaderProps {
  session: SessionDetail;
  onDelete: () => void;
}

export default function SessionHeader({ session, onDelete }: SessionHeaderProps) {
  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
        <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          ← 返回列表
        </Link>
        <span>/</span>
        <span className="text-gray-700 dark:text-gray-300 font-medium">会话详情</span>
      </div>

      {/* Title and actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">
          {session.display}
        </h1>
        <div className="flex gap-2">
          <Link
            href={`/api/sessions/${session.sessionId}/raw`}
            target="_blank"
            className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            查看原始 JSONL
          </Link>
          <button
            onClick={onDelete}
            className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
          >
            删除此会话
          </button>
        </div>
      </div>

      {/* Session metadata */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Session ID</div>
          <code className="text-xs font-mono text-gray-700 dark:text-gray-300 break-all">
            {session.sessionId.substring(0, 12)}...
          </code>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">项目</div>
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{session.project || '-'}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">时间</div>
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {session.timestamp ? new Date(session.timestamp).toLocaleString('zh-CN') : '-'}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">消息数</div>
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{session.messageCount}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">文件大小</div>
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {session.fileSize > 1024
              ? `${(session.fileSize / 1024).toFixed(1)} KB`
              : `${session.fileSize} B`}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">文件路径</div>
          <div className="text-xs font-mono text-gray-500 dark:text-gray-400 truncate" title={session.filePath}>
            {session.filePath ? '...' + session.filePath.slice(-40) : '-'}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### Task 13: 详情页 UI — 消息气泡组件

**Files:**
- Create: `src/components/MessageBubble.tsx`

- [ ] **Step 1: 创建消息气泡组件**

```tsx
// src/components/MessageBubble.tsx
'use client';

import { useState } from 'react';
import { SessionMessage } from '@/lib/types';

interface MessageBubbleProps {
  message: SessionMessage;
}

const typeConfig = {
  user: { icon: 'U', color: 'bg-blue-500', label: '用户', bgColor: 'bg-blue-50 dark:bg-blue-900/10', borderColor: 'border-blue-200 dark:border-blue-800' },
  assistant: { icon: 'A', color: 'bg-emerald-500', label: 'Claude', bgColor: 'bg-emerald-50 dark:bg-emerald-900/10', borderColor: 'border-emerald-200 dark:border-emerald-800' },
  system: { icon: 'S', color: 'bg-purple-500', label: '系统', bgColor: 'bg-purple-50 dark:bg-purple-900/10', borderColor: 'border-purple-200 dark:border-purple-800' },
  attachment: { icon: 'T', color: 'bg-amber-500', label: '工具/附件', bgColor: 'bg-amber-50 dark:bg-amber-900/10', borderColor: 'border-amber-200 dark:border-amber-800' },
  mode: { icon: 'M', color: 'bg-gray-500', label: '模式', bgColor: 'bg-gray-50 dark:bg-gray-800', borderColor: 'border-gray-200 dark:border-gray-700' },
  'file-history': { icon: 'F', color: 'bg-rose-500', label: '文件快照', bgColor: 'bg-rose-50 dark:bg-rose-900/10', borderColor: 'border-rose-200 dark:border-rose-800' },
};

export default function MessageBubble({ message }: MessageBubbleProps) {
  const [expanded, setExpanded] = useState(false);
  const config = typeConfig[message.type] || typeConfig.system;

  // 对于无内容的系统消息和文件快照，显示简约版本
  const isMinimal = message.type === 'mode' || message.type === 'file-history' || (message.type === 'system' && !message.content);

  if (isMinimal) {
    return (
      <div className="flex gap-3 items-start">
        <div className={`w-7 h-7 rounded-full ${config.color} text-white flex items-center justify-center text-xs font-bold flex-shrink-0`}>
          {config.icon}
        </div>
        <div className={`flex-1 border ${config.borderColor} ${config.bgColor} rounded-lg px-4 py-2`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{config.label}</span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {message.timestamp ? new Date(message.timestamp).toLocaleString('zh-CN') : ''}
            </span>
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-1 italic">
            {message.type === 'mode' ? `模式: ${message.content?.replace('Mode: ', '') || 'normal'}` : message.content || message.type}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 items-start">
      <div className={`w-7 h-7 rounded-full ${config.color} text-white flex items-center justify-center text-xs font-bold flex-shrink-0`}>
        {config.icon}
      </div>
      <div className={`flex-1 border ${config.borderColor} ${config.bgColor} rounded-lg overflow-hidden`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-inherit">
          <span className="text-xs font-semibold" style={{ color: config.color.replace('bg-', 'text-').replace('-500', '-600') }}>
            {config.label}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {message.timestamp ? new Date(message.timestamp).toLocaleString('zh-CN') : ''}
          </span>
        </div>
        
        {/* Content */}
        <div className="px-4 py-3">
          {message.type === 'attachment' && message.content ? (
            <div>
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline mb-2"
              >
                {expanded ? '收起附件内容 ▲' : '展开附件内容 ▼'}
              </button>
              {expanded && (
                <pre className="text-xs bg-gray-900 dark:bg-black text-gray-100 p-3 rounded-lg overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap font-mono leading-relaxed">
                  {message.content}
                </pre>
              )}
            </div>
          ) : (
            <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
              {message.content || '(空)'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

### Task 14: 详情页 UI — 消息筛选 + 原始 JSON 查看器

**Files:**
- Create: `src/components/MessageFilter.tsx`
- Create: `src/components/RawJsonViewer.tsx`

- [ ] **Step 1: 创建消息类型筛选组件**

```tsx
// src/components/MessageFilter.tsx
'use client';

import { MessageType } from '@/lib/types';

interface FilterOption {
  key: string;
  label: string;
  count: number;
}

interface MessageFilterProps {
  options: FilterOption[];
  selected: string;
  onSelect: (key: string) => void;
}

export default function MessageFilter({ options, selected, onSelect }: MessageFilterProps) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onSelect(opt.key)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            selected === opt.key
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          {opt.label} ({opt.count})
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 创建原始 JSONL 查看器组件**

```tsx
// src/components/RawJsonViewer.tsx
'use client';

import { useState } from 'react';

interface RawJsonViewerProps {
  sessionId: string;
}

export default function RawJsonViewer({ sessionId }: RawJsonViewerProps) {
  const [rawContent, setRawContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const toggleExpand = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    if (!rawContent && !loading) {
      setLoading(true);
      try {
        const res = await fetch(`/api/sessions/${sessionId}/raw`);
        const text = await res.text();
        setRawContent(text);
      } catch {
        setRawContent('// 获取原始数据失败');
      } finally {
        setLoading(false);
      }
    }
    setExpanded(true);
  };

  return (
    <details open={expanded} onToggle={toggleExpand} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <summary className="px-4 py-3 bg-gray-50 dark:bg-gray-800 text-sm font-medium text-blue-600 dark:text-blue-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors select-none">
        {expanded ? '收起原始 JSONL 数据' : '显示原始 JSONL 数据'}
      </summary>
      <div className="p-0">
        {loading ? (
          <div className="p-4 text-sm text-gray-400 animate-pulse">加载中...</div>
        ) : (
          <pre className="text-xs bg-gray-900 dark:bg-black text-gray-100 p-4 overflow-x-auto max-h-96 overflow-y-auto font-mono leading-relaxed whitespace-pre-wrap">
            {rawContent || '// 暂无数据'}
          </pre>
        )}
      </div>
    </details>
  );
}
```

---

### Task 15: 详情页 UI — 详情页面组装

**Files:**
- Create: `src/app/sessions/[id]/page.tsx`

- [ ] **Step 1: 实现详情页面**

```tsx
// src/app/sessions/[id]/page.tsx
'use client';

import { useEffect, useState, use } from 'react';
import SessionHeader from '@/components/SessionHeader';
import MessageFilter from '@/components/MessageFilter';
import MessageBubble from '@/components/MessageBubble';
import RawJsonViewer from '@/components/RawJsonViewer';
import DeleteDialog from '@/components/DeleteDialog';
import Link from 'next/link';
import { SessionDetail, SessionSummary, SessionMessage } from '@/lib/types';

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [showDelete, setShowDelete] = useState(false);

  const fetchSession = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${id}`);
      if (res.status === 404) {
        setError('会话未找到');
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error(`请求失败: ${res.status}`);
      const data = await res.json();
      setSession(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取会话详情失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, [id]);

  // 消息类型统计
  const typeCounts = () => {
    if (!session) return [];
    const counts: Record<string, number> = { all: session.messages.length };
    for (const m of session.messages) {
      const label = { user: '用户', assistant: '助手', system: '系统', attachment: '附件', mode: '系统', 'file-history': '文件快照' }[m.type] || '其他';
      counts[label] = (counts[label] || 0) + 1;
    }
    return Object.entries(counts).map(([key, count]) => ({ key, label: key === 'all' ? '全部' : key, count }));
  };

  const filteredMessages = () => {
    if (!session || filter === 'all') return session?.messages || [];
    const typeMap: Record<string, MessageType[]> = {
      '用户': ['user'],
      '助手': ['assistant'],
      '系统': ['system', 'mode', 'file-history'],
      '附件': ['attachment'],
    };
    const types = typeMap[filter] || [];
    return session.messages.filter(m => types.includes(m.type));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="max-w-5xl mx-auto px-4 py-8 animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-8"></div>
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-6"></div>
          <div className="grid grid-cols-6 gap-3 mb-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            ))}
          </div>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🔍</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{error}</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">该会话不存在或已被删除</p>
          <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline">
            ← 返回列表
          </Link>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const summaryForDelete: SessionSummary = {
    sessionId: session.sessionId,
    display: session.display,
    timestamp: session.timestamp,
    project: session.project,
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <SessionHeader session={session} onDelete={() => setShowDelete(true)} />

        {/* Message filter */}
        <MessageFilter
          options={typeCounts()}
          selected={filter}
          onSelect={setFilter}
        />

        {/* Message list */}
        <div className="space-y-3 mb-6">
          {filteredMessages().length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500 text-sm">
              没有匹配的消息类型
            </div>
          ) : (
            filteredMessages().map((msg, idx) => (
              <MessageBubble key={msg.uuid || idx} message={msg} />
            ))
          )}
        </div>

        {/* Raw JSONL viewer */}
        <RawJsonViewer sessionId={session.sessionId} />
      </div>

      {/* Delete Dialog */}
      {showDelete && (
        <DeleteDialog
          session={summaryForDelete}
          onClose={() => setShowDelete(false)}
          onDeleted={() => { window.location.href = '/'; }}
        />
      )}
    </div>
  );
}
```

---

### Task 16: 样式优化（使用 frontend-design skill）

- [ ] **Step 1: 调用 frontend-design skill 对 UI 进行视觉优化**，调整颜色、间距、动效，确保设计一致性和美观度。

---

### Task 17: 最终验证与提交

- [ ] **Step 1: 运行 `npm run build` 确保无错误**
- [ ] **Step 2: 启动开发服务器并手动测试核心功能**
- [ ] **Step 3: 创建最终 git 提交**
