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
