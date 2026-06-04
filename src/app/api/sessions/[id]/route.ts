// src/app/api/sessions/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSessionDetail, deleteSessionFiles } from '@/lib/sessions';
import { removeHistoryEntries } from '@/lib/history';
import { DeleteResult } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const detail = getSessionDetail(id);

    if (!detail) {
      return NextResponse.json({ error: '会话未找到' }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    console.error('获取会话详情失败:', error);
    return NextResponse.json(
      { error: '获取会话详情失败', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. 删除 JSONL 文件和 session-env 目录
    const fileResult = await deleteSessionFiles(id);

    // 2. 清理 history.jsonl 中的关联条目
    const historyCount = removeHistoryEntries(id);

    const result: DeleteResult = {
      success: true,
      deleted: {
        jsonl: fileResult.jsonl,
        sessionEnv: fileResult.sessionEnv,
        fileHistory: fileResult.fileHistory,
        historyEntries: historyCount,
      },
    };

    // 如果什么都没删掉，认为失败
    if (!fileResult.jsonl && !fileResult.sessionEnv && !fileResult.fileHistory && historyCount === 0) {
      result.success = false;
      result.error = '未找到任何关联的会话数据';
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('删除会话失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      } as DeleteResult,
      { status: 500 }
    );
  }
}
