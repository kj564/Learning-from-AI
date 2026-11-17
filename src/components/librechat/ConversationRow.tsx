'use client';

/**
 * Single conversation row — LibreChat Convo.tsx inspired.
 *
 *   - h-12 mobile, md:h-9 desktop
 *   - Active: bg-surface-nav-selected + accent vertical bar on start edge
 *   - Hover: bg-surface-nav-hover
 *   - Title: truncate with mask fade; double-click to rename
 *   - Right action: ellipsis menu (Pin/Unpin, Rename, Delete)
 */

import { useState, useRef, useEffect } from 'react';
import { Ellipsis, Pin, Pen, Trash2, X } from 'lucide-react';
import type { Conversation } from '@/lib/store';

interface ConversationRowProps {
  conversation: Conversation;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (newTitle: string) => void;
}

export default function ConversationRow({
  conversation,
  active,
  onSelect,
  onDelete,
  onRename,
}: ConversationRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(conversation.title);
  const menuRef = useRef<HTMLDivElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  useEffect(() => {
    if (renaming && renameRef.current) {
      renameRef.current.focus();
      renameRef.current.select();
    }
  }, [renaming]);

  const commitRename = () => {
    const t = draft.trim();
    if (t) onRename(t);
    setRenaming(false);
  };

  return (
    <div
      className={`group relative flex h-12 items-center rounded-lg outline-none transition md:h-9 ${
        active ? 'bg-surface-nav-selected nav-active-bar' : 'hover:bg-surface-nav-hover'
      }`}
      onClick={onSelect}
      onDoubleClick={() => {
        setRenaming(true);
        setDraft(conversation.title);
      }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
        {renaming ? (
          <input
            ref={renameRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setRenaming(false);
            }}
            className="text-text-primary bg-surface-primary border-border-medium w-full rounded border px-1.5 py-1 text-sm outline-none"
          />
        ) : (
          <span className="text-text-primary truncate text-sm" title={conversation.title}>
            {conversation.title}
          </span>
        )}
      </div>

      {!renaming && (
        <div
          className={`me-1 flex shrink-0 items-center transition ${
            active || menuOpen
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative" ref={menuRef}>
            <button
              aria-label="Conversation actions"
              onClick={() => setMenuOpen((v) => !v)}
              className="text-text-tertiary hover:bg-surface-active hover:text-text-primary flex h-7 w-7 items-center justify-center rounded-md"
            >
              <Ellipsis size={16} />
            </button>

            {menuOpen && (
              <div className="bg-surface-popover border-border-light text-text-primary absolute end-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-lg border shadow-xl">
                <button
                  onClick={() => {
                    setRenaming(true);
                    setMenuOpen(false);
                  }}
                  className="hover:bg-surface-hover flex w-full items-center gap-2 px-3 py-2 text-start text-sm"
                >
                  <Pen size={14} /> Rename
                </button>
                <button
                  onClick={() => {
                    onDelete();
                    setMenuOpen(false);
                  }}
                  className="text-status-error hover:bg-surface-hover flex w-full items-center gap-2 px-3 py-2 text-start text-sm"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Pinned section row (for the future) — kept simple for now. */
export function PinnedRow({ label }: { label: string }) {
  return (
    <div className="text-text-tertiary flex h-9 items-center gap-2 px-3 text-xs">
      <Pin size={12} /> {label}
    </div>
  );
}

/** Optional close button (mobile drawer). */
export function CloseDrawerButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Close drawer"
      className="text-text-secondary hover:bg-surface-nav-hover hover:text-text-primary flex h-9 w-9 items-center justify-center rounded-lg"
    >
      <X size={18} />
    </button>
  );
}
