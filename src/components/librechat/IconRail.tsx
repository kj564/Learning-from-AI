'use client';

/**
 * LibreChat-style icon rail — far-left 52px vertical strip.
 *
 * Top → Bottom:
 *   - Sidebar toggle (PanelLeft icon)
 *   - New chat (SquarePen)
 *   - Divider
 *   - Panel switch icons (MessagesSquare, FolderOpen, ScrollText, NotebookPen, Bookmark, SlidersHorizontal)
 *   - (spacer)
 *   - Theme toggle
 *   - Account avatar
 *
 * Each icon is 36px (h-9 w-9), rounded-lg, hover surface-nav-hover.
 * Active panel icon gets accent ring/fill.
 */

import {
  PanelLeft,
  SquarePen,
  MessagesSquare,
  FolderOpen,
  ScrollText,
  NotebookPen,
  Bookmark,
  SlidersHorizontal,
  BarChart3,
  BookOpen,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import ThemeToggle from './ThemeToggle';

export type PanelId = 'conversations' | 'projects' | 'prompts' | 'bookmarks' | 'parameters' | 'insights' | 'knowledge';

interface IconRailProps {
  activePanel: PanelId;
  onPanelChange: (p: PanelId) => void;
}

interface RailButtonProps {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  onClick?: () => void;
  active?: boolean;
}

function RailButton({ icon: Icon, label, onClick, active }: RailButtonProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${
        active
          ? 'bg-surface-nav-selected text-text-primary'
          : 'text-text-secondary hover:bg-surface-nav-hover hover:text-text-primary'
      }`}
    >
      <Icon size={18} />
    </button>
  );
}

export default function IconRail({ activePanel, onPanelChange }: IconRailProps) {
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const newConversation = useStore((s) => s.newConversation);
  const sidebarExpanded = useStore((s) => s.sidebarExpanded);
  const isMobile = useStore((s) => s.isMobile);
  const setDrawerOpen = useStore((s) => s.setDrawerOpen);

  const handleToggle = () => {
    if (isMobile) {
      // On mobile the rail is only rendered inside the open drawer — toggle closes it.
      setDrawerOpen(false);
    } else {
      toggleSidebar();
    }
  };

  const handleNewChat = () => {
    newConversation();
    if (isMobile) setDrawerOpen(false);
  };

  return (
    <div className="bg-surface-sidebar border-border-light flex h-full w-[52px] shrink-0 flex-col items-center gap-1 border-e px-2 py-2">
      {/* Toggle sidebar */}
      <RailButton icon={PanelLeft} label={sidebarExpanded ? 'Close sidebar' : 'Open sidebar'} onClick={handleToggle} />

      {/* New chat */}
      <RailButton icon={SquarePen} label="New chat" onClick={handleNewChat} />

      <div className="border-border-light my-1 w-8 border-t" />

      {/* Panel switch icons */}
      <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
        <RailButton
          icon={MessagesSquare}
          label="Chat history"
          active={activePanel === 'conversations'}
          onClick={() => onPanelChange('conversations')}
        />
        <RailButton
          icon={FolderOpen}
          label="Projects"
          active={activePanel === 'projects'}
          onClick={() => onPanelChange('projects')}
        />
        <RailButton
          icon={BookOpen}
          label="Knowledge base"
          active={activePanel === 'knowledge'}
          onClick={() => onPanelChange('knowledge')}
        />
        <RailButton
          icon={ScrollText}
          label="Prompts"
          active={activePanel === 'prompts'}
          onClick={() => onPanelChange('prompts')}
        />
        <RailButton
          icon={Bookmark}
          label="Bookmarks"
          active={activePanel === 'bookmarks'}
          onClick={() => onPanelChange('bookmarks')}
        />
        <RailButton
          icon={SlidersHorizontal}
          label="Parameters"
          active={activePanel === 'parameters'}
          onClick={() => onPanelChange('parameters')}
        />
        <RailButton
          icon={BarChart3}
          label="Insights"
          active={activePanel === 'insights'}
          onClick={() => onPanelChange('insights')}
        />
      </div>

      {/* Bottom: theme + account */}
      <div className="flex flex-col items-center gap-1">
        <ThemeToggle compact />
        <button
          title="Account"
          className="bg-surface-tertiary text-text-primary hover:bg-surface-active flex h-9 w-9 items-center justify-center rounded-full transition"
        >
          <span className="text-xs font-semibold">U</span>
        </button>
      </div>
    </div>
  );
}
