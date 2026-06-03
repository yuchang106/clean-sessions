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
                <p className="text-red-800 dark:text-red-300"><strong>会话信息：</strong></p>
                <p className="text-red-700 dark:text-red-400 mt-1">{session.display}</p>
                <p className="text-red-600 dark:text-red-500 font-mono text-xs mt-1">Session: {session.sessionId}</p>
                <p className="text-red-600 dark:text-red-400 text-xs mt-0.5">项目: {session.project}</p>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 flex justify-end gap-3">
              <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">取消</button>
              <button onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors">确认删除</button>
            </div>
          </>
        )}

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

        {stage === 'result' && (
          <div className="p-6 text-center">
            {error ? (
              <>
                <div className="text-4xl mb-3">❌</div>
                <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">删除失败</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{error}</p>
                <button onClick={handleDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 mr-2">重试</button>
                <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600">关闭</button>
              </>
            ) : (
              <>
                <div className="text-4xl mb-3">✅</div>
                <h2 className="text-lg font-semibold text-green-600 dark:text-green-400 mb-2">会话已成功删除</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">已清理 {result?.deleted.historyEntries} 项关联数据</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
