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
