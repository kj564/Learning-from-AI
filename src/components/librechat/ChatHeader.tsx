'use client';

/**
 * LibreChat-style header bar — absolutely positioned at the top of the chat pane.
 *
 *   - h-[3.25rem] (52px), z-20
 *   - Gradient fade bg from surface-canvas → transparent (messages scroll under it)
 *   - Left: ModelSelector + Presets/Bookmarks/Tools buttons (desktop)
 *   - Right: Documents toggle, export/share menu, new chat (mobile)
 *
 * On mobile: shows open-sidebar button + model selector + new chat + overflow menu.
 */

import { useStore } from '@/lib/store';
import { useTheme } from 'next-themes';
import {
  SquarePen, BookCopy, Bookmark, PanelRightOpen, PanelRightClose,
  MoreVertical, Sparkles, Clock, Sun, Moon, Monitor, Check,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import ModelSelector from './ModelSelector';
import AssistantsMenu from './AssistantsMenu';

export default function ChatHeader() {
  const isMobile = useStore((s) => s.isMobile);
  const setDrawerOpen = useStore((s) => s.setDrawerOpen);
  const newConversation = useStore((s) => s.newConversation);
  const showDocumentsPanel = useStore((s) => s.showDocumentsPanel);
  const toggleDocumentsPanel = useStore((s) => s.toggleDocumentsPanel);
  const activeConversationId = useStore((s) => s.activeConversationId);
  const conversations = useStore((s) => s.conversations);
  const active = conversations.find((c) => c.id === activeConversationId);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const handleNew = () => {
    newConversation();
    if (isMobile) setDrawerOpen(false);
  };

  return (
    <div className="header-gradient pointer-events-none absolute inset-x-0 top-0 z-20 flex h-[3.25rem] items-center gap-2 p-2">
      {/* Left: mobile sidebar open + model select */}
      <div className="pointer-events-auto flex min-w-0 flex-1 items-center gap-2 ps-1">
        {isMobile && (
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open sidebar"
            className="text-text-secondary hover:bg-surface-nav-hover hover:text-text-primary flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          >
            <PanelRightOpen size={18} />
          </button>
        )}
        {!isMobile && (
          <>
            <AssistantsMenu />
            <ModelSelector />
            <button
              title="Presets"
              className="text-text-secondary hover:bg-surface-nav-hover hover:text-text-primary hidden h-9 w-9 items-center justify-center rounded-lg md:flex"
            >
              <BookCopy size={18} />
            </button>
            <button
              title="Bookmarks"
              className="text-text-secondary hover:bg-surface-nav-hover hover:text-text-primary hidden h-9 w-9 items-center justify-center rounded-lg md:flex"
            >
              <Bookmark size={18} />
            </button>
          </>
        )}
      </div>

      {/* Right: actions */}
      <div className="pointer-events-auto flex shrink-0 items-center gap-2">
        {/* Documents panel toggle */}
        <button
          onClick={toggleDocumentsPanel}
          title={showDocumentsPanel ? 'Hide documents' : 'Show documents'}
          className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
            showDocumentsPanel
              ? 'bg-surface-nav-selected text-text-primary'
              : 'text-text-secondary hover:bg-surface-nav-hover hover:text-text-primary'
          }`}
        >
          {showDocumentsPanel ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
        </button>

        {/* Mobile new chat */}
        {isMobile && (
          <button
            onClick={handleNew}
            aria-label="New chat"
            className="text-text-secondary hover:bg-surface-nav-hover hover:text-text-primary flex h-9 w-9 items-center justify-center rounded-lg"
          >
            <SquarePen size={18} />
          </button>
        )}

        {/* Mobile overflow menu */}
        {isMobile && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="More"
              className="text-text-secondary hover:bg-surface-nav-hover hover:text-text-primary flex h-9 w-9 items-center justify-center rounded-lg"
            >
              <MoreVertical size={18} />
            </button>
            {menuOpen && (
              <div className="bg-surface-popover border-border-light text-text-primary absolute end-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-lg border shadow-xl">
                <button
                  onClick={() => {
                    handleNew();
                    setMenuOpen(false);
                  }}
                  className="hover:bg-surface-hover flex w-full items-center gap-2 px-3 py-2 text-start text-sm"
                >
                  <SquarePen size={14} /> New chat
                </button>
                <button
                  onClick={() => {
                    toggleDocumentsPanel();
                    setMenuOpen(false);
                  }}
                  className="hover:bg-surface-hover flex w-full items-center gap-2 px-3 py-2 text-start text-sm"
                >
                  {showDocumentsPanel ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
                  {showDocumentsPanel ? 'Hide documents' : 'Show documents'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Desktop: export/share */}
        {!isMobile && (
          <button
            title="Export conversation"
            className="border-border-light bg-surface-chat hover:bg-surface-active-alt text-text-secondary hover:text-text-primary flex h-9 w-9 items-center justify-center rounded-lg border transition"
          >
            <MoreVertical size={16} />
          </button>
        )}
      </div>

      {/* Hidden metadata for screen readers */}
      <span className="sr-only">{active?.title}</span>
    </div>
  );
}
