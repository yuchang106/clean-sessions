// src/components/SessionStats.tsx
'use client';

import { SessionStats as Stats } from '@/lib/types';

interface SessionStatsProps {
  stats: Stats | null;
  loading: boolean;
}

export default function SessionStats({ stats, loading }: SessionStatsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-2"></div>
            <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    { label: '总会话数', value: stats.total.toString(), icon: '💬' },
    { label: '项目数', value: stats.projects.toString(), icon: '📁' },
    { label: '今日会话', value: stats.todayCount.toString(), icon: '📅' },
    { label: '占用空间', value: stats.totalSize, icon: '📦' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">{card.label}</span>
            <span className="text-lg">{card.icon}</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{card.value}</div>
        </div>
      ))}
    </div>
  );
}
