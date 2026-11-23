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
  ChevronRight, Loader2, Flame, CheckCircle, ArrowLeft,
  BookOpen, Layers, Grid3x3, List, Headphones, StickyNote,
  Network, FolderOpen, GraduationCap, Plus, Download,
  Bold, Italic, Underline, Type, AlignLeft,
  RotateCcw, Star, Trophy, Crown, Sparkles,
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

// Tab definitions (captured from pelajarin sidebar nav)
const TABS = [
  { id: 'belajar', label: 'Learn', icon: BookOpen, url: 'belajar' },
  { id: 'catatan', label: 'Notes', icon: FileText, url: 'catatan' },
  { id: 'mindmap', label: 'Mindmap', icon: Network, url: 'mindmap' },
  { id: 'kuis', label: 'Quiz', icon: CheckCircle, url: 'kuis' },
  { id: 'flashcard', label: 'Flashcards', icon: Brain, url: 'flashcard' },
  { id: 'sumber', label: 'Sources', icon: FolderOpen, url: 'sumber' },
  { id: 'chat', label: 'Ask AI', icon: MessageSquare, url: 'chat' },
  { id: 'podcast', label: 'Podcast', icon: Headphones, url: 'podcast' },
  { id: 'tempel', label: 'Sticky', icon: StickyNote, url: 'tempel' },
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
        <a className="flex flex-none items-center gap-2" aria-label="bimo.ai" href="/">
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
            <a aria-current="page" className="inline-flex flex-none items-center gap-1.5 font-semibold text-text-primary active" href="/"><Home size={18} className="shrink-0" />Home</a>
          ) : (
            <>
              <a className="inline-flex flex-none items-center gap-1.5 font-semibold text-text-primary" href="/"><Home size={18} className="shrink-0" />Home</a>
              <ChevronRight size={12} className="shrink-0 text-text-muted" />
              <span className="truncate font-semibold text-text-primary">{activeNote?.title}</span>
              <ChevronRight size={12} className="shrink-0 text-text-muted" />
              <span className="font-semibold text-primary">{TABS.find(t => t.url === activeTab)?.label}</span>
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

      {/* Footer — only on dashboard (per pelajarin capture: app view has no footer) */}
      {view === 'dashboard' && (
        <footer className="border-t border-app px-20 py-6 text-center text-xs text-muted">
          <p>Bimo — Teman belajar AI untuk siswa Indonesia. Gratis selamanya, Pro mulai Rp 20 ribu.</p>
          <p className="mt-1">60% lebih murah · 15 catatan/bulan · 50 chat/bulan</p>
        </footer>
      )}

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
            <span className="relative"><tab.icon size={26} className="shrink-0" /></span>
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
        <img sizes="132px" alt="" aria-hidden="true" decoding="async" className="object-contain pointer-events-none size-[132px] flex-none max-sm:size-[104px]" src="/pelajarin-assets/img/pai-pointing.png" />
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
                <div className="relative aspect-video w-full overflow-hidden bg-surface-secondary">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" aria-hidden="true" loading="lazy" decoding="async" className="size-full object-cover" src="/pelajarin-assets/img/pai-head.png" />
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
  const isFullHeight = ['catatan', 'mindmap', 'sumber', 'chat'].includes(tab);
  const maxWidth = tab === 'podcast' ? '1360px' : '1120px';

  return (
    <main className="flex min-w-0 flex-1 flex-col" style={{ height: isFullHeight ? 'calc(100vh - 4rem)' : 'auto' }}>
      {/* Tab content */}
      {tab === 'belajar' && <BelajarTab note={noteDetail} onUpgrade={onUpgrade} onBack={onBack} />}
      {tab === 'catatan' && <CatatanTab note={noteDetail} noteId={note.id} />}
      {tab === 'mindmap' && <MindmapTab note={noteDetail} />}
      {tab === 'kuis' && <QuizTab key={`quiz-${note.id}-${tab}`} noteId={note.id} />}
      {tab === 'flashcard' && <FlashcardTab key={`flash-${note.id}-${tab}`} noteId={note.id} />}
      {tab === 'sumber' && <SourcesTab note={noteDetail} />}
      {tab === 'chat' && <ChatTab noteId={note.id} noteTitle={note.title} usage={usage} />}
      {tab === 'podcast' && <PodcastTab noteId={note.id} noteTitle={note.title} />}
      {tab === 'tempel' && <StickyTab />}
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
  if (!note) return <Loader2 className="animate-spin text-muted mx-auto" size={24} />;
  const chapters = note?.chapters || [];
  const totalChapters = chapters.length;
  const completedCount = 1;
  const progress = totalChapters > 0 ? Math.round(completedCount * 100 / totalChapters) : 0;
  // Zig-zag x values: 0 (left), 1 (right), 0, -1, 0... (from auth HTML)
  const xValues = [0, 1, 0, -1, 0, 1, 0, -1];

  return (
    <div className="mx-auto w-full overflow-y-auto" style={{ maxWidth: '1120px', padding: '0 clamp(28px, 5vw, 72px) 80px' }}>
      {/* Top section — captured: Pai mascot + badge + title + progress + Upgrade */}
      <div className="mb-8 flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/pelajarin-assets/img/pai-pointing.png" alt="Pai" width={80} height={80} style={{ objectFit: 'contain' }} />
        <div className="flex-1">
          <span className="inline-block rounded-full px-3 py-1 text-xs font-semibold mb-2" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', borderRadius: '9999px' }}>
            {note?.subject?.name || 'Adventure'}
          </span>
          <h1 className="font-bold leading-tight" style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(20px, 3vw, 28px)', color: 'var(--text-primary)' }}>{note.title || 'Catatan Baru'}</h1>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-2 flex-1 max-w-xs rounded-full" style={{ background: 'var(--bg-surface)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: 'var(--accent-orange)' }} />
            </div>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{progress}%</span>
          </div>
        </div>
        <button onClick={onUpgrade} className="inline-flex items-center rounded-full font-semibold transition-transform hover:-translate-y-0.5 active:translate-y-0.5 shrink-0" style={{ background: 'var(--accent-orange)', color: '#fff', fontSize: '14px', fontWeight: 600, padding: '0 20px', height: 44, borderRadius: '20px' }}>Upgrade to Pro</button>
      </div>

      {/* Chapters label + "N of M done" */}
      <div className="mb-4 flex items-center justify-between">
        <span className="text-lg font-bold" style={{ fontFamily: 'var(--font-heading)' }}>Chapters</span>
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{completedCount} of {totalChapters} done</span>
      </div>

      {/* Journey map — 1:1 from auth HTML: ol with --amp/--isle, li with --x zig-zag */}
      {chapters.length > 0 ? (
        <ol className="relative" style={{ ['--amp' as any]: '142px', ['--isle' as any]: '160px' }}>
          {/* SVG journey-path — connects islands with dotted lines (from auth capture) */}
          <svg data-journey-path="true" aria-hidden="true" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 z-0 size-full overflow-visible" viewBox="0 0 900 1124" style={{ width: '100%', height: '100%' }}>
            {/* Green solid path for completed segment */}
            <path d="M 503.9 158.9 L 538.1 199.9" fill="none" stroke="var(--accent-green)" strokeWidth="6" strokeLinecap="round" />
            {/* Dotted trail for remaining segments */}
            <path d="M 540.0 330.3 L 502.0 378.5" fill="none" stroke="var(--text-muted)" strokeDasharray="1 15" strokeWidth="6" strokeLinecap="round" />
            <path d="M 396.1 508.9 L 361.9 549.9" fill="none" stroke="var(--text-muted)" strokeDasharray="1 15" strokeWidth="6" strokeLinecap="round" />
            <path d="M 354.7 684.2 L 403.3 756.6" fill="none" stroke="var(--text-muted)" strokeDasharray="1 15" strokeWidth="6" strokeLinecap="round" />
            <path d="M 495.3 897.2 L 546.7 977.6" fill="none" stroke="var(--text-muted)" strokeDasharray="1 15" strokeWidth="6" strokeLinecap="round" />
          </svg>

          {chapters.map((c: any, i: number) => {
            const xVal = xValues[i % xValues.length];
            const isRight = xVal > 0;
            const isLeft = xVal < 0;
            const isCompleted = i === 0;
            const islandImg = BROMO_ISLANDS[i % BROMO_ISLANDS.length];
            const locationName = BROMO_LOCATIONS[i % BROMO_LOCATIONS.length];

            return (
              <li
                key={c.id}
                className="relative z-[1] flex items-center gap-4 max-sm:mb-6 max-sm:gap-3 max-sm:last:mb-0"
                style={{
                  ['--x' as any]: `calc(var(--amp) * ${xVal}.000)`,
                  paddingLeft: isLeft ? `calc(50% + var(--x) - var(--isle) / 2)` : undefined,
                  paddingRight: isRight ? `calc(50% - var(--x) - var(--isle) / 2)` : undefined,
                  flexDirection: isRight ? 'row-reverse' : 'row',
                  height: 'var(--isle)',
                }}
              >
                {/* Island image — <a> if completed (clickable), <div> if locked */}
                {isCompleted ? (
                  <a aria-label={`Chapter ${i + 1}: ${c.title}`} className="relative block flex-none cursor-pointer rounded-3xl transition-transform hover:-translate-y-1 active:translate-y-0.5" style={{ width: 'var(--isle)', height: 'var(--isle)' }} href="#">
                    <span className="block size-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt="" draggable={false} className="size-full select-none object-contain" src={islandImg} width={160} height={160} />
                      {/* Green check badge */}
                      <span className="absolute left-[72%] top-[67%] grid size-9 place-items-center rounded-full border-[3px] border-surface" style={{ background: 'var(--accent-green)', color: '#fff' }}>
                        <CheckCircle size={18} />
                      </span>
                    </span>
                  </a>
                ) : (
                  <div className="relative block flex-none" style={{ width: 'var(--isle)', height: 'var(--isle)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img alt="" draggable={false} className="size-full select-none object-contain" style={{ filter: 'grayscale(60%) brightness(1.22) contrast(0.7)' }} src={islandImg} width={160} height={160} />
                    {/* Lock badge */}
                    <span className="absolute left-[72%] top-[67%] grid size-9 place-items-center rounded-full border-2" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                      <span style={{ fontSize: 14 }}>🔒</span>
                    </span>
                  </div>
                )}

                {/* Chapter card — opposite side */}
                {isCompleted ? (
                  <a className="flex min-w-0 max-w-[340px] flex-[0_1_auto] flex-col rounded-lg px-3.5 py-1.5 transition-colors hover:bg-[#fef9c3]" href="#" style={{ maxWidth: 340 }}>
                    <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{locationName}</span>
                    <span className="font-bold" style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', color: 'var(--text-primary)' }}>{c.title}</span>
                    <span className="hidden items-center gap-1.5 text-sm font-medium" style={{ color: 'var(--accent-orange)' }}>Review <ChevronRight size={14} /></span>
                  </a>
                ) : (
                  <div className="flex min-w-0 max-w-[400px] flex-[0_1_auto] flex-wrap items-center gap-3 rounded-2xl px-[18px] py-3" style={{ background: 'var(--bg-surface)', maxWidth: 400 }}>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{locationName}</div>
                      <div className="font-bold" style={{ fontFamily: 'var(--font-heading)', fontSize: '18px', color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{c.title}</div>
                    </div>
                    <button onClick={onUpgrade} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-transform active:translate-y-0.5" style={{ height: 44, padding: '0 24px', fontSize: '14px', background: 'var(--accent-orange)', color: '#fff', boxShadow: '0 4px 0 var(--accent-orange)' }}>
                      <span style={{ fontSize: 14 }}>🔒</span> Upgrade to Pro
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

      {/* FAB — orange plus bottom-right */}
      <button onClick={onUpgrade} className="fixed bottom-8 right-8 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95" style={{ background: 'var(--accent-orange)', color: '#fff', borderRadius: '9999px' }}>
        <Plus size={24} />
      </button>
    </div>
  );
}

// === Tab 2: Catatan (Notes) — 70:30 split: editor + AI panel (1:1 from auth capture) ===
function CatatanTab({ note, noteId }: { note: any; noteId: string }) {
  if (!note) return <Loader2 className="animate-spin text-muted mx-auto" size={24} />;
  // Inline AI panel state (same as ChatTab but simplified for the right column)
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const sessionIdRef = useRef<string>('');
  useEffect(() => { sessionIdRef.current = crypto.randomUUID(); }, [noteId]);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);

  async function send() {
    if (!input.trim() || streaming) return;
    const msg = input.trim(); setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setStreaming(true);
    try {
      const res = await fetch('/api/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note_id: noteId, session_id: sessionIdRef.current, message: msg }) });
      if (!res.ok) return;
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      const reader = res.body?.getReader(); const decoder = new TextDecoder();
      let text = ''; let buf = '';
      while (reader) {
        const { done, value } = await reader.read(); if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split('\n\n'); buf = events.pop() || '';
        for (const evt of events) {
          const lines = evt.split('\n'); let eventType = ''; let dataStr = '';
          for (const line of lines) { if (line.startsWith('event:')) eventType = line.slice(6).trim(); if (line.startsWith('data:')) dataStr = line.slice(5).trim(); }
          if (!dataStr) continue;
          try { const data = JSON.parse(dataStr); if (eventType === 'text-delta' && data.text) { text += data.text; setMessages(prev => { const c = [...prev]; c[c.length - 1] = { role: 'assistant', content: text }; return c; }); } } catch {}
        }
      }
    } catch {} finally { setStreaming(false); }
  }

  return (
    <div className="flex h-full items-stretch">
      {/* LEFT: Editor (70%) */}
      <div className="flex flex-1 flex-col" style={{ flex: '7' }}>
        {/* Toolbar — captured: undo/redo, H1, Format, bold/italic/underline/strikethrough/code/list, Export */}
        <div className="flex items-center gap-1 border-b border-app p-2 flex-wrap">
          <button className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface" style={{ borderRadius: '16px' }}><RotateCcw size={14} /></button>
          <button className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface" style={{ borderRadius: '16px' }}><Bold size={14} /></button>
          <button className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface" style={{ borderRadius: '16px' }}><Italic size={14} /></button>
          <button className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface" style={{ borderRadius: '16px' }}><Underline size={14} /></button>
          <div className="w-px h-6 bg-app mx-1" />
          <button className="flex h-8 items-center gap-1 rounded-lg px-2 text-sm hover:bg-surface" style={{ borderRadius: '16px' }}><Type size={14} /> Heading 1</button>
          <button className="flex h-8 items-center gap-1 rounded-lg px-2 text-sm hover:bg-surface" style={{ borderRadius: '16px' }}><AlignLeft size={14} /> Format</button>
          <div className="w-px h-6 bg-app mx-1" />
          <button className="flex h-8 items-center gap-1 rounded-lg px-2 text-sm hover:bg-surface" style={{ borderRadius: '16px' }}><Download size={14} /> Export PDF</button>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {note.content ? <div className="prose prose-sm max-w-none"><Markdown content={note.content} /></div> : <p className="text-muted">Catatan belum diproses.</p>}
        </div>
      </div>

      {/* RIGHT: AI panel (30%) — captured: "Percakapan Baru" + Pai mascot + input */}
      <div className="flex flex-col border-l border-app" style={{ flex: '3', minWidth: 280 }}>
        {/* AI panel header — captured: "Percakapan Baru" + dropdown + add button */}
        <div className="flex items-center gap-2 border-b border-app p-3">
          <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm" style={{ borderRadius: '16px' }}>Percakapan Baru</button>
          <button className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface" style={{ borderRadius: '16px' }}><Plus size={16} /></button>
        </div>
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/pelajarin-assets/img/pai-pointing.png" alt="Pai" width={80} height={80} style={{ objectFit: 'contain' }} className="mx-auto mb-3" />
              <p className="text-sm font-semibold">Hi, I&apos;m Pai!</p>
              <p className="text-xs text-muted mt-1">I can help you understand these notes and answer any question.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`mb-3 flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[85%] rounded-2xl px-3 py-2 text-sm" style={{ background: m.role === 'user' ? 'var(--accent-orange)' : 'var(--bg-surface)', color: m.role === 'user' ? '#fff' : 'var(--text-primary)' }}>
                {m.role === 'assistant' && m.content === '' && streaming ? <Loader2 size={14} className="animate-spin" /> : m.role === 'assistant' ? <div className="prose prose-sm max-w-none"><Markdown content={m.content} /></div> : m.content}
              </div>
            </div>
          ))}
        </div>
        {/* Input — captured: grey card with send button */}
        <div className="p-3 border-t border-app">
          <div className="flex items-end gap-2 rounded-2xl p-2" style={{ background: 'var(--bg-surface)', borderRadius: '16px' }}>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Ask anything about this material..." rows={1} className="flex-1 resize-none border-none bg-transparent outline-none text-sm" style={{ color: 'var(--text-primary)' }} />
            <button onClick={send} disabled={streaming || !input.trim()} className="grid place-items-center rounded-full shrink-0" style={{ width: 32, height: 32, background: 'var(--accent-orange)', color: '#fff', borderRadius: '9999px' }}>{streaming ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// === Tab 3: Mindmap — ReactFlow canvas (radial tree from chapters) ===
function MindmapTab({ note }: { note: any }) {
  return (
    <div className="flex h-full items-stretch">
      <div className="relative flex-1 overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
        <MindmapView note={note} />
      </div>
    </div>
  );
}

// === Tab 4: Kuis (Quiz) ===
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

  if (loading) return <div className="mx-auto w-full flex flex-col items-center justify-center py-20" style={{ maxWidth: '1120px' }}><div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--bg-accent)', borderRadius: '9999px' }}><Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent-orange)' }} /></div><p className="mt-4 text-sm text-muted">Writing questions...</p></div>;

  if (total === 0) return (
    <div className="mx-auto w-full" style={{ maxWidth: '1120px', padding: '0 clamp(28px, 5vw, 72px)' }}>
      <div className="mx-auto flex min-h-[calc(100dvh-11rem)] w-full flex-col items-center justify-center" style={{ maxWidth: '672px' }}>
        <div className="text-center">
          <CheckCircle size={48} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <p className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Belum ada kuis.</p>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Generate kuis dari materi ini untuk mulai berlatih.</p>
          <button onClick={generate} disabled={generating} className="inline-flex items-center gap-2 rounded-full font-semibold transition-transform active:translate-y-0.5" style={{ background: 'var(--accent-orange)', color: '#fff', fontSize: '15px', fontWeight: 600, padding: '0 28px', height: 48, borderRadius: '9999px', boxShadow: '0 4px 0 #c5520a' }}>{generating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />} Generate Kuis</button>
        </div>
      </div>
    </div>
  );

  // Single-question-per-screen view (1:1 from auth HTML)
  const q = allQuestions[currentQ];
  const options = q.options || [];
  const isCorrect = selectedAnswer !== null && options[selectedAnswer] === q.answer;

  return (
    <div className="mx-auto w-full" style={{ maxWidth: '1120px', padding: '8px clamp(28px, 5vw, 72px) 80px' }}>
      <div className="mx-auto flex min-h-[calc(100dvh-11rem)] w-full flex-col" style={{ maxWidth: '672px', padding: '0 20px 32px' }}>
        <div className="m-auto w-full">
          <div className="flex flex-col gap-6">
            {/* Top bar: counter (N / M) + New Quiz/Repeat/Edit buttons */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{currentQ + 1} / {total}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={generate} className="inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all active:translate-y-0.5" style={{ height: 36, padding: '0 16px', fontSize: '14px', background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: '0 4px 0 var(--border)' }}><Plus size={14} /> New Quiz</button>
                <button onClick={generate} className="inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all active:translate-y-0.5" style={{ height: 36, padding: '0 16px', fontSize: '14px', background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: '0 4px 0 var(--border)' }}><RefreshCw size={14} /> Repeat Quiz</button>
                <button className="inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all active:translate-y-0.5" style={{ height: 36, padding: '0 16px', fontSize: '14px', background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: '0 4px 0 var(--border)' }}><Settings size={14} /> Edit</button>
              </div>
            </div>

            {/* Question content */}
            <div className="py-2">
              <div className="flex flex-col gap-5">
                {/* Question text */}
                <h2 className="font-bold leading-tight" style={{ fontFamily: 'var(--font-heading)', fontSize: '24px', color: 'var(--text-primary)' }}>{q.question}</h2>

                {/* Show Hint button */}
                {q.hint && (
                  <button onClick={() => setShowHint(prev => !prev)} className="inline-flex items-center gap-2 self-start rounded-full font-semibold transition-colors" style={{ height: 36, padding: '0 16px', fontSize: '13px', background: '#fef9c3', color: '#a16207', borderRadius: '9999px' }}>
                    <Lightbulb size={14} /> Show Hint
                  </button>
                )}
                {showHint && q.hint && (
                  <div className="rounded-xl p-4" style={{ background: '#fef9c3', borderRadius: '16px', color: '#92400e' }}>
                    <p className="text-sm">{q.hint}</p>
                  </div>
                )}

                {/* Answer options (A/B/C/D) — grid with circle letter */}
                <div className="grid gap-3">
                  {options.map((opt: string, oi: number) => {
                    const isSelected = selectedAnswer === oi;
                    const showResult = checked && (opt === q.answer || isSelected);
                    return (
                      <button key={oi} type="button" onClick={() => !checked && setSelectedAnswer(oi)} disabled={checked}
                        className="flex items-center gap-3 rounded-2xl p-4 text-left transition-all"
                        style={{
                          borderRadius: '16px', padding: '16px',
                          background: checked && opt === q.answer ? '#e8f5e9' : checked && isSelected && !isCorrect ? '#fee2e2' : isSelected ? 'var(--bg-accent)' : 'var(--bg-surface)',
                          border: `2px solid ${checked && opt === q.answer ? 'var(--accent-green)' : checked && isSelected && !isCorrect ? 'var(--accent-red)' : isSelected ? 'var(--accent-orange)' : 'transparent'}`,
                          boxShadow: '0 4px 0 var(--border)',
                        }}>
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-semibold" style={{ background: isSelected || (checked && opt === q.answer) ? 'var(--accent-orange)' : 'var(--bg-primary)', color: isSelected || (checked && opt === q.answer) ? '#fff' : 'var(--text-primary)', border: '2px solid var(--border)' }}>
                          {String.fromCharCode(65 + oi)}
                        </div>
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{opt}</span>
                        {checked && opt === q.answer && <CheckCircle size={18} className="ml-auto" style={{ color: 'var(--accent-green)' }} />}
                      </button>
                    );
                  })}
                </div>

                {/* Check answer + Previous/Next */}
                <div className="flex items-center justify-between">
                  <button type="button" onClick={() => { if (currentQ > 0) { setCurrentQ(prev => prev - 1); setSelectedAnswer(null); setShowHint(false); setChecked(false); } }} disabled={currentQ === 0}
                    className="inline-flex items-center gap-2 rounded-xl font-heading text-sm font-bold transition-all disabled:opacity-40" style={{ height: 44, padding: '0 12px', color: 'var(--text-primary)' }}>
                    <ChevronRight size={16} className="rotate-180" /> Previous
                  </button>
                  {checked ? (
                    <button type="button" onClick={() => { if (currentQ < total - 1) { setCurrentQ(prev => prev + 1); setSelectedAnswer(null); setShowHint(false); setChecked(false); } }} disabled={currentQ === total - 1}
                      className="inline-flex items-center gap-2 rounded-xl font-heading text-sm font-bold transition-all disabled:opacity-40" style={{ height: 44, padding: '0 16px', background: 'var(--accent-orange)', color: '#fff', boxShadow: '0 4px 0 #c5520a' }}>
                      Next <ChevronRight size={16} />
                    </button>
                  ) : (
                    <button type="button" onClick={() => setChecked(true)} disabled={selectedAnswer === null}
                      className="inline-flex items-center gap-2 rounded-xl font-heading text-sm font-bold transition-all active:translate-y-0.5 disabled:opacity-40" style={{ height: 44, padding: '0 20px', background: 'var(--accent-orange)', color: '#fff', boxShadow: '0 4px 0 #c5520a', fontSize: '15px' }}>
                      Check answer <ChevronRight size={16} />
                    </button>
                  )}
                </div>

                {/* Explanation after check */}
                {checked && q.explanation && (
                  <div className="rounded-2xl p-4" style={{ background: isCorrect ? '#e8f5e9' : '#fee2e2', borderRadius: '16px' }}>
                    <p className="text-sm font-semibold mb-1" style={{ color: isCorrect ? 'var(--accent-green)' : 'var(--accent-red)' }}>{isCorrect ? 'Benar!' : 'Belum tepat'}</p>
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{q.explanation}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// === Tab 5: Flashcard — single-card flip view (1:1 from auth HTML) ===
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

  if (loading) return <div className="mx-auto w-full flex flex-col items-center justify-center py-20" style={{ maxWidth: '1120px' }}><div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--bg-accent)', borderRadius: '9999px' }}><Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent-orange)' }} /></div><p className="mt-4 text-sm text-muted">Making cards...</p></div>;

  if (cards.length === 0) return (
    <div className="mx-auto w-full" style={{ maxWidth: '1120px', padding: '0 clamp(28px, 5vw, 72px)' }}>
      <div className="mx-auto flex min-h-[calc(100dvh-11rem)] w-full flex-col items-center justify-center" style={{ maxWidth: '672px' }}>
        <div className="text-center">
          <Brain size={48} className="mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
          <p className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Belum ada flashcard.</p>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Generate flashcard dari materi ini untuk mulai berlatih.</p>
          <button onClick={generate} disabled={generating} className="inline-flex items-center gap-2 rounded-full font-semibold transition-transform active:translate-y-0.5" style={{ background: 'var(--accent-orange)', color: '#fff', fontSize: '15px', fontWeight: 600, padding: '0 28px', height: 48, borderRadius: '9999px', boxShadow: '0 4px 0 #c5520a' }}>{generating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />} Generate Flashcard</button>
        </div>
      </div>
    </div>
  );

  // Single-card-per-screen view (1:1 from auth HTML)
  const card = cards[currentCard];
  const total = cards.length;

  return (
    <div className="mx-auto w-full" style={{ maxWidth: '1120px', padding: '8px clamp(28px, 5vw, 72px) 80px' }}>
      <div className="mx-auto flex min-h-[calc(100dvh-11rem)] w-full flex-col" style={{ maxWidth: '672px', padding: '0 20px 32px' }}>
        <div className="m-auto w-full">
          <div className="flex flex-col gap-5">
            {/* Top bar: counter (N / M) + Regenerate/Restart/Manage buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{currentCard + 1} / {total}</span>
              <div className="flex items-center gap-2">
                <button onClick={generate} disabled={generating} className="inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all active:translate-y-0.5 disabled:opacity-50" style={{ height: 36, padding: '0 14px', fontSize: '14px', background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: '0 4px 0 var(--border)' }}>{generating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Regenerate</button>
                <button onClick={() => { setCurrentCard(0); setFlipped(false); }} className="inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all active:translate-y-0.5" style={{ height: 36, padding: '0 14px', fontSize: '14px', background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: '0 4px 0 var(--border)' }}><RotateCcw size={14} /> Restart</button>
                <button className="inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all active:translate-y-0.5" style={{ height: 36, padding: '0 14px', fontSize: '14px', background: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: '0 4px 0 var(--border)' }}><Settings size={14} /> Manage</button>
              </div>
            </div>

            {/* Flip card — 1:1 from auth: perspective-[1000px], two faces, rotateY */}
            <div className="w-full" style={{ perspective: '1000px' }}>
              <button type="button" onClick={() => setFlipped(prev => !prev)}
                className="relative w-full cursor-pointer"
                style={{ minHeight: '22rem', transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)', transition: 'transform 0.6s' }}>
                {/* Question face */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 rounded-3xl border-2"
                  style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', background: 'var(--bg-surface)', borderColor: 'var(--border)', boxShadow: '0 4px 0 var(--border)', borderRadius: '24px' }}>
                  <div className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>Question</div>
                  <div className="font-bold" style={{ fontFamily: 'var(--font-heading)', fontSize: '22px', color: 'var(--text-primary)' }}>{card.front}</div>
                  <div className="absolute bottom-6 left-0 right-0 text-center text-xs" style={{ color: 'var(--text-muted)' }}>Click to see the answer</div>
                </div>
                {/* Answer face */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 rounded-3xl border-2"
                  style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', background: 'var(--bg-accent)', borderColor: 'var(--accent-orange)', boxShadow: '0 4px 0 #c5520a', borderRadius: '24px', transform: 'rotateY(180deg)' }}>
                  <div className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>Answer</div>
                  <div className="text-base leading-relaxed" style={{ color: 'var(--text-primary)' }}>{card.back}</div>
                </div>
              </button>
            </div>

            {/* Navigation: Previous / Next */}
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => { if (currentCard > 0) { setCurrentCard(prev => prev - 1); setFlipped(false); } }} disabled={currentCard === 0}
                className="inline-flex items-center gap-2 rounded-xl font-heading text-sm font-bold transition-all disabled:opacity-40" style={{ height: 44, padding: '0 12px', color: 'var(--text-primary)' }}>
                <ChevronRight size={16} className="rotate-180" /> Previous
              </button>
              <button type="button" onClick={() => { if (currentCard < total - 1) { setCurrentCard(prev => prev + 1); setFlipped(false); } }} disabled={currentCard === total - 1}
                className="inline-flex items-center gap-2 rounded-xl font-heading text-sm font-bold transition-all disabled:opacity-40" style={{ height: 44, padding: '0 12px', color: 'var(--text-primary)' }}>
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// === Tab 6: Sumber (Sources) — file list + per-document chat ===
function SourcesTab({ note }: { note: any }) {
  if (!note?.files || note.files.length === 0) return <div className="flex h-full items-center justify-center"><div className="text-center"><FolderOpen size={32} className="mx-auto text-muted mb-2" /><p className="text-sm text-muted">Belum ada sumber. Upload file untuk mulai.</p></div></div>;
  return (
    <div className="flex h-full items-stretch">
      {/* File list */}
      <div className="flex flex-col gap-2 border-r border-app p-4" style={{ width: '300px' }}>
        {note.files.map((f: any) => (
          <div key={f.id} className="flex items-center gap-3 rounded-xl border-2 border-app p-3" style={{ borderRadius: '16px' }}>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: 'var(--bg-surface)' }}><FileText size={20} style={{ color: 'var(--accent-red)' }} /></div>
            <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{f.filename}</p><p className="text-xs text-muted">{(f.size_bytes / 1024).toFixed(0)} KB</p></div>
            <a href="#" className="text-xs font-semibold" style={{ color: 'var(--accent-blue)' }}>Open ↗</a>
          </div>
        ))}
      </div>
      {/* Per-document chat */}
      <div className="flex flex-1 flex-col">
        <div className="border-b border-app p-3"><span className="text-sm font-semibold">Percakapan Baru</span></div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-center py-8"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: 'var(--bg-accent)' }}><span style={{ color: 'var(--accent-orange)', fontWeight: 700, fontSize: '20px' }}>B</span></div><p className="text-sm font-semibold">Hi, I'm Bimo!</p><p className="text-xs text-muted mt-1">Ask anything about this document</p></div>
        </div>
        <div className="flex gap-2 p-3 border-t border-app"><textarea placeholder="Ask..." className="flex-1 resize-none border-none bg-transparent outline-none text-sm" style={{ fontSize: '15px' }} /><button className="grid h-10 w-10 place-items-center rounded-full" style={{ background: 'var(--bg-accent)', color: 'var(--accent-orange)', borderRadius: '9999px' }}><Send size={16} /></button></div>
      </div>
    </div>
  );
}

// === Tab 7: Chat (Ask AI) ===
function ChatTab({ noteId, noteTitle, usage }: { noteId: string; noteTitle: string; usage: Usage | null }) {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [clarifying, setClarifying] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string>('');
  useEffect(() => { sessionIdRef.current = crypto.randomUUID(); }, [noteId]);
  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);

  // Stream an SSE response (shared by send + clarify). Returns the full text.
  async function streamSSE(res: Response, onDelta: (text: string) => void): Promise<string> {
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
      await streamSSE(res, (text) => setMessages(prev => { const c = [...prev]; c[c.length - 1] = { role: 'assistant', content: text }; return c; }));
      fetch('/api/v1/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_name: 'chat_session', note_id: noteId }) }).catch(() => {});
    } catch { toast.error('Chat error'); }
    finally { setStreaming(false); }
  }

  // Clarify the last assistant answer with a different style.
  // Per RECON-DEEP-v4 §2.1: POST /api/v2/chat/clarify/stream (SSE).
  async function clarify(mode: 'simpler' | 'shorter' | 'detailed' | 'example') {
    if (streaming || clarifying) return;
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAssistant || !lastAssistant.content) { toast.error('Belum ada jawaban untuk dijelaskan ulang'); return; }
    setClarifying(true);
    try {
      const res = await fetch('/api/v2/chat/clarify/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sessionIdRef.current, mode }) });
      if (!res.ok) { const err = await res.json(); toast.error(err.error?.message || 'Clarify gagal'); return; }
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      await streamSSE(res, (text) => setMessages(prev => { const c = [...prev]; c[c.length - 1] = { role: 'assistant', content: text }; return c; }));
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

  return (
    <div className="flex h-full items-stretch">
      <div className="flex flex-1 flex-col">
        {/* Chat header — captured: "Percakapan Baru" + dropdown */}
        <div className="flex items-center gap-2 border-b border-app p-3">
          <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm" style={{ borderRadius: '16px' }}>Percakapan Baru</button>
          <button className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface" style={{ borderRadius: '16px' }}><Plus size={16} /></button>
        </div>
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              {/* Real Pai mascot from pelajarin.ai (per authenticated capture: 3D purple robot) */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/pelajarin-assets/img/pai-pointing.png" alt="Pai" width={120} height={120} style={{ objectFit: 'contain' }} className="mx-auto mb-3" />
              <p className="text-sm font-semibold">Hi, I&apos;m Pai!</p>
              <p className="text-xs text-muted mt-1">I can help you understand these notes and answer any question.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`mb-3 flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.role === 'user' ? '' : 'bg-surface'}`} style={{ background: m.role === 'user' ? 'var(--accent-orange)' : 'var(--bg-surface)', color: m.role === 'user' ? '#fff' : 'var(--text-primary)' }}>
                {m.role === 'assistant' && m.content === '' && (streaming || clarifying) ? <Loader2 size={14} className="animate-spin" /> : m.role === 'assistant' ? <div className="prose prose-sm max-w-none"><Markdown content={m.content} /></div> : m.content}
              </div>
            </div>
          ))}
          {/* Clarify buttons — appear after the last assistant answer (per pelajarin RE: /api/v2/chat/clarify/stream) */}
          {showClarify && (
            <div className="mb-3 flex flex-wrap gap-2 pl-1">
              {CLARIFY_BUTTONS.map(b => (
                <button key={b.mode} onClick={() => clarify(b.mode)} disabled={clarifying || streaming} className="inline-flex items-center gap-1.5 rounded-full border-2 font-semibold transition-colors hover:border-[var(--accent-orange)] disabled:opacity-50" style={{ fontSize: '12px', fontWeight: 600, padding: '5px 12px', borderColor: 'var(--border)', color: 'var(--text-muted)', borderRadius: '9999px' }}>
                  <Sparkles size={11} /> {b.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Input — captured: large grey card in center with mic + send buttons */}
        <div className="p-4">
          <div className="flex items-end gap-2 rounded-2xl p-3" style={{ background: 'var(--bg-surface)', borderRadius: '20px' }}>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Ask anything about this note..." rows={1} className="flex-1 resize-none border-none bg-transparent outline-none" style={{ fontSize: '15px', color: 'var(--text-primary)' }} />
            <button onClick={send} disabled={streaming || !input.trim()} className="grid place-items-center rounded-full shrink-0" style={{ width: 40, height: 40, background: 'var(--accent-orange)', color: '#fff', borderRadius: '9999px' }}>{streaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// === Tab 8: Podcast — 4 AI host personas + generate + sequential playback ===
function PodcastTab({ noteId, noteTitle }: { noteId: string; noteTitle: string }) {
  // Hosts — 1:1 from auth HTML: real host images + bg-host-*-light classes
  const HOSTS = [
    { name: 'Pai', role: 'Explainer', color: 'var(--accent-orange)', img: '/pelajarin-assets/img/app-pai.png', bgLight: '#fff3eb' },
    { name: 'Kiko', role: 'The curious one', color: 'var(--accent-blue)', img: '/pelajarin-assets/img/app-kiko.png', bgLight: '#e3f2fd' },
    { name: 'Bolu', role: 'Storyteller', color: 'var(--accent-green)', img: '/pelajarin-assets/img/app-bolu.png', bgLight: '#e8f5e9' },
    { name: 'Meli', role: 'Exam coach', color: 'var(--accent-red)', img: '/pelajarin-assets/img/app-meli.png', bgLight: '#fce4ec' },
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
    const hostColor = HOSTS.find(h => h.name === seg.speaker)?.color || 'var(--accent-orange)';
    return (
      <div className="mx-auto flex w-full flex-col" style={{ maxWidth: '760px', padding: '32px clamp(28px, 5vw, 72px)' }}>
        <div className="mb-4 flex items-center gap-3">
          <button onClick={() => { setResult(null); setPlaying(false); audioRef.current?.pause(); }} className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: 'var(--accent-orange)' }}><ArrowLeft size={16} /> Buat ulang</button>
          <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>{noteTitle}</h2>
        </div>

        {/* Now playing card */}
        <div className="mb-6 rounded-2xl border-2 border-app p-5" style={{ borderRadius: '24px' }}>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: hostColor, color: '#fff', fontWeight: 700 }}>{seg.speaker[0]}</div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{seg.speaker}</p>
              <p className="text-xs text-muted">Segmen {currentSeg + 1} dari {result.segments.length}</p>
            </div>
            <span className="text-xs text-muted">{duration} min</span>
          </div>
          <p className="text-sm mb-4" style={{ color: 'var(--text-primary)' }}>{seg.text}</p>

          {/* Audio element (hidden, controlled by buttons) */}
          <audio ref={audioRef} onEnded={onEnded} preload="auto" className="hidden" />

          {/* Player controls */}
          <div className="flex items-center justify-center gap-3">
            <button onClick={prevSeg} disabled={currentSeg === 0} className="flex h-10 w-10 items-center justify-center rounded-full disabled:opacity-30" style={{ background: 'var(--bg-surface)', borderRadius: '9999px' }}>
              <RotateCcw size={16} />
            </button>
            <button onClick={togglePlay} className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--accent-orange)', color: '#fff', borderRadius: '9999px' }}>
              {playing ? <span style={{ fontSize: 18 }}>❚❚</span> : <span style={{ fontSize: 18, marginLeft: 2 }}>▶</span>}
            </button>
            <button onClick={nextSeg} disabled={currentSeg >= result.segments.length - 1} className="flex h-10 w-10 items-center justify-center rounded-full disabled:opacity-30" style={{ background: 'var(--bg-surface)', borderRadius: '9999px' }}>
              <ChevronRight size={16} />
            </button>
          </div>
          {/* Progress bar */}
          <div className="mt-4 h-1.5 w-full rounded-full" style={{ background: 'var(--bg-surface)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${((currentSeg + 1) / result.segments.length) * 100}%`, background: 'var(--accent-orange)' }} />
          </div>
        </div>

        {/* Transcript */}
        <p className="text-sm font-semibold mb-3">Transkrip</p>
        <div className="max-h-96 overflow-y-auto space-y-2 pr-2" style={{ scrollbarWidth: 'thin' }}>
          {result.segments.map((s, i) => {
            const c = HOSTS.find(h => h.name === s.speaker)?.color || 'var(--accent-orange)';
            return (
              <button key={i} onClick={() => { setCurrentSeg(i); setPlaying(true); }} className="block w-full text-left rounded-xl p-3 transition-colors" style={{ background: i === currentSeg ? 'var(--bg-accent)' : 'transparent', borderRadius: '16px', border: `2px solid ${i === currentSeg ? 'var(--accent-orange)' : 'var(--border)'}` }}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold" style={{ background: c, color: '#fff' }}>{s.speaker[0]}</div>
                  <span className="text-xs font-semibold">{s.speaker}</span>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{s.text}</p>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // === Setup view — 1:1 from auth HTML: radial gradient purple container + host cards ===
  return (
    <div className="mx-auto flex w-full flex-col justify-center" style={{ minHeight: 'calc(100svh - 4rem)', maxWidth: '1360px', padding: '32px clamp(20px, 4vw, 56px) 80px' }}>
      <div className="mx-auto w-full" style={{ maxWidth: '760px' }}>
        {/* Radial gradient purple container — captured: rounded-[28px] bg-[radial-gradient(130% 100% at 30% 0%, ...)] */}
        <div className="overflow-hidden rounded-[28px] text-white" style={{ background: 'radial-gradient(130% 100% at 30% 0%, #6c5ce0 0%, #4834b8 55%, #2d1b6e 100%)' }}>
          {/* Header */}
          <div className="flex items-start gap-4 px-7 pb-2.5 pt-6">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h2 className="font-bold tracking-tight text-white" style={{ fontFamily: 'var(--font-heading)', fontSize: '26px' }}>Create a podcast</h2>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>From the lesson {noteTitle}</p>
            </div>
          </div>
          {/* Body */}
          <div className="flex flex-col gap-5 px-7 pb-5 pt-2.5">
            {/* Pick 2 hosts — captured: host cards with bg-host-*-light + real host images */}
            <section className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-bold text-white" style={{ fontFamily: 'var(--font-heading)', fontSize: '17px' }}>Pick 2 hosts</h3>
                <span className="text-[13px] font-semibold text-white">{selected.length} of 2 picked</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {HOSTS.map(h => {
                  const isSelected = selected.includes(h.name);
                  return (
                    <button key={h.name} type="button" aria-pressed={isSelected} onClick={() => setSelected(prev => prev.includes(h.name) ? prev.filter(n => n !== h.name) : prev.length < 2 ? [...prev, h.name] : [prev[1], h.name])}
                      className="relative flex flex-col items-center gap-1 rounded-[22px] px-2.5 pb-3.5 pt-4 transition-colors"
                      style={{ background: isSelected ? h.bgLight : 'rgba(255,255,255,0.1)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img alt="" width={72} height={72} className="size-[72px] rounded-full" src={h.img} />
                      <span className="font-bold" style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', color: isSelected ? 'var(--text-primary)' : '#fff' }}>{h.name}</span>
                      <span className="text-xs" style={{ color: isSelected ? 'rgba(26,26,46,0.7)' : 'rgba(255,255,255,0.7)' }}>{h.role}</span>
                      {/* Check badge when selected */}
                      {isSelected && (
                        <span className="absolute right-2.5 top-2.5 grid size-6 place-items-center rounded-full" style={{ background: 'var(--accent-orange)', color: '#fff' }}>
                          <CheckCircle size={14} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
            {/* Style suggestions — captured: textarea input with 0/200 counter + "Optional" label */}
            <section className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor="podcast-prompt" className="font-bold text-white" style={{ fontFamily: 'var(--font-heading)', fontSize: '17px' }}>What should the chat be like?</label>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>Optional</span>
              </div>
              <div className="flex flex-col gap-2 rounded-[18px] px-3.5 py-3" style={{ background: 'var(--bg-surface)' }}>
                <textarea id="podcast-prompt" rows={3} maxLength={200} placeholder="E.g. make Bolu joke a lot, use canteen snack examples, don't be too serious" className="w-full resize-none border-none bg-transparent outline-none text-sm" style={{ color: 'var(--text-primary)' }} value={activeStyle || ''} onChange={(e) => setActiveStyle(e.target.value || null)} />
                <span className="text-right text-xs" style={{ color: 'var(--text-muted)' }}>{(activeStyle || '').length}/200</span>
              </div>
              {/* Style suggestion chips — still available as quick presets */}
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => setActiveStyle(prev => prev === s ? null : s)} className="inline-flex items-center rounded-full font-semibold transition-colors" style={{ background: activeStyle === s ? 'var(--accent-orange)' : 'rgba(255,255,255,0.15)', color: '#fff', fontSize: '13px', fontWeight: 600, padding: '6px 16px', borderRadius: '9999px' }}>{s}</button>
                ))}
              </div>
            </section>
            {/* Duration + language — captured: labels "Length" + "Language" above toggles */}
            <section className="flex flex-col gap-2.5">
              <div className="flex flex-col gap-2">
                <label className="font-bold text-white" style={{ fontFamily: 'var(--font-heading)', fontSize: '17px' }}>Length</label>
                <div className="flex gap-2">
                  {['3 min', '7 min'].map((d, i) => (
                    <button key={d} onClick={() => setDuration(i === 0 ? '3' : '7')} className="font-semibold transition-colors" style={{ width: 167, height: 44, borderRadius: '24px', fontSize: '14px', fontWeight: 600, background: duration === (i === 0 ? '3' : '7') ? 'var(--accent-orange)' : 'rgba(255,255,255,0.15)', color: '#fff', border: '2px solid ' + (duration === (i === 0 ? '3' : '7') ? 'var(--accent-orange)' : 'transparent') }}>{d}</button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-bold text-white" style={{ fontFamily: 'var(--font-heading)', fontSize: '17px' }}>Language</label>
                <div className="flex gap-2">
                  {['Indonesian', 'English'].map((l, i) => (
                    <button key={l} onClick={() => setLanguage(i === 0 ? 'id' : 'en')} className="font-semibold transition-colors" style={{ width: 167, height: 44, borderRadius: '24px', fontSize: '14px', fontWeight: 600, background: language === (i === 0 ? 'id' : 'en') ? 'var(--accent-orange)' : 'rgba(255,255,255,0.15)', color: '#fff', border: '2px solid ' + (language === (i === 0 ? 'id' : 'en') ? 'var(--accent-orange)' : 'transparent') }}>{l}</button>
                  ))}
                </div>
              </div>
            </section>
            {/* Generate button */}
            <button onClick={generate} disabled={generating || selected.length !== 2} className="inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-transform active:translate-y-0.5 disabled:opacity-60" style={{ height: 48, padding: '0 32px', fontSize: '15px', fontWeight: 600, background: 'var(--accent-orange)', color: '#fff', boxShadow: '0 4px 0 #c5520a' }}>
              {generating ? <Loader2 size={18} className="animate-spin" /> : <Headphones size={18} />}
              {generating ? (progress || 'Generating...') : 'Generate Podcast'}
            </button>
            {generating && <p className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>Bimo nulis skrip + bikin suara host satu-satu. Biasanya 30-60 detik.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// === Tab 9: Tempel (Sticky notes) — 1:1 from auth HTML ===
function StickyTab() {
  const [notes, setNotes] = useState<{ id: string; text: string; color: string }[]>([]);
  const [newText, setNewText] = useState('');
  const [search, setSearch] = useState('');
  const COLORS = ['#fff3eb', '#e8f5e9', '#e3f2fd', '#fce4ec'];

  function addNote(text?: string) {
    const content = (text ?? newText).trim() || 'New note';
    setNotes(prev => [...prev, { id: crypto.randomUUID(), text: content, color: COLORS[prev.length % COLORS.length] }]);
    if (!text) setNewText('');
  }

  const filtered = search.trim() ? notes.filter(n => n.text.toLowerCase().includes(search.toLowerCase())) : notes;

  return (
    <div className="mx-auto w-full" style={{ maxWidth: '1360px', padding: '32px clamp(28px, 5vw, 72px) 80px' }}>
      <div className="flex flex-col gap-8">
        {/* Header — captured: title + search input + New sticky note button */}
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-bold leading-tight" style={{ fontFamily: 'var(--font-heading)', fontSize: '32px', color: 'var(--text-primary)' }}>Sticky notes</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Drag a note off the board to stick it on the page.</p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
            {/* Search input — captured: rounded-xl border-2 with search icon */}
            <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl px-3 sm:w-72 sm:flex-none" style={{ border: '2px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
              <Search size={16} className="shrink-0" />
              <input placeholder="Search notes" aria-label="Search notes" className="min-w-0 flex-1 bg-transparent text-sm outline-none" style={{ color: 'var(--text-primary)' }} type="search" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            {/* New sticky note button — captured: neo-brutalist with shadow */}
            <button type="button" onClick={() => addNote()} className="inline-flex h-11 flex-none items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all active:translate-y-0.5" style={{ background: 'var(--accent-orange)', color: '#fff', boxShadow: '0 4px 0 #c5520a' }}>
              <Plus size={18} /> New sticky note
            </button>
          </div>
        </header>

        {/* Empty state — captured: write.webp illustration + "No sticky notes yet" */}
        {filtered.length === 0 && notes.length === 0 ? (
          <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="" aria-hidden="true" className="object-contain size-40" src="/pelajarin-assets/img/write-Bi8IeuzT.webp" />
            <h2 className="font-bold" style={{ fontFamily: 'var(--font-heading)', fontSize: '20px', color: 'var(--text-primary)' }}>No sticky notes yet</h2>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>Press + in the top-right to add one, or drag a note off the board to stick it on the page.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12"><p className="text-sm text-muted">No notes match "{search}".</p></div>
        ) : (
          /* Sticky notes grid */
          <div className="flex flex-wrap gap-3">
            {filtered.map(n => (
              <div key={n.id} className="rounded-2xl p-4 shadow-sm" style={{ background: n.color, borderRadius: '16px', width: 220, minHeight: 120 }}>
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{n.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
