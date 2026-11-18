'use client';

/**
 * Single conversation row — chat.z.ai style.
 *
 *   - Active: bg-surface-nav-selected + accent vertical bar
 *   - Hover: bg-surface-nav-hover + reveal action buttons (Pin, Archive, Rename, Delete)
 *   - Double-click title to rename inline
 *   - Right-click for full menu (Move to workspace, etc.)
 */

import { useState, useRef, useEffect } from 'react';
import { Ellipsis, Pin, Pen, Trash2, X, Archive, ArchiveRestore, FolderInput } from 'lucide-react';
import type { Conversation } from '@/lib/store';

interface ConversationRowProps {
  conversation: Conversation;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (newTitle: string) => void;
  onArchive?: () => void;
  onUnarchive?: () => void;
  isArchived?: boolean;
  onMoveToWorkspace?: () => void;
}

export default function ConversationRow({
  conversation, active, onSelect, onDelete, onRename, onArchive, onUnarchive, isArchived, onMoveToWorkspace,
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

  // Keep draft in sync with conversation.title when not actively renaming
  useEffect(() => {
    if (!renaming) setDraft(conversation.title);
  }, [conversation.title, renaming]);

  const commitRename = () => {
    const t = draft.trim();
    if (t) onRename(t);
    setRenaming(false);
  };

  return (
    <div
      className={`group relative flex h-12 items-center rounded-lg outline-none transition md:h-9 ${
        active ? 'bg-surface-nav-selected nav-active-bar' : 'hover:bg-surface-nav-hover'
      } ${isArchived ? 'opacity-60' : ''}`}
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
            active || menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
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
              <div className="bg-surface-popover border-border-light text-text-primary absolute end-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-lg border shadow-xl">
                <button
                  onClick={() => { setRenaming(true); setMenuOpen(false); }}
                  className="hover:bg-surface-hover flex w-full items-center gap-2 px-3 py-2 text-start text-sm"
                >
                  <Pen size={14} /> Rename
                </button>
                {onMoveToWorkspace && (
                  <button
                    onClick={() => { onMoveToWorkspace(); setMenuOpen(false); }}
                    className="hover:bg-surface-hover flex w-full items-center gap-2 px-3 py-2 text-start text-sm"
                  >
                    <FolderInput size={14} /> Move to workspace
                  </button>
                )}
                {isArchived ? (
                  onUnarchive && (
                    <button
                      onClick={() => { onUnarchive(); setMenuOpen(false); }}
                      className="hover:bg-surface-hover flex w-full items-center gap-2 px-3 py-2 text-start text-sm"
                    >
                      <ArchiveRestore size={14} /> Unarchive
                    </button>
                  )
                ) : (
                  onArchive && (
                    <button
                      onClick={() => { onArchive(); setMenuOpen(false); }}
                      className="hover:bg-surface-hover flex w-full items-center gap-2 px-3 py-2 text-start text-sm"
                    >
                      <Archive size={14} /> Archive
                    </button>
                  )
                )}
                <button
                  onClick={() => { onDelete(); setMenuOpen(false); }}
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
