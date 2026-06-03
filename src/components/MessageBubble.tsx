// src/components/MessageBubble.tsx
'use client';

import { useState } from 'react';
import { SessionMessage } from '@/lib/types';

interface MessageBubbleProps {
  message: SessionMessage;
}

const typeConfig: Record<string, { icon: string; color: string; label: string; bgColor: string; borderColor: string }> = {
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
        <div className="flex items-center justify-between px-4 py-2 border-b border-inherit">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{config.label}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {message.timestamp ? new Date(message.timestamp).toLocaleString('zh-CN') : ''}
          </span>
        </div>
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
