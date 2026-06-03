// src/app/api/sessions/[id]/raw/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSessionRaw } from '@/lib/sessions';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const raw = getSessionRaw(id);

    if (!raw) {
      return NextResponse.json({ error: '会话未找到' }, { status: 404 });
    }

    return new NextResponse(raw, {
      headers: {
        'Content-Type': 'application/jsonl',
        'Content-Disposition': `attachment; filename="${id}.jsonl"`,
      },
    });
  } catch (error) {
    console.error('获取原始 JSONL 失败:', error);
    return NextResponse.json(
      { error: '获取原始 JSONL 失败' },
      { status: 500 }
    );
  }
}
