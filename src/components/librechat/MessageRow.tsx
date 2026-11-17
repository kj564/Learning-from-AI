'use client';

/**
 * Single message row — chat.z.ai-style:
 *
 *   - User: right-aligned bubble, bg-surface-user-message, attachments shown above
 *   - Assistant: full width, avatar + name header, rich inline content:
 *       1. Web search results panel (collapsible "Searched the web")
 *       2. Tool execution cards
 *       3. Generated image cards (with download/regenerate/lightbox)
 *       4. Markdown content (text)
 *       5. Audio widget (TTS read-aloud cache or voice reply)
 *   - Hover toolbar (assistant only): Copy, Read-aloud, Regenerate
 */

import { useState, useEffect } from 'react';
import {
  Copy, Check, RefreshCw, Wrench, Sparkles, FileText, Code, Terminal,
  Search, FolderPlus, BookOpen, Package, Link2, ChevronRight, Image as ImageIcon,
} from 'lucide-react';
import type { ChatMessage, GeneratedImageRef } from '@/lib/store';
import { useStore } from '@/lib/store';
import Markdown from './Markdown';
import WebSearchResultsPanel from './WebSearchResultsPanel';
import GeneratedImageCard from './GeneratedImageCard';
import AttachmentThumbs from './AttachmentThumbs';
import AudioMessageWidget from './AudioMessageWidget';
import ReadAloudButton from './ReadAloudButton';

const TOOL_ICONS: Record<string, { icon: typeof Wrench; color: string }> = {
  file_write: { icon: FileText, color: 'text-status-info' },
  file_read: { icon: FileText, color: 'text-status-info' },
  file_list: { icon: FileText, color: 'text-status-info' },
  file_delete: { icon: FileText, color: 'text-status-error' },
  code_run: { icon: Code, color: 'text-status-success' },
  shell_run: { icon: Terminal, color: 'text-status-success' },
  npm_install: { icon: Package, color: 'text-status-warning' },
  web_search: { icon: Search, color: 'text-accent-primary' },
  image_generate: { icon: ImageIcon, color: 'text-status-info' },
  image_search: { icon: ImageIcon, color: 'text-accent-primary' },
  knowledge_search: { icon: BookOpen, color: 'text-accent-primary' },
  project_create: { icon: FolderPlus, color: 'text-status-info' },
  canva_mcp: { icon: Link2, color: 'text-accent-primary' },
};

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
    tool === 'image_generate' ? `draw ${String(args.prompt || '').slice(0, 40)}` :
    tool === 'image_search' ? `find ${args.query}` :
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
  convoId?: string;
  onRegenerateImage?: (img: GeneratedImageRef) => void;
}

function timeLabel(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MessageRow({ message, isLast, onRegenerate, convoId, onRegenerateImage }: MessageRowProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

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

  // === User message ===
  if (isUser) {
    return (
      <div className="group mx-auto flex w-full max-w-3xl flex-row justify-end gap-2 xl:max-w-4xl">
        <div className="flex min-w-0 max-w-[85%] flex-col items-end">
          {message.attachments && message.attachments.length > 0 && (
            <AttachmentThumbs attachments={message.attachments} />
          )}
          {message.audio && (
            <AudioMessageWidget
              audioUrl={message.audio.url}
              messageId={message.id}
              title="Voice message"
            />
          )}
          {message.content && (
            <div className="bg-surface-user-message text-text-primary w-fit rounded-2xl rounded-ee-md px-3 py-2.5 text-sm">
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            </div>
          )}
          <div className="text-text-tertiary mt-1 hidden text-xs group-hover:block">
            {timeLabel(message.createdAt)}
          </div>
        </div>
      </div>
    );
  }

  // === Assistant message ===
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
              {/* 1. Web search results panel */}
              {message.webSearch && message.webSearch.results.length > 0 && (
                <WebSearchResultsPanel
                  query={message.webSearch.query}
                  results={message.webSearch.results}
                />
              )}

              {/* 2. Tool execution cards */}
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

              {/* 3. Generated images */}
              {message.images && message.images.length > 0 && (
                <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {message.images.map((img) => (
                    <GeneratedImageCard
                      key={img.id}
                      image={img}
                      onRegenerate={onRegenerateImage}
                    />
                  ))}
                </div>
              )}

              {/* 4. Markdown content */}
              {message.content ? (
                <Markdown content={message.content} streaming={message.streaming} />
              ) : !message.toolExecutions?.length && !message.images?.length && !message.webSearch ? (
                <span className="text-text-tertiary text-xs italic">(no text response)</span>
              ) : null}

              {/* 5. Audio widget (TTS cache or voice reply) */}
              {message.audio && (
                <AudioMessageWidget
                  audioUrl={message.audio.url}
                  messageId={message.id}
                  title="Read-aloud"
                />
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
            {convoId && message.content && (
              <ReadAloudButton convoId={convoId} messageId={message.id} content={message.content} />
            )}
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
