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
      <summary className="px-4 py-3 bg-gray-50 dark:bg-gray-800 text-sm font-medium text-indigo-600 dark:text-indigo-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors select-none">
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
