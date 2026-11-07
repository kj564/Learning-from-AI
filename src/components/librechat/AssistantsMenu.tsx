'use client';

/**
 * Assistants dropdown — Onyx-style.
 *
 * Trigger: bordered chip showing the active assistant's icon + name.
 * Menu: search + list of assistants (select to activate) + "+ New assistant".
 *
 * Selecting an assistant injects its systemPrompt + tool whitelist into the chat.
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check, Bot, Plus, Sparkles } from 'lucide-react';
import { useStore } from '@/lib/store';
import { getAssistants } from '@/lib/api';
import type { Assistant } from '@/lib/api';

export default function AssistantsMenu() {
  const assistants = useStore((s) => s.assistants);
  const setAssistants = useStore((s) => s.setAssistants);
  const activeAssistantId = useStore((s) => s.activeAssistantId);
  const setActiveAssistant = useStore((s) => s.setActiveAssistant);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Fetch on mount
  useEffect(() => {
    getAssistants().then((list) => setAssistants(list as Assistant[]));
  }, [setAssistants]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const active = assistants.find((a) => a.id === activeAssistantId);
  const filtered = assistants.filter(
    (a) =>
      a.name.toLowerCase().includes(query.toLowerCase()) ||
      a.description.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="border-border-light bg-surface-chat text-text-primary hover:bg-surface-active-alt flex h-9 max-w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm transition"
        title={active ? `${active.name} — ${active.description}` : 'Choose an assistant'}
      >
        <Bot size={16} className="text-accent-primary shrink-0" />
        <span className="truncate text-start">{active?.name || 'Assistant'}</span>
        <ChevronDown size={14} className="text-text-tertiary shrink-0" />
      </button>

      {open && (
        <div className="bg-surface-popover border-border-light text-text-primary absolute start-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border shadow-xl">
          <div className="border-border-light border-b p-2">
            <div className="text-text-tertiary bg-surface-secondary flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
              <Search size={14} />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search assistants"
                className="text-text-primary placeholder:text-text-tertiary w-full bg-transparent outline-none"
              />
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto p-1">
            <button
              onClick={() => {
                setActiveAssistant(null);
                setOpen(false);
                setQuery('');
              }}
              className={`flex w-full items-start gap-3 rounded-md px-2.5 py-2 text-start transition ${
                !activeAssistantId ? 'bg-surface-active-alt' : 'hover:bg-surface-hover'
              }`}
            >
              <Sparkles size={16} className="text-accent-primary mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-text-primary flex items-center gap-1.5 text-sm font-medium">
                  Default (no assistant)
                  {!activeAssistantId && <Check size={14} className="text-accent-primary" />}
                </div>
                <div className="text-text-tertiary truncate text-xs">
                  Use the standard Claude with all tools enabled.
                </div>
              </div>
            </button>
            <div className="border-border-light my-1 border-t" />
            {filtered.map((a) => {
              const isActive = a.id === activeAssistantId;
              return (
                <button
                  key={a.id}
                  onClick={() => {
                    setActiveAssistant(a.id);
                    setOpen(false);
                    setQuery('');
                  }}
                  className={`flex w-full items-start gap-3 rounded-md px-2.5 py-2 text-start transition ${
                    isActive ? 'bg-surface-active-alt' : 'hover:bg-surface-hover'
                  }`}
                >
                  <Bot size={16} className="text-accent-primary mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-text-primary flex items-center gap-1.5 text-sm font-medium">
                      {a.name}
                      {isActive && <Check size={14} className="text-accent-primary" />}
                    </div>
                    <div className="text-text-tertiary truncate text-xs">{a.description}</div>
                    <div className="text-text-tertiary mt-0.5 truncate text-[11px]">
                      {a.tools.length} tool{a.tools.length === 1 ? '' : 's'} · {a.model}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="border-border-light border-t p-1.5">
            <button
              onClick={() => {
                setOpen(false);
                setQuery('');
                // Open the assistant editor panel (in real app, a route). For MVP, prompt for name + systemPrompt.
                const name = prompt('Assistant name:');
                if (!name) return;
                const systemPrompt = prompt('System prompt (persona):') || '';
                import('@/lib/api').then(({ createAssistant }) =>
                  createAssistant({ name, systemPrompt, description: 'Custom assistant' }).then((a) => {
                    if (a) setAssistants([a as Assistant, ...assistants]);
                  })
                );
              }}
              className="text-text-primary hover:bg-surface-hover flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm"
            >
              <Plus size={14} /> New assistant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
