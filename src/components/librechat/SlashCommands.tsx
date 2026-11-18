'use client';

/**
 * SlashCommands — popover that appears when user types "/" at the start of
 * the composer. Lists available commands; selecting one inserts the command
 * (and runs the side-effect for /new, /clear, /help).
 *
 * Commands:
 *   /new          Start a new chat
 *   /clear        Clear the current conversation
 *   /model opus   Switch to Opus model
 *   /model sonnet Switch to Sonnet
 *   /model haiku  Switch to Haiku
 *   /image <p>    Open the image gen dialog with prompt <p>
 *   /web          Toggle web search
 *   /help         Show keyboard shortcuts help
 */

import { useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';
import {
  Sparkles, Trash2, Cpu, Image as ImageIcon, Globe, Keyboard,
} from 'lucide-react';

interface SlashCommandsProps {
  query: string; // the text after the "/", e.g. "mod" for "/mod"
  onPick: (cmd: string, args: string) => void;
  onClose: () => void;
}

const COMMANDS = [
  { cmd: 'new', desc: 'Start a new chat', icon: Sparkles, color: 'text-accent-primary' },
  { cmd: 'clear', desc: 'Clear current conversation', icon: Trash2, color: 'text-status-error' },
  { cmd: 'model', desc: 'Switch model: /model opus | sonnet | haiku', icon: Cpu, color: 'text-status-info' },
  { cmd: 'image', desc: 'Generate image: /image <prompt>', icon: ImageIcon, color: 'text-status-warning' },
  { cmd: 'web', desc: 'Toggle web search', icon: Globe, color: 'text-accent-primary' },
  { cmd: 'help', desc: 'Show keyboard shortcuts', icon: Keyboard, color: 'text-text-secondary' },
];

export default function SlashCommands({ query, onPick, onClose }: SlashCommandsProps) {
  const ref = useRef<HTMLDivElement>(null);

  const filtered = COMMANDS.filter((c) => c.cmd.startsWith(query.toLowerCase()));
  if (filtered.length === 0) return null;

  return (
    <div
      ref={ref}
      className="bg-surface-popover border-border-light text-text-primary absolute bottom-full start-0 z-50 mb-2 w-80 overflow-hidden rounded-xl border shadow-2xl"
    >
      <div className="text-text-tertiary px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide">
        Slash commands
      </div>
      {filtered.map((c) => (
        <button
          key={c.cmd}
          onClick={() => onPick(c.cmd, '')}
          className="hover:bg-surface-hover flex w-full items-center gap-2.5 px-3 py-2 text-start text-sm"
        >
          <c.icon size={14} className={`${c.color} shrink-0`} />
          <div className="min-w-0 flex-1">
            <div className="text-text-primary font-mono text-xs">/{c.cmd}</div>
            <div className="text-text-tertiary truncate text-[11px]">{c.desc}</div>
          </div>
        </button>
      ))}
    </div>
  );
}
