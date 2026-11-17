'use client';

/**
 * KeyboardShortcutsHelp — modal showing all keyboard shortcuts.
 * Opens with cmd+/ or via the command palette.
 */

import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const SHORTCUTS = [
  { keys: ['⌘', 'K'], desc: 'Open command palette' },
  { keys: ['⌘', 'N'], desc: 'New chat' },
  { keys: ['⌘', 'B'], desc: 'Toggle sidebar' },
  { keys: ['⌘', '/'], desc: 'Show this help' },
  { keys: ['⌘', '↵'], desc: 'Send message' },
  { keys: ['⇧', '↵'], desc: 'New line in composer' },
  { keys: ['Esc'], desc: 'Close dialog / stop generation' },
];

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function KeyboardShortcutsHelp({ open, onOpenChange }: KeyboardShortcutsHelpProps) {
  // Listen for cmd+/
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        onOpenChange(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface-popover border-border-light text-text-primary sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {SHORTCUTS.map((s) => (
            <div key={s.desc} className="flex items-center justify-between py-1">
              <span className="text-text-secondary text-sm">{s.desc}</span>
              <div className="flex gap-1">
                {s.keys.map((k, i) => (
                  <kbd
                    key={i}
                    className="bg-surface-active border-border-light text-text-primary rounded border px-2 py-0.5 text-xs font-mono"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
