'use client';

/**
 * Messages view — LibreChat faithful:
 *   - pt-14 (header clearance) pb-9 (composer clearance)
 *   - Welcome screen when no messages (centered avatar + greeting + starter prompts)
 *   - Scrollable list of MessageRow
 *   - Auto-scroll to bottom when new messages arrive
 *   - Scroll-to-bottom button when not at bottom
 */

import { useEffect, useRef, useState } from 'react';
import { ArrowDown, Sparkles, FileText, Code, Lightbulb, PenLine } from 'lucide-react';
import { useStore } from '@/lib/store';
import type { ChatMessage } from '@/lib/store';
import MessageRow from './MessageRow';

// Stable empty array reference — avoids zustand's useSyncExternalStore warning
// "The result of getServerSnapshot should be cached to avoid an infinite loop"
// when returning `|| []` (a new array literal each render).
const EMPTY_MESSAGES: ChatMessage[] = [];

const STARTERS = [
  { icon: PenLine, label: 'Write a story', prompt: 'Write a short story about a robot learning to dream.' },
  { icon: Code, label: 'Explain code', prompt: 'Explain how a Promise works in JavaScript, with examples.' },
  { icon: FileText, label: 'Summarize text', prompt: 'Summarize the key ideas of atomic habits in 5 bullet points.' },
  { icon: Lightbulb, label: 'Brainstorm ideas', prompt: 'Brainstorm 10 unique ideas for a mobile app for book lovers.' },
];

function WelcomeScreen({ onPick }: { onPick: (p: string) => void }) {
  return (
    <div className="flex h-full transform-gpu flex-col items-center justify-center gap-6 px-4 pb-16">
      <div className="bg-surface-active-alt flex size-12 items-center justify-center rounded-full">
        <Sparkles size={24} className="text-accent-primary" />
      </div>
      <div className="text-center">
        <h1 className="text-text-primary text-2xl font-semibold sm:text-3xl">How can I help you today?</h1>
        <p className="text-text-secondary mt-2 max-w-md text-sm">
          Ask anything, or pick a starter below. I can write, code, summarize, brainstorm, and more — and I can use tools to do it for real.
        </p>
      </div>
      <div className="grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
        {STARTERS.map((s) => (
          <button
            key={s.label}
            onClick={() => onPick(s.prompt)}
            className="border-border-light bg-surface-chat hover:bg-surface-active-alt group flex items-start gap-3 rounded-xl border p-3 text-start transition"
          >
            <s.icon size={18} className="text-accent-primary mt-0.5 shrink-0" />
            <div>
              <div className="text-text-primary text-sm font-medium">{s.label}</div>
              <div className="text-text-tertiary line-clamp-2 text-xs">{s.prompt}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function MessagesView({ onRegenerate }: { onRegenerate: () => void }) {
  const activeConversationId = useStore((s) => s.activeConversationId);
  const messages = useStore((s) =>
    activeConversationId ? (s.messagesByConversation[activeConversationId] ?? EMPTY_MESSAGES) : EMPTY_MESSAGES
  );
  const isGenerating = useStore((s) => s.isGenerating);
  const setComposerText = useStore((s) => s.setComposerText);

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);

  // Auto-scroll to bottom when new messages arrive (only if already at bottom)
  useEffect(() => {
    if (!scrollRef.current) return;
    if (atBottom) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isGenerating, atBottom]);

  // Track whether user is at bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const threshold = 80;
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      setAtBottom(distance < threshold);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      setAtBottom(true);
    }
  };

  return (
    <div className="relative flex-1 overflow-hidden">
      <div ref={scrollRef} className="scrollbar-gutter-stable h-full overflow-y-auto overflow-x-hidden">
        <div ref={contentRef} className="flex min-h-full flex-col pt-14 pb-9">
          {messages.length === 0 ? (
            <WelcomeScreen onPick={(p) => setComposerText(p)} />
          ) : (
            <div className="flex flex-col gap-6 px-4 py-4">
              {messages.map((m, i) => (
                <MessageRow
                  key={m.id}
                  message={m}
                  isLast={i === messages.length - 1}
                  onRegenerate={onRegenerate}
                />
              ))}
              {isGenerating && messages[messages.length - 1]?.role === 'user' && (
                <div className="mx-auto flex w-full max-w-3xl gap-3 xl:max-w-4xl">
                  <div className="bg-surface-active-alt flex size-6 shrink-0 items-center justify-center self-start rounded-full">
                    <Sparkles size={14} className="text-accent-primary" />
                  </div>
                  <div className="text-text-secondary flex items-center gap-2 text-sm">
                    <span className="inline-flex gap-1">
                      <span className="bg-text-tertiary h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.3s]" />
                      <span className="bg-text-tertiary h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:-0.15s]" />
                      <span className="bg-text-tertiary h-1.5 w-1.5 animate-bounce rounded-full" />
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Scroll to bottom button */}
      {!atBottom && (
        <button
          onClick={scrollToBottom}
          aria-label="Scroll to bottom"
          className="bg-surface-popover border-border-light text-text-primary absolute bottom-4 start-1/2 z-10 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border shadow-lg transition hover:bg-surface-active"
        >
          <ArrowDown size={16} />
        </button>
      )}
    </div>
  );
}
