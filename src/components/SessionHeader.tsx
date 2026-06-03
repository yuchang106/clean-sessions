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
