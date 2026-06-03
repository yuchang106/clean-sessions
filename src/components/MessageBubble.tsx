// src/components/MessageBubble.tsx
'use client';

import { useState } from 'react';
import { SessionMessage, ContentBlock } from '@/lib/types';

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

/** 格式化 JSON 为可读字符串 */
function formatJSON(input: unknown): string {
  if (typeof input === 'string') {
    try { return JSON.stringify(JSON.parse(input), null, 2); }
    catch { return input; }
  }
  return JSON.stringify(input, null, 2);
}

/** 渲染 text 内容块 */
function TextBlock({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
      {text}
    </div>
  );
}

/** 渲染 thinking 内容块（默认折叠） */
function ThinkingBlock({ thinking }: { thinking: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mt-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <span className={`transform transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
        <span>{open ? 'Claude 的思考过程' : '显示 Claude 的思考过程'}</span>
        <span className="ml-auto text-gray-400 dark:text-gray-500">{thinking.length} 字符</span>
      </button>
      {open && (
        <pre className="text-xs text-gray-600 dark:text-gray-400 p-3 bg-gray-50 dark:bg-gray-900/50 whitespace-pre-wrap font-sans leading-relaxed max-h-64 overflow-y-auto">
          {thinking}
        </pre>
      )}
    </div>
  );
}

/** 渲染 tool_use 内容块（工具调用） */
function ToolUseBlock({ block }: { block: ContentBlock }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mt-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs bg-amber-50 dark:bg-amber-900/10 hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-colors"
      >
        <span className="text-amber-600 dark:text-amber-400">🔧</span>
        <span className="font-mono font-medium text-amber-800 dark:text-amber-300">{block.name || 'tool'}</span>
        {block.input ? (
          <span className="ml-auto text-amber-600 dark:text-amber-400">
            {open ? '收起' : '查看参数'}
          </span>
        ) : null}
      </button>
      {open && block.input != null && (
        <pre className="text-xs text-gray-600 dark:text-gray-400 p-3 bg-gray-50 dark:bg-gray-900/50 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto border-t border-gray-200 dark:border-gray-700">
          {formatJSON(block.input)}
        </pre>
      )}
    </div>
  );
}

/** 将未知值转为字符串 */
function stringify(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(stringify).join('\n');
  if (value && typeof value === 'object') {
    // Check for structured content
    const arr = Array.isArray(value) ? value : [value];
    return arr.map((item: unknown) => {
      const obj = item as Record<string, unknown>;
      if (obj?.type === 'text') return stringify(obj.text);
      if (obj?.type === 'tool_result') return stringify(obj.content);
      if (obj?.type === 'tool_use') return `Tool: ${obj.name} - ${stringify(obj.input)}`;
      return JSON.stringify(obj, null, 2);
    }).join('\n');
  }
  return String(value ?? '');
}

/** 渲染 tool_result 内容块（工具调用结果） */
function ToolResultBlock({ block }: { block: ContentBlock }) {
  const [open, setOpen] = useState(false);
  const content = stringify(block.content);

  if (!content.trim()) return null;

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden mt-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <span className={`transform transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
        <span>{open ? '收起工具结果' : '展开工具结果'}</span>
        <span className="ml-auto font-mono text-gray-400">{content.length} 字符</span>
      </button>
      {open && (
        <pre className="text-xs text-gray-100 p-3 bg-gray-900 dark:bg-black whitespace-pre-wrap font-mono leading-relaxed max-h-96 overflow-y-auto border-t border-gray-700">
          {content}
        </pre>
      )}
    </div>
  );
}

/** 渲染内容块列表 */
function ContentBlocks({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className="space-y-2">
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'text':
            return <TextBlock key={idx} text={block.text || ''} />;
          case 'thinking':
            return <ThinkingBlock key={idx} thinking={block.thinking || ''} />;
          case 'tool_use':
            return <ToolUseBlock key={idx} block={block} />;
          case 'tool_result':
            return <ToolResultBlock key={idx} block={block} />;
          default:
            return null;
        }
      })}
    </div>
  );
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const [expanded, setExpanded] = useState(false);
  const config = typeConfig[message.type] || typeConfig.system;
  const isMeta = message.type === 'mode' || message.type === 'file-history';
  const isMinimalSystem = message.type === 'system' && !message.content;

  // 元消息：精简显示
  if (isMeta || isMinimalSystem) {
    return (
      <div className="flex gap-3 items-start">
        <div className={`w-7 h-7 rounded-full ${config.color} text-white flex items-center justify-center text-xs font-bold shrink-0`}>
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

  // 完整消息气泡
  return (
    <div className="flex gap-3 items-start">
      <div className={`w-7 h-7 rounded-full ${config.color} text-white flex items-center justify-center text-xs font-bold shrink-0`}>
        {config.icon}
      </div>
      <div className={`flex-1 border ${config.borderColor} ${config.bgColor} rounded-lg overflow-hidden`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-inherit">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{config.label}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {message.timestamp ? new Date(message.timestamp).toLocaleString('zh-CN') : ''}
          </span>
        </div>

        {/* Content */}
        <div className="px-4 py-3 space-y-2">
          {/* 内容块渲染（优先） */}
          {message.contentBlocks && message.contentBlocks.length > 0 ? (
            <ContentBlocks blocks={message.contentBlocks} />
          ) : message.type === 'attachment' ? (
            /* 附件内容（可折叠） */
            <div>
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline mb-1 font-medium"
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
            /* 纯文本内容 */
            <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
              {message.content || '(空)'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
