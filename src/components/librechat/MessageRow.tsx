'use client';

/**
 * Single message row — LibreChat faithful:
 *
 *   - User: right-aligned bubble, bg-surface-user-message, rounded-2xl (small bottom-end corner)
 *   - Assistant: full width, no bubble; avatar + name header; Markdown content
 *   - Hover toolbar (assistant only): Copy, Edit (disabled), Regenerate
 *   - Tool executions: small badge below content
 *   - Timestamp on the side
 */

import { useState, useEffect } from 'react';
import {
  Copy, Check, RefreshCw, Wrench, Sparkles, FileText, Code, Terminal,
  Search, FolderPlus, BookOpen, Package, Link2, ChevronRight,
} from 'lucide-react';
import type { ChatMessage } from '@/lib/store';
import Markdown from './Markdown';

/** Map tool name → icon + accent color (for inline tool_use display, bolt.diy-style). */
const TOOL_ICONS: Record<string, { icon: typeof Wrench; color: string }> = {
  file_write: { icon: FileText, color: 'text-status-info' },
  file_read: { icon: FileText, color: 'text-status-info' },
  file_list: { icon: FileText, color: 'text-status-info' },
  file_delete: { icon: FileText, color: 'text-status-error' },
  code_run: { icon: Code, color: 'text-status-success' },
  shell_run: { icon: Terminal, color: 'text-status-success' },
  npm_install: { icon: Package, color: 'text-status-warning' },
  web_search: { icon: Search, color: 'text-accent-primary' },
  knowledge_search: { icon: BookOpen, color: 'text-accent-primary' },
  project_create: { icon: FolderPlus, color: 'text-status-info' },
  canva_mcp: { icon: Link2, color: 'text-accent-primary' },
};

/** Inline tool execution card — shown above the assistant's text response. */
function ToolExecutionCard({ tool, args, success }: { tool: string; args: Record<string, unknown>; success: boolean }) {
  const meta = TOOL_ICONS[tool] || { icon: Wrench, color: 'text-text-secondary' };
  const Icon = meta.icon;
  const summary =
    tool === 'file_write' ? `write ${args.path}` :
    tool === 'file_read' ? `read ${args.path}` :
    tool === 'file_list' ? `list ${args.dir || '.'}` :
    tool === 'file_delete' ? `delete ${args.path}` :
    tool === 'code_run' ? `run ${(args.language as string) || 'javascript'}` :
    tool === 'shell_run' ? `run ${String(args.command || '').slice(0, 40)}` :
    tool === 'npm_install' ? `install ${(args.packages as string[] || []).join(' ')}` :
    tool === 'web_search' ? `search ${args.query}` :
    tool === 'knowledge_search' ? `kb search: ${args.query}` :
    tool === 'project_create' ? `scaffold ${args.name}` :
    tool === 'canva_mcp' ? 'canva call' :
    tool;

  return (
    <div className={`border ${success ? 'border-border-light' : 'border-status-error/40'} bg-surface-code rounded-md px-2 py-1.5 text-xs`}>
      <div className="flex items-center gap-1.5">
        <Icon size={12} className={`${meta.color} shrink-0`} />
        <span className="text-text-primary font-mono">{tool}</span>
        <ChevronRight size={10} className="text-text-tertiary" />
        <span className="text-text-tertiary truncate font-mono">{summary}</span>
        <span className={`ms-auto shrink-0 ${success ? 'text-status-success' : 'text-status-error'}`}>
          {success ? '✓' : '✗'}
        </span>
      </div>
    </div>
  );
}

interface MessageRowProps {
  message: ChatMessage;
  isLast: boolean;
  onRegenerate?: () => void;
}

function timeLabel(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MessageRow({ message, isLast, onRegenerate }: MessageRowProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
    } catch {
      // ignore
    }
  };

  if (isUser) {
    return (
      <div className="group mx-auto flex w-full max-w-3xl flex-row justify-end gap-2 xl:max-w-4xl">
        <div className="flex min-w-0 flex-1 flex-col items-end">
          <div className="bg-surface-user-message text-text-primary w-fit max-w-[85%] rounded-2xl rounded-ee-md px-3 py-2.5 text-sm">
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          </div>
          <div className="text-text-tertiary mt-1 hidden text-xs group-hover:block">
            {timeLabel(message.createdAt)}
          </div>
        </div>
      </div>
    );
  }

  // Assistant
  return (
    <div className="group mx-auto flex w-full max-w-3xl flex-1 gap-3 xl:max-w-4xl">
      {/* Avatar */}
      <div className="bg-surface-active-alt flex size-6 shrink-0 items-center justify-center self-start rounded-full">
        <Sparkles size={14} className="text-accent-primary" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Author header */}
        <h2 className="text-text-primary mb-1 flex min-h-7 items-center gap-2 text-sm font-semibold">
          Assistant
          <span className="text-text-tertiary ms-auto shrink-0 text-xs font-normal">
            {timeLabel(message.createdAt)}
          </span>
        </h2>

        {/* Body */}
        <div className="text-text-primary min-w-0">
          {message.pending ? (
            <div className="text-text-secondary flex items-center gap-2 text-sm">
              <RefreshCw size={14} className="animate-spin" />
              <span>Thinking…</span>
            </div>
          ) : message.error ? (
            <div className="text-status-error border-status-error/40 bg-status-error/10 rounded-md border px-3 py-2 text-sm">
              {message.error}
            </div>
          ) : (
            <>
              {/* Inline tool executions — bolt.diy-style cards above the content */}
              {message.toolExecutions && message.toolExecutions.length > 0 && (
                <div className="mb-2 space-y-1">
                  {message.toolExecutions.map((t, i) => (
                    <ToolExecutionCard
                      key={i}
                      tool={t.tool}
                      args={t.args}
                      success={t.success}
                    />
                  ))}
                </div>
              )}
              {message.content ? (
                <Markdown content={message.content} streaming={message.streaming} />
              ) : message.toolExecutions && message.toolExecutions.length > 0 ? null : (
                <span className="text-text-tertiary text-xs italic">(no text response)</span>
              )}
            </>
          )}
        </div>

        {/* Hover toolbar */}
        {!message.pending && !message.error && (
          <div className="mt-2 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
            <button
              onClick={copy}
              title={copied ? 'Copied' : 'Copy'}
              className="text-text-tertiary hover:bg-surface-active hover:text-text-primary flex h-7 w-7 items-center justify-center rounded-md"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
            {isLast && onRegenerate && (
              <button
                onClick={onRegenerate}
                title="Regenerate response"
                className="text-text-tertiary hover:bg-surface-active hover:text-text-primary flex h-7 w-7 items-center justify-center rounded-md"
              >
                <RefreshCw size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
