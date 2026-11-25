'use client';

/**
 * BimoApp — 1:1 rebuild of pelajarin.ai app, captured via Craft Anything
 * web_site_capture (authenticated CDP session, getComputedStyle per element).
 *
 * Captured layout (CAPTURE-APP.json + tab screenshots):
 *   - LIGHT theme: bg #fff, text #1a1a2e, border #e5e7eb
 *   - Header: h-64, glass bg, sticky, pad 0 28px, gap 12px
 *   - Sidebar: 96px, 9 nav items (Learn/Notes/Mindmap/Quiz/Flashcards/Sources/Ask AI/Podcast/Sticky)
 *     - Active: color #f76703, radius 20px, font 12px/600
 *     - Inactive: color #6b7280
 *   - Main: 1184px (sidebar 96 + main), per-tab content area
 *   - Upload box: max-w 760px, border-2 #e5e7eb, radius 24px
 *   - 4 action buttons: Record(green) Upload(blue) YouTube(red) Send(orange 44px circle)
 *   - Note detail: 9 tabs with exact content per tab
 *
 * Tab content (captured):
 *   belajar: chapter list with locked/unlocked, progress %, "Upgrade to Pro"
 *   catatan: rich text editor with Heading/Format/Export PDF toolbar
 *   mindmap: ReactFlow canvas with zoom controls
 *   kuis: "Writing question 1 of 5" loading state, quiz UI
 *   flashcard: "Making card 1 of 5" loading state, flashcard review UI
 *   sumber: source file list with PDF icon, "Open ↗" link + per-document chat
 *   chat: "Percakapan Baru" + "Hi, I'm Pai!" + textarea 632x72 + send buttons
 *   podcast: 4 AI hosts (Pai/Kiko/Bolu/Meli 169x150 cards) + style suggestions + 3/7 min
 *   tempel: sticky notes board, "New sticky note" + 56px add button
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Upload, Mic, Video, Send, FileText, Brain, MessageSquare,
  ChevronRight, ChevronDown, ChevronLeft, Loader2, Flame, CheckCircle, ArrowLeft, ArrowUp,
  BookOpen, Layers, Grid3x3, List, ListOrdered, ListTodo, Headphones, StickyNote,
  Network, FolderOpen, GraduationCap, Plus, Download, FileDown,
  Bold, Italic, Underline, Strikethrough, Code, SquareCode,
  Link2, Table, Sigma, Pi, Minus, Undo2, Redo2, Lock, Flag, Maximize2, TextQuote,
  RotateCcw, Star, Trophy, Crown, Sparkles, Volume2,
  MoreHorizontal, Home, Search, Lightbulb, RefreshCw, RotateCw, Settings, History,
} from 'lucide-react';
import { toast } from 'sonner';
import Markdown from '@/components/librechat/Markdown';
import { MindmapView } from '@/components/librechat/MindmapView';
import { PricingModal } from '@/components/librechat/PricingModal';
import { OnboardingModal, shouldShowOnboarding } from '@/components/librechat/OnboardingModal';
import { GamificationHubModal } from '@/components/librechat/GamificationHubModal';
import { CelebrationsModal } from '@/components/librechat/CelebrationsModal';

// Types
interface User { id: string; name: string; email: string; plan: string; }
interface Usage { notesUsed: number; chatsUsed: number; notesRemaining: number; chatsRemaining: number; canCreateNote: boolean; canSendChat: boolean; }
interface Note { id: string; title: string; description: string | null; status: string; flashcard_count: number; quiz_count: number; total_chapters: number; updated_at: string; }
interface Gamification {
  total_xp: number; level: number; xp_to_next_level: number;
  streak: { current: number; longest: number };
  daily_goal_minutes: number; today_minutes: number;
}

// === Shared: PDF file icon — COPY PASTE exact SVG from tab-sumber.html ===
// (viewBox 0 0 34 40, red "PDF" label rect #e5484d)
export function PdfFileIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 34 40" className={className || 'size-7 flex-none'} aria-hidden="true">
      <path fill="#fff" d="M3 1.5A1.5 1.5 0 0 1 4.5 0h17.4a2 2 0 0 1 1.42.59l6.59 6.59A2 2 0 0 1 30.5 8.6V38.5A1.5 1.5 0 0 1 29 40H4.5A1.5 1.5 0 0 1 3 38.5Z" />
      <path fill="#c9cfd8" d="M23.6.8 30.2 7.4a1.6 1.6 0 0 1 .47 1.13V8.6h-6.1a1.5 1.5 0 0 1-1.5-1.5V.7Z" />
      <path fill="none" stroke="#c9cfd8" strokeWidth="1.6" d="M4.6 1.6h17.3L29.4 9v29.4H4.6Z" />
      <rect x="1" y="26" width="26.5" height="11" rx="2.5" fill="#e5484d" />
      <text x="14.25" y="34.2" textAnchor="middle" fontSize="7.6" fontWeight="700" fill="#fff">PDF</text>
    </svg>
  );
}

// === Shared: Sticky notes FAB — appears on ALL note tabs (COPY PASTE from
// tab-catatan/mindmap/podcast HTML: fixed right 404px|24px bottom 24px) ===
// Opens a small menu to create a sticky note; stickies persist in localStorage
// and also power the Sticky (Tempel) tab.
function useStickyNotes() {
  const [stickies, setStickies] = useState<{ id: string; text: string; color: string }[]>([]);
  useEffect(() => {
    try { setStickies(JSON.parse(localStorage.getItem('bimo_stickies') || '[]')); } catch {}
  }, []);
  const save = (next: { id: string; text: string; color: string }[]) => {
    setStickies(next);
    try { localStorage.setItem('bimo_stickies', JSON.stringify(next)); } catch {}
  };
  const addSticky = (text: string, color: string) => {
    save([...stickies, { id: crypto.randomUUID(), text, color }]);
  };
  const removeSticky = (id: string) => save(stickies.filter(s => s.id !== id));
  return { stickies, addSticky, removeSticky };
}

const STICKY_COLORS = ['#fff3eb', '#e8f5e9', '#e3f2fd', '#fce4ec'];

function StickyNotesFab({ offsetRight = 24 }: { offsetRight?: number }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const { stickies, addSticky, removeSticky } = useStickyNotes();
  const popoverRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  return (
    <div className="fixed z-40 transition-[right,bottom] duration-200" style={{ right: offsetRight, bottom: 24 }}>
      <div className="relative">
        {open && (
          <div ref={popoverRef} className="absolute bottom-[calc(100%+8px)] right-0 w-72 rounded-2xl border-2 border-border bg-surface p-3 shadow-[0_18px_44px_rgb(16_24_40/18%)]">
            <div className="mb-2 font-heading text-sm font-bold text-text-primary">Sticky notes</div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (text.trim()) { addSticky(text.trim(), STICKY_COLORS[stickies.length % STICKY_COLORS.length]); setText(''); setOpen(false); toast.success('Sticky note ditambahkan'); } } }}
              placeholder="Tulis catatan tempel..."
              rows={3}
              className="w-full resize-none rounded-xl border-2 border-border bg-surface-tertiary p-2.5 text-sm text-text-primary outline-none placeholder:text-text-muted focus:border-primary"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => { if (text.trim()) { addSticky(text.trim(), STICKY_COLORS[stickies.length % STICKY_COLORS.length]); setText(''); setOpen(false); toast.success('Sticky note ditambahkan'); } }}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-text-inverse shadow-[0_4px_0_var(--color-primary-dark)] transition-all duration-100 hover:bg-primary-hover active:translate-y-[2px] active:shadow-[0_2px_0_var(--color-primary-dark)]"
              >
                <Plus size={16} className="shrink-0" /> New sticky note
              </button>
            </div>
            {stickies.length > 0 && (
              <div className="mt-3 max-h-40 overflow-y-auto border-t-2 border-border pt-2">
                {stickies.map(s => (
                  <div key={s.id} className="group flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-secondary">
                    <span className="mt-1 size-2.5 flex-none rounded-sm" style={{ background: s.color }} />
                    <p className="min-w-0 flex-1 break-words text-xs text-text-primary">{s.text}</p>
                    <button type="button" aria-label="Delete sticky" onClick={() => removeSticky(s.id)} className="flex-none text-text-muted opacity-0 transition-opacity hover:text-error group-hover:opacity-100">&times;</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen(prev => !prev)}
          aria-label="Sticky notes menu"
          title="Sticky notes menu"
          aria-haspopup="dialog"
          aria-expanded={open}
          className="relative grid size-14 place-items-center rounded-full bg-primary text-text-inverse shadow-[0_4px_0_var(--color-primary-dark)] transition-all duration-100 hover:bg-primary-hover active:translate-y-[2px] active:shadow-[0_2px_0_var(--color-primary-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          <Plus size={26} className="shrink-0" />
        </button>
      </div>
    </div>
  );
}

// === Shared: AI chat aside (right panel) — COPY PASTE from tab-catatan.html /
// tab-sumber.html: header "Percakapan Baru \u25be" + New Chat, centered Pai
// empty state (idle mascot 88px), composer-shell with mic + send ===
function AiAside({ noteId, subtitle, messages, input, setInput, streaming, onSend, children }: {
  noteId: string;
  subtitle: string;
  messages: { role: string; content: string }[];
  input: string;
  setInput: (v: string) => void;
  streaming: boolean;
  onSend: () => void;
  children?: React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);
  const hasMessages = messages.length > 0;
  return (
    <aside className="relative min-h-0 flex-col overflow-hidden bg-surface hidden lg:flex lg:h-full lg:flex-none" style={{ ['--chat-w' as any]: '380px', width: 'var(--chat-w)' }}>
      <div className="group absolute inset-y-0 left-0 z-20 hidden w-2 cursor-col-resize lg:block" aria-hidden="true">
        <div className="absolute left-0 top-1/2 h-10 w-1 -translate-y-1/2 rounded-full bg-border transition-colors group-hover:bg-primary" />
      </div>
      <header className="flex items-center gap-2 px-3 pb-3 pt-4">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <button type="button" className="flex min-w-0 max-w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left transition-colors hover:bg-surface-secondary">
            <span className="truncate font-heading text-[15px] font-bold text-text-primary">Percakapan Baru</span>
            <ChevronDown size={16} className="flex-none text-text-muted" />
          </button>
          <button type="button" aria-label="New Chat" title="New Chat" className="grid size-8 flex-none place-items-center rounded-lg text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary">
            <Plus size={18} className="shrink-0" />
          </button>
        </div>
      </header>
      {hasMessages ? (
        <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4">
          {messages.map((m, i) => (
            <div key={i} className={`w-full max-w-full ${m.role === 'user' ? 'self-end' : 'self-start'}`}>
              <div
                className={`rounded-2xl px-3 py-2 text-sm ${m.role === 'user' ? 'bg-primary-light text-primary' : 'bg-surface-tertiary text-text-primary'}`}
              >
                {m.role === 'assistant' && m.content === '' && streaming ? <Loader2 size={14} className="animate-spin" /> : m.role === 'assistant' ? <div className="prose prose-sm max-w-none"><Markdown content={m.content} /></div> : m.content}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-10">
          <div className="max-w-[340px] text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img sizes="128px" alt="" aria-hidden="true" decoding="async" className="object-contain mx-auto mb-3 size-[88px]" src="/assets/idle-Ctcj4aS0.webp" />
            <h2 className="font-heading font-bold text-text-primary text-[22px]">Hi, I&apos;m Pai!</h2>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">{subtitle}</p>
          </div>
          {children}
        </div>
      )}
      {/* Composer — w-full max-w-[440px], composer-shell with mic + send */}
      <div className={`w-full max-sm:order-1 max-w-[440px] self-center ${hasMessages ? 'mb-4 justify-self-center' : ''}`} style={hasMessages ? { margin: '0 auto 16px' } : undefined}>
        <div className="composer-shell grid min-h-[56px] grid-cols-[1fr_auto] items-center gap-x-1.5 rounded-full bg-surface-tertiary py-0 pl-6 pr-2 transition-[border-radius] [&.is-tall]:items-end [&.is-tall]:gap-y-2.5 [&.is-tall]:rounded-[28px] [&.is-tall]:pb-2.5 [&.is-tall]:pt-4">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
            placeholder={'Ask anything about this material\u2026'}
            aria-label={'Ask anything about this material\u2026'}
            className="col-start-1 row-start-1 m-0 mr-2 min-w-0 resize-none overflow-y-hidden overscroll-contain border-0 bg-transparent p-0 text-[15px] leading-6 text-text-primary outline-none placeholder:overflow-hidden placeholder:text-ellipsis placeholder:whitespace-nowrap placeholder:text-text-muted"
          />
          <span className="col-start-2 row-start-1 flex items-center gap-1.5 justify-self-end">
            <button type="button" aria-label="Voice input" title="Voice input" className="grid size-10 flex-none place-items-center rounded-full transition-colors disabled:opacity-40 text-text-secondary hover:bg-surface-secondary hover:text-text-primary">
              <Mic size={18} className="shrink-0" />
            </button>
            <button type="button" onClick={onSend} disabled={streaming || !input.trim()} aria-label="Send" className="grid size-10 flex-none place-items-center rounded-full bg-primary text-text-inverse transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-surface-tertiary disabled:text-text-muted">
              <ArrowUp size={18} className="shrink-0" />
            </button>
          </span>
        </div>
      </div>
    </aside>
  );
}

// Shared SSE stream reader (chat + clarify)
async function readSSE(res: Response, onDelta: (full: string) => void): Promise<string> {
  const reader = res.body?.getReader(); const decoder = new TextDecoder();
  let fullText = ''; let buf = '';
  while (reader) {
    const { done, value } = await reader.read(); if (done) break;
    buf += decoder.decode(value, { stream: true });
    const events = buf.split('\n\n'); buf = events.pop() || '';
    for (const evt of events) {
      const lines = evt.split('\n'); let eventType = ''; let dataStr = '';
      for (const line of lines) { if (line.startsWith('event:')) eventType = line.slice(6).trim(); if (line.startsWith('data:')) dataStr = line.slice(5).trim(); }
      if (!dataStr) continue;
      try { const data = JSON.parse(dataStr); if (eventType === 'text-delta' && data.text) { fullText += data.text; onDelta(fullText); } } catch {}
    }
  }
  return fullText;
}

// Shared chat send for the inline AI asides
function useAsideChat(noteId: string) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const sessionIdRef = useRef<string>('');
  useEffect(() => { sessionIdRef.current = crypto.randomUUID(); }, [noteId]);
  const send = useCallback(async () => {
    if (!input.trim() || streaming) return;
    const msg = input.trim(); setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setStreaming(true);
    try {
      const res = await fetch('/api/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note_id: noteId, session_id: sessionIdRef.current, message: msg }) });
      if (!res.ok) return;
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      await readSSE(res, (text) => setMessages(prev => { const c = [...prev]; c[c.length - 1] = { role: 'assistant', content: text }; return c; }));
    } catch {} finally { setStreaming(false); }
  }, [input, streaming, noteId]);
  const reset = () => setMessages([]);
  return { messages, input, setInput, streaming, send, reset };
}


// === Sidebar icons — COPY PASTE exact SVG paths from pelajarin.ai HTML ===
const SIDEBAR_ICON_PATHS: Record<string, string> = {
  belajar: 'M10 16c-.46.6-1.18 1-2 1H3.5A1.5 1.5 0 0 1 2 15.5v-11C2 3.67 2.67 3 3.5 3H8c.82 0 1.54.4 2 1 .46-.6 1.18-1 2-1h4.5c.83 0 1.5.67 1.5 1.5v11c0 .83-.67 1.5-1.5 1.5H12a2.5 2.5 0 0 1-2-1ZM3 4.5v11c0 .28.22.5.5.5H8c.83 0 1.5-.67 1.5-1.5v-9C9.5 4.67 8.83 4 8 4H3.5a.5.5 0 0 0-.5.5Zm7.5 10c0 .83.67 1.5 1.5 1.5h4.5a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5H12c-.83 0-1.5.67-1.5 1.5v9Z',
  catatan: 'M10 2v4.5c0 .83.67 1.5 1.5 1.5H16v8.5c0 .83-.67 1.5-1.5 1.5h-9A1.5 1.5 0 0 1 4 16.5v-13C4 2.67 4.67 2 5.5 2H10Zm1 .25V6.5c0 .28.22.5.5.5h4.25L11 2.25Z',
  mindmap: 'M4.5 3C3.67 3 3 3.67 3 4.5v2C3 7.33 3.67 8 4.5 8H5v3.84a1 1 0 0 0-.2.16L3 13.8a1 1 0 0 0 0 1.4L4.8 17a1 1 0 0 0 1.4 0L8 15.2a1 1 0 0 0 .16-.2H12v.5c0 .83.67 1.5 1.5 1.5h2c.83 0 1.5-.67 1.5-1.5v-2c0-.83-.67-1.5-1.5-1.5h-2c-.83 0-1.5.67-1.5 1.5v.5H8.16a1 1 0 0 0-.16-.2L6.2 12a1 1 0 0 0-.2-.16V8h.5C7.33 8 8 7.33 8 6.5v-2C8 3.67 7.33 3 6.5 3h-2ZM4 4.5c0-.28.22-.5.5-.5h2c.28 0 .5.22.5.5v2a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-2Zm10 10c0-.28.22-.5.5-.5h2c.28 0 .5.22.5.5v2a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-2ZM4.5 13.5h.59l1.2 1.2-1.06 1.06-1.23-1.23v-1.03Zm.44-.5L6.2 11.8a1 1 0 0 0 .2-.16h1.1v-2.3H6.4a1 1 0 0 0-.2-.16L4.94 7.9v5.1Z',
  kuis: 'M10 2a8 8 0 1 1-3.61 15.14l-.12-.07-3.65.92a.5.5 0 0 1-.62-.45v-.08l.01-.08.92-3.64-.07-.12a7.95 7.95 0 0 1-.83-2.9l-.02-.37L2 10a8 8 0 0 1 8-8Zm0 1a7 7 0 0 0-6.1 10.42.5.5 0 0 1 .06.28l-.02.1-.75 3.01 3.02-.75a.5.5 0 0 1 .19-.01l.09.02.09.04A7 7 0 1 0 10 3Zm.5 8a.5.5 0 0 1 .09 1H7.5a.5.5 0 0 1-.09-1h3.09Zm2-3a.5.5 0 0 1 .09 1H7.5a.5.5 0 0 1-.09-1h5.09Z',
  flashcard: 'M6.5 2A2.5 2.5 0 0 0 4 4.5V8c.38 0 .73.14 1 .38V4.5C5 3.67 5.67 3 6.5 3h7c.83 0 1.5.67 1.5 1.5v3.88A1.5 1.5 0 0 1 16 8V4.5A2.5 2.5 0 0 0 13.5 2h-7ZM16 13.69c-.31.16-.65.3-1 .44v1.37c0 .83-.67 1.5-1.5 1.5h-7A1.5 1.5 0 0 1 5 15.5v-1.37a11.1 11.1 0 0 1-1-.44v1.81A2.5 2.5 0 0 0 6.5 18h7a2.5 2.5 0 0 0 2.5-2.5v-1.81ZM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5ZM7 9.5c0-.28.22-.5.5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5Zm0 3c0-.28.22-.5.5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5Zm0-3Z',
  sumber: 'M4 4c0-1.1.9-2 2-2h3.59c.4 0 .78.16 1.06.44l3.91 3.91c.28.28.44.67.44 1.06V14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4Zm2-1a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V8h-3.5A1.5 1.5 0 0 1 9 6.5V3H6Zm4 .2v3.3c0 .28.22.5.5.5h3.3L10 3.2ZM17 9a1 1 0 0 0-1-1v6a3 3 0 0 1-3 3H6a1 1 0 0 0 1 1h6.06A3.94 3.94 0 0 0 17 14.06V9Z',
  chat: 'M7.4 12.8a1.04 1.04 0 0 0 1.59-.51l.45-1.37a2.34 2.34 0 0 1 1.47-1.48l1.4-.45A1.04 1.04 0 0 0 12.25 7l-1.37-.45A2.34 2.34 0 0 1 9.4 5.08L8.95 3.7a1.03 1.03 0 0 0-.82-.68 1.04 1.04 0 0 0-1.15.7l-.46 1.4a2.34 2.34 0 0 1-1.44 1.45L3.7 7a1.04 1.04 0 0 0 .02 1.97l1.37.45a2.33 2.33 0 0 1 1.48 1.48l.46 1.4c.07.2.2.37.38.5Zm.08-7.4.53-1.38.44 1.37a3.33 3.33 0 0 0 2.12 2.12l1.4.53-1.38.45a3.34 3.34 0 0 0-2.12 2.12l-.53 1.4-.45-1.4a3.33 3.33 0 0 0-2.1-2.1l-1.4-.55 1.38-.44a3.34 3.34 0 0 0 2.13-2.12Zm9.6 4.5a.83.83 0 0 0-.99-.75l-.83.27a1.3 1.3 0 0 1-.82-.82l.27-.83a.83.83 0 0 0-.75-.99h-.01a.83.83 0 0 0-.85.83l.02.9a2.2 2.2 0 0 0 1.4 2l.9.27a.83.83 0 0 0 .83-.85Z',
  podcast: 'M10 2a4 4 0 0 1 4 4v2.05a2.5 2.5 0 0 1 2 2.45v5a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 4 15.5v-5a2.5 2.5 0 0 1 2-2.45V6a4 4 0 0 1 4-4Zm0 1a3 3 0 0 0-3 3v2h6V6a3 3 0 0 0-3-3Zm0 6.5a1.25 1.25 0 0 0-.5 2.4v2.35a.5.5 0 0 0 1 0v-2.35a1.25 1.25 0 0 0-.5-2.4Z',
  tempel: 'M14 3a3 3 0 0 1 3 2.82v4.56a2 2 0 0 1-.47 1.28l-.12.13-4.62 4.62a2 2 0 0 1-1.24.58l-.17.01H6a3 3 0 0 1-3-2.82V6a3 3 0 0 1 2.82-3H14Zm0 1H6a2 2 0 0 0-2 1.85V14a2 2 0 0 0 1.85 2H10v-3a3 3 0 0 1 2.82-3H16V6a2 2 0 0 0-1.85-2H14Zm1.78 7H13a2 2 0 0 0-2 1.85V15.78l.09-.07 4.62-4.62a1 1 0 0 0 .07-.09Z',
};
function PelajarinSidebarIcon({ id, size = 26 }: { id: string; size?: number }) {
  const path = SIDEBAR_ICON_PATHS[id];
  return (
    <svg font-size="20" width={size} height={size} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="inline-block shrink-0" xmlns="http://www.w3.org/2000/svg">
      {path ? <path d={path} fill="currentColor" /> : null}
    </svg>
  );
}

// Tab definitions (captured from pelajarin sidebar nav)
const TABS = [
  { id: 'belajar', label: 'Learn', url: 'belajar' },
  { id: 'catatan', label: 'Notes', url: 'catatan' },
  { id: 'mindmap', label: 'Mindmap', url: 'mindmap' },
  { id: 'kuis', label: 'Quiz', url: 'kuis' },
  { id: 'flashcard', label: 'Flashcards', url: 'flashcard' },
  { id: 'sumber', label: 'Sources', url: 'sumber' },
  { id: 'chat', label: 'Ask AI', url: 'chat' },
  { id: 'podcast', label: 'Podcast', url: 'podcast' },
  { id: 'tempel', label: 'Sticky', url: 'tempel' },
] as const;

export function BimoApp() {
  const [user, setUser] = useState<User | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'dashboard' | 'note'>('dashboard');
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [activeTab, setActiveTab] = useState<string>('belajar');
  const [pricingOpen, setPricingOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [gamification, setGamification] = useState<Gamification | null>(null);
  const [hubOpen, setHubOpen] = useState(false);
  const [celebrationsOpen, setCelebrationsOpen] = useState(false);

  // Show onboarding on first visit (once per browser)
  useEffect(() => {
    if (shouldShowOnboarding()) {
      const t = setTimeout(() => setOnboardingOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [meRes, subRes, notesRes, gameRes] = await Promise.all([
        fetch('/api/v1/me').then(r => r.json()),
        fetch('/api/v1/subscriptions').then(r => r.json()),
        fetch('/api/v1/notes?limit=50').then(r => r.json()),
        fetch('/api/v1/gamification').then(r => r.json()),
      ]);
      setUser(meRes.data);
      setUsage(subRes.data?.usage);
      setNotes(notesRes.data || []);
      setGamification(gameRes.data);
    } catch (e) { console.error('load failed', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-refresh while any note is still processing — the LLM generation
  // runs in the background (POST /notes/generate or upload), so the dashboard
  // needs to poll until status flips from "processing" → "completed".
  useEffect(() => {
    const hasProcessing = notes.some(n => n.status === 'processing');
    if (!hasProcessing) return;
    const interval = setInterval(() => { loadData(); }, 5000);
    return () => clearInterval(interval);
  }, [notes, loadData]);

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-app text-app"><Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent-orange)' }} /></div>;

  return (
    <div className="min-h-screen bg-app text-app flex flex-col" style={{ fontFamily: 'var(--font-body)', color: 'var(--text-primary)' }}>
      {/* Header — COPY PASTE 1:1 from pelajarin.ai dashboard.html */}
      <header data-mode-header="true" className="sticky top-0 z-50 flex h-16 items-center gap-3 bg-[color-mix(in_srgb,var(--color-surface)_82%,transparent)] px-[clamp(16px,3vw,28px)] backdrop-blur-2xl max-lg:gap-2 max-lg:px-4">
        <a className="flex flex-none items-center gap-2" aria-label="bimo.ai" href="#" onClick={(e) => { e.preventDefault(); setView('dashboard'); setActiveNote(null); }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" className="block size-8 object-contain dark:hidden" src="/pelajarin-assets/img/logo-light.png" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" className="hidden size-8 object-contain dark:block" src="/pelajarin-assets/img/logo-dark.png" />
          <span className="font-heading text-xl font-bold leading-none tracking-tight text-text-primary max-sm:hidden">bimo.ai</span>
        </a>
        <button type="button" title="Classic" aria-label="Classic" className="group inline-flex h-8 flex-none items-center rounded-full border border-border px-1.5 font-body text-xs font-semibold text-text-secondary transition-colors hover:border-text-secondary hover:text-text-primary">
          <History size={18} className="shrink-0" />
          <span className="grid grid-cols-[0fr] transition-[grid-template-columns] duration-200 ease-out group-hover:grid-cols-[1fr]"><span className="min-w-0 overflow-hidden whitespace-nowrap"><span className="block pl-1.5 pr-1">Classic</span></span></span>
        </button>
        <span className="h-6 w-px flex-none bg-border max-sm:hidden" />
        <nav className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-sm font-medium" aria-label="Breadcrumb">
          {view === 'dashboard' ? (
            <a aria-current="page" className="inline-flex flex-none items-center gap-1.5 font-semibold text-text-primary active" href="#" onClick={(e) => e.preventDefault()}><Home size={18} className="shrink-0" />Home</a>
          ) : (
            <>
              <a className="inline-flex flex-none items-center gap-1.5 text-text-secondary hover:text-text-primary" href="#" onClick={(e) => { e.preventDefault(); setView('dashboard'); setActiveNote(null); }}><Home size={18} className="shrink-0" />Home</a>
              <span className="text-text-muted">›</span>
              <a className="max-w-[40vw] truncate text-text-secondary hover:text-text-primary lg:max-w-[28vw]" href="#" onClick={(e) => { e.preventDefault(); setView('dashboard'); setActiveNote(null); }}>{activeNote?.title}</a>
              <span className="text-text-muted">›</span>
              <span className="flex-none font-semibold text-text-primary" aria-current="page">{TABS.find(t => t.url === activeTab)?.label}</span>
            </>
          )}
        </nav>
        <span className="flex-1" />
        <a title="Become a Creator" aria-label="Become a Creator" className="relative inline-flex h-9 flex-none items-center justify-center gap-2 overflow-hidden rounded-full px-4 font-body text-sm font-semibold text-text-inverse transition-[box-shadow,transform,background-color] active:translate-y-0.5 max-sm:px-3 bg-[linear-gradient(90deg,var(--color-pill-affiliate-from),var(--color-pill-affiliate-to))] shadow-[0_4px_0_var(--color-pill-affiliate-shadow)] hover:brightness-105 active:shadow-[0_2px_0_var(--color-pill-affiliate-shadow)]" href="#" onClick={(e) => e.preventDefault()}>
          <Star size={18} className="shrink-0" />
          <span className="grid text-center whitespace-nowrap max-sm:hidden"><span className="col-start-1 row-start-1 invisible">Affiliate</span><span className="col-start-1 row-start-1">Become a Creator</span></span>
        </a>
        <a title="Streak ends at midnight" className="relative inline-flex h-9 flex-none items-center gap-2 rounded-full px-4 font-body text-sm font-semibold transition-[box-shadow,transform] active:translate-y-0.5 bg-[linear-gradient(90deg,var(--color-pill-streak-from),var(--color-pill-streak-to))] text-text-inverse shadow-[0_4px_0_var(--color-pill-streak-shadow)] active:shadow-[0_2px_0_var(--color-pill-streak-shadow)] max-md:hidden" href="#" onClick={(e) => { e.preventDefault(); setHubOpen(true); }}>
          <Flame size={18} className="shrink-0 motion-safe:animate-pulse" />
          <span>Streak</span>
          <span className="font-bold">{gamification?.streak?.current ?? 0}</span>
        </a>
        <a title="Level" className="relative inline-flex h-9 flex-none items-center justify-center gap-2 overflow-hidden rounded-full px-4 font-body text-sm font-semibold text-text-inverse transition-[box-shadow,transform,background-color] active:translate-y-0.5 max-sm:px-3 bg-[linear-gradient(90deg,var(--color-pill-level-from),var(--color-pill-level-to))] shadow-[0_4px_0_var(--color-pill-level-shadow)] active:shadow-[0_2px_0_var(--color-pill-level-shadow)] max-md:hidden" href="#" onClick={(e) => { e.preventDefault(); setHubOpen(true); }}>
          <Trophy size={18} className="shrink-0" />
          <span>Level</span>
          <span className="font-bold">{gamification?.level ?? 1}</span>
        </a>
        <button onClick={() => setPricingOpen(true)} className="relative inline-flex h-9 flex-none items-center justify-center gap-2 overflow-hidden rounded-full px-4 font-body text-sm font-semibold text-text-inverse transition-[box-shadow,transform,background-color] active:translate-y-0.5 max-sm:px-3 bg-[linear-gradient(135deg,var(--color-primary)_0%,color-mix(in_srgb,var(--color-primary)_55%,var(--color-warning))_100%)] shadow-[0_4px_0_var(--color-primary-dark)] active:shadow-[0_2px_0_var(--color-primary-dark)]">
          <Sparkles size={18} className="relative z-10 shrink-0" />
          <span className="relative z-10 max-sm:hidden">Upgrade</span>
        </button>
        <div className="relative flex-none">
          <button type="button" aria-label={user?.name || 'B'} className="grid size-9 translate-y-[2px] place-items-center overflow-hidden rounded-full bg-primary font-heading text-sm font-bold text-text-inverse ring-2 ring-transparent transition hover:ring-border-light">{user?.name?.[0] || 'B'}</button>
        </div>
      </header>

      {/* Body: sidebar (note detail only) + main.
          Per pelajarin capture: dashboard view has NO left sidebar (full-width
          main). The 9-tab sidebar only appears inside a note detail. */}
      <div className="flex flex-1">
        {view === 'note' && (
          <NoteSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        )}

        {view === 'dashboard' && (
          <BimoDashboard notes={notes} usage={usage}
            onNoteClick={(n) => { setActiveNote(n); setView('note'); setActiveTab('belajar'); }}
            onNoteCreated={loadData} />
        )}
        {view === 'note' && activeNote && (
          <BimoNoteDetail note={activeNote} activeTab={activeTab} usage={usage}
            onUpgrade={() => setPricingOpen(true)}
            onBack={() => { setView('dashboard'); setActiveNote(null); }} />
        )}
      </div>

      {/* No footer — per pelajarin.ai capture: app view has NO footer */}

      {/* Pricing modal — triggered by "Upgrade" pill in the header */}
      <PricingModal open={pricingOpen} onOpenChange={setPricingOpen} />
      {/* Onboarding modal — first-visit welcome carousel */}
      <OnboardingModal open={onboardingOpen} onOpenChange={setOnboardingOpen} />
      {/* Gamification hub modal — triggered by Streak/Level badge click */}
      <GamificationHubModal open={hubOpen} onOpenChange={setHubOpen} />
      {/* Celebrations modal — auto-shows pending level-up/streak/achievement */}
      <CelebrationsModal open={celebrationsOpen} onOpenChange={setCelebrationsOpen} />
    </div>
  );
}

// === Dashboard sidebar (3 items: Home, Notes, Study) ===
function DashboardSidebar() {
  return (
    <aside className="sticky top-16 z-40 hidden flex-col items-center gap-2 self-start border-r border-app bg-app sm:flex" style={{ width: 'var(--sidebar-w)', height: 'calc(100vh - 4rem)', padding: '20px 8px' }}>
      {[{ icon: BookOpen, label: 'Home' }, { icon: FileText, label: 'Notes' }, { icon: Brain, label: 'Study' }].map(item => (
        <button key={item.label} className="flex w-full flex-col items-center gap-1.5 rounded-xl p-1.5 text-center" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', borderRadius: '20px' }}>
          <item.icon size={20} />
          {item.label}
        </button>
      ))}
    </aside>
  );
}

// === Note detail sidebar (9 tabs — captured) ===
function NoteSidebar({ activeTab, onTabChange }: { activeTab: string; onTabChange: (t: string) => void }) {
  return (
    <aside className="sticky top-16 z-40 hidden flex-col self-start border-r border-border bg-surface sm:flex" style={{ width: 'var(--sidebar-w, 96px)', height: 'calc(100vh - 4rem)' }}>
      {/* COPY PASTE 1:1 from pelajarin.ai — nav with 9 tab buttons */}
      <nav className="flex min-h-0 flex-1 flex-col justify-center-safe gap-3 overflow-y-auto overflow-x-hidden [&::-webkit-scrollbar]:w-0 pb-24" aria-label="Main navigation">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.url)}
            className={`flex w-full flex-col items-center gap-1.5 rounded-xl px-1 py-1.5 text-center font-body text-[12px] font-semibold leading-tight transition-colors ${activeTab === tab.url ? 'text-primary' : 'text-text-secondary hover:text-text-primary'}`}
          >
            <span className="relative"><PelajarinSidebarIcon id={tab.id} size={26} /></span>
            {tab.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

// === Dashboard ===
function BimoDashboard({ notes, usage, onNoteClick, onNoteCreated }: { notes: Note[]; usage: Usage | null; onNoteClick: (n: Note) => void; onNoteCreated: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [filter, setFilter] = useState('all');
  const [folders, setFolders] = useState<{ id: string; name: string; color: string; note_count: number }[]>([]);
  const [activeFolder, setActiveFolder] = useState<string | null>(null); // null = All folders
  const [foldersOpen, setFoldersOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load folders for the "All folders" dropdown (per pelajarin RE: /folders)
  useEffect(() => {
    fetch('/api/v1/folders').then(r => r.json()).then(d => setFolders(d.data || [])).catch(() => {});
  }, []);

  async function createFolder(name: string) {
    try {
      const res = await fetch('/api/v1/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      const d = await res.json();
      if (d.data) { toast.success(`Folder "${name}" dibuat`); const r2 = await fetch('/api/v1/folders'); const d2 = await r2.json(); setFolders(d2.data || []); }
    } catch { toast.error('Gagal buat folder'); }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const presignRes = await fetch('/api/v1/documents/presign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: file.name, content_type: file.type || 'application/octet-stream', size_bytes: file.size }) });
      const presignData = await presignRes.json().catch(() => ({}));
      if (!presignData.data) throw new Error(presignData.error?.message || 'Presign gagal');
      // PUT the raw file. This returns a small JSON ack (or 404 if route missing);
      // we don't strictly need the body, just a 2xx.
      const putRes = await fetch(presignData.data.upload_url, { method: 'PUT', body: file });
      if (!putRes.ok) throw new Error(`Upload file gagal (HTTP ${putRes.status})`);
      const noteRes = await fetch('/api/v1/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: file.name.replace(/\.[^.]+$/, ''), file_ids: [presignData.data.document_id] }) });
      const noteData = await noteRes.json().catch(() => ({}));
      if (noteData.data) { toast.success('Catatan dibuat! Bimo sedang memproses...'); onNoteCreated(); }
      else throw new Error(noteData.error?.message || 'Gagal membuat catatan');
    } catch (e) { toast.error(`Upload gagal: ${e instanceof Error ? e.message : String(e)}`); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  }

  async function handleCreateNote() {
    const topic = inputText.trim();
    if (!topic) { toast.error('Ketik topik yang mau dipelajari dulu'); return; }
    try {
      // Per pelajarin RE (RECON-DEEP-v4 §2.1): POST /notes/generate takes a
      // text prompt and runs the full generation pipeline — the LLM writes
      // the teaching material. This is the primary free-tier entry point.
      const res = await fetch('/api/v1/notes/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: topic }) });
      const data = await res.json().catch(() => ({}));
      if (data.data) { toast.success('Bimo lagi belajarin materinya...'); onNoteCreated(); setInputText(''); }
      else toast.error(data.error?.message || 'Gagal membuat catatan');
    } catch { toast.error('Gagal membuat catatan'); }
  }

  const filters = ['All', 'Documents', 'Slides', 'Audio', 'YouTube'];

  return (
    <main className="mx-auto w-full flex-1 px-[clamp(24px,4vw,56px)] pb-20 pt-8 max-lg:px-5 max-lg:pb-[72px]">
      <input ref={fileInputRef} type="file" onChange={handleUpload} className="hidden" accept=".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.txt,.md,.jpg,.png,.webp,.heic,.heif,.mp3,.wav,.weba,.m4a,.ogg,.mp4,.webm,.mov,.avi,.mkv,.jpeg,.markdown,.mpeg,.mpga" multiple />
      {/* Hero — COPY PASTE 1:1 from pelajarin.ai dashboard.html */}
      <section className="mb-7 mt-[clamp(24px,6vh,64px)] flex items-center justify-center gap-2 text-left max-sm:flex-col max-sm:gap-0 max-sm:text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img sizes="132px" alt="" aria-hidden="true" decoding="async" className="object-contain pointer-events-none size-[132px] flex-none max-sm:size-[104px]" srcSet="/assets/yoyo-CLVpPPxW.webp 288w, /assets/yoyo-576-Mwnvh0Dn.webp 576w" src="/assets/yoyo-CLVpPPxW.webp" />
        <h1 className="text-balance font-heading text-[clamp(28px,4.4vw,42px)] font-bold leading-[1.15] tracking-[-0.01em] text-text-primary">What do you want to learn today?</h1>
      </section>
      {/* Upload box — COPY PASTE 1:1 from pelajarin.ai */}
      <section className="mx-auto mb-12 max-w-[760px] rounded-2xl border-2 bg-surface px-[18px] pb-3.5 pt-[18px] transition-[border-color,box-shadow] border-border focus-within:border-primary focus-within:shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-primary)_18%,transparent)]">
        <div className="relative">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCreateNote(); } }}
            placeholder="Teach me the basics of microeconomics"
            className="min-h-[52px] w-full resize-none border-none bg-transparent px-0.5 py-1 font-body text-[17px] leading-normal text-text-primary outline-none placeholder:text-text-muted"
            rows={1}
            aria-label="What would you like to learn?"
          />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-full bg-surface-tertiary px-3.5 py-1.5 font-body text-[13px] font-semibold transition-colors hover:bg-border text-success-dark" type="button"><Mic size={18} className="shrink-0" />Record</button>
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-1.5 rounded-full bg-surface-tertiary px-3.5 py-1.5 font-body text-[13px] font-semibold transition-colors hover:bg-border text-secondary-dark disabled:opacity-50" type="button"><Upload size={18} className="shrink-0" />{uploading ? 'Uploading...' : 'Upload'}</button>
          <button className="inline-flex items-center gap-1.5 rounded-full bg-surface-tertiary px-3.5 py-1.5 font-body text-[13px] font-semibold transition-colors hover:bg-border text-error" type="button"><Video size={18} className="shrink-0" />YouTube</button>
          <span className="flex-1" />
          <button onClick={handleCreateNote} type="button" aria-label="Send" disabled={uploading} className="grid size-11 flex-none place-items-center rounded-full transition-[transform,box-shadow,background-color] bg-primary-light text-primary"><Send size={20} className="shrink-0" /></button>
        </div>
      </section>
      {/* Keep learning banner — COPY PASTE 1:1 from pelajarin.ai */}
      {notes.length > 0 && (
        <a className="mx-auto mt-6 flex w-max max-w-full items-center gap-3 rounded-full border-2 border-border bg-surface py-2 pl-3 pr-2 text-text-primary" href="#" onClick={(e) => { e.preventDefault(); onNoteClick(notes[0]); }}>
          {/* Progress ring — SVG with stroke-dashoffset */}
          <div className="relative flex-none" style={{ width: 32, height: 32 }}>
            <svg viewBox="0 0 32 32" className="size-full -rotate-90">
              <circle cx="16" cy="16" r="13" fill="none" stroke="var(--color-surface-tertiary)" strokeWidth="4" />
              <circle cx="16" cy="16" r="13" fill="none" stroke="var(--color-primary)" strokeWidth="4" strokeLinecap="round" strokeDasharray="81.68" strokeDashoffset={81.68 * (1 - (notes[0].total_chapters > 0 ? Math.min(1, 1 / notes[0].total_chapters) : 0))} className="transition-[stroke-dashoffset] duration-500" />
            </svg>
          </div>
          <span className="truncate text-sm font-semibold">{notes[0].title}</span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-primary-light px-4 py-2 text-sm font-semibold text-primary">Keep learning <ChevronRight size={18} className="shrink-0" /></span>
        </a>
      )}
      {/* Notes section — COPY PASTE 1:1 from pelajarin.ai dashboard.html */}
      <div className="mb-4 mt-12 flex items-center gap-3">
        <span className="min-w-0 flex-1">
          <h2 className="font-heading text-[clamp(20px,3vw,24px)] font-bold text-text-primary">Notes</h2>
        </span>
      </div>
      {/* Filter bar — COPY PASTE: folders dropdown + chips + grid/list toggle */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {/* All folders dropdown */}
        <div className="relative">
          <button type="button" onClick={() => setFoldersOpen(prev => !prev)} className="inline-flex items-center gap-1.5 rounded-full border-2 px-3.5 py-1.5 font-body text-[13px] font-semibold transition-colors border-border text-text-secondary hover:border-text-muted">
            <FolderOpen size={15} className="shrink-0" />
            <span className="max-w-[160px] truncate">{activeFolder ? (folders.find(f => f.id === activeFolder)?.name || 'Folder') : 'All folders'}</span>
            <ChevronRight size={14} className="shrink-0 rotate-90" />
          </button>
          {foldersOpen && (
            <div className="absolute left-0 top-full mt-1 z-50 w-56 rounded-2xl border-2 border-border bg-surface p-2 shadow-xl">
              <button onClick={() => { setActiveFolder(null); setFoldersOpen(false); }} className="block w-full rounded-lg px-2 py-2 text-left font-body text-sm font-semibold text-text-secondary hover:bg-surface-secondary hover:text-text-primary">All folders</button>
              {folders.map(f => (
                <button key={f.id} onClick={() => { setActiveFolder(f.id); setFoldersOpen(false); }} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 font-body text-sm font-semibold text-text-secondary hover:bg-surface-secondary hover:text-text-primary">
                  <span className="size-2.5 rounded-full shrink-0" style={{ background: f.color }} /> {f.name} <span className="ml-auto text-xs text-text-muted">{f.note_count}</span>
                </button>
              ))}
              <div className="mx-1 my-1 h-px bg-border-light" />
              <button onClick={() => { const name = prompt('Nama folder baru?'); if (name && name.trim()) { createFolder(name.trim()); } setFoldersOpen(false); }} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 font-body text-sm font-semibold text-primary hover:bg-surface-secondary">
                <Plus size={16} className="shrink-0" /> Folder baru
              </button>
            </div>
          )}
        </div>
        <span aria-hidden="true" className="mx-1 h-5 w-px flex-none bg-border" />
        {/* Filter chips — COPY PASTE: border-2 rounded-full text-[13px] */}
        {filters.map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f.toLowerCase())}
            className={`rounded-full border-2 px-3 py-1.5 text-[13px] font-semibold transition-colors ${filter === f.toLowerCase() ? 'border-primary bg-primary-light text-primary' : 'border-border text-text-secondary hover:border-text-muted'}`}>{f}</button>
        ))}
        {/* Grid/List toggle — COPY PASTE: border-2 rounded-full */}
        <div className="ml-auto flex gap-1.5">
          <button type="button" aria-pressed={true} onClick={() => setView('dashboard')} className="rounded-full border-2 px-3 py-1.5 text-[13px] font-semibold transition-colors border-primary bg-primary-light text-primary">Grid</button>
          <button type="button" aria-pressed={false} className="rounded-full border-2 px-3 py-1.5 text-[13px] font-semibold transition-colors border-border text-text-secondary hover:border-text-muted">List</button>
        </div>
      </div>
      {/* Note cards grid — COPY PASTE: grid gap-5 [grid-template-columns:repeat(3,...)] */}
      {notes.length === 0 ? (
        <div className="text-center py-12"><BookOpen size={32} className="mx-auto text-text-muted mb-2" /><p className="text-sm text-text-muted">Belum ada catatan. Upload materi untuk mulai belajar!</p></div>
      ) : (
        <div className="grid gap-5 [grid-template-columns:repeat(3,minmax(0,1fr))] max-[900px]:[grid-template-columns:repeat(2,minmax(0,1fr))] max-[600px]:[grid-template-columns:minmax(0,1fr)]">
          {notes.map(n => (
            <div key={n.id} className="group relative rounded-2xl border-2 border-border bg-surface p-3 transition-colors hover:border-text-muted">
              <a className="relative block overflow-hidden rounded-xl" href="#" onClick={(e) => { e.preventDefault(); onNoteClick(n); }}>
                {/* Preview area — COPY PASTE: aspect-video w-full overflow-hidden bg-surface-secondary */}
                {/* Cover = first page of the attached PDF (via /documents/<id>/cover), like pelajarin */}
                <div className="relative aspect-video w-full overflow-hidden bg-surface-secondary">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    decoding="async"
                    className="size-full object-cover object-top"
                    src={(n as any).has_document ? `/api/v1/documents/${(n as any).file_ids[0]}/cover` : '/pelajarin-assets/img/pai-head.png'}
                    onError={(e) => { (e.target as HTMLImageElement).src = '/pelajarin-assets/img/pai-head.png'; }}
                  />
                </div>
                {/* PDF badge — COPY PASTE: absolute left-2.5 top-2.5 rounded-lg bg-white px-2.5 py-1 */}
                <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-[#1b2430] shadow-[0_1px_4px_rgba(0,0,0,.16)]">
                  <FileText size={14} className="flex-none" />
                  {n.status === 'processing' ? 'NEW' : 'PDF'}
                </span>
              </a>
              {/* Card content — COPY PASTE: px-1 pb-1 pt-3.5 */}
              <div className="px-1 pb-1 pt-3.5">
                <div className="flex items-start gap-2">
                  <a className="line-clamp-2 min-h-[2lh] min-w-0 flex-1 font-body text-base font-semibold leading-[1.38] text-text-primary" href="#" onClick={(e) => { e.preventDefault(); onNoteClick(n); }}>{n.title}</a>
                  <button type="button" aria-label="More actions" className="grid size-8 flex-none place-items-center rounded-lg text-text-muted transition-colors hover:bg-surface-secondary hover:text-text-primary"><MoreHorizontal size={18} /></button>
                </div>
                <p className="mt-2.5 text-[13.5px] text-text-muted">Created {new Date(n.updated_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                {n.status === 'processing' && <div className="mt-2 flex items-center gap-1 text-xs text-primary"><Loader2 size={10} className="animate-spin" /> Processing...</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

// === Note Detail with 9 tabs ===
function BimoNoteDetail({ note, activeTab, usage, onUpgrade, onBack }: { note: Note; activeTab: string; usage: Usage | null; onUpgrade: () => void; onBack: () => void }) {
  const [noteDetail, setNoteDetail] = useState<any>(null);
  const [tab, setTab] = useState(activeTab);

  useEffect(() => { setTab(activeTab); }, [activeTab]);
  useEffect(() => { fetch(`/api/v1/notes/${note.id}`).then(r => r.json()).then(d => setNoteDetail(d.data)).catch(() => {}); }, [note.id]);

  // Study heartbeat — per pelajarin RE (RECON-DEEP-v4 §2.6): POST /gamification/study/heartbeat
  // Auto-send every 60s while the user is viewing a note detail. Awards 3 XP
  // per 5-min milestone + keeps the streak alive. Cleans up on unmount.
  useEffect(() => {
    const interval = setInterval(() => {
      fetch('/api/v1/gamification/study/heartbeat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes: 1 }),
      }).catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, [note.id]);

  // Per-tab main content max-width (captured):
  // belajar/kuis/flashcard/tempel: max-w-[1120px] px-[clamp(28px,5vw,72px)]
  // catatan/mindmap/sumber/chat: full height flex h-[calc(100vh-4rem)]
  // podcast: max-w-[1360px]
  // Full-height tabs: catatan/mindmap/sumber/chat use flex h-[calc(100vh-4rem)]
  const isFullHeight = ['catatan', 'mindmap', 'sumber', 'chat'].includes(tab);
  // Sticky FAB offset: 404px when the 380px AI aside is visible (lg), else 24px
  const hasAside = ['catatan', 'sumber'].includes(tab);
  const fabRight = hasAside ? 404 : 24;

  return (
    <main className="flex min-w-0 flex-1 flex-col" style={{ height: isFullHeight ? 'calc(100vh - 4rem)' : 'auto' }}>
      {/* Tab content */}
      {tab === 'belajar' && <BelajarTab note={noteDetail} onUpgrade={onUpgrade} onBack={onBack} />}
      {tab === 'catatan' && <CatatanTab note={noteDetail} noteId={note.id} />}
      {tab === 'mindmap' && <MindmapTab note={noteDetail} />}
      {tab === 'kuis' && <QuizTab key={`quiz-${note.id}-${tab}`} noteId={note.id} />}
      {tab === 'flashcard' && <FlashcardTab key={`flash-${note.id}-${tab}`} noteId={note.id} />}
      {tab === 'sumber' && <SourcesTab note={noteDetail} noteId={note.id} />}
      {tab === 'chat' && <ChatTab noteId={note.id} noteTitle={note.title} usage={usage} />}
      {tab === 'podcast' && <PodcastTab noteId={note.id} noteTitle={note.title} />}
      {tab === 'tempel' && <StickyTab />}
      {/* Sticky notes FAB — COPY PASTE: present on every note tab, bottom-right */}
      <StickyNotesFab offsetRight={fabRight} />
    </main>
  );
}

// === Tab 1: Belajar (Learn) — 3D island journey map (1:1 from auth HTML rip) ===
// Per tab-belajar.html: ol with --amp:142px --isle:160px, each <li> has
// --x: calc(var(--amp) * N) where N alternates 0.000, 1.000, 0.000, -1.000...
// SVG journey-path connects islands with dotted lines.
// First chapter: <a> (clickable) + green check badge. Rest: <div> + lock badge + grayscale filter.
const BROMO_ISLANDS = [
  '/pelajarin-assets/img/bromo-01-CeLXIM2X.webp',
  '/pelajarin-assets/img/bromo-07-Q2mrRcas.webp',
  '/pelajarin-assets/img/bromo-13-CLYdEMAj.webp',
  '/pelajarin-assets/img/bromo-18-DfKN9Si-.webp',
  '/pelajarin-assets/img/bromo-24-DTjGE7XZ.webp',
  '/pelajarin-assets/img/bromo-30-CszJu1cD.webp',
];
// Themed location names per chapter (from auth capture — Bromo Expedition theme)
const BROMO_LOCATIONS = ['Gapura Tengger', 'Seruni Point', 'Lautan pasir', 'Warung kawah', 'Pos tangga', 'Kawah Bromo · 2,329 m'];

function BelajarTab({ note, onUpgrade, onBack }: { note: any; onUpgrade: () => void; onBack: () => void }) {
  if (!note) return <Loader2 className="animate-spin text-muted mx-auto mt-16" size={24} />;
  const chapters = note?.chapters || [];
  const totalChapters = chapters.length;
  const completedCount = 1;
  const progress = totalChapters > 0 ? Math.round(completedCount * 100 / totalChapters) : 0;
  // Zig-zag x values: 0 (left), 1 (right), 0, -1 (from auth HTML: --x: calc(var(--amp) * N))
  const xValues = [0, 1, 0, -1];
  const nextChapter = chapters[completedCount]?.title;

  return (
    <div className="mx-auto w-full max-w-[1120px] px-[clamp(28px,5vw,72px)] pb-20 pt-8 max-lg:px-5 max-lg:pb-[72px]">
      <div className="mx-auto max-w-[900px]">
        {/* Top section — COPY PASTE: snack mascot + league badge + title + progress */}
        <section className="mb-7 mt-4 flex items-center gap-6 max-sm:gap-3.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img sizes="132px" alt="" aria-hidden="true" decoding="async" className="object-contain pointer-events-none size-[132px] flex-none max-sm:size-[84px]" src="/assets/snack-DGXTg2Ey.webp" />
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="inline-flex h-8 items-center gap-2 rounded-full px-3.5 font-heading text-sm font-bold text-text-primary" style={{ backgroundColor: 'color-mix(in srgb, var(--color-league-bromo) 16%, transparent)' }}>
                <Flag size={16} className="shrink-0" /> Bromo Expedition
              </span>
            </div>
            <h1 className="font-heading text-[clamp(28px,4vw,44px)] font-bold leading-[1.12] tracking-[-0.01em] text-text-primary">{note.title || 'Catatan Baru'}</h1>
            <div className="mt-5 flex max-w-[560px] items-center gap-3.5">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-tertiary">
                <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${progress}%` }} />
              </div>
              <span className="flex-none font-heading text-[15px] font-bold text-text-secondary">{progress}%</span>
            </div>
          </div>
        </section>

        {/* Upgrade + Up next — COPY PASTE from tab-belajar.html */}
        <section className="mb-11 flex flex-wrap items-center gap-6 max-sm:mb-8 max-sm:gap-3.5">
          <button type="button" onClick={onUpgrade} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border-2 border-transparent font-body font-semibold tracking-[0.02em] select-none transition-[transform,box-shadow,background-color,border-color] h-11 px-6 text-sm text-text-inverse bg-primary hover:bg-primary-hover shadow-[0_4px_0_var(--color-primary-dark)] active:translate-y-0.5 active:shadow-[0_2px_0_var(--color-primary-dark)]">
            <Lock size={18} className="shrink-0" /> Upgrade to Pro
          </button>
          {nextChapter && (
            <div>
              <div className="font-heading text-[11px] font-bold tracking-[0.12em] text-text-muted">Up next</div>
              <div className="mt-0.5 text-base font-semibold text-text-primary">{nextChapter}</div>
            </div>
          )}
        </section>

        {/* Chapters heading — COPY PASTE */}
        <div className="mb-2 flex items-center gap-3">
          <h2 className="flex-1 font-heading text-[clamp(20px,3vw,24px)] font-bold text-text-primary">Chapters</h2>
          <span className="text-sm text-text-secondary">{completedCount} of {totalChapters} done</span>
        </div>

        {/* Journey map — COPY PASTE: ol with --amp/--isle + li --x zig-zag + SVG journey-path */}
        {chapters.length > 0 ? (
          <ol className="relative m-0 list-none p-0 [--amp:142px] [--isle:160px] max-[899px]:[--amp:84px] max-[899px]:[--isle:128px] max-sm:[--amp:0px] max-sm:[--isle:96px]">
            <svg data-journey-path="true" aria-hidden="true" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 z-0 size-full overflow-visible" viewBox="0 0 900 1124">
              {/* Green solid path for the completed segment */}
              <path d="M 503.9 158.9 L 538.1 199.9" fill="none" stroke="var(--color-success)" strokeWidth="6" strokeLinecap="round" />
              {/* Dotted trail for remaining segments */}
              <path d="M 540.0 330.3 L 502.0 378.5" fill="none" stroke="var(--color-journey-trail)" strokeDasharray="1 15" strokeWidth="6" strokeLinecap="round" />
              <path d="M 396.1 508.9 L 361.9 549.9" fill="none" stroke="var(--color-journey-trail)" strokeDasharray="1 15" strokeWidth="6" strokeLinecap="round" />
              <path d="M 354.7 684.2 L 403.3 756.6" fill="none" stroke="var(--color-journey-trail)" strokeDasharray="1 15" strokeWidth="6" strokeLinecap="round" />
              <path d="M 495.3 897.2 L 546.7 977.6" fill="none" stroke="var(--color-journey-trail)" strokeDasharray="1 15" strokeWidth="6" strokeLinecap="round" />
            </svg>

            {chapters.map((c: any, i: number) => {
              const xVal = xValues[i % xValues.length];
              const isRight = xVal > 0;
              const isLeft = xVal < 0;
              const isCompleted = i < completedCount;
              const islandImg = BROMO_ISLANDS[i % BROMO_ISLANDS.length];
              const locationName = BROMO_LOCATIONS[i % BROMO_LOCATIONS.length];

              return (
                <li
                  key={c.id}
                  className={`relative z-[1] flex items-center gap-4 [height:var(--isle)] max-sm:mb-6 max-sm:gap-3 max-sm:last:mb-0 ${isRight ? 'flex-row-reverse pr-[calc(50%_-_var(--x)_-_var(--isle)_/_2)] max-sm:flex-row max-sm:pr-0' : 'pl-[calc(50%_+_var(--x)_-_var(--isle)_/_2)] max-sm:pl-0'}`}
                  style={{ ['--x' as any]: `calc(var(--amp) * ${xVal}.000)` }}
                >
                  {/* Island — <a> if completed (clickable), <span> if locked */}
                  {isCompleted ? (
                    <a aria-label={`Chapter ${i + 1}: ${c.title}`} className="relative block flex-none [height:var(--isle)] [width:var(--isle)] cursor-pointer rounded-3xl transition-transform hover:-translate-y-1 active:translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" href="#" onClick={(e) => e.preventDefault()}>
                      <span data-dot="true" className="block size-full">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt="" draggable={false} className="size-full select-none object-contain" src={islandImg} width={160} height={160} />
                        <span className="absolute left-[72%] top-[67%] grid size-9 place-items-center rounded-full max-sm:size-7 border-[3px] border-surface bg-success text-text-inverse">
                          <CheckCircle size={18} className="shrink-0" />
                        </span>
                      </span>
                    </a>
                  ) : (
                    <span data-dot="true" className="relative block flex-none [height:var(--isle)] [width:var(--isle)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt="" draggable={false} className="size-full select-none object-contain [filter:grayscale(60%)_brightness(1.22)_contrast(0.7)] dark:[filter:grayscale(70%)_brightness(0.72)_contrast(0.85)]" src={islandImg} width={160} height={160} />
                      <span className="absolute left-[72%] top-[67%] grid size-9 place-items-center rounded-full max-sm:size-7 border-2 border-border bg-surface text-text-muted">
                        <Lock size={16} className="shrink-0" />
                      </span>
                    </span>
                  )}

                  {/* Chapter card — opposite side */}
                  {isCompleted ? (
                    <a className="flex min-w-0 max-w-[340px] flex-[0_1_auto] flex-col rounded-lg px-3.5 py-1.5 group/row transition-colors hover:bg-warning-light" href="#" onClick={(e) => e.preventDefault()}>
                      <span className="text-xs font-medium text-text-secondary">{locationName}</span>
                      <span className="font-heading text-base font-bold text-text-primary">{c.title}</span>
                      <span className="hidden items-center gap-1.5 text-sm font-medium text-primary group-hover/row:inline-flex">Review <ChevronRight size={14} className="shrink-0" /></span>
                    </a>
                  ) : (
                    <div className="flex min-w-0 max-w-[400px] flex-[0_1_auto] flex-wrap items-center gap-3 rounded-2xl bg-surface-tertiary px-[18px] py-3 max-sm:px-3.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-text-secondary">{locationName}</div>
                        <div className="font-heading text-lg font-bold text-text-primary [overflow-wrap:anywhere] max-sm:text-base">{c.title}</div>
                      </div>
                      <button type="button" onClick={onUpgrade} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl border-2 border-transparent font-body font-semibold tracking-[0.02em] select-none transition-[transform,box-shadow,background-color,border-color] h-11 px-6 text-sm text-text-inverse bg-primary hover:bg-primary-hover shadow-[0_4px_0_var(--color-primary-dark)] active:translate-y-0.5 active:shadow-[0_2px_0_var(--color-primary-dark)]">
                        <Lock size={18} className="shrink-0" /> Upgrade to Pro
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="text-center py-12 rounded-2xl border-2 border-app">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pelajarin-assets/img/pai-thinking.png" alt="" width={64} height={64} className="mx-auto mb-2" style={{ objectFit: 'contain', opacity: 0.7 }} />
            <p className="text-sm text-muted">Catatan belum diproses. Upload materi untuk mulai belajar!</p>
          </div>
        )}
      </div>
    </div>
  );
}

// === Tab 2: Catatan (Notes) — COPY PASTE 1:1 from tab-catatan.html ===
// Layout: flex h-[calc(100vh-4rem)] items-stretch → editor (relative min-w-0 flex-1)
// + aside (380px AI chat). Toolbar: sticky top-0 with 20 buttons. Editor: ProseMirror
// prose classes, max-w-[760px], H1 "Catatan: <title>".
const TOOLBAR_ICON_BTN = 'flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40 disabled:pointer-events-none text-text-secondary hover:bg-surface-tertiary hover:text-text-primary';
const TOOLBAR_DROPDOWN_BTN = 'inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm whitespace-nowrap text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

function CatatanTab({ note, noteId }: { note: any; noteId: string }) {
  const chat = useAsideChat(noteId);
  if (!note) return <Loader2 className="animate-spin text-muted mx-auto mt-16" size={24} />;

  return (
    <div className="flex h-[calc(100vh-4rem)] items-stretch">
      {/* LEFT: editor — relative min-w-0 flex-1 with sticky toolbar + ProseMirror prose */}
      <div className="relative min-w-0 flex-1">
        <div className="relative h-full overflow-y-auto">
          <div className="relative z-[1]">
            <div className="flex flex-col">
              {/* Toolbar — COPY PASTE: sticky top-0 z-30, 20 buttons in exact order */}
              <div className="sticky top-0 z-30 flex items-center gap-0.5 overflow-x-auto border-b-2 border-border bg-surface px-[clamp(16px,3vw,28px)] py-2">
                <button type="button" disabled aria-label="Undo" className={TOOLBAR_ICON_BTN}><Undo2 size={18} className="shrink-0" /></button>
                <button type="button" disabled aria-label="Redo" className={TOOLBAR_ICON_BTN}><Redo2 size={18} className="shrink-0" /></button>
                <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
                {/* Heading type dropdown — exact H icon SVG path from capture */}
                <button type="button" aria-label="Heading type" className={TOOLBAR_DROPDOWN_BTN}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="inline-block shrink-0"><path d="M16.55 4a.5.5 0 0 1 .45.5v11a.5.5 0 0 1-1 0V6.73a8.58 8.58 0 0 1-2.22 2.19.5.5 0 1 1-.56-.84 6.76 6.76 0 0 0 2.83-3.8.5.5 0 0 1 .5-.28ZM2.5 4c.28 0 .5.22.5.5V9h6V4.5a.5.5 0 1 1 1 0v11a.5.5 0 0 1-1 0V10H3v5.5a.5.5 0 0 1-1 0v-11c0-.28.22-.5.5-.5Z" /></svg>
                  <span className="hidden sm:inline">Heading 1</span>
                  <ChevronDown size={16} className="shrink-0" />
                </button>
                {/* Format dropdown — exact AA icon SVG path from capture */}
                <button type="button" aria-label="Format" className={TOOLBAR_DROPDOWN_BTN}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="inline-block shrink-0"><path d="M13 3.5c.2 0 .4.13.47.32l3 8v.02l1.5 3.98a.5.5 0 1 1-.94.36l-1.38-3.68h-5.3l-1.38 3.68a.5.5 0 0 1-.93 0L6.96 13.5H4.04l-1.08 2.69a.5.5 0 1 1-.92-.38l1.2-2.98v-.03l1.8-4.49a.5.5 0 0 1 .92 0l1.8 4.5v.02l.73 1.79 1.04-2.78v-.03l3-7.99A.5.5 0 0 1 13 3.5Zm-2.28 8h4.56L13 5.42l-2.28 6.08Zm-4.16 1L5.5 9.85 4.44 12.5h2.12Z" /></svg>
                  <span className="hidden sm:inline">Format</span>
                  <ChevronDown size={16} className="shrink-0" />
                </button>
                <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
                <button type="button" aria-label="Bold" className={TOOLBAR_ICON_BTN}><Bold size={18} className="shrink-0" /></button>
                <button type="button" aria-label="Italic" className={TOOLBAR_ICON_BTN}><Italic size={18} className="shrink-0" /></button>
                <button type="button" aria-label="Underline" className={TOOLBAR_ICON_BTN}><Underline size={18} className="shrink-0" /></button>
                <button type="button" aria-label="Strikethrough" className={TOOLBAR_ICON_BTN}><Strikethrough size={18} className="shrink-0" /></button>
                <button type="button" aria-label="Inline Code" className={TOOLBAR_ICON_BTN}><Code size={18} className="shrink-0" /></button>
                <button type="button" aria-label="Bullet List" className={TOOLBAR_ICON_BTN}><List size={18} className="shrink-0" /></button>
                <button type="button" aria-label="Numbered List" className={TOOLBAR_ICON_BTN}><ListOrdered size={18} className="shrink-0" /></button>
                <button type="button" aria-label="Task List" className={TOOLBAR_ICON_BTN}><ListTodo size={18} className="shrink-0" /></button>
                <button type="button" aria-label="Blockquote" className={TOOLBAR_ICON_BTN}><TextQuote size={18} className="shrink-0" /></button>
                <button type="button" aria-label="Code Block" className={TOOLBAR_ICON_BTN}><SquareCode size={18} className="shrink-0" /></button>
                <button type="button" aria-label="Horizontal Rule" className={TOOLBAR_ICON_BTN}><Minus size={18} className="shrink-0" /></button>
                <button type="button" aria-label="Insert Link" className={TOOLBAR_ICON_BTN}><Link2 size={18} className="shrink-0" /></button>
                <button type="button" aria-label="Insert Table" className={TOOLBAR_ICON_BTN}><Table size={18} className="shrink-0" /></button>
                <button type="button" aria-label="Insert inline formula" className={TOOLBAR_ICON_BTN}><Sigma size={18} className="shrink-0" /></button>
                <button type="button" aria-label="Insert block formula" className={TOOLBAR_ICON_BTN}><Pi size={18} className="shrink-0" /></button>
                <div className="ml-auto flex items-center pl-2">
                  <button type="button" aria-label="Export PDF" className={TOOLBAR_DROPDOWN_BTN}>
                    <FileDown size={18} className="shrink-0" />
                    <span className="hidden sm:inline">Export PDF</span>
                  </button>
                </div>
              </div>
              {/* Editor content — COPY PASTE ProseMirror prose classes + H1 title */}
              <div className="tiptap ProseMirror prose prose-sm sm:prose-base focus:outline-none prose-headings:font-heading prose-headings:font-bold prose-headings:text-text-primary prose-p:text-text-primary prose-p:leading-relaxed prose-strong:text-text-primary prose-strong:font-semibold prose-a:text-secondary prose-a:no-underline hover:prose-a:underline prose-code:rounded prose-code:bg-surface-tertiary prose-code:px-1.5 prose-code:py-0.5 prose-code:text-primary prose-code:font-medium prose-code:before:content-none prose-code:after:content-none prose-blockquote:border-primary prose-blockquote:text-text-secondary prose-li:text-text-primary mx-auto min-h-[70vh] max-w-[760px] px-6 pb-32 pt-8 [&_h1]:text-[28px] [&_h1]:leading-[1.15] [&_h2]:text-[22px] [&_h3]:text-lg">
                <h1>{`Catatan: ${note.title || 'Catatan Baru'}`}</h1>
                {note.content
                  ? <div className="rich-text space-y-3"><Markdown content={note.content} /></div>
                  : <p className="text-text-muted">Catatan belum diproses.</p>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: AI chat aside — shared exact pelajarin component */}
      <AiAside
        noteId={noteId}
        subtitle="I can help you understand these notes and answer any question."
        messages={chat.messages}
        input={chat.input}
        setInput={chat.setInput}
        streaming={chat.streaming}
        onSend={chat.send}
      />
    </div>
  );
}

// === Tab 3: Mindmap — COPY PASTE 1:1 from tab-mindmap.html ===
// flex h-[calc(100vh-4rem)] items-stretch → min-w-0 flex-1 → custom canvas
// (bg-surface-secondary/40, zoom controls top-left, gray edges, no minimap)
function MindmapTab({ note }: { note: any }) {
  return (
    <div className="flex h-[calc(100vh-4rem)] items-stretch">
      <div className="min-w-0 flex-1">
        <div className="relative flex h-full w-full flex-col">
          <MindmapView note={note} />
        </div>
      </div>
    </div>
  );
}

// === Tab 4: Kuis (Quiz) — COPY PASTE 1:1 from tab-kuis.html ===
// mx-auto max-w-[1120px] → inner max-w-2xl m-auto; counter text-secondary;
// New Quiz/Repeat/Edit: bg-neutral shadow-[0_4px_0_var(--color-neutral-edge)];
// question: font-heading text-xl sm:text-2xl; hint: bg-warning-light text-warning;
// options: bg-surface-tertiary hover:bg-border, letter bg-surface-secondary.
const QUIZ_CTRL_BTN = 'inline-flex items-center justify-center gap-2 whitespace-nowrap font-body font-semibold rounded-full select-none transition-all duration-100 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:translate-y-[2px] bg-neutral text-text-primary shadow-[0_4px_0_var(--color-neutral-edge)] hover:brightness-105 active:shadow-[0_2px_0_var(--color-neutral-edge)] focus-visible:ring-primary h-9 px-4 text-sm';
const QUIZ_PREV_BTN = 'inline-flex items-center justify-center gap-2 whitespace-nowrap font-body font-semibold rounded-full select-none transition-all duration-100 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface bg-transparent text-text-primary hover:bg-surface-secondary active:translate-y-0 focus-visible:ring-primary h-11 px-5 text-[15px]';
const QUIZ_NEXT_BTN = 'inline-flex items-center justify-center gap-2 whitespace-nowrap font-body font-semibold rounded-full select-none transition-all duration-100 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:translate-y-[2px] bg-primary text-text-inverse shadow-[0_4px_0_var(--color-primary-dark)] hover:bg-primary-hover active:shadow-[0_2px_0_var(--color-primary-dark)] focus-visible:ring-primary h-11 px-5 text-[15px]';

function QuizTab({ noteId }: { noteId: string }) {
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [checked, setChecked] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);

  async function loadQuizzes() {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/notes/${noteId}/quizzes`);
      const d = await res.json();
      setQuizzes(d.data || []);
    } catch {} finally { setLoading(false); }
  }
  useEffect(() => { loadQuizzes(); }, [noteId]);

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/v1/notes/${noteId}/quizzes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ count: 5 }) });
      const d = await res.json();
      if (d.data) { toast.success(`${d.data.question_count} soal kuis dibuat!`); setSelectedAnswer(null); setShowHint(false); setChecked(false); setCurrentQ(0); loadQuizzes(); }
      else toast.error(d.error?.message || 'Gagal generate kuis');
    } catch { toast.error('Gagal generate kuis'); }
    finally { setGenerating(false); }
  }

  // Flatten all questions from all quizzes
  const allQuestions: any[] = quizzes.flatMap(q => q.questions || []);
  const total = allQuestions.length;

  if (loading) return <div className="mx-auto w-full flex flex-col items-center justify-center py-20 max-w-[1120px]"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-light"><Loader2 size={24} className="animate-spin text-primary" /></div><p className="mt-4 text-sm text-text-secondary">Writing questions...</p></div>;

  if (total === 0) return (
    <div className="mx-auto w-full max-w-[1120px] px-[clamp(28px,5vw,72px)] pb-20 pt-8 max-lg:px-5 max-lg:pb-[72px]">
      <div className="mx-auto flex min-h-[calc(100dvh-11rem)] w-full max-w-2xl flex-col px-5 py-8">
        <div className="m-auto w-full text-center">
          <CheckCircle size={48} className="mx-auto mb-4 text-text-muted" />
          <p className="mb-2 text-base font-semibold text-text-primary">Belum ada kuis.</p>
          <p className="mb-6 text-sm text-text-secondary">Generate kuis dari materi ini untuk mulai berlatih.</p>
          <button onClick={generate} disabled={generating} className={QUIZ_NEXT_BTN + ' h-11 px-6'}>{generating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={16} />} Generate Kuis</button>
        </div>
      </div>
    </div>
  );

  // Single-question-per-screen view (1:1 from auth HTML)
  const q = allQuestions[currentQ];
  const options: string[] = q.options || [];
  // Answer check — handles both formats: letter ("B") and exact option text.
  const correctAnswerText = (() => {
    const ans = String(q.answer || '');
    if (/^[A-Da-d]$/.test(ans) && options.length > 0) {
      const idx = ans.toUpperCase().charCodeAt(0) - 65;
      return options[idx] ?? ans;
    }
    return ans;
  })();
  const isCorrect = selectedAnswer !== null && options[selectedAnswer]?.trim().toLowerCase() === correctAnswerText.trim().toLowerCase();

  return (
    <div className="mx-auto w-full max-w-[1120px] px-[clamp(28px,5vw,72px)] pb-20 pt-8 max-lg:px-5 max-lg:pb-[72px]">
      <div className="mx-auto flex min-h-[calc(100dvh-11rem)] w-full max-w-2xl flex-col px-5 py-8">
        <div className="m-auto w-full">
          <div className="flex flex-col gap-6">
            {/* Top bar — COPY PASTE: counter + New Quiz/Repeat/Edit (bg-neutral) */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-body text-sm font-medium text-text-secondary">{currentQ + 1} / {total}</span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={generate} disabled={generating} className={QUIZ_CTRL_BTN}><Plus size={16} className="shrink-0" /> New Quiz</button>
                <button type="button" onClick={generate} disabled={generating} className={QUIZ_CTRL_BTN}><RotateCcw size={16} className="shrink-0" /> Repeat Quiz</button>
                <button type="button" className={QUIZ_CTRL_BTN}><Settings size={16} className="shrink-0" /> Edit</button>
              </div>
            </div>

            {/* Question content — COPY PASTE: h2 rich-text + Show Hint (bg-warning-light) */}
            <div className="py-2" style={{ opacity: 1, transform: 'none' }}>
              <h2 className="font-heading text-xl font-bold text-text-primary mb-4 sm:text-2xl">
                <div className="rich-text space-y-3"><p className="leading-relaxed">{q.question}</p></div>
              </h2>
              {q.hint && (
                <button type="button" onClick={() => setShowHint(prev => !prev)} className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-warning-light px-3 py-1.5 font-body text-xs font-semibold text-warning transition-colors hover:bg-warning-light/70">
                  <Lightbulb size={14} className="shrink-0" /> Show Hint
                </button>
              )}
              {showHint && q.hint && (
                <div className="mb-4 rounded-xl bg-warning-light p-4"><p className="text-sm text-text-primary">{q.hint}</p></div>
              )}

              {/* Answer options — COPY PASTE: bg-surface-tertiary hover:bg-border, letter bg-surface-secondary */}
              <div className="grid gap-3">
                {options.map((opt, oi) => {
                  const isSelected = selectedAnswer === oi;
                  const isAnswer = opt?.trim().toLowerCase() === correctAnswerText.trim().toLowerCase();
                  const showResult = checked && (isAnswer || isSelected);
                  return (
                    <button key={oi} type="button" onClick={() => !checked && setSelectedAnswer(oi)} disabled={checked} tabIndex={0}
                      className={`flex items-center gap-3 rounded-2xl p-4 text-left transition-all disabled:cursor-not-allowed ${checked && isAnswer ? 'bg-success-light' : checked && isSelected && !isCorrect ? 'bg-error-light' : isSelected ? 'bg-primary-light' : 'bg-surface-tertiary hover:bg-border'}`}>
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-semibold text-sm ${checked && isAnswer ? 'bg-success text-text-inverse' : checked && isSelected && !isCorrect ? 'bg-error text-text-inverse' : isSelected ? 'bg-primary text-text-inverse' : 'bg-surface-secondary text-text-secondary'}`}>
                        {String.fromCharCode(65 + oi)}
                      </div>
                      <span className="flex-1 font-body text-sm text-text-primary font-medium">{opt}</span>
                      {showResult && isAnswer && <CheckCircle size={18} className="ml-auto flex-none text-success" />}
                    </button>
                  );
                })}
              </div>

              {/* Explanation after check */}
              {checked && q.explanation && (
                <div className={`rounded-2xl p-4 ${isCorrect ? 'bg-success-light' : 'bg-error-light'}`}>
                  <p className={`mb-1 text-sm font-semibold ${isCorrect ? 'text-success' : 'text-error'}`}>{isCorrect ? 'Benar!' : 'Belum tepat'}</p>
                  <p className="text-sm text-text-primary">{q.explanation}</p>
                </div>
              )}

              {/* Previous / Check answer / Next — COPY PASTE exact button classes */}
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => { if (currentQ > 0) { setCurrentQ(prev => prev - 1); setSelectedAnswer(null); setShowHint(false); setChecked(false); } }} disabled={currentQ === 0} className={QUIZ_PREV_BTN}>
                  <ChevronLeft size={16} className="shrink-0" /> Previous
                </button>
                {checked ? (
                  <button type="button" onClick={() => { if (currentQ < total - 1) { setCurrentQ(prev => prev + 1); setSelectedAnswer(null); setShowHint(false); setChecked(false); } }} disabled={currentQ === total - 1} className={QUIZ_NEXT_BTN}>
                    Next
                  </button>
                ) : (
                  <button type="button" onClick={() => setChecked(true)} disabled={selectedAnswer === null} className={QUIZ_NEXT_BTN}>
                    Check answer
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// === Tab 5: Flashcard — COPY PASTE 1:1 from tab-flashcard.html ===
// perspective-[1000px] flip card, front bg-surface / back bg-primary-light/40,
// border-2 border-border shadow-[0_4px_0_var(--color-border)], controls bg-neutral.
function FlashcardTab({ noteId }: { noteId: string }) {
  const [cards, setCards] = useState<any[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [currentCard, setCurrentCard] = useState(0);

  async function loadCards() {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/notes/${noteId}/flashcards`);
      const d = await res.json();
      setCards(d.data || []);
    } catch {} finally { setLoading(false); }
  }
  useEffect(() => { loadCards(); }, [noteId]);

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/v1/notes/${noteId}/flashcards`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ count: 5 }) });
      const d = await res.json();
      if (d.data) { toast.success(`${d.data.count} flashcard dibuat!`); setFlipped(false); setCurrentCard(0); loadCards(); }
      else toast.error(d.error?.message || 'Gagal generate flashcard');
    } catch { toast.error('Gagal generate flashcard'); }
    finally { setGenerating(false); }
  }

  if (loading) return <div className="mx-auto w-full flex flex-col items-center justify-center py-20 max-w-[1120px]"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-light"><Loader2 size={24} className="animate-spin text-primary" /></div><p className="mt-4 text-sm text-text-secondary">Making card {currentCard + 1} of 5...</p></div>;

  if (cards.length === 0) return (
    <div className="mx-auto w-full max-w-[1120px] px-[clamp(28px,5vw,72px)] pb-20 pt-8 max-lg:px-5 max-lg:pb-[72px]">
      <div className="mx-auto flex min-h-[calc(100dvh-11rem)] w-full max-w-2xl flex-col px-5 py-8">
        <div className="m-auto w-full text-center">
          <Brain size={48} className="mx-auto mb-4 text-text-muted" />
          <p className="mb-2 text-base font-semibold text-text-primary">Belum ada flashcard.</p>
          <p className="mb-6 text-sm text-text-secondary">Generate flashcard dari materi ini untuk mulai berlatih.</p>
          <button onClick={generate} disabled={generating} className={QUIZ_NEXT_BTN + ' h-11 px-6'}>{generating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={16} />} Generate Flashcard</button>
        </div>
      </div>
    </div>
  );

  // Single-card-per-screen flip view — COPY PASTE classes from tab-flashcard.html
  const card = cards[currentCard];
  const total = cards.length;

  return (
    <div className="mx-auto w-full max-w-[1120px] px-[clamp(28px,5vw,72px)] pb-20 pt-8 max-lg:px-5 max-lg:pb-[72px]">
      <div className="mx-auto flex min-h-[calc(100dvh-11rem)] w-full max-w-2xl flex-col px-5 py-8">
        <div className="m-auto w-full">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4">
              {/* Top bar — COPY PASTE: counter + Regenerate/Restart/Manage (bg-neutral) */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-body text-sm font-medium text-text-secondary">{currentCard + 1} / {total}</span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={generate} disabled={generating} className={QUIZ_CTRL_BTN}>{generating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} className="shrink-0" />} Regenerate</button>
                  <button type="button" onClick={() => { setCurrentCard(0); setFlipped(false); }} className={QUIZ_CTRL_BTN}><RotateCcw size={16} className="shrink-0" /> Restart</button>
                  <button type="button" className={QUIZ_CTRL_BTN}><Settings size={16} className="shrink-0" /> Manage</button>
                </div>
              </div>

              {/* Flip card — COPY PASTE: perspective-[1000px], min-h-[22rem], rotateY faces */}
              <div className="perspective-[1000px] w-full" style={{ perspective: '1000px' }}>
                <button type="button" onClick={() => setFlipped(prev => !prev)}
                  className="relative w-full rounded-3xl min-h-[22rem] cursor-pointer"
                  style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)', transition: 'transform 0.6s' }}>
                  {/* Question face — bg-surface, border-2, shadow-[0_4px_0_var(--color-border)] */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 rounded-3xl border-2 border-border bg-surface shadow-[0_4px_0_var(--color-border)]" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(0deg)' }}>
                    <div className="text-xs font-semibold text-text-muted mb-3">Question</div>
                    <div className="font-heading text-xl font-bold text-text-primary sm:text-2xl">
                      <div className="rich-text space-y-3"><p className="leading-relaxed">{card.front}</p></div>
                    </div>
                    <div className="absolute bottom-6 left-0 right-0 text-center text-xs text-text-muted">Click to see the answer</div>
                  </div>
                  {/* Answer face — bg-primary-light/40 */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 rounded-3xl border-2 border-border shadow-[0_4px_0_var(--color-border)] bg-primary-light/40" style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                    <div className="text-xs font-semibold text-text-muted mb-3">Answer</div>
                    <div className="font-body text-base text-text-primary sm:text-lg leading-relaxed">
                      <div className="rich-text space-y-3"><p className="leading-relaxed">{card.back}</p></div>
                    </div>
                  </div>
                </button>
              </div>

              {/* Previous / Next — COPY PASTE: rounded-xl px-3 font-heading text-sm font-bold */}
              <div className="flex items-center justify-between">
                <button type="button" onClick={() => { if (currentCard > 0) { setCurrentCard(prev => prev - 1); setFlipped(false); } }} disabled={currentCard === 0}
                  className="inline-flex h-11 items-center gap-2 rounded-xl px-3 font-heading text-sm font-bold text-text-secondary disabled:opacity-40">
                  <ChevronLeft size={16} className="shrink-0" /> Previous
                </button>
                <button type="button" onClick={() => { if (currentCard < total - 1) { setCurrentCard(prev => prev + 1); setFlipped(false); } }} disabled={currentCard === total - 1}
                  className="inline-flex h-11 items-center gap-2 rounded-xl px-3 font-heading text-sm font-bold text-text-secondary disabled:opacity-40">
                  Next <ChevronRight size={16} className="shrink-0" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// === Tab 6: Sumber (Sources) — COPY PASTE 1:1 from tab-sumber.html ===
// File bar (h-[52px], PDF SVG icon, filename, "Open ↗") + PDF iframe viewer +
// AI chat aside (380px). NOTE: hooks are called unconditionally (React rules).
function SourcesTab({ note, noteId }: { note: any; noteId: string }) {
  const chat = useAsideChat(noteId);
  const files: any[] = note?.files || [];
  const firstFile = files[0] || null;

  return (
    <div className="flex h-[calc(100vh-4rem)] items-stretch">
      {/* LEFT: file bar + PDF iframe — COPY PASTE exact classes */}
      <section className="flex min-h-0 flex-col overflow-hidden bg-surface-secondary min-w-0 flex-1">
        {firstFile ? (
          <>
            <div className="flex h-[52px] flex-none items-center gap-3 bg-surface px-4">
              <PdfFileIcon />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">{firstFile.filename}</span>
              <a href={`/api/v1/documents/${firstFile.id}/file`} target="_blank" rel="noopener noreferrer" className="flex-none text-[13px] font-semibold text-primary hover:underline">Open ↗</a>
            </div>
            <iframe
              src={`/api/v1/documents/${firstFile.id}/file#toolbar=0&navpanes=0&view=FitH`}
              title={firstFile.filename}
              className="min-h-0 w-full flex-1 border-0 bg-surface"
            />
          </>
        ) : (
          /* Empty viewer — upload prompt (AI aside tetap tampil seperti pelajarin) */
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/idle-Ctcj4aS0.webp" alt="" aria-hidden="true" className="object-contain size-[88px]" />
            <h2 className="font-heading text-xl font-bold text-text-primary">Belum ada sumber</h2>
            <p className="max-w-[380px] text-sm leading-relaxed text-text-secondary">Upload PDF, slide, atau audio di halaman utama untuk melihat sumber materi di sini.</p>
          </div>
        )}
      </section>

      {/* RIGHT: AI chat aside — "I have already read it" subtitle */}
      <AiAside
        noteId={noteId}
        subtitle="Ask anything about this document — I have already read it."
        messages={chat.messages}
        input={chat.input}
        setInput={chat.setInput}
        streaming={chat.streaming}
        onSend={chat.send}
      />
    </div>
  );
}

// === Tab 7: Chat (Ask AI) — COPY PASTE 1:1 from tab-chat.html ===
// Full-height section bg-surface, header "Percakapan Baru ▾" (px-4 py-3 lg:px-6),
// centered greeting (idle mascot 112px, h2 text-[26px]) + composer max-w-[680px]
// with mic + "Talk to Pai" violet button (waveform icon + lock badge).
function ChatTab({ noteId, noteTitle, usage }: { noteId: string; noteTitle: string; usage: Usage | null }) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [clarifying, setClarifying] = useState(false);
  const sessionIdRef = useRef<string>('');
  useEffect(() => { sessionIdRef.current = crypto.randomUUID(); }, [noteId]);

  async function send() {
    if (!input.trim() || streaming) return;
    if (usage && !usage.canSendChat) { toast.error('Batas chat tercapai. Upgrade ke Pro.'); return; }
    const msg = input.trim(); setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setStreaming(true);
    try {
      const res = await fetch('/api/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note_id: noteId, session_id: sessionIdRef.current, message: msg }) });
      if (!res.ok) { const err = await res.json(); toast.error(err.error?.message || 'Chat gagal'); return; }
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      await readSSE(res, (text) => setMessages(prev => { const c = [...prev]; c[c.length - 1] = { role: 'assistant', content: text }; return c; }));
      fetch('/api/v1/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_name: 'chat_session', note_id: noteId }) }).catch(() => {});
    } catch { toast.error('Chat error'); }
    finally { setStreaming(false); }
  }

  // Clarify — POST /api/v2/chat/clarify/stream (SSE), per RECON-DEEP-v4 §2.1
  async function clarify(mode: 'simpler' | 'shorter' | 'detailed' | 'example') {
    if (streaming || clarifying) return;
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistant || !lastAssistant.content) { toast.error('Belum ada jawaban untuk dijelaskan ulang'); return; }
    setClarifying(true);
    try {
      const res = await fetch('/api/v2/chat/clarify/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sessionIdRef.current, mode }) });
      if (!res.ok) { const err = await res.json(); toast.error(err.error?.message || 'Clarify gagal'); return; }
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      await readSSE(res, (text) => setMessages(prev => { const c = [...prev]; c[c.length - 1] = { role: 'assistant', content: text }; return c; }));
    } catch { toast.error('Clarify error'); }
    finally { setClarifying(false); }
  }

  const CLARIFY_BUTTONS: { mode: 'simpler' | 'shorter' | 'detailed' | 'example'; label: string }[] = [
    { mode: 'simpler', label: 'Jelaskan ulang' },
    { mode: 'shorter', label: 'Lebih ringkas' },
    { mode: 'detailed', label: 'Lebih detail' },
    { mode: 'example', label: 'Dengan contoh' },
  ];

  const lastMsg = messages[messages.length - 1];
  const showClarify = lastMsg?.role === 'assistant' && lastMsg.content && !streaming && !clarifying;
  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-[calc(100vh-4rem)] items-stretch">
      <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface">
        {/* Header — COPY PASTE: px-4 py-3 lg:px-6 */}
        <header className="flex items-center gap-3 px-4 py-3 lg:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <button type="button" className="flex min-w-0 max-w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left transition-colors hover:bg-surface-secondary">
              <span className="truncate font-heading text-[15px] font-bold text-text-primary">Percakapan Baru</span>
              <ChevronDown size={16} className="flex-none text-text-muted" />
            </button>
            <button type="button" aria-label="New Chat" title="New Chat" onClick={() => setMessages([])} className="grid size-8 flex-none place-items-center rounded-lg text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary">
              <Plus size={18} className="shrink-0" />
            </button>
          </div>
        </header>

        {hasMessages ? (
          <div className="flex min-h-0 flex-1 flex-col px-4 lg:px-6">
            {/* Messages list */}
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto pb-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${m.role === 'user' ? 'bg-primary-light text-primary' : 'bg-surface-tertiary text-text-primary'}`}>
                    {m.role === 'assistant' && m.content === '' && (streaming || clarifying) ? <Loader2 size={14} className="animate-spin" /> : m.role === 'assistant' ? <div className="prose prose-sm max-w-none"><Markdown content={m.content} /></div> : m.content}
                  </div>
                </div>
              ))}
              {/* Clarify buttons — after the last assistant answer */}
              {showClarify && (
                <div className="flex flex-wrap gap-2">
                  {CLARIFY_BUTTONS.map(b => (
                    <button key={b.mode} type="button" onClick={() => clarify(b.mode)} disabled={clarifying || streaming} className="inline-flex items-center gap-1.5 rounded-full bg-surface-tertiary px-3 py-1.5 font-body text-xs font-semibold text-text-secondary transition-colors hover:bg-border hover:text-text-primary disabled:opacity-50">
                      <Sparkles size={12} className="shrink-0" /> {b.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Composer at bottom while chatting — same shell */}
            <div className="flex w-full justify-center pb-6">
              <div className="w-full max-w-[680px]">
                <div className="composer-shell grid min-h-[56px] grid-cols-[1fr_auto] items-center gap-x-1.5 rounded-full bg-surface-tertiary py-0 pl-6 pr-2">
                  <textarea
                    rows={1}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder={'Ask anything about this material\u2026'}
                    aria-label={'Ask anything about this material\u2026'}
                    className="col-start-1 row-start-1 m-0 mr-2 min-w-0 resize-none overflow-y-hidden overscroll-contain border-0 bg-transparent p-0 text-[15px] leading-6 text-text-primary outline-none placeholder:overflow-hidden placeholder:text-ellipsis placeholder:whitespace-nowrap placeholder:text-text-muted"
                  />
                  <span className="col-start-2 row-start-1 flex items-center gap-1.5 justify-self-end">
                    <button type="button" aria-label="Voice input" title="Voice input" className="grid size-10 flex-none place-items-center rounded-full transition-colors disabled:opacity-40 text-text-secondary hover:bg-surface-secondary hover:text-text-primary">
                      <Mic size={18} className="shrink-0" />
                    </button>
                    <button type="button" onClick={send} disabled={streaming || !input.trim()} aria-label="Send" className="grid size-10 flex-none place-items-center rounded-full bg-primary text-text-inverse transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-surface-tertiary disabled:text-text-muted">
                      <ArrowUp size={18} className="shrink-0" />
                    </button>
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Empty state — COPY PASTE: centered greeting + tall composer */
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-16">
            <div className="max-w-[340px] text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img sizes="128px" alt="" aria-hidden="true" decoding="async" className="object-contain mx-auto mb-3 size-[112px]" src="/assets/idle-Ctcj4aS0.webp" />
              <h2 className="font-heading font-bold text-text-primary text-[26px]">Hi, I&apos;m Pai!</h2>
              <p className="mt-2 text-sm leading-relaxed text-text-secondary">I can help you understand these notes and answer any question.</p>
            </div>
            <div className="w-full max-sm:order-1 max-w-[680px]">
              <div className="composer-shell grid min-h-[56px] grid-cols-[1fr_auto] items-center gap-x-1.5 rounded-full bg-surface-tertiary py-0 pl-6 pr-2 transition-[border-radius] [&.is-tall]:items-end [&.is-tall]:gap-y-2.5 [&.is-tall]:rounded-[28px] [&.is-tall]:pb-2.5 [&.is-tall]:pt-4">
                <textarea
                  rows={2}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder={'Ask anything about this material\u2026'}
                  aria-label={'Ask anything about this material\u2026'}
                  className="col-start-1 row-start-1 m-0 mr-2 min-w-0 resize-none overflow-y-hidden overscroll-contain border-0 bg-transparent p-0 text-[15px] leading-6 text-text-primary outline-none placeholder:overflow-hidden placeholder:text-ellipsis placeholder:whitespace-nowrap placeholder:text-text-muted"
                />
                <span className="col-start-2 row-start-1 flex items-center gap-1.5 justify-self-end">
                  <button type="button" aria-label="Voice input" title="Voice input" className="grid size-10 flex-none place-items-center rounded-full transition-colors disabled:opacity-40 text-text-secondary hover:bg-surface-secondary hover:text-text-primary">
                    <Mic size={18} className="shrink-0" />
                  </button>
                  {/* When text present: orange Send; when empty: violet "Talk to Pai" (voice) with lock badge */}
                  {input.trim() ? (
                    <button type="button" onClick={send} disabled={streaming} aria-label="Send" className="grid size-10 flex-none place-items-center rounded-full bg-primary text-text-inverse transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-surface-tertiary disabled:text-text-muted">
                      <ArrowUp size={18} className="shrink-0" />
                    </button>
                  ) : (
                    <button type="button" aria-label="Talk to Pai" title="Talk to Pai" className="relative grid size-10 flex-none place-items-center rounded-full bg-pai-violet text-white transition-colors hover:bg-pai-violet-dark disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pai-violet/30">
                      <Volume2 size={18} className="shrink-0" />
                      <span className="absolute -right-1 -top-1 grid size-[18px] place-items-center rounded-full bg-surface text-pai-violet">
                        <Lock size={10} className="shrink-0" />
                      </span>
                    </button>
                  )}
                </span>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// === Tab 8: Podcast — COPY PASTE 1:1 from tab-podcast.html ===
// Radial gradient container (var(--color-podcast-glow/podcast/deep)), host cards
// bg-host-*-light, chips bg-white/15, Length/Language side-by-side, Upgrade inside.
function PodcastTab({ noteId, noteTitle }: { noteId: string; noteTitle: string }) {
  // Hosts — 1:1 from auth HTML: real host images from /assets/ + bg-host-*-light
  const HOSTS = [
    { name: 'Pai', role: 'Explainer', img: '/assets/pai-CXSlTxP1.png', light: 'bg-host-pai-light' },
    { name: 'Kiko', role: 'The curious one', img: '/assets/kiko-BnsmIBKB.png', light: 'bg-host-kiko-light' },
    { name: 'Bolu', role: 'Storyteller', img: '/assets/bolu-DbmSwtX0.png', light: 'bg-host-bolu-light' },
    { name: 'Meli', role: 'Exam coach', img: '/assets/meli-uOrh2rEm.png', light: 'bg-host-meli-light' },
  ];
  const SUGGESTIONS = ['Make it funnier', 'Use anime examples', 'Like canteen gossip', 'Focus on exam questions', "Go slow, I'm a beginner"];
  const [selected, setSelected] = useState<string[]>(['Pai', 'Kiko']);
  const [duration, setDuration] = useState<'3' | '7'>('3');
  const [language, setLanguage] = useState<'id' | 'en'>('id');
  const [activeStyle, setActiveStyle] = useState<string | null>(null);

  // Generation + playback state
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [result, setResult] = useState<{ segments: { speaker: string; text: string; url: string }[] } | null>(null);
  const [currentSeg, setCurrentSeg] = useState(0);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function generate() {
    if (selected.length !== 2) { toast.error('Pilih 2 host dulu'); return; }
    setGenerating(true);
    setProgress('Bimo lagi nulis skrip podcast...');
    try {
      const res = await fetch(`/api/v1/notes/${noteId}/podcast`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hosts: selected, duration, language, style: activeStyle || undefined }),
      });
      const d = await res.json();
      if (d.data?.segments?.length > 0) {
        setResult({ segments: d.data.segments });
        setCurrentSeg(0);
        toast.success(`${d.data.total_segments} segmen podcast siap!`);
      } else {
        toast.error(d.error?.message || 'Gagal generate podcast');
      }
    } catch (e) {
      toast.error(`Gagal: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setGenerating(false); setProgress(''); }
  }

  // Sequential playback — when a segment ends, advance to the next
  function onEnded() {
    if (!result) return;
    if (currentSeg < result.segments.length - 1) {
      setCurrentSeg(prev => prev + 1);
      setPlaying(true);
    } else {
      setPlaying(false);
      setCurrentSeg(0);
    }
  }

  // Autoplay the next segment when it changes (during sequential play)
  useEffect(() => {
    if (playing && audioRef.current && result) {
      audioRef.current.src = result.segments[currentSeg].url;
      audioRef.current.play().catch(() => {});
    }
  }, [currentSeg, playing, result]);

  function togglePlay() {
    if (!result) return;
    if (!playing) { setPlaying(true); }
    else { setPlaying(false); audioRef.current?.pause(); }
  }

  function nextSeg() {
    if (result && currentSeg < result.segments.length - 1) setCurrentSeg(prev => prev + 1);
  }
  function prevSeg() {
    if (currentSeg > 0) setCurrentSeg(prev => prev - 1);
  }

  // === Result view — player + transcript ===
  if (result) {
    const seg = result.segments[currentSeg];
    return (
      <div className="mx-auto flex w-full flex-col" style={{ maxWidth: '760px', padding: '32px clamp(28px, 5vw, 72px)' }}>
        <div className="mb-4 flex items-center gap-3">
          <button type="button" onClick={() => { setResult(null); setPlaying(false); audioRef.current?.pause(); }} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"><ArrowLeft size={16} className="shrink-0" /> Buat ulang</button>
          <h2 className="text-xl font-bold font-heading text-text-primary">{noteTitle}</h2>
        </div>

        {/* Now playing card */}
        <div className="mb-6 rounded-2xl border-2 border-border bg-surface p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-text-inverse font-bold">{seg.speaker[0]}</div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-text-primary">{seg.speaker}</p>
              <p className="text-xs text-text-secondary">Segmen {currentSeg + 1} dari {result.segments.length}</p>
            </div>
            <span className="text-xs text-text-muted">{duration} min</span>
          </div>
          <p className="mb-4 text-sm text-text-primary">{seg.text}</p>

          {/* Audio element (hidden, controlled by buttons) */}
          <audio ref={audioRef} onEnded={onEnded} preload="auto" className="hidden" />

          {/* Player controls */}
          <div className="flex items-center justify-center gap-3">
            <button type="button" onClick={prevSeg} disabled={currentSeg === 0} className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-tertiary text-text-primary transition-colors hover:bg-border disabled:opacity-30">
              <RotateCcw size={16} className="shrink-0" />
            </button>
            <button type="button" onClick={togglePlay} className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-text-inverse shadow-[0_4px_0_var(--color-primary-dark)] transition-all duration-100 hover:bg-primary-hover active:translate-y-[2px] active:shadow-[0_2px_0_var(--color-primary-dark)]">
              {playing ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button type="button" onClick={nextSeg} disabled={currentSeg >= result.segments.length - 1} className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-tertiary text-text-primary transition-colors hover:bg-border disabled:opacity-30">
              <ChevronRight size={16} className="shrink-0" />
            </button>
          </div>
          {/* Progress bar */}
          <div className="mt-4 h-1.5 w-full rounded-full bg-surface-tertiary">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((currentSeg + 1) / result.segments.length) * 100}%` }} />
          </div>
        </div>

        {/* Transcript */}
        <p className="mb-3 text-sm font-semibold text-text-primary">Transkrip</p>
        <div className="max-h-96 space-y-2 overflow-y-auto pr-2" style={{ scrollbarWidth: 'thin' }}>
          {result.segments.map((s, i) => (
            <button key={i} type="button" onClick={() => { setCurrentSeg(i); setPlaying(true); }} className={`block w-full rounded-xl border-2 p-3 text-left transition-colors ${i === currentSeg ? 'border-primary bg-primary-light' : 'border-border bg-surface hover:bg-surface-secondary'}`}>
              <div className="mb-1 flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-text-inverse">{s.speaker[0]}</div>
                <span className="text-xs font-semibold text-text-primary">{s.speaker}</span>
              </div>
              <p className="text-sm text-text-primary">{s.text}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // === Setup view — COPY PASTE 1:1 from tab-podcast.html ===
  return (
    <div className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-[1360px] flex-col justify-center px-[clamp(20px,4vw,56px)] pb-20 pt-8 max-lg:px-4 max-lg:pb-[72px]">
      <div className="mx-auto w-full max-w-[760px]">
        {/* Radial gradient container — exact classes from capture */}
        <div className="gap-0 overflow-hidden rounded-[28px] bg-[radial-gradient(130%_100%_at_30%_0%,var(--color-podcast-glow)_0%,var(--color-podcast)_55%,var(--color-podcast-deep)_100%)] text-white">
          {/* Header */}
          <div className="flex items-start gap-4 px-7 pb-2.5 pt-6">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h2 className="font-heading text-[26px] font-bold tracking-tight text-white">Create a podcast</h2>
              <p className="font-body text-sm text-white/70">From the lesson {noteTitle}</p>
            </div>
          </div>
          {/* Body */}
          <div className="flex flex-col gap-5 px-7 pb-5 pt-2.5">
            {/* Pick 2 hosts — COPY PASTE: bg-host-*-light + real host images */}
            <section className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-heading text-[17px] font-bold text-white">Pick 2 hosts</h3>
                <span className="font-body text-[13px] font-semibold text-white">{selected.length} of 2 picked</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {HOSTS.map(h => {
                  const isSelected = selected.includes(h.name);
                  return (
                    <button key={h.name} type="button" aria-pressed={isSelected} onClick={() => setSelected(prev => prev.includes(h.name) ? prev.filter(n => n !== h.name) : prev.length < 2 ? [...prev, h.name] : [prev[1], h.name])}
                      className={`relative flex flex-col items-center gap-1 rounded-[22px] px-2.5 pb-3.5 pt-4 transition-colors ${isSelected ? h.light : 'bg-surface hover:bg-surface-secondary'}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt="" width={72} height={72} className="size-[72px] rounded-full" src={h.img} />
                      <span className={`font-heading text-base font-bold ${isSelected ? 'text-note-ink' : 'text-text-primary'}`}>{h.name}</span>
                      <span className={`font-body text-xs ${isSelected ? 'text-note-ink/70' : 'text-text-secondary'}`}>{h.role}</span>
                      {/* Check badge when selected — bg-primary text-text-inverse */}
                      {isSelected && (
                        <span className="absolute right-2.5 top-2.5 grid size-6 place-items-center rounded-full bg-primary text-text-inverse">
                          <CheckCircle size={14} className="shrink-0" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
            {/* Style prompt — COPY PASTE: textarea in bg-surface rounded-[18px] + 0/200 */}
            <section className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor="podcast-prompt" className="font-heading text-[17px] font-bold text-white">What should the chat be like?</label>
                <span className="font-body text-xs text-white/60">Optional</span>
              </div>
              <div className="flex flex-col gap-2 rounded-[18px] bg-surface px-3.5 py-3">
                <textarea id="podcast-prompt" rows={3} maxLength={200} placeholder="E.g. make Bolu joke a lot, use canteen snack examples, don't be too serious" className="w-full resize-none border-none bg-transparent font-body text-[15px] leading-normal text-text-primary outline-none placeholder:text-text-muted" value={activeStyle || ''} onChange={(e) => setActiveStyle(e.target.value || null)} />
                <span className="self-end font-body text-xs text-text-muted">{(activeStyle || '').length}/200</span>
              </div>
              {/* Suggestion chips — COPY PASTE: h-9 rounded-full bg-white/15 */}
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map(s => (
                  <button key={s} type="button" onClick={() => setActiveStyle(prev => prev === s ? null : s)} className="h-9 rounded-full bg-white/15 px-3 font-body text-[13px] font-semibold text-white transition-colors hover:bg-white/25">{s}</button>
                ))}
              </div>
            </section>
            {/* Length + Language — COPY PASTE: side-by-side flex flex-wrap gap-5 */}
            <div className="flex flex-wrap gap-5">
              <section className="flex min-w-[220px] flex-1 flex-col gap-2.5">
                <h3 className="font-heading text-[17px] font-bold text-white">Length</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" aria-pressed={duration === '3'} onClick={() => setDuration('3')} className={`h-11 rounded-2xl font-body text-sm font-semibold transition-colors ${duration === '3' ? 'bg-primary text-text-inverse' : 'bg-surface text-text-primary hover:bg-surface-secondary'}`}>3 min</button>
                  <button type="button" aria-pressed={duration === '7'} onClick={() => setDuration('7')} className={`h-11 rounded-2xl font-body text-sm font-semibold transition-colors ${duration === '7' ? 'bg-primary text-text-inverse' : 'bg-surface text-text-primary hover:bg-surface-secondary'}`}>7 min</button>
                </div>
              </section>
              <section className="flex min-w-[200px] flex-1 flex-col gap-2.5">
                <h3 className="font-heading text-[17px] font-bold text-white">Language</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" aria-pressed={language === 'id'} onClick={() => setLanguage('id')} className={`h-11 rounded-2xl font-body text-sm font-semibold transition-colors ${language === 'id' ? 'bg-primary text-text-inverse' : 'bg-surface text-text-primary hover:bg-surface-secondary'}`}>Indonesian</button>
                  <button type="button" aria-pressed={language === 'en'} onClick={() => setLanguage('en')} className={`h-11 rounded-2xl font-body text-sm font-semibold transition-colors ${language === 'en' ? 'bg-primary text-text-inverse' : 'bg-surface text-text-primary hover:bg-surface-secondary'}`}>English</button>
                </div>
              </section>
            </div>
          </div>
          {/* Upgrade to Pro — COPY PASTE: inside container, px-7 pb-7 pt-2 */}
          <div className="flex flex-wrap items-center gap-3 px-7 pb-7 pt-2">
            <button type="button" onClick={generate} disabled={generating} className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full select-none font-body text-[15px] font-semibold transition-all duration-100 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:translate-y-[2px] bg-primary text-text-inverse shadow-[0_4px_0_var(--color-primary-dark)] hover:bg-primary-hover active:shadow-[0_2px_0_var(--color-primary-dark)] focus-visible:ring-primary px-5">
              {generating ? <Loader2 size={18} className="animate-spin" /> : <Lock size={18} className="shrink-0" />}
              {generating ? (progress || 'Generating...') : 'Upgrade to Pro'}
            </button>
            {generating && <span className="font-body text-xs text-white/70">Bimo nulis skrip + bikin suara host satu-satu. Biasanya 30-60 detik.</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M6.3 3.8a.6.6 0 0 1 .9-.52l10 6.2a.6.6 0 0 1 0 1.04l-10 6.2a.6.6 0 0 1-.9-.52V3.8Z" /></svg>
  );
}
function PauseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M5.5 3h2a.5.5 0 0 1 .5.5v13a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-13a.5.5 0 0 1 .5-.5Zm7 0h2a.5.5 0 0 1 .5.5v13a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-13a.5.5 0 0 1 .5-.5Z" /></svg>
  );
}

// === Tab 9: Tempel (Sticky notes) — COPY PASTE 1:1 from tab-tempel.html ===
// Sticky notes persist in localStorage (shared with the StickyNotesFab popover).
function StickyTab() {
  const { stickies: notes, addSticky, removeSticky } = useStickyNotes();
  const [newText, setNewText] = useState('');
  const [search, setSearch] = useState('');

  function addNote(text?: string) {
    const content = (text ?? newText).trim() || 'New note';
    addSticky(content, STICKY_COLORS[notes.length % STICKY_COLORS.length]);
    if (!text) setNewText('');
  }

  const filtered = search.trim() ? notes.filter(n => n.text.toLowerCase().includes(search.toLowerCase())) : notes;

  return (
    <div className="mx-auto w-full max-w-[1360px] px-[clamp(28px,5vw,72px)] pb-20 pt-8 max-lg:px-5 max-lg:pb-[72px]">
      <div className="flex flex-col gap-8">
        {/* Header — COPY PASTE: title + search label + New sticky note (bg-primary shadow) */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-heading text-[32px] font-bold leading-tight text-text-primary">Sticky notes</h1>
            <p className="mt-1 text-sm text-text-secondary">Drag a note off the board to stick it on the page.</p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
            {/* Search input — COPY PASTE: rounded-xl border-2 focus-within:border-primary */}
            <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border-2 border-border bg-surface px-3 text-text-muted focus-within:border-primary sm:w-72 sm:flex-none">
              <Search size={16} className="shrink-0" />
              <input placeholder="Search notes" aria-label="Search notes" className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted" type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            {/* New sticky note — COPY PASTE: bg-primary shadow-[0_4px_0_var(--color-primary-dark)] */}
            <button type="button" onClick={() => addNote()} className="inline-flex h-11 flex-none items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-text-inverse shadow-[0_4px_0_var(--color-primary-dark)] transition-all duration-100 hover:bg-primary-hover active:translate-y-[2px] active:shadow-[0_2px_0_var(--color-primary-dark)]">
              <Plus size={18} className="shrink-0" /> New sticky note
            </button>
          </div>
        </header>

        {/* Empty state — COPY PASTE: write.webp + "No sticky notes yet" + bottom-right text */}
        {filtered.length === 0 && notes.length === 0 ? (
          <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img sizes="160px" alt="" aria-hidden="true" decoding="async" className="object-contain size-40" src="/assets/write-Bi8IeuzT.webp" />
            <h2 className="font-heading text-xl font-bold text-text-primary">No sticky notes yet</h2>
            <p className="text-sm leading-relaxed text-text-secondary">Press + in the bottom-right corner of a lesson, or make a note here.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center"><p className="text-sm text-text-secondary">No notes match &quot;{search}&quot;.</p></div>
        ) : (
          /* Sticky notes grid — neo-brutalist cards with delete */
          <div className="flex flex-wrap gap-3">
            {filtered.map(n => (
              <div key={n.id} className="group relative rounded-2xl border-2 border-border p-4 shadow-[0_4px_0_var(--color-border)] transition-transform hover:-translate-y-0.5" style={{ background: n.color, width: 220, minHeight: 120 }}>
                <p className="break-words text-sm text-text-primary">{n.text}</p>
                <button type="button" aria-label="Delete sticky" onClick={() => removeSticky(n.id)} className="absolute right-2 top-2 grid size-6 place-items-center rounded-full text-text-muted opacity-0 transition-opacity hover:bg-surface hover:text-error group-hover:opacity-100">&times;</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
