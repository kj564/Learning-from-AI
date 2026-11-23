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
} from 'lucide-react';
import { toast } from 'sonner';
import Markdown from '@/components/librechat/Markdown';
import { MindmapView } from '@/components/librechat/MindmapView';

// Types
interface User { id: string; name: string; email: string; plan: string; }
interface Usage { notesUsed: number; chatsUsed: number; notesRemaining: number; chatsRemaining: number; canCreateNote: boolean; canSendChat: boolean; }
interface Note { id: string; title: string; description: string | null; status: string; flashcard_count: number; quiz_count: number; total_chapters: number; updated_at: string; }

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

  const loadData = useCallback(async () => {
    try {
      const [meRes, subRes, notesRes] = await Promise.all([
        fetch('/api/v1/me').then(r => r.json()),
        fetch('/api/v1/subscriptions').then(r => r.json()),
        fetch('/api/v1/notes?limit=50').then(r => r.json()),
      ]);
      setUser(meRes.data);
      setUsage(subRes.data?.usage);
      setNotes(notesRes.data || []);
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
      {/* Header — captured: h-64, glass bg, sticky, pad 0 28px, gap 12px */}
      <header className="sticky top-0 z-50 flex items-center gap-3 header-glass border-b border-app" style={{ height: 'var(--header-h)', padding: 'var(--header-pad)', gap: 'var(--header-gap)' }}>
        <a href="/" className="flex items-center" style={{ gap: 8 }}>
          {/* Real pelajarin.ai logo (64x64 logo.png) — used as-is per "pakai aset asli dulu" */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pelajarin-assets/img/logo.png" alt="Bimo logo" width={32} height={32} style={{ objectFit: 'contain' }} />
          <span className="font-bold" style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-logo)', fontWeight: 700 }}>bimo.ai</span>
        </a>
        <button className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-app text-xs font-semibold text-muted" style={{ fontSize: '11px' }}>C</button>
        <nav className="flex items-center gap-2 text-sm font-semibold" style={{ fontSize: 'var(--text-nav)' }}>
          <span>{view === 'dashboard' ? 'Home' : activeNote?.title.slice(0, 30)}</span>
          {view === 'note' && <><span className="text-muted">›</span><span style={{ color: 'var(--accent-orange)' }}>{TABS.find(t => t.url === activeTab)?.label}</span></>}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {/* Become a Creator — captured: outline pill */}
          <a href="#" className="inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold" style={{ padding: '0 16px', height: 36, fontSize: 'var(--text-nav)', border: '2px solid var(--border)', color: 'var(--text-primary)' }}>Become a Creator</a>
          {/* Streak — captured: yellow bg pill with Flame icon */}
          <span className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold" style={{ background: '#fef9c3', color: '#a16207', padding: '0 14px', height: 36, fontSize: 'var(--text-nav)' }}>
            <Flame size={14} /> Streak {usage && usage.notesUsed > 0 ? 1 : 0}
          </span>
          {/* Level — captured: blue bg pill with Trophy icon */}
          <span className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold" style={{ background: '#dbeafe', color: '#1d4ed8', padding: '0 14px', height: 36, fontSize: 'var(--text-nav)' }}>
            <Trophy size={14} /> Level 1
          </span>
          {/* Upgrade — captured: orange bg pill with Sparkles icon */}
          <span className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold" style={{ background: 'var(--accent-orange)', color: '#fff', padding: '0 16px', height: 36, fontSize: 'var(--text-nav)' }}>
            <Sparkles size={14} /> Upgrade
          </span>
          {/* Avatar — captured: 36x36 round with initial */}
          <div className="flex items-center justify-center rounded-full text-sm font-bold" style={{ background: 'var(--bg-surface)', width: 36, height: 36, color: 'var(--text-primary)' }}>{user?.name?.[0] || 'B'}</div>
        </div>
      </header>

      {/* Body: sidebar + main */}
      <div className="flex flex-1">
        {view === 'dashboard' ? (
          <DashboardSidebar />
        ) : (
          <NoteSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        )}

        {view === 'dashboard' && (
          <BimoDashboard notes={notes} usage={usage}
            onNoteClick={(n) => { setActiveNote(n); setView('note'); setActiveTab('belajar'); }}
            onNoteCreated={loadData} />
        )}
        {view === 'note' && activeNote && (
          <BimoNoteDetail note={activeNote} activeTab={activeTab} usage={usage}
            onBack={() => { setView('dashboard'); setActiveNote(null); }} />
        )}
      </div>

      <footer className="border-t border-app px-20 py-6 text-center text-xs text-muted">
        <p>Bimo — Teman belajar AI untuk siswa Indonesia. Gratis selamanya, Pro mulai Rp 20 ribu.</p>
        <p className="mt-1">60% lebih murah · 15 catatan/bulan · 50 chat/bulan</p>
      </footer>
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
    <aside className="sticky top-16 z-40 hidden flex-col self-start border-r border-app bg-app sm:flex" style={{ width: 'var(--sidebar-w)', height: 'calc(100vh - 4rem)', padding: '20px 8px' }}>
      <nav className="flex flex-col gap-2" aria-label="Main navigation">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.url)}
            className="flex w-full flex-col items-center gap-1.5 rounded-xl p-1.5 text-center font-semibold transition-colors"
            style={{
              fontSize: '12px', fontWeight: 600, borderRadius: '20px',
              color: activeTab === tab.url ? 'var(--accent-orange)' : 'var(--text-muted)',
            }}
          >
            <tab.icon size={20} />
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    <main className="mx-auto w-full flex-1" style={{ maxWidth: 'var(--main-max)', padding: 'var(--main-pad)' }}>
      <input ref={fileInputRef} type="file" onChange={handleUpload} className="hidden" accept=".pdf,.docx,.pptx,.xlsx,.txt,.png,.jpg,.mp3,.mp4" />
      {/* Hero — captured: 132x132 Pai mascot + "What do you want to learn today?" */}
      <section className="mb-7 flex items-center" style={{ gap: 8 }}>
        {/* Real Pai mascot from pelajarin.ai (pai-pointing.png, 212x212) */}
        <div className="flex items-center justify-center" style={{ width: 132, height: 132 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pelajarin-assets/img/pai-pointing.png" alt="Bimo mascot" width={132} height={132} style={{ objectFit: 'contain' }} />
        </div>
        <h1 className="font-bold text-balance" style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-h1)', lineHeight: 'var(--text-h1-lh)' }}>What do you want to learn today?</h1>
      </section>
      {/* Upload box */}
      <section className="mx-auto mb-12 rounded-2xl border-2 border-app bg-app transition-colors" style={{ maxWidth: 'var(--upload-max)', padding: 'var(--upload-pad)' }}>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCreateNote(); } }}
          placeholder="What would you like to learn?"
          className="w-full resize-none border-none bg-transparent outline-none"
          style={{ minHeight: 52, fontFamily: 'var(--font-body)', fontSize: 'var(--text-input)', color: 'var(--text-primary)' }}
        />
        <div className="mt-1 flex items-center gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-full font-semibold" style={{ background: 'var(--bg-surface)', color: 'var(--accent-green)', fontSize: 'var(--text-btn-sm)', fontWeight: 600, padding: '6px 14px' }}><Mic size={14} /> Record</button>
          <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-full font-semibold" style={{ background: 'var(--bg-surface)', color: 'var(--accent-blue)', fontSize: 'var(--text-btn-sm)', fontWeight: 600, padding: '6px 14px' }} disabled={uploading}><Upload size={14} /> {uploading ? 'Uploading...' : 'Upload'}</button>
          <button className="inline-flex items-center gap-1.5 rounded-full font-semibold" style={{ background: 'var(--bg-surface)', color: 'var(--accent-red)', fontSize: 'var(--text-btn-sm)', fontWeight: 600, padding: '6px 14px' }}><Video size={14} /> YouTube</button>
          <button onClick={handleCreateNote} className="ml-auto grid place-items-center rounded-full" style={{ width: 44, height: 44, background: 'var(--bg-accent)', color: 'var(--accent-orange)' }}><Send size={18} /></button>
        </div>
      </section>
      {/* Notes + filters — captured: "Notes" heading + "All folders" dropdown + filter chips + Grid/List pill toggle */}
      <div className="mb-4 flex items-center gap-3">
        <span className="text-lg font-bold" style={{ fontFamily: 'var(--font-heading)' }}>Notes</span>
        {/* All folders dropdown — captured: pill with chevron */}
        <button className="inline-flex items-center gap-1.5 rounded-full border-2 border-app font-semibold" style={{ fontSize: 'var(--text-btn-sm)', fontWeight: 600, padding: '6px 14px', color: 'var(--text-primary)' }}>
          All folders <ChevronRight size={12} className="rotate-90" />
        </button>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button key={f} onClick={() => setFilter(f.toLowerCase())}
            className={`inline-flex items-center gap-1.5 rounded-full border-2 font-semibold transition-colors ${filter === f.toLowerCase() ? 'filter-active' : 'filter-inactive'}`}
            style={{ fontSize: 'var(--text-btn-sm)', fontWeight: 600, padding: '6px 12px', borderRadius: 'var(--radius-pill)' }}>{f}</button>
        ))}
        {/* Grid/List pill toggle — captured: pill container with active Grid (orange) */}
        <div className="ml-auto inline-flex items-center gap-0.5 rounded-full p-1" style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-pill)' }}>
          <button onClick={() => setView('dashboard')} className="grid place-items-center rounded-full p-1.5 transition-colors" style={{ background: 'var(--bg-primary)', color: 'var(--accent-orange)', borderRadius: 'var(--radius-pill)' }} aria-label="Grid view"><Grid3x3 size={16} /></button>
          <button className="grid place-items-center rounded-full p-1.5 text-muted transition-colors" style={{ borderRadius: 'var(--radius-pill)' }} aria-label="List view"><List size={16} /></button>
        </div>
      </div>
      {/* Notes grid */}
      {notes.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border-2 border-app"><BookOpen size={32} className="mx-auto text-muted mb-2" /><p className="text-sm text-muted">Belum ada catatan. Upload materi untuk mulai belajar!</p></div>
      ) : (
        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          {notes.map(n => (
            <button key={n.id} onClick={() => onNoteClick(n)} className="group card-pjr text-left transition-colors hover:border-[var(--accent-orange)]">
              <div className="mb-2 flex items-start justify-between">
                <div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--bg-surface)]"><FileText size={16} style={{ color: 'var(--accent-blue)' }} /></div><h4 className="text-sm font-semibold truncate" style={{ maxWidth: 200 }}>{n.title}</h4></div>
                <ChevronRight size={16} className="text-muted group-hover:text-[var(--accent-orange)]" />
              </div>
              <div className="flex items-center gap-3 text-xs text-muted">
                {n.total_chapters > 0 && <span className="flex items-center gap-1"><Layers size={10} /> {n.total_chapters} bab</span>}
                {n.flashcard_count > 0 && <span className="flex items-center gap-1"><Brain size={10} /> {n.flashcard_count}</span>}
                {n.quiz_count > 0 && <span className="flex items-center gap-1"><CheckCircle size={10} /> {n.quiz_count}</span>}
                <span className="ml-auto">{new Date(n.updated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
              </div>
              {n.status === 'processing' && <div className="mt-2 flex items-center gap-1 text-xs" style={{ color: 'var(--accent-orange)' }}><Loader2 size={10} className="animate-spin" /> Processing...</div>}
            </button>
          ))}
        </div>
      )}
    </main>
  );
}

// === Note Detail with 9 tabs ===
function BimoNoteDetail({ note, activeTab, usage, onBack }: { note: Note; activeTab: string; usage: Usage | null; onBack: () => void }) {
  const [noteDetail, setNoteDetail] = useState<any>(null);
  const [tab, setTab] = useState(activeTab);

  useEffect(() => { setTab(activeTab); }, [activeTab]);
  useEffect(() => { fetch(`/api/v1/notes/${note.id}`).then(r => r.json()).then(d => setNoteDetail(d.data)).catch(() => {}); }, [note.id]);

  // Per-tab main content max-width (captured):
  // belajar/kuis/flashcard/tempel: max-w-[1120px] px-[clamp(28px,5vw,72px)]
  // catatan/mindmap/sumber/chat: full height flex h-[calc(100vh-4rem)]
  // podcast: max-w-[1360px]
  const isFullHeight = ['catatan', 'mindmap', 'sumber', 'chat'].includes(tab);
  const maxWidth = tab === 'podcast' ? '1360px' : '1120px';

  return (
    <main className="flex min-w-0 flex-1 flex-col" style={{ height: isFullHeight ? 'calc(100vh - 4rem)' : 'auto' }}>
      {/* Tab content */}
      {tab === 'belajar' && <BelajarTab note={noteDetail} onBack={onBack} />}
      {tab === 'catatan' && <CatatanTab note={noteDetail} />}
      {tab === 'mindmap' && <MindmapTab note={noteDetail} />}
      {tab === 'kuis' && <QuizTab noteId={note.id} />}
      {tab === 'flashcard' && <FlashcardTab noteId={note.id} />}
      {tab === 'sumber' && <SourcesTab note={noteDetail} />}
      {tab === 'chat' && <ChatTab noteId={note.id} noteTitle={note.title} usage={usage} />}
      {tab === 'podcast' && <PodcastTab noteId={note.id} noteTitle={note.title} />}
      {tab === 'tempel' && <StickyTab />}
    </main>
  );
}

// === Tab 1: Belajar (Learn) — chapter list with progress + locked chapters ===
function BelajarTab({ note, onBack }: { note: any; onBack: () => void }) {
  if (!note) return <Loader2 className="animate-spin text-muted mx-auto" size={24} />;
  const progress = note?.total_chapters > 0 ? Math.round((note?.flashcard_count || 0) * 100 / Math.max(note?.total_chapters, 1)) : 0;
  return (
    <div className="mx-auto w-full" style={{ maxWidth: '1120px', padding: '0 clamp(28px, 5vw, 72px) 8px' }}>
      {/* Progress + Upgrade */}
      <div className="mb-4 flex items-center gap-4">
        <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>{note.title || 'Catatan Baru'}</h1>
        <span className="text-sm text-muted">{progress}%</span>
        <button className="inline-flex items-center rounded-full font-semibold" style={{ background: 'var(--accent-orange)', color: '#fff', fontSize: '14px', fontWeight: 600, padding: '0 20px', height: 44, borderRadius: '20px' }}>Upgrade to Pro</button>
      </div>
      {/* Chapter list */}
      {note?.chapters && note.chapters.length > 0 ? (
        <div className="space-y-2">
          {note.chapters.map((c: any, i: number) => (
            <div key={c.id} className="flex items-center gap-3 rounded-2xl border-2 border-app p-4" style={{ borderRadius: '24px' }}>
              <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: i === 0 ? 'var(--accent-orange)' : 'var(--bg-surface)', color: i === 0 ? '#fff' : 'var(--text-muted)' }}>{i + 1}</div>
              <div className="flex-1"><h3 className="text-sm font-semibold">{c.title}</h3>{c.content && <p className="text-xs text-muted mt-1 truncate">{c.content.slice(0, 60)}...</p>}</div>
              {i > 0 && <button className="inline-flex items-center rounded-full font-semibold" style={{ background: 'var(--accent-orange)', color: '#fff', fontSize: '14px', fontWeight: 600, padding: '0 20px', height: 44, borderRadius: '20px' }}>Upgrade to Pro</button>}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 rounded-2xl border-2 border-app"><BookOpen size={32} className="mx-auto text-muted mb-2" /><p className="text-sm text-muted">Catatan belum diproses. Upload materi untuk mulai belajar!</p></div>
      )}
    </div>
  );
}

// === Tab 2: Catatan (Notes) — rich text editor ===
function CatatanTab({ note }: { note: any }) {
  if (!note) return <Loader2 className="animate-spin text-muted mx-auto" size={24} />;
  return (
    <div className="flex h-full items-stretch">
      <div className="flex flex-1 flex-col">
        {/* Toolbar — captured: Heading 1, Format, Export PDF buttons */}
        <div className="flex items-center gap-1 border-b border-app p-2">
          {[Bold, Italic, Underline].map((Icon, i) => <button key={i} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-surface" style={{ borderRadius: '16px' }}><Icon size={16} /></button>)}
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
  const [selectedAnswer, setSelectedAnswer] = useState<Record<string, number>>({});

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
      if (d.data) { toast.success(`${d.data.question_count} soal kuis dibuat!`); loadQuizzes(); }
      else toast.error(d.error?.message || 'Gagal generate kuis');
    } catch { toast.error('Gagal generate kuis'); }
    finally { setGenerating(false); }
  }

  if (loading) return <div className="mx-auto w-full flex flex-col items-center justify-center py-20" style={{ maxWidth: '1120px' }}><div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--bg-accent)', borderRadius: '9999px' }}><Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent-orange)' }} /></div><p className="mt-4 text-sm text-muted">Writing questions...</p></div>;
  if (quizzes.length === 0) return <div className="mx-auto w-full" style={{ maxWidth: '1120px', padding: '0 clamp(28px, 5vw, 72px)' }}><div className="text-center py-12 rounded-2xl border-2 border-app"><CheckCircle size={32} className="mx-auto text-muted mb-2" /><p className="text-sm text-muted mb-4">Belum ada kuis.</p><button onClick={generate} disabled={generating} className="inline-flex items-center gap-2 rounded-full font-semibold" style={{ background: 'var(--accent-orange)', color: '#fff', fontSize: '14px', fontWeight: 600, padding: '0 24px', height: 44, borderRadius: '9999px' }}>{generating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Generate Kuis</button></div></div>;
  return <div className="mx-auto w-full space-y-4" style={{ maxWidth: '1120px', padding: '0 clamp(28px, 5vw, 72px)' }}>
    {quizzes.map(q => (
      <div key={q.id} className="card-pjr">
        <p className="text-sm font-medium mb-3">{q.title || 'Kuis'}</p>
        {q.questions?.map((qs: any, qi: number) => (
          <div key={qs.id} className="mb-4 rounded-xl border-2 border-app p-3" style={{ borderRadius: '16px' }}>
            <p className="text-sm font-medium mb-2">{qi + 1}. {qs.question}</p>
            {qs.options?.map((opt: string, oi: number) => {
              const isCorrect = opt === qs.answer;
              const isSelected = selectedAnswer[qs.id] === oi;
              return <button key={oi} onClick={() => setSelectedAnswer(prev => ({ ...prev, [qs.id]: oi }))} className="block w-full text-left rounded-lg px-3 py-2 mb-1 text-sm transition-colors" style={{ border: `2px solid ${isSelected ? (isCorrect ? 'var(--accent-green)' : 'var(--accent-red)') : 'var(--border)'}`, borderRadius: '12px', background: isSelected ? (isCorrect ? 'rgba(88,204,2,0.1)' : 'rgba(239,68,68,0.1)') : 'transparent' }}><span className="font-semibold mr-2">{String.fromCharCode(65 + oi)}.</span> {opt}</button>;
            })}
            {selectedAnswer[qs.id] !== undefined && <p className="text-xs text-muted mt-2">{qs.explanation}</p>}
          </div>
        ))}
      </div>
    ))}
    <button onClick={generate} disabled={generating} className="inline-flex items-center gap-2 rounded-full font-semibold" style={{ background: 'var(--accent-orange)', color: '#fff', fontSize: '14px', fontWeight: 600, padding: '0 24px', height: 44, borderRadius: '9999px' }}>{generating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Generate Lagi</button>
  </div>;
}

// === Tab 5: Flashcard ===
function FlashcardTab({ noteId }: { noteId: string }) {
  const [cards, setCards] = useState<any[]>([]);
  const [flipped, setFlipped] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

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
      const res = await fetch(`/api/v1/notes/${noteId}/flashcards`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ count: 10 }) });
      const d = await res.json();
      if (d.data) { toast.success(`${d.data.count} flashcard dibuat!`); loadCards(); }
      else toast.error(d.error?.message || 'Gagal generate flashcard');
    } catch { toast.error('Gagal generate flashcard'); }
    finally { setGenerating(false); }
  }

  if (loading) return <div className="mx-auto w-full flex flex-col items-center justify-center py-20" style={{ maxWidth: '1120px' }}><div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--bg-accent)', borderRadius: '9999px' }}><Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent-orange)' }} /></div><p className="mt-4 text-sm text-muted">Making cards...</p></div>;
  if (cards.length === 0) return <div className="mx-auto w-full" style={{ maxWidth: '1120px', padding: '0 clamp(28px, 5vw, 72px)' }}><div className="text-center py-12 rounded-2xl border-2 border-app"><Brain size={32} className="mx-auto text-muted mb-2" /><p className="text-sm text-muted mb-4">Belum ada flashcard.</p><button onClick={generate} disabled={generating} className="inline-flex items-center gap-2 rounded-full font-semibold" style={{ background: 'var(--accent-orange)', color: '#fff', fontSize: '14px', fontWeight: 600, padding: '0 24px', height: 44, borderRadius: '9999px' }}>{generating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Generate Flashcard</button></div></div>;
  return <div className="mx-auto w-full space-y-3" style={{ maxWidth: '1120px', padding: '0 clamp(28px, 5vw, 72px)' }}>
    {cards.map((c, i) => (<button key={c.id} onClick={() => setFlipped(flipped === i ? null : i)} className="card-pjr w-full text-left flex items-center" style={{ minHeight: 120 }}>{flipped === i ? <><p className="text-xs text-muted mb-1">JAWABAN</p><p className="text-sm">{c.back}</p></> : <><p className="text-xs text-muted mb-1">PERTANYAAN</p><p className="text-sm">{c.front}</p><p className="text-xs text-muted mt-2">Klik untuk lihat jawaban</p></>}</button>))}
    <button onClick={generate} disabled={generating} className="inline-flex items-center gap-2 rounded-full font-semibold" style={{ background: 'var(--accent-orange)', color: '#fff', fontSize: '14px', fontWeight: 600, padding: '0 24px', height: 44, borderRadius: '9999px' }}>{generating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Generate Lagi</button>
  </div>;
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionIdRef = useRef<string>('');
  useEffect(() => { sessionIdRef.current = crypto.randomUUID(); }, [noteId]);
  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);

  async function send() {
    if (!input.trim() || streaming) return;
    if (usage && !usage.canSendChat) { toast.error('Batas chat tercapai. Upgrade ke Pro.'); return; }
    const msg = input.trim(); setInput('');
    setMessages(prev => [...prev, { role: 'user', content: msg }]);
    setStreaming(true);
    try {
      const res = await fetch('/api/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note_id: noteId, session_id: sessionIdRef.current, message: msg }) });
      if (!res.ok) { const err = await res.json(); toast.error(err.error?.message || 'Chat gagal'); return; }
      const reader = res.body?.getReader(); const decoder = new TextDecoder();
      let assistantText = ''; let buf = '';
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      while (reader) {
        const { done, value } = await reader.read(); if (done) break;
        buf += decoder.decode(value, { stream: true });
        const events = buf.split('\n\n'); buf = events.pop() || '';
        for (const evt of events) {
          const lines = evt.split('\n'); let eventType = ''; let dataStr = '';
          for (const line of lines) { if (line.startsWith('event:')) eventType = line.slice(6).trim(); if (line.startsWith('data:')) dataStr = line.slice(5).trim(); }
          if (!dataStr) continue;
          try { const data = JSON.parse(dataStr); if (eventType === 'text-delta' && data.text) { assistantText += data.text; setMessages(prev => { const c = [...prev]; c[c.length - 1] = { role: 'assistant', content: assistantText }; return c; }); } } catch {}
        }
      }
      fetch('/api/v1/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_name: 'chat_session', note_id: noteId }) }).catch(() => {});
    } catch { toast.error('Chat error'); }
    finally { setStreaming(false); }
  }

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
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: 'var(--bg-accent)' }}><span style={{ color: 'var(--accent-orange)', fontWeight: 700, fontSize: '20px' }}>B</span></div>
              <p className="text-sm font-semibold">Hi, I'm Bimo!</p>
              <p className="text-xs text-muted mt-1">I can help you understand these notes and answer any question.</p>
              <div className="mt-4 space-y-2">{['Jelaskan konsep utama dari materi ini', 'Buat ringkasan singkat', 'Soal apa yang mungkin keluar?'].map(s => <button key={s} onClick={() => setInput(s)} className="block w-full rounded-lg border-2 border-app px-3 py-2 text-xs text-muted hover:border-[var(--accent-orange)] hover:text-app transition-all">{s}</button>)}</div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`mb-3 flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.role === 'user' ? '' : 'bg-surface'}`} style={{ background: m.role === 'user' ? 'var(--accent-orange)' : 'var(--bg-surface)', color: m.role === 'user' ? '#fff' : 'var(--text-primary)' }}>
                {m.role === 'assistant' && m.content === '' && streaming ? <Loader2 size={14} className="animate-spin" /> : m.role === 'assistant' ? <div className="prose prose-sm max-w-none"><Markdown content={m.content} /></div> : m.content}
              </div>
            </div>
          ))}
        </div>
        {/* Input — captured: textarea 632x72 + 40x40 buttons + 56x56 send */}
        <div className="flex gap-2 p-3 border-t border-app">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Ask anything about this note..." rows={1} className="flex-1 resize-none border-none bg-transparent outline-none" style={{ fontSize: '15px' }} />
          <button onClick={send} disabled={streaming || !input.trim()} className="grid place-items-center rounded-full" style={{ width: 40, height: 40, background: 'var(--bg-accent)', color: 'var(--accent-orange)', borderRadius: '9999px' }}>{streaming ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}</button>
        </div>
      </div>
    </div>
  );
}

// === Tab 8: Podcast — 4 AI host personas + generate + sequential playback ===
function PodcastTab({ noteId, noteTitle }: { noteId: string; noteTitle: string }) {
  const HOSTS = [
    { name: 'Pai', role: 'Explainer', color: 'var(--accent-orange)' },
    { name: 'Kiko', role: 'The curious one', color: 'var(--accent-blue)' },
    { name: 'Bolu', role: 'Storyteller', color: 'var(--accent-green)' },
    { name: 'Meli', role: 'Exam coach', color: 'var(--accent-red)' },
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

  // === Setup view — pick hosts, style, duration, generate ===
  return (
    <div className="mx-auto flex w-full flex-col" style={{ maxWidth: '1360px', minHeight: 'calc(100svh - 4rem)' }}>
      <div className="mx-auto w-full" style={{ maxWidth: '760px', padding: '32px clamp(28px, 5vw, 72px)' }}>
        <h2 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-heading)' }}>Create a podcast</h2>
        <p className="text-sm text-muted mb-6">From the lesson {noteTitle}</p>
        {/* Pick 2 hosts — captured: 169x150 cards, radius 22px */}
        <p className="text-sm font-semibold mb-3">Pick 2 hosts <span className="text-muted">({selected.length} of 2 picked)</span></p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
          {HOSTS.map(h => (
            <button key={h.name} onClick={() => setSelected(prev => prev.includes(h.name) ? prev.filter(n => n !== h.name) : prev.length < 2 ? [...prev, h.name] : [prev[1], h.name])}
              className="flex flex-col items-center justify-center rounded-2xl border-2 p-4 text-center transition-colors"
              style={{ borderRadius: '22px', borderColor: selected.includes(h.name) ? h.color : 'var(--border)', background: selected.includes(h.name) ? 'var(--bg-accent)' : 'var(--bg-primary)', minHeight: 150 }}>
              <div className="flex h-12 w-12 items-center justify-center rounded-full mb-2" style={{ background: h.color, color: '#fff', fontWeight: 700 }}>{h.name[0]}</div>
              <p className="text-sm font-semibold">{h.name}</p>
              <p className="text-xs text-muted">{h.role}</p>
            </button>
          ))}
        </div>
        {/* Style suggestions — captured: pill 13px/600 */}
        <p className="text-sm font-semibold mb-3">What should the chat be like?</p>
        <div className="mb-6 flex flex-wrap gap-2">
          {SUGGESTIONS.map(s => (
            <button key={s} onClick={() => setActiveStyle(prev => prev === s ? null : s)} className="inline-flex items-center rounded-full font-semibold transition-colors" style={{ background: activeStyle === s ? 'var(--accent-orange)' : 'var(--bg-surface)', color: activeStyle === s ? '#fff' : 'var(--text-primary)', fontSize: '13px', fontWeight: 600, padding: '6px 16px', borderRadius: '9999px' }}>{s}</button>
          ))}
        </div>
        {/* Duration + language — captured: 167x44, radius 24px */}
        <div className="mb-6 flex gap-2">
          {['3 min', '7 min'].map((d, i) => <button key={d} onClick={() => setDuration(i === 0 ? '3' : '7')} className="font-semibold" style={{ width: 167, height: 44, borderRadius: '24px', fontSize: '14px', fontWeight: 600, border: `2px solid ${duration === (i === 0 ? '3' : '7') ? 'var(--accent-orange)' : 'var(--border)'}`, background: duration === (i === 0 ? '3' : '7') ? 'var(--bg-accent)' : 'var(--bg-primary)', color: duration === (i === 0 ? '3' : '7') ? 'var(--accent-orange)' : 'var(--text-muted)' }}>{d}</button>)}
        </div>
        <div className="mb-6 flex gap-2">
          {['Indonesian', 'English'].map((l, i) => <button key={l} onClick={() => setLanguage(i === 0 ? 'id' : 'en')} className="font-semibold" style={{ width: 167, height: 44, borderRadius: '24px', fontSize: '14px', fontWeight: 600, border: `2px solid ${language === (i === 0 ? 'id' : 'en') ? 'var(--accent-orange)' : 'var(--border)'}`, background: language === (i === 0 ? 'id' : 'en') ? 'var(--bg-accent)' : 'var(--bg-primary)', color: language === (i === 0 ? 'id' : 'en') ? 'var(--accent-orange)' : 'var(--text-muted)' }}>{l}</button>)}
        </div>
        {/* Generate button — free users can do 3-min; 7-min shows Pro hint */}
        <button onClick={generate} disabled={generating || selected.length !== 2} className="inline-flex items-center gap-2 rounded-full font-semibold disabled:opacity-60" style={{ background: 'var(--accent-orange)', color: '#fff', fontSize: '15px', fontWeight: 600, padding: '0 24px', height: 44, borderRadius: '9999px' }}>
          {generating ? <Loader2 size={16} className="animate-spin" /> : <Headphones size={16} />}
          {generating ? (progress || 'Generating...') : 'Generate Podcast'}
        </button>
        {generating && (
          <p className="mt-3 text-xs text-muted">Bimo nulis skrip + bikin suara host satu-satu. Biasanya 30-60 detik.</p>
        )}
      </div>
    </div>
  );
}

// === Tab 9: Tempel (Sticky notes) ===
function StickyTab() {
  const [notes, setNotes] = useState<{ id: string; text: string; color: string }[]>([]);
  const [newText, setNewText] = useState('');
  const COLORS = ['#fff3eb', '#e8f5e9', '#e3f2fd', '#fce4ec'];
  return (
    <div className="mx-auto w-full" style={{ maxWidth: '1360px', padding: '0 clamp(28px, 5vw, 72px) 8px' }}>
      <div className="mb-4">
        <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>Sticky notes</h2>
        <p className="text-sm text-muted">Drag a note off the board to stick it on the page.</p>
      </div>
      {/* New sticky note input — captured: 232x20 input + "New sticky note" 170x44 button */}
      <div className="mb-4 flex items-center gap-2">
        <input value={newText} onChange={(e) => setNewText(e.target.value)} placeholder="New sticky note" className="border-none bg-transparent outline-none text-sm" style={{ fontSize: '14px' }} />
        <button onClick={() => { if (newText.trim()) { setNotes(prev => [...prev, { id: crypto.randomUUID(), text: newText, color: COLORS[prev.length % COLORS.length] }]); setNewText(''); } }} className="inline-flex items-center rounded-full font-semibold" style={{ fontSize: '14px', fontWeight: 600, padding: '0 20px', height: 44, borderRadius: '20px', background: 'var(--accent-orange)', color: '#fff' }}>New sticky note</button>
      </div>
      {/* Sticky notes board */}
      {notes.length === 0 ? (
        <div className="text-center py-12"><StickyNote size={32} className="mx-auto text-muted mb-2" /><p className="text-sm text-muted">No sticky notes yet. Press + in the bottom-right to add one.</p></div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {notes.map(n => (
            <div key={n.id} className="rounded-2xl p-4 shadow-sm" style={{ background: n.color, borderRadius: '16px', width: 200, minHeight: 100 }}>
              <p className="text-sm">{n.text}</p>
            </div>
          ))}
        </div>
      )}
      {/* Add button — captured: 56px circle bottom-right */}
      <button onClick={() => setNotes(prev => [...prev, { id: crypto.randomUUID(), text: 'New note', color: COLORS[prev.length % COLORS.length] }])} className="fixed bottom-8 right-8 flex h-14 w-14 items-center justify-center rounded-full shadow-lg" style={{ background: 'var(--accent-orange)', color: '#fff', borderRadius: '9999px' }}><Plus size={24} /></button>
    </div>
  );
}
