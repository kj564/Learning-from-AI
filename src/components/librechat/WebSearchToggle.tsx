'use client';

/**
 * WebSearchToggle — chip button that toggles the webSearchEnabled flag.
 * When enabled, the assistant is forced to do a web_search round before answering.
 */

import { Globe } from 'lucide-react';
import { useStore } from '@/lib/store';

export default function WebSearchToggle() {
  const enabled = useStore((s) => s.webSearchEnabled);
  const toggle = useStore((s) => s.toggleWebSearch);

  return (
    <button
      onClick={toggle}
      title={enabled ? 'Web search ON — assistant will search the web first' : 'Web search OFF'}
      aria-pressed={enabled}
      className={`flex h-8 shrink-0 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition ${
        enabled
          ? 'border-accent-primary/40 bg-accent-primary/10 text-accent-primary'
          : 'border-border-light text-text-secondary hover:bg-surface-active hover:text-text-primary'
      }`}
    >
      <Globe size={14} />
      <span className="hidden sm:inline">Search web</span>
    </button>
  );
}
