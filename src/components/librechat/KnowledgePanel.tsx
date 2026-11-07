'use client';

/**
 * Knowledge panel — Onyx-inspired document knowledge base.
 *
 *   - List uploaded documents with metadata (title, source, size, tags)
 *   - Add a document (title + source + content + tags) — calls /api/knowledge
 *   - Delete a document
 *   - Live search test box — runs /api/knowledge?action=search
 *
 * Mounted as a sidebar panel (PanelId === 'knowledge').
 */

import { useEffect, useState } from 'react';
import { Plus, Trash2, Search, BookOpen, Loader2, X } from 'lucide-react';
import { useStore } from '@/lib/store';
import type { KnowledgeDocMeta } from '@/lib/store';
import {
  getKnowledgeDocs,
  createKnowledgeDoc,
  deleteKnowledgeDoc,
  searchKnowledge,
  type KnowledgeSearchResult,
} from '@/lib/api';

export default function KnowledgePanel({ onClose }: { onClose?: () => void }) {
  const docs = useStore((s) => s.knowledgeDocs);
  const setDocs = useStore((s) => s.setKnowledgeDocs);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [source, setSource] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [busy, setBusy] = useState(false);

  // Search test
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<KnowledgeSearchResult[]>([]);

  useEffect(() => {
    refresh();
  }, []);

  const refresh = async () => {
    const list = await getKnowledgeDocs();
    setDocs(list as KnowledgeDocMeta[]);
  };

  const handleCreate = async () => {
    if (!title.trim() || !content.trim()) return;
    setBusy(true);
    const doc = await createKnowledgeDoc({
      title: title.trim(),
      source: source.trim() || title.trim(),
      content: content.trim(),
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    });
    setBusy(false);
    if (doc) {
      await refresh();
      setTitle('');
      setSource('');
      setContent('');
      setTags('');
      setShowForm(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this document?')) return;
    await deleteKnowledgeDoc(id);
    await refresh();
  };

  const handleSearch = async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const r = await searchKnowledge(query.trim(), 4);
    setResults(r);
  };

  return (
    <div className="bg-surface-sidebar border-border-light flex h-full w-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-border-light flex h-[3.25rem] shrink-0 items-center justify-between gap-2 border-b px-3">
        <div className="text-text-primary flex min-w-0 items-center gap-2 text-sm font-semibold">
          <BookOpen size={16} className="text-accent-primary shrink-0" />
          <span className="truncate">Knowledge Base</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="text-text-secondary hover:bg-surface-nav-hover hover:text-text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {/* Search test */}
        <div className="pb-3">
          <label className="text-text-tertiary mb-1 block text-xs font-medium uppercase tracking-wide">
            Test search (BM25)
          </label>
          <div className="flex gap-1">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Query…"
              className="bg-surface-search border-border-light text-text-primary placeholder:text-text-tertiary w-full rounded-md border px-2.5 py-1.5 text-sm outline-none"
            />
            <button
              onClick={handleSearch}
              className="bg-surface-active-alt text-text-primary hover:bg-surface-active flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition"
              title="Search"
            >
              <Search size={14} />
            </button>
          </div>
          {results.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {results.map((r, i) => (
                <div key={i} className="border-border-light bg-surface-chat rounded-md border p-2">
                  <div className="text-text-primary truncate text-xs font-semibold">
                    {r.title} <span className="text-text-tertiary font-normal">· score {r.score}</span>
                  </div>
                  <div className="text-text-secondary mt-0.5 line-clamp-3 text-xs">{r.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-border-light my-3 border-t" />

        {/* Docs list */}
        <div className="flex items-center justify-between pb-2">
          <span className="text-text-primary text-sm font-semibold">Documents ({docs.length})</span>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="text-text-secondary hover:bg-surface-nav-hover hover:text-text-primary flex items-center gap-1 rounded-md px-2 py-1 text-xs"
          >
            <Plus size={14} /> {showForm ? 'Cancel' : 'Add'}
          </button>
        </div>

        {showForm && (
          <div className="border-border-light bg-surface-chat mb-3 space-y-2 rounded-md border p-2.5">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (e.g. API Reference)"
              className="bg-surface-search border-border-light text-text-primary placeholder:text-text-tertiary w-full rounded border px-2 py-1 text-sm outline-none"
            />
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Source (URL or filename, optional)"
              className="bg-surface-search border-border-light text-text-primary placeholder:text-text-tertiary w-full rounded border px-2 py-1 text-xs outline-none"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Document content…"
              rows={6}
              className="bg-surface-code-body border-border-light text-text-primary w-full resize-y rounded border px-2 py-1.5 font-mono text-xs outline-none"
            />
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Tags (comma-separated)"
              className="bg-surface-search border-border-light text-text-primary placeholder:text-text-tertiary w-full rounded border px-2 py-1 text-xs outline-none"
            />
            <button
              onClick={handleCreate}
              disabled={busy || !title.trim() || !content.trim()}
              className="bg-accent-primary text-text-inverted hover:bg-accent-primary-hover flex w-full items-center justify-center gap-2 rounded px-3 py-1.5 text-xs font-medium transition disabled:opacity-50"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              Save document
            </button>
          </div>
        )}

        <div className="space-y-1.5">
          {docs.length === 0 && !showForm && (
            <div className="text-text-tertiary px-1 py-6 text-center text-xs">
              No documents. Click <Plus size={12} className="mx-1 inline" /> Add to upload one.
            </div>
          )}
          {docs.map((d) => (
            <div
              key={d.id}
              className="group border-border-light bg-surface-chat flex items-start gap-2 rounded-md border p-2"
            >
              <BookOpen size={14} className="text-accent-primary mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-text-primary truncate text-sm font-medium">{d.title}</div>
                <div className="text-text-tertiary truncate text-xs">
                  {d.source} · {d.contentLength.toLocaleString()} chars
                </div>
                {d.tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {d.tags.map((t) => (
                      <span
                        key={t}
                        className="bg-surface-active-alt text-text-tertiary rounded px-1.5 py-0.5 text-[10px]"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleDelete(d.id)}
                title="Delete document"
                className="text-text-tertiary hover:text-status-error rounded p-1 opacity-0 transition group-hover:opacity-100"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
