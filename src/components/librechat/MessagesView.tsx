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
import { ArrowDown, Sparkles, FileText, Code, Lightbulb, PenLine, Image as ImageIcon, Globe, Search } from 'lucide-react';
import { useStore } from '@/lib/store';
import type { ChatMessage } from '@/lib/store';
import MessageRow from './MessageRow';

// Stable empty array reference — avoids zustand's useSyncExternalStore warning
// "The result of getServerSnapshot should be cached to avoid an infinite loop"
// when returning `|| []` (a new array literal each render).
const EMPTY_MESSAGES: ChatMessage[] = [];

const STARTERS = [
  { icon: ImageIcon, label: 'Generate image', prompt: 'Generate an image of a serene mountain landscape at sunset, watercolor style', accent: 'text-status-info' },
  { icon: Globe, label: 'Search the web', prompt: 'Search the web for the latest news about AI and summarize the top 3 stories', accent: 'text-accent-primary' },
  { icon: Code, label: 'Write code', prompt: 'Write a Python function that checks if a string is a palindrome, with tests', accent: 'text-status-success' },
  { icon: PenLine, label: 'Write a story', prompt: 'Write a short story about a robot learning to dream', accent: 'text-status-warning' },
  { icon: Lightbulb, label: 'Brainstorm', prompt: 'Brainstorm 10 unique ideas for a mobile app for book lovers', accent: 'text-accent-primary' },
  { icon: FileText, label: 'Summarize', prompt: 'Summarize the key ideas of Atomic Habits in 5 bullet points', accent: 'text-status-info' },
];

function WelcomeScreen({ onPick }: { onPick: (p: string) => void }) {
  return (
    <div className="flex h-full transform-gpu flex-col items-center justify-center gap-8 px-4 pb-24 pt-14">
      <div className="flex flex-col items-center gap-4">
        <div className="bg-surface-active-alt flex size-14 items-center justify-center rounded-2xl">
          <Sparkles size={28} className="text-accent-primary" />
        </div>
        <div className="text-center">
          <h1 className="text-text-primary text-3xl font-semibold tracking-tight sm:text-4xl">
            How can I help you today?
          </h1>
          <p className="text-text-secondary mt-3 max-w-lg text-sm sm:text-base">
            Ask anything, generate images, search the web, upload a photo, or use your voice.
          </p>
        </div>
      </div>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {STARTERS.map((s) => (
          <button
            key={s.label}
            onClick={() => onPick(s.prompt)}
            className="border-border-light bg-surface-chat hover:bg-surface-active-alt hover:border-accent-primary/30 group flex flex-col gap-2 rounded-xl border p-3.5 text-start transition"
          >
            <div className="flex items-center gap-2">
              <s.icon size={16} className={`${s.accent} shrink-0`} />
              <span className="text-text-primary text-sm font-medium">{s.label}</span>
            </div>
            <div className="text-text-tertiary line-clamp-2 text-xs leading-relaxed">{s.prompt}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function MessagesView({ onRegenerate, onRegenerateImage }: { onRegenerate: () => void; onRegenerateImage?: (img: import('@/lib/store').GeneratedImageRef) => void }) {
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
                  convoId={activeConversationId || undefined}
                  onRegenerateImage={onRegenerateImage}
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
