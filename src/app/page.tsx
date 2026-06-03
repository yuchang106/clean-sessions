// src/app/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import SessionStats from '@/components/SessionStats';
import SessionFilter from '@/components/SessionFilter';
import SessionTable from '@/components/SessionTable';
import Pagination from '@/components/Pagination';
import DeleteDialog from '@/components/DeleteDialog';
import { SessionSummary, SessionStats as Stats } from '@/lib/types';

const PAGE_SIZE = 20;

export default function HomePage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedProject, setSelectedProject] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SessionSummary | null>(null);
  const [projects, setProjects] = useState<string[]>([]);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: PAGE_SIZE.toString(),
      });
      if (selectedProject) params.set('project', selectedProject);
      if (searchQuery) params.set('search', searchQuery);

      const res = await fetch(`/api/sessions?${params}`);
      if (!res.ok) throw new Error(`请求失败: ${res.status}`);
      const data = await res.json();
      setSessions(data.sessions);
      setStats(data.stats);
      setTotal(data.total);

      if (projects.length === 0 && data.stats) {
        const allRes = await fetch('/api/sessions?pageSize=500');
        const allData = await allRes.json() as { sessions: { project: string }[] };
        const projSet = new Set(allData.sessions.map(s => s.project));
        setProjects(Array.from(projSet).sort());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取数据失败');
    } finally {
      setLoading(false);
    }
  }, [page, selectedProject, searchQuery]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const handleDeleted = () => {
    fetchSessions();
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Claude Code 会话管理</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">管理所有项目的 Claude Code 会话</p>
          </div>
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索会话..."
              className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-60"
            />
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              搜索
            </button>
          </form>
        </div>

        {/* Stats */}
        <SessionStats stats={stats} loading={loading} />

        {/* Filter */}
        <SessionFilter
          projects={projects}
          selectedProject={selectedProject}
          onSelect={(project) => { setSelectedProject(project); setPage(1); }}
        />

        {/* Error */}
        {error && (
          <div className="p-4 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
            {error}
            <button onClick={fetchSessions} className="ml-2 underline">重试</button>
          </div>
        )}

        {/* Table */}
        <SessionTable sessions={sessions} loading={loading} onDelete={setDeleteTarget} />

        {/* Pagination */}
        <Pagination
          currentPage={page}
          totalPages={Math.ceil(total / PAGE_SIZE)}
          total={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>

      {/* Delete Dialog */}
      {deleteTarget && (
        <DeleteDialog
          session={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
