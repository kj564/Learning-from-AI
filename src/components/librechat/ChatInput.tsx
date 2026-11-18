'use client';

/**
 * Composer — chat.z.ai-style bottom input bar.
 *
 *   - Centered, max-w-3xl (xl: max-w-4xl), sm:px-2
 *   - Rounded card (bg-surface-composer), border-border-light
 *   - Auto-growing TextareaAutosize
 *   - Bottom bar: PlusMenu (left), WebSearchToggle + chips, VoiceInputButton + Send/Stop (right)
 *   - Paste/drag image upload handled at the composer container level (in page.tsx)
 *   - Enter to send (Shift+Enter for newline)
 */

import { useRef, useEffect, useCallback } from 'react';
import { Send, Square } from 'lucide-react';
import { useStore } from '@/lib/store';
import ComposerAttachmentsBar from './ComposerAttachmentsBar';
import PlusMenu from './PlusMenu';
import WebSearchToggle from './WebSearchToggle';
import VoiceInputButton from './VoiceInputButton';

interface ChatInputProps {
  onSend: (text: string) => void;
  onStop: () => void;
  onGenerateImage?: () => void;
}

export default function ChatInput({ onSend, onStop, onGenerateImage }: ChatInputProps) {
  const text = useStore((s) => s.composerText);
  const setText = useStore((s) => s.setComposerText);
  const isGenerating = useStore((s) => s.isGenerating);
  const newConversation = useStore((s) => s.newConversation);
  const activeConversationId = useStore((s) => s.activeConversationId);
  const addAttachment = useStore((s) => s.addAttachment);
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
    // Compute the max height in pixels (was parseInt('40vh') = 40, a bug).
    const ratio = window.innerHeight < 768 ? 0.4 : 0.55;
    const maxPx = window.innerHeight * ratio;
    el.style.maxHeight = `${maxPx}px`;
    el.style.height = Math.min(el.scrollHeight, maxPx) + 'px';
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

  // Paste images directly into the textarea
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of Array.from(items)) {
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file && file.size < 4 * 1024 * 1024) {
          const reader = new FileReader();
          reader.onload = () => {
            addAttachment({
              id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              kind: 'image',
              name: file.name,
              mime: file.type,
              size: file.size,
              dataUrl: reader.result as string,
            });
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  return (
    <div className="mx-auto flex w-full flex-row gap-3 px-2 sm:px-2">
      <div className="relative flex w-full min-w-0 flex-1 flex-col">
        <div
          className="bg-surface-composer border-border-light composer-shadow-blurred focus-within:composer-shadow-focused flex w-full flex-col overflow-hidden rounded-2xl border sm:rounded-2xl"
        >
          <ComposerAttachmentsBar />
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Message Claude… (paste an image, type /, or just ask)"
            rows={1}
            className="text-text-primary placeholder:text-text-tertiary max-h-[55vh] w-full resize-none overflow-y-auto bg-transparent px-4 py-3.5 text-sm outline-none"
            style={{ minHeight: '44px' }}
          />

          {/* Bottom bar */}
          <div className="flex items-center gap-1.5 px-2 pb-2">
            <PlusMenu onGenerateImage={onGenerateImage} />
            <WebSearchToggle />
            <div className="flex min-w-0 flex-1 items-center" />
            <VoiceInputButton />
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
          AI can use tools to write files, run code, search the web, and generate images. Press <kbd className="rounded border border-current/30 px-1">Enter</kbd> to send.
        </div>
      </div>
    </div>
  );
}
