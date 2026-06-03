// src/app/sessions/[id]/page.tsx
'use client';

import { useEffect, useState, use } from 'react';
import SessionHeader from '@/components/SessionHeader';
import MessageFilter from '@/components/MessageFilter';
import MessageBubble from '@/components/MessageBubble';
import RawJsonViewer from '@/components/RawJsonViewer';
import DeleteDialog from '@/components/DeleteDialog';
import Link from 'next/link';
import { SessionDetail, SessionSummary } from '@/lib/types';
import { MessageType } from '@/lib/types';

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
            {[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>)}
          </div>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>)}
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
          <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline">← 返回列表</Link>
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

        <MessageFilter
          options={typeCounts()}
          selected={filter}
          onSelect={setFilter}
        />

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

        <RawJsonViewer sessionId={session.sessionId} />
      </div>

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
