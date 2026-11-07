'use client';

/**
 * Composer — LibreChat faithful bottom input bar.
 *
 *   - Centered, max-w-3xl (xl: max-w-4xl), sm:px-2
 *   - Rounded card (bg-surface-composer), border-border-light
 *   - Auto-growing TextareaAutosize (rows=1, max ~12 rows then scrolls)
 *   - Bottom bar: "+" palette button (left), chips, mic (right) + send/stop button (round, green)
 *   - Send button: bg-surface-submit (green), round, with SendIcon
 *   - Stop button: same shape, contains a 12×12 rounded rect
 *   - Enter to send (Shift+Enter for newline)
 */

import { useRef, useEffect, useCallback } from 'react';
import { Plus, Mic, Send, Square } from 'lucide-react';
import { useStore } from '@/lib/store';

interface ChatInputProps {
  onSend: (text: string) => void;
  onStop: () => void;
}

export default function ChatInput({ onSend, onStop }: ChatInputProps) {
  const text = useStore((s) => s.composerText);
  const setText = useStore((s) => s.setComposerText);
  const isGenerating = useStore((s) => s.isGenerating);
  const newConversation = useStore((s) => s.newConversation);
  const activeConversationId = useStore((s) => s.activeConversationId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Ensure there's an active conversation when user starts typing
  useEffect(() => {
    if (!activeConversationId && text) {
      newConversation();
    }
  }, [text, activeConversationId, newConversation]);

  // Auto-grow the textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const maxHeight = window.innerHeight < 768 ? '40vh' : '55vh';
    el.style.maxHeight = maxHeight;
    el.style.height = Math.min(el.scrollHeight, parseInt(maxHeight)) + 'px';
  }, [text]);

  const handleSend = useCallback(() => {
    const t = text.trim();
    if (!t || isGenerating) return;
    onSend(t);
    setText('');
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    });
  }, [text, isGenerating, onSend, setText]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="mx-auto flex w-full flex-row gap-3 px-2 sm:px-2">
      <div className="relative flex w-full min-w-0 flex-1 flex-col">
        <div
          className="bg-surface-composer border-border-light composer-shadow-blurred focus-within:composer-shadow-focused flex w-full flex-col overflow-hidden rounded-2xl border sm:rounded-2xl"
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Claude…"
            rows={1}
            className="text-text-primary placeholder:text-text-tertiary max-h-[55vh] w-full resize-none overflow-y-auto bg-transparent px-4 py-3.5 text-sm outline-none"
            style={{ minHeight: '44px' }}
          />

          {/* Bottom bar */}
          <div className="flex items-center gap-1.5 px-2 pb-2">
            {/* Plus palette (left) */}
            <button
              aria-label="Add attachment or tool"
              className="text-text-secondary hover:bg-surface-active hover:text-text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition"
              title="Add attachment or tool"
            >
              <Plus size={18} />
            </button>

            {/* Chips area (middle) — empty for now */}
            <div className="flex min-w-0 flex-1 items-center" />

            {/* Mic + Send (right) */}
            <button
              aria-label="Use microphone"
              className="text-text-secondary hover:bg-surface-active hover:text-text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition"
              title="Voice input (coming soon)"
            >
              <Mic size={18} />
            </button>

            {isGenerating ? (
              <button
                onClick={onStop}
                aria-label="Stop generating"
                title="Stop generating"
                className="bg-surface-submit text-text-inverted hover:bg-surface-submit-hover flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition"
              >
                <Square size={12} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!text.trim()}
                aria-label="Send message"
                title="Send message"
                className="bg-surface-submit text-text-inverted hover:bg-surface-submit-hover flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition disabled:opacity-50 disabled:hover:bg-surface-submit"
              >
                <Send size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Hint below */}
        <div className="text-text-tertiary mt-1.5 px-2 text-center text-xs">
          AI can use tools to write files, run code, and search the web. Press <kbd className="rounded border border-current/30 px-1">Enter</kbd> to send.
        </div>
      </div>
    </div>
  );
}
