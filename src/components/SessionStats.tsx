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
    { label: '总会话数', value: stats.total.toString(), icon: '💬', accent: 'from-indigo-500/5 to-purple-500/5' },
    { label: '项目数', value: stats.projects.toString(), icon: '📁', accent: 'from-emerald-500/5 to-teal-500/5' },
    { label: '今日会话', value: stats.todayCount.toString(), icon: '📅', accent: 'from-amber-500/5 to-orange-500/5' },
    { label: '占用空间', value: stats.totalSize, icon: '📦', accent: 'from-blue-500/5 to-cyan-500/5' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {cards.map((card) => (
        <div
          key={card.label}
          className="group relative bg-white dark:bg-gray-800/80 rounded-xl border border-gray-200/80 dark:border-gray-700/50 p-4 hover:shadow-lg hover:shadow-indigo-500/5 dark:hover:shadow-indigo-500/10 transition-all duration-200 overflow-hidden"
        >
          <div className={`absolute inset-0 bg-linear-to-br ${card.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">{card.label}</span>
              <span className="text-lg">{card.icon}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">{card.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
