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
