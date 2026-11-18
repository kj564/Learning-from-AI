'use client';

/**
 * ThinkToggle — chip button that toggles reasoning mode (chat.z.ai style).
 * When enabled, the AI reasons before answering (longer but more thoughtful).
 */

import { Brain } from 'lucide-react';
import { useStore } from '@/lib/store';

export default function ThinkToggle() {
  const enabled = useStore((s) => s.thinkEnabled);
  const toggle = useStore((s) => s.toggleThink);

  return (
    <button
      onClick={toggle}
      title={enabled ? 'Reasoning ON — AI thinks before answering' : 'Reasoning OFF — direct answers'}
      aria-pressed={enabled}
      className={`flex h-8 shrink-0 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium transition ${
        enabled
          ? 'border-accent-primary/40 bg-accent-primary/10 text-accent-primary'
          : 'border-border-light text-text-secondary hover:bg-surface-active hover:text-text-primary'
      }`}
    >
      <Brain size={14} />
      <span className="hidden sm:inline">Think</span>
    </button>
  );
}
