// src/app/api/sessions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAllSessions, getSessionStats } from '@/lib/sessions';
import { SessionsResponse } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20')));
    const project = searchParams.get('project') || '';
    const search = searchParams.get('search') || '';

    let sessions = getAllSessions();
    const stats = getSessionStats();

    // 按项目筛选
    if (project) {
      sessions = sessions.filter(s => s.project === project);
    }

    // 按关键词搜索（在 display 和 sessionId 中搜索）
    if (search) {
      const keyword = search.toLowerCase();
      sessions = sessions.filter(
        s => s.display.toLowerCase().includes(keyword) || s.sessionId.toLowerCase().includes(keyword)
      );
    }

    const total = sessions.length;
    const start = (page - 1) * pageSize;
    const pagedSessions = sessions.slice(start, start + pageSize);

    const response: SessionsResponse = {
      sessions: pagedSessions,
      stats,
      total,
      page,
      pageSize,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('获取会话列表失败:', error);
    return NextResponse.json(
      { error: '获取会话列表失败', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
