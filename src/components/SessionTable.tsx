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
                      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-200/50 dark:ring-indigo-500/20">
                    {session.project}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <Link
                      href={`/sessions/${session.sessionId}`}
                      className="px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all duration-150"
                    >
                      详情
                    </Link>
                    <button
                      onClick={() => onDelete(session)}
                      className="px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20 transition-all duration-150"
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
