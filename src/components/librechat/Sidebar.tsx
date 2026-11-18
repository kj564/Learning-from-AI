'use client';

/**
 * LibreChat-style expanded sidebar panel.
 *
 * Contains (when activePanel === 'conversations'):
 *   - Search bar
 *   - Conversations list (grouped by date: Today / Yesterday / Previous 7 days / Older)
 *   - Projects shortcut
 * When activePanel === 'projects':
 *   - Projects list with create/select/delete
 * Other panels:
 *   - Placeholder "coming soon"
 *
 * The sidebar is 280px wide on desktop (sidebarExpanded=true, isMobile=false).
 * On mobile it becomes a 100%-width drawer (drawerOpen=true).
 */

import { useState, useMemo, useEffect } from 'react';
import {
  Search, X, Plus, FolderOpen, ChevronDown, MessagesSquare, FolderPlus, FileText, Trash2, Code, Settings2,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import type { Project } from '@/lib/api';
import { createProject, deleteProject, getProject } from '@/lib/api';
import ConversationRow from './ConversationRow';
import KnowledgePanel from './KnowledgePanel';
import type { PanelId } from './IconRail';

interface SidebarProps {
  activePanel: PanelId;
  onPanelChange: (p: PanelId) => void;
  isDrawer?: boolean; // mobile drawer mode
  onCloseDrawer?: () => void;
}

/** Wrapper around KnowledgePanel that hides the close button when inside the Sidebar. */
function KnowledgePanelInline() {
  return <KnowledgePanel />;
}

function dateGroup(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const day = 24 * 60 * 60 * 1000;
  if (diff < day) return 'Today';
  if (diff < 2 * day) return 'Yesterday';
  if (diff < 7 * day) return 'Previous 7 Days';
  if (diff < 30 * day) return 'Previous 30 Days';
  return 'Older';
}

function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center px-3 pb-2 pt-1">
      <div className="bg-surface-search flex h-9 w-full items-center gap-2 rounded-lg px-2.5">
        <Search size={16} className="text-text-tertiary shrink-0" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search chats"
          className="text-text-primary placeholder:text-text-tertiary w-full bg-transparent text-sm outline-none"
        />
        {value && (
          <button
            onClick={() => onChange('')}
            aria-label="Clear search"
            className="text-text-tertiary hover:text-text-primary"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ label, open, onToggle, action }: { label: string; open: boolean; onToggle: () => void; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5">
      <button
        onClick={onToggle}
        className="text-text-tertiary hover:text-text-primary flex items-center gap-1 text-xs font-semibold uppercase tracking-wide"
      >
        <ChevronDown size={14} className={`transition ${open ? '' : '-rotate-90'}`} />
        {label}
      </button>
      {action}
    </div>
  );
}

function ConversationsPanel({ query }: { query: string }) {
  const localConversations = useStore((s) => s.conversations);
  const serverConversations = useStore((s) => s.serverConversations);
  const activeId = useStore((s) => s.activeConversationId);
  const setActive = useStore((s) => s.setActiveConversation);
  const del = useStore((s) => s.deleteConversation);
  const rename = useStore((s) => s.renameConversation);
  const [openChats, setOpenChats] = useState(true);

  // Merge local (in-progress) + server (persisted) conversations, dedup by id, sort by updatedAt
  const conversations = useMemo(() => {
    const map = new Map<string, typeof localConversations[number]>();
    for (const c of localConversations) {
      map.set(c.id, { ...c, updatedAt: c.updatedAt });
    }
    for (const sc of serverConversations) {
      if (!map.has(sc.id)) {
        // Add server convo as a local-shaped conversation (no messages yet — loaded on click)
        map.set(sc.id, {
          id: sc.id,
          title: sc.title,
          createdAt: sc.createdAt,
          updatedAt: sc.updatedAt,
          projectId: sc.projectId,
          model: sc.model as any,
          assistantId: sc.assistantId,
        });
      } else {
        // Update existing local with server metadata (title might have changed)
        const existing = map.get(sc.id)!;
        if (existing.title === 'New Chat' && sc.title !== 'New Chat') {
          map.set(sc.id, { ...existing, title: sc.title });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [localConversations, serverConversations]);

  const filtered = useMemo(() => {
    if (!query.trim()) return conversations;
    const q = query.toLowerCase();
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, query]);

  // Group by date
  const groups = useMemo(() => {
    const m = new Map<string, typeof conversations>();
    for (const c of filtered) {
      const g = dateGroup(c.updatedAt);
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(c);
    }
    return Array.from(m.entries());
  }, [filtered]);

  if (conversations.length === 0) {
    return (
      <div className="text-text-tertiary flex flex-1 items-center justify-center px-4 py-8 text-center text-sm">
        No conversations yet. Click <MessagesSquare size={14} className="mx-1 inline" /> to start a new chat.
      </div>
    );
  }

  // Lazy-load messages when a server conversation is clicked (if not already loaded).
  const handleSelect = async (c: typeof conversations[number]) => {
    setActive(c.id);
    // If this conversation has no local messages yet, fetch from server.
    const existing = useStore.getState().messagesByConversation[c.id];
    if (!existing || existing.length === 0) {
      try {
        const { getConversation } = await import('@/lib/api');
        const detail = await getConversation(c.id);
        if (detail?.messages && detail.messages.length > 0) {
          useStore.setState((s) => ({
            messagesByConversation: {
              ...s.messagesByConversation,
              [c.id]: detail.messages.map((m) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                createdAt: m.createdAt,
                toolExecutions: m.toolExecutions,
              })) as any,
            },
          }));
        }
      } catch { /* ignore — empty chat is fine */ }
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <SectionHeader label="Chats" open={openChats} onToggle={() => setOpenChats((v) => !v)} />
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {openChats &&
          groups.map(([label, items]) => (
            <div key={label} className="mb-1">
              <div className="text-text-tertiary px-2 py-1 text-xs font-medium">{label}</div>
              {items.map((c) => (
                <ConversationRow
                  key={c.id}
                  conversation={c}
                  active={c.id === activeId}
                  onSelect={() => handleSelect(c)}
                  onDelete={() => del(c.id)}
                  onRename={(t) => rename(c.id, t)}
                />
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}

function ProjectsPanel({ onOpenProject }: { onOpenProject: (p: Project) => void }) {
  const projects = useStore((s) => s.projects);
  const setProjects = useStore((s) => s.setProjects);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    const n = name.trim();
    if (!n) return;
    setCreating(true);
    const p = await createProject(n);
    setCreating(false);
    if (p) {
      setProjects([p, ...projects]);
      setName('');
      onOpenProject(p);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this workspace and all its documents?')) return;
    const ok = await deleteProject(id);
    if (ok) setProjects(projects.filter((p) => p.id !== id));
  };

  const handleOpen = async (id: string) => {
    const full = await getProject(id);
    if (full) onOpenProject(full);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="text-text-primary flex items-center gap-2 text-sm font-semibold">
          <FolderOpen size={16} /> Workspaces
        </div>
      </div>
      <div className="px-3 pb-2">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="New workspace name"
            className="bg-surface-search border-border-light text-text-primary placeholder:text-text-tertiary w-full rounded-md border px-2.5 py-1.5 text-sm outline-none"
          />
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="bg-accent-primary text-text-inverted hover:bg-accent-primary-hover flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-50"
          >
            <Plus size={14} /> New
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {projects.length === 0 && (
          <div className="text-text-tertiary px-3 py-8 text-center text-sm">
            No workspaces yet. Create one above.
          </div>
        )}
        {projects.map((p) => (
          <div
            key={p.id}
            className="group hover:bg-surface-nav-hover flex items-center gap-2 rounded-lg px-2 py-2"
          >
            <button onClick={() => handleOpen(p.id)} className="flex min-w-0 flex-1 items-center gap-2 text-start">
              <FolderOpen size={16} className="text-accent-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-text-primary truncate text-sm font-medium">{p.name}</div>
                <div className="text-text-tertiary truncate text-xs">
                  {p.documents.length} doc{p.documents.length === 1 ? '' : 's'}
                </div>
              </div>
            </button>
            <button
              onClick={() => handleDelete(p.id)}
              aria-label="Delete project"
              className="text-text-tertiary hover:text-status-error opacity-0 transition group-hover:opacity-100"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlaceholderPanel({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 py-8 text-center">
      <div className="text-text-primary text-sm font-semibold">{title}</div>
      <div className="text-text-tertiary text-xs">{hint}</div>
    </div>
  );
}

export default function Sidebar({ activePanel, onPanelChange, isDrawer, onCloseDrawer }: SidebarProps) {
  const [query, setQuery] = useState('');
  const [openProjects, setOpenProjects] = useState(true);
  const projects = useStore((s) => s.projects);
  const setActiveProject = useStore((s) => s.setActiveProject);
  const setShowDocumentsPanel = useStore((s) => s.setShowDocumentsPanel);
  const setServerConversations = useStore((s) => s.setServerConversations);

  // Auto-fetch projects on mount
  useEffect(() => {
    import('@/lib/api').then(({ getProjects }) =>
      getProjects().then((items) => {
        // hydrate projects list with empty documents array
        useStore.setState((s) => ({
          projects: items.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            documents: [],
            instructions: '',
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
          })) as Project[],
        }));
      })
    );
  }, []);

  // Auto-fetch server-side conversations on mount (replaces localStorage-only list).
  // These are the persisted conversations from SQLite — survives across
  // browsers and devices (when we add auth).
  useEffect(() => {
    let cancelled = false;
    import('@/lib/api').then(({ listConversations }) =>
      listConversations().then((list) => {
        if (!cancelled && list.length > 0) setServerConversations(list);
      })
    );
    return () => { cancelled = true; };
  }, [setServerConversations]);

  const openProjectFromSidebar = (p: Project) => {
    setActiveProject(p);
    setShowDocumentsPanel(true);
    onPanelChange('conversations');
  };

  return (
    <div
      className={`bg-surface-sidebar border-border-light flex h-full flex-col overflow-hidden ${
        isDrawer ? 'w-full' : 'w-[280px]'
      } border-e`}
    >
      {/* Mobile drawer header */}
      {isDrawer && (
        <div className="border-border-light flex h-14 shrink-0 items-center justify-between border-b px-2">
          <span className="text-text-primary px-2 text-sm font-semibold">Menu</span>
          {onCloseDrawer && (
            <button
              onClick={onCloseDrawer}
              className="text-text-secondary hover:bg-surface-nav-hover hover:text-text-primary flex h-9 w-9 items-center justify-center rounded-lg"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          )}
        </div>
      )}

      {/* Panel content */}
      {activePanel === 'conversations' && (
        <>
          <SearchBar value={query} onChange={setQuery} />
          {/* Inline workspaces shortcut */}
          <div className="px-2">
            <SectionHeader
              label="Workspaces"
              open={openProjects}
              onToggle={() => setOpenProjects((v) => !v)}
              action={
                <button
                  onClick={() => onPanelChange('projects')}
                  title="Manage workspaces"
                  className="text-text-tertiary hover:bg-surface-nav-hover hover:text-text-primary flex h-7 w-7 items-center justify-center rounded-md"
                >
                  <FolderPlus size={14} />
                </button>
              }
            />
            {openProjects && (
              <div className="px-2 pb-1">
                {projects.length === 0 ? (
                  <button
                    onClick={() => onPanelChange('projects')}
                    className="text-text-tertiary hover:text-text-primary flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start text-xs"
                  >
                    <Plus size={12} /> Create a workspace
                  </button>
                ) : (
                  projects.slice(0, 4).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => openProjectFromSidebar(p)}
                      className="hover:bg-surface-nav-hover flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-start"
                    >
                      <FolderOpen size={14} className="text-accent-primary shrink-0" />
                      <span className="text-text-primary truncate text-sm">{p.name}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <ConversationsPanel query={query} />
        </>
      )}

      {activePanel === 'projects' && (
        <>
          <SearchBar value={query} onChange={() => {}} />
          <ProjectsPanel onOpenProject={openProjectFromSidebar} />
        </>
      )}

      {activePanel === 'knowledge' && <KnowledgePanelInline />}

      {activePanel === 'prompts' && (
        <PlaceholderPanel title="Prompts" hint="Save and reuse prompts (coming soon)." />
      )}
      {activePanel === 'bookmarks' && (
        <PlaceholderPanel title="Bookmarks" hint="Bookmark important turns (coming soon)." />
      )}
      {activePanel === 'parameters' && (
        <PlaceholderPanel title="Parameters" hint="Advanced model parameters (coming soon)." />
      )}
      {activePanel === 'insights' && (
        <PlaceholderPanel title="Insights" hint="Usage analytics (coming soon)." />
      )}

      {/* Footer */}
      {!isDrawer && (
        <div className="border-border-light text-text-tertiary flex shrink-0 items-center gap-2 border-t px-3 py-2 text-xs">
          <Code size={12} />
          <span>Workspace v1.0</span>
          <Settings2 size={12} className="ms-auto" />
        </div>
      )}
    </div>
  );
}
