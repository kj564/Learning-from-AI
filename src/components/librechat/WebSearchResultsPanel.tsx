'use client';

/**
 * WebSearchResultsPanel — collapsible "Searched the web" panel.
 *
 * Shown above the assistant's text content when the message has
 * webSearch results. Each result is a clickable link with favicon,
 * host name, title, and snippet.
 */

import { useState } from 'react';
import { Globe, ChevronDown, ExternalLink } from 'lucide-react';
import type { WebSearchSource } from '@/lib/store';

interface WebSearchResultsPanelProps {
  query: string;
  results: WebSearchSource[];
}

export default function WebSearchResultsPanel({ query, results }: WebSearchResultsPanelProps) {
  const [open, setOpen] = useState(false);

  if (!results || results.length === 0) return null;

  return (
    <div className="border-border-light bg-surface-search mb-2 overflow-hidden rounded-lg border">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-text-secondary hover:bg-surface-nav-hover flex w-full items-center gap-2 px-3 py-2 text-start text-xs transition"
      >
        <Globe size={14} className="text-accent-primary shrink-0" />
        <span className="font-medium">Searched the web</span>
        <span className="text-text-tertiary">— {results.length} results</span>
        <span className="text-text-tertiary truncate">for “{query}”</span>
        <ChevronDown size={14} className={`ms-auto shrink-0 transition ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && (
        <ul className="border-border-light space-y-1 border-t p-2">
          {results.map((r, i) => (
            <li key={i}>
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:bg-surface-nav-hover flex gap-2 rounded-md px-2 py-1.5 transition"
              >
                {r.favicon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.favicon} alt="" className="mt-0.5 size-4 shrink-0 rounded-sm" />
                ) : (
                  <span className="bg-surface-active mt-0.5 flex size-4 shrink-0 items-center justify-center rounded text-[8px] font-bold uppercase">
                    {r.host_name?.[0] || '?'}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-text-tertiary flex items-center gap-1 text-[11px]">
                    {r.host_name}
                    <ExternalLink size={9} className="shrink-0" />
                  </div>
                  <div className="text-text-primary truncate text-xs font-medium">{r.name}</div>
                  <div className="text-text-secondary line-clamp-2 text-xs">{r.snippet}</div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
