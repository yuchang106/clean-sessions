// src/lib/sessions.ts
import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { rm } from 'fs/promises';
import path from 'path';
import { HistoryEntry, SessionSummary, SessionStats, SessionMessage, SessionDetail, ContentBlock } from './types';

const CLAUDE_DIR = path.join(process.env.HOME || '/Users/yzy', '.claude');
const HISTORY_FILE = path.join(CLAUDE_DIR, 'history.jsonl');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');
const SESSION_ENV_DIR = path.join(CLAUDE_DIR, 'session-env');
const FILE_HISTORY_DIR = path.join(CLAUDE_DIR, 'file-history');

/**
 * 尝试将字符串解析为内容块数组（助手消息的 content blocks 格式）
 */
function tryParseContentBlocks(raw: string): ContentBlock[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].type) {
      // Validate it looks like content blocks
      const validTypes = ['text', 'thinking', 'tool_use', 'tool_result'];
      if (parsed.some((b: Record<string, unknown>) => validTypes.includes(String(b.type)))) {
        return parsed as ContentBlock[];
      }
    }
  } catch {
    // Not JSON
  }
  return null;
}

/**
 * 从内容块数组中提取纯文本内容
 */
function extractTextFromBlocks(blocks: ContentBlock[]): string {
  return blocks
    .filter(b => b.type === 'text' && b.text)
    .map(b => b.text!)
    .join('\n');
}

/**
 * 清理用户消息中的命令/系统 XML 标签
 */
function cleanUserMessage(content: string): string {
  return content
    // 移除 <local-command-caveat>...</local-command-caveat>
    .replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g, '')
    // 移除 <command-name>...</command-name> 及其周围空白
    .replace(/<command-name>[\s\S]*?<\/command-name>/g, '')
    // 移除 <command-message>...</command-message>
    .replace(/<command-message>[\s\S]*?<\/command-message>/g, '')
    // 移除 <command-args>...</command-args>
    .replace(/<command-args>[\s\S]*?<\/command-args>/g, '')
    // 移除 <local-command-stdout>...</local-command-stdout>
    .replace(/<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g, '')
    // 清理多余空白行 打印后的多余空白
    .trim();
}

// 无意义命令集合
const commandSet = new Set([
  '/exit', 'exit', '/quit', 'quit', '/clear', '/new',
  '/resume', '/reload-plugins', '/plugins', '/help',
  '/status', '/config', '/cost', '/effort',
  '1', '2', '3', '4',
]);

function isCommand(display: string): boolean {
  const d = display.trim().toLowerCase();
  if (commandSet.has(d)) return true;
  if (d.startsWith('/') && d.length < 20) return true;
  if (d.length <= 1) return true;
  return false;
}

/**
 * 从项目的 JSONL 文件中解析会话摘要（用于 history.jsonl 中不存在的 VS Code 会话）
 */
function parseSessionSummaryFromFile(filePath: string): SessionSummary | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    let display = '';
    let timestamp = 0;
    let project = '';
    let entrypoint: 'claude-cli' | 'claude-vscode' = 'claude-vscode';
    let sessionId = path.basename(filePath, '.jsonl');

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);

        // sessionId
        if (parsed.sessionId) {
          sessionId = parsed.sessionId;
        }

        // entrypoint — 检查文件中是否明确指定
        if (parsed.entrypoint && parsed.entrypoint !== 'claude-vscode') {
          entrypoint = 'claude-cli';
        }

        // project (cwd)
        if (!project && parsed.cwd) {
          project = path.basename(parsed.cwd);
        }

        // 第一条用户消息作为 display/标题
        if (!display && parsed.type === 'user' && parsed.message?.content) {
          const content = parsed.message.content;
          if (Array.isArray(content) && content[0]?.text) {
            display = content[0].text;
          } else if (typeof content === 'string') {
            const cleaned = cleanUserMessage(content);
            if (!isCommand(cleaned)) {
              display = cleaned;
            }
          }
        }

        // 第一条有效时间戳
        if (!timestamp && parsed.timestamp) {
          if (typeof parsed.timestamp === 'string') {
            timestamp = new Date(parsed.timestamp).getTime();
          } else if (typeof parsed.timestamp === 'number') {
            timestamp = parsed.timestamp;
          }
        }

        // 取到所有需要的数据后提前退出
        if (display && timestamp && project) break;
      } catch {
        continue;
      }
    }

    if (!display && !timestamp) return null;

    return {
      sessionId,
      display: display || '(无标题)',
      timestamp,
      project: project || 'unknown',
      entrypoint,
    };
  } catch {
    return null;
  }
}

/**
 * 获取所有会话列表，同时覆盖 CLI（history.jsonl）和 VS Code（projects 目录）的会话。
 * 按时间戳降序排列。
 */
export function getAllSessions(): SessionSummary[] {
  const sessions: SessionSummary[] = [];
  const historySessionIds = new Set<string>();

  // ---- 1. 从 history.jsonl 读取 CLI 会话 ----
  if (existsSync(HISTORY_FILE)) {
    const content = readFileSync(HISTORY_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    // 按 sessionId 分组
    const sessionGroups = new Map<string, HistoryEntry[]>();
    for (const line of lines) {
      try {
        const entry: HistoryEntry = JSON.parse(line);
        const group = sessionGroups.get(entry.sessionId) || [];
        group.push(entry);
        sessionGroups.set(entry.sessionId, group);
      } catch {
        continue;
      }
    }

    for (const [, entries] of sessionGroups) {
      entries.sort((a, b) => a.timestamp - b.timestamp);

      const best = entries.find(e => !isCommand(e.display)) || entries[0];
      const latest = entries[entries.length - 1];

      sessions.push({
        sessionId: latest.sessionId,
        display: best.display,
        timestamp: latest.timestamp,
        project: path.basename(latest.project),
        entrypoint: 'claude-cli',
      });

      historySessionIds.add(latest.sessionId);
    }
  }

  // ---- 2. 扫描 projects 目录，找出 VS Code 生成的额外会话 ----
  if (existsSync(PROJECTS_DIR)) {
    const projectDirs = readdirSync(PROJECTS_DIR);
    for (const projectDir of projectDirs) {
      const projectPath = path.join(PROJECTS_DIR, projectDir);
      try {
        const files = readdirSync(projectPath).filter(f => f.endsWith('.jsonl'));
        for (const file of files) {
          const sessionId = file.replace('.jsonl', '');
          if (!historySessionIds.has(sessionId)) {
            const summary = parseSessionSummaryFromFile(path.join(projectPath, file));
            if (summary) {
              sessions.push(summary);
            }
          }
        }
      } catch {
        continue;
      }
    }
  }

  // ---- 3. 按时间戳降序排列 ----
  sessions.sort((a, b) => b.timestamp - a.timestamp);
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

      // 跳过不可展示的元数据类型
      if (['ai-title', 'last-prompt', 'permission-mode'].includes(parsed.type)) {
        continue;
      }

      if (parsed.type === 'user' && parsed.message) {
        msg.role = 'user';
        const rawContent = typeof parsed.message.content === 'string'
          ? parsed.message.content
          : JSON.stringify(parsed.message.content);

        // 尝试解析 tool_result 内容块
        const blocks = tryParseContentBlocks(rawContent);
        if (blocks) {
          msg.contentBlocks = blocks;
          msg.content = blocks
            .filter(b => b.type === 'tool_result')
            .map(b => {
              const c = b.content;
              if (Array.isArray(c)) return c.join('\n');
              if (typeof c === 'string') return c;
              return JSON.stringify(c, null, 2);
            })
            .join('\n');
          if (!msg.content) msg.content = '(tool result)';
        } else {
          // 清理命令标签，保留有意义的内容
          const cleaned = cleanUserMessage(rawContent);
          msg.content = cleaned || undefined;
        }
      } else if (parsed.type === 'assistant' && parsed.message) {
        msg.role = 'assistant';
        const rawContent = typeof parsed.message.content === 'string'
          ? parsed.message.content
          : JSON.stringify(parsed.message.content);

        // 解析 content blocks（text/thinking/tool_use）
        const blocks = tryParseContentBlocks(rawContent);
        if (blocks) {
          msg.contentBlocks = blocks;
          msg.content = extractTextFromBlocks(blocks);
          if (!msg.content) msg.content = '';
        } else {
          msg.content = rawContent;
        }
      } else if (parsed.type === 'attachment') {
        msg.role = 'attachment';
        const attachmentType = parsed.attachment?.type || parsed.attachment?.hookName || 'attachment';
        msg.content = typeof parsed.attachment?.content === 'string'
          ? parsed.attachment.content
          : parsed.attachment?.content
            ? JSON.stringify(parsed.attachment.content, null, 2)
            : attachmentType;
      } else if (parsed.type === 'system') {
        msg.role = parsed.subtype || 'system';
        msg.content = parsed.content || '';
      } else if (parsed.type === 'mode') {
        msg.content = `Mode: ${parsed.mode}`;
      } else if (parsed.type === 'file-history-snapshot') {
        msg.content = 'File history snapshot';
      }

      // 截取内容预览
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
    entrypoint: summary?.entrypoint || 'claude-cli',
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
 * 删除会话（JSONL 文件、session-env 目录、file-history 目录）
 * 注意：history.jsonl 的清理由 history.ts 处理
 */
export async function deleteSessionFiles(sessionId: string): Promise<{ jsonl: boolean; sessionEnv: boolean; fileHistory: boolean }> {
  const result = { jsonl: false, sessionEnv: false, fileHistory: false };

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

  // 删除 file-history 目录
  const fileHistoryDir = path.join(FILE_HISTORY_DIR, sessionId);
  if (existsSync(fileHistoryDir)) {
    try {
      await rm(fileHistoryDir, { recursive: true, force: true });
      result.fileHistory = true;
    } catch {
      result.fileHistory = false;
    }
  }

  return result;
}
