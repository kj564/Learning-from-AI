'use client';

/**
 * Model selector dropdown — LibreChat-style.
 * Trigger: bordered rounded chip with model icon + name.
 * Menu: search input + list of models grouped by endpoint.
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search, Sparkles, Zap, Brain } from 'lucide-react';
import { useStore } from '@/lib/store';
import type { AiModel, AiModelId } from '@/lib/api';

const DEFAULT_MODELS: AiModel[] = [
  { id: 'default', name: 'Claude Opus 5.5', description: 'Most powerful model for complex challenges' },
  { id: 'fast', name: 'Claude Haiku', description: 'Fast responses, lighter model' },
  { id: 'smart', name: 'Claude Sonnet 5', description: 'Balanced quality and speed' },
];

const MODEL_ICONS: Record<AiModelId, typeof Sparkles> = {
  default: Sparkles,
  fast: Zap,
  smart: Brain,
};

export default function ModelSelector() {
  const selectedModel = useStore((s) => s.selectedModel);
  const setSelectedModel = useStore((s) => s.setSelectedModel);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const current = DEFAULT_MODELS.find((m) => m.id === selectedModel) || DEFAULT_MODELS[0];
  const CurrentIcon = MODEL_ICONS[current.id];
  const filtered = DEFAULT_MODELS.filter(
    (m) => m.name.toLowerCase().includes(query.toLowerCase()) || m.description.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="border-border-light bg-surface-chat text-text-primary hover:bg-surface-active-alt flex h-9 max-w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm transition"
      >
        <CurrentIcon size={16} className="text-accent-primary shrink-0" />
        <span className="truncate text-start">{current.name}</span>
        <ChevronDown size={14} className="text-text-tertiary shrink-0" />
      </button>

      {open && (
        <div className="bg-surface-popover border-border-light text-text-primary absolute start-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border shadow-xl">
          <div className="border-border-light border-b p-2">
            <div className="text-text-tertiary bg-surface-secondary flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
              <Search size={14} />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search models"
                className="text-text-primary placeholder:text-text-tertiary w-full bg-transparent outline-none"
              />
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto p-1">
            {filtered.length === 0 && (
              <div className="text-text-tertiary px-3 py-4 text-center text-sm">No models found</div>
            )}
            {filtered.map((m) => {
              const Icon = MODEL_ICONS[m.id];
              const active = m.id === selectedModel;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    setSelectedModel(m.id);
                    setOpen(false);
                    setQuery('');
                  }}
                  className={`flex w-full items-start gap-3 rounded-md px-2.5 py-2 text-start transition ${
                    active ? 'bg-surface-active-alt' : 'hover:bg-surface-hover'
                  }`}
                >
                  <Icon size={16} className="text-accent-primary mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-text-primary flex items-center gap-1.5 text-sm font-medium">
                      {m.name}
                      {active && <Check size={14} className="text-accent-primary" />}
                    </div>
                    <div className="text-text-tertiary truncate text-xs">{m.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
