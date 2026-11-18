'use client';

/**
 * chat.z.ai clone — clean, minimal, radical rebuild.
 *
 * Layout:
 *   - Left sidebar: search + new chat + conversation list + workspaces
 *   - Center: chat messages + composer
 *   - Right: workspace (code IDE) when AI generates files
 *
 * NO icon rail. NO assistants dropdown. NO heavy borders.
 * Clean, minimal, centered. Like chat.z.ai.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useStore } from '@/lib/store';
import { streamChat, generateImage, vision, webSearch, type GeneratedImage } from '@/lib/api';
import { toast } from 'sonner';
import {
  Search, SquarePen, PanelLeft, X, Plus, Globe, Brain,
  Send, Square, Sparkles, Download, ExternalLink, Eye, Code2,
  ChevronDown, FileCode, FileText, Folder, FolderOpen, ChevronRight,
  RefreshCw, Copy, Check, Trash2, Archive, ArchiveRestore, Pen,
  Settings, Sun, Moon, Star, Zap, MessageSquare, Share2,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import CodeWorkspace from '@/components/librechat/CodeWorkspace';
import Markdown from '@/components/librechat/Markdown';
import CodeBlock from '@/components/librechat/CodeBlock';
import ImageGenDialog from '@/components/librechat/ImageGenDialog';
import ImageLightbox from '@/components/librechat/ImageLightbox';
import SettingsDialog from '@/components/librechat/SettingsDialog';
import CommandPalette from '@/components/librechat/CommandPalette';
import KeyboardShortcutsHelp from '@/components/librechat/KeyboardShortcutsHelp';
import { Button } from '@/components/ui/button';

const genId = (p: string) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const MODELS = [
  { id: 'glm-5.3', name: 'GLM-5.3', desc: 'Most advanced', icon: Star },
  { id: 'glm-5.3-flash', name: 'GLM-5.3-Flash', desc: 'Fast & free', icon: Zap },
  { id: 'glm-4.7', name: 'GLM-4.7', desc: 'Previous flagship', icon: Sparkles },
  { id: 'glm-4.6', name: 'GLM-4.6', desc: 'Coding specialist', icon: Code2 },
  { id: 'glm-4.5v', name: 'GLM-4.5V', desc: 'Vision', icon: Eye },
  { id: 'glm-4-plus', name: 'GLM-4-Plus', desc: 'Balanced', icon: Sparkles },
  { id: 'glm-4-flash', name: 'GLM-4-Flash', desc: 'Fast', icon: Zap },
];

const STARTERS = [
  { icon: Code2, label: 'Write code', prompt: 'Build a React todo app with local storage', color: 'text-blue-400' },
  { icon: Brain, label: 'Think deeply', prompt: 'What are the implications of AI consciousness?', color: 'text-purple-400' },
  { icon: Globe, label: 'Search web', prompt: 'What are the latest developments in quantum computing?', color: 'text-teal-400' },
  { icon: Sparkles, label: 'Generate image', prompt: 'Generate an image of a serene Japanese garden at sunset', color: 'text-amber-400' },
];

function parseToolResult(tool: string, resultStr: string) {
  try {
    const parsed = JSON.parse(resultStr);
    if ((tool === 'image_generate' || tool === 'image_edit') && parsed.image) {
      return { images: [{ id: parsed.image.id, url: parsed.image.url, prompt: parsed.image.prompt, size: parsed.image.size, width: parsed.image.width, height: parsed.image.height }] };
    }
    if (tool === 'web_search' && Array.isArray(parsed.results)) {
      return { webSearch: { query: parsed.query || '', results: parsed.results.slice(0, 8) } };
    }
  } catch { /* */ }
  return {};
}

export default function Page() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);

  const store = useStore;
  const activeConversationId = store((s) => s.activeConversationId);
  const conversations = store((s) => s.conversations);
  const serverConversations = store((s) => s.serverConversations);
  const messagesByConversation = store((s) => s.messagesByConversation);
  const sessionByConversation = store((s) => s.sessionByConversation);
  const selectedModel = store((s) => s.selectedModel);
  const setSelectedModel = store((s) => s.setSelectedModel);
  const webSearchEnabled = store((s) => s.webSearchEnabled);
  const toggleWebSearch = store((s) => s.toggleWebSearch);
  const thinkEnabled = store((s) => s.thinkEnabled);
  const toggleThink = store((s) => s.toggleThink);
  const isGenerating = store((s) => s.isGenerating);
  const setIsGenerating = store((s) => s.setIsGenerating);
  const newConversation = store((s) => s.newConversation);
  const setActiveConversation = store((s) => s.setActiveConversation);
  const deleteConversation = store((s) => s.deleteConversation);
  const renameConversation = store((s) => s.renameConversation);
  const archiveConversation = store((s) => s.archiveConversation);
  const unarchiveConversation = store((s) => s.unarchiveConversation);
  const archivedConversations = store((s) => s.archivedConversations);
  const addMessage = store((s) => s.addMessage);
  const updateMessage = store((s) => s.updateMessage);
  const removeMessage = store((s) => s.removeMessage);
  const setSessionForConversation = store((s) => s.setSessionForConversation);
  const composerText = store((s) => s.composerText);
  const setComposerText = store((s) => s.setComposerText);
  const composerAttachments = store((s) => s.composerAttachments);
  const clearAttachments = store((s) => s.clearAttachments);
  const activeProject = store((s) => s.activeProject);
  const activeAssistant = store((s) => s.assistants.find((a) => a.id === s.activeAssistantId) || null);
  const showWorkspace = store((s) => s.showWorkspace);
  const workspaceFiles = store((s) => s.workspaceFiles);
  const setShowWorkspace = store((s) => s.setShowWorkspace);
  const addWorkspaceFile = store((s) => s.addWorkspaceFile);
  const openImageLightbox = store((s) => s.openImageLightbox);
  const readAloud = store((s) => s.readAloud);
  const setReadAloud = store((s) => s.setReadAloud);
  const { theme, setTheme } = useTheme();
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [slashOpen, setSlashOpen] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);

  // Ensure conversation exists on mount
  useEffect(() => {
    if (conversations.length === 0) newConversation();
  }, []);

  // Load server conversations
  useEffect(() => {
    import('@/lib/api').then(({ listConversations }) =>
      listConversations().then((list) => {
        if (list.length > 0) store.getState().setServerConversations(list);
      })
    );
  }, []);

  // Mobile detection
  useEffect(() => {
    const check = () => store.getState().setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); /* command palette */ }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') { e.preventDefault(); newConversation(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') { e.preventDefault(); setSidebarOpen((v) => !v); }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') { e.preventDefault(); setShortcutsOpen(true); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [newConversation]);

  // Slash command detection
  useEffect(() => {
    setSlashOpen(/^\//.test(composerText));
  }, [composerText]);

  // Textarea auto-grow
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, window.innerHeight * 0.5) + 'px';
  }, [composerText]);

  // Auto-scroll
  const activeMessages = activeConversationId ? (messagesByConversation[activeConversationId] || []) : [];
  useEffect(() => {
    if (scrollRef.current && atBottom) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeMessages, isGenerating, atBottom]);

  // Reset scroll on conversation switch
  useEffect(() => {
    setAtBottom(true);
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [activeConversationId]);

  // === Send message ===
  const handleSend = useCallback(async () => {
    const text = composerText.trim();
    if (!text || isGenerating) return;

    // Slash command?
    const m = text.match(/^\/(\w+)\s?(.*)$/);
    if (m) {
      const cmd = m[1];
      const args = m[2] || '';
      switch (cmd) {
        case 'new': newConversation(); break;
        case 'clear':
          if (activeConversationId) {
            store.setState((s) => ({ messagesByConversation: { ...s.messagesByConversation, [activeConversationId]: [] } }));
          }
          break;
        case 'model':
          const valid = MODELS.find((x) => x.id === args || x.id === `glm-${args}`);
          if (valid) { setSelectedModel(valid.id); toast.success(`Model: ${valid.name}`); }
          else toast.error('Unknown. Try: /model glm-5.3 | glm-5.3-flash | glm-4.6');
          break;
        case 'image': setImageDialogOpen(true); break;
        case 'web': toggleWebSearch(); break;
        case 'help': setShortcutsOpen(true); break;
        default: toast.error(`Unknown: /${cmd}`);
      }
      setComposerText('');
      return;
    }

    let convoId = activeConversationId || newConversation();
    const attachments = [...composerAttachments];
    addMessage(convoId, { id: genId('msg'), role: 'user', content: text, createdAt: Date.now(), attachments: attachments.length > 0 ? attachments : undefined });
    clearAttachments();

    const pendingMsgId = genId('msg');
    addMessage(convoId, { id: pendingMsgId, role: 'assistant', content: '', createdAt: Date.now(), pending: true, streaming: true });
    setComposerText('');

    // Stream
    setIsGenerating(true);
    updateMessage(convoId, pendingMsgId, { streaming: true, pending: false });

    // Vision pre-flight for image attachments
    let augmentedText = text;
    if (attachments.some((a) => a.kind === 'image' && a.dataUrl)) {
      for (const a of attachments) {
        if (a.kind === 'image' && a.dataUrl) {
          try {
            const desc = await vision({ imageUrl: a.dataUrl, prompt: 'Describe this image concisely.' });
            augmentedText += `\n\n[Image: ${a.name}]\n${desc}`;
          } catch { /* */ }
        }
      }
    }

    // Web search pre-flight
    if (webSearchEnabled) {
      try {
        const results = await webSearch(text.slice(0, 80), 6);
        if (results.length > 0) {
          augmentedText += `\n\n[Web search results for "${text.slice(0, 80)}"]:\n${results.slice(0, 6).map((r, i) => `${i+1}. ${r.name}\n   ${r.url}\n   ${r.snippet}`).join('\n\n')}`;
          updateMessage(convoId, pendingMsgId, { webSearch: { query: text.slice(0, 80), results } });
        }
      } catch { /* */ }
    }

    const sessionId = sessionByConversation[convoId];
    const controller = streamChat(
      { message: augmentedText, sessionId, conversationId: convoId, model: selectedModel, project: activeProject || undefined, assistant: activeAssistant ? { id: activeAssistant.id, name: activeAssistant.name, systemPrompt: activeAssistant.systemPrompt } : null, think: thinkEnabled },
      {
        onTextDelta: (delta) => updateMessage(convoId, pendingMsgId, (prev) => ({ content: (prev?.content || '') + delta })),
        onTextReplace: (text) => updateMessage(convoId, pendingMsgId, { content: text }),
        onToolUse: (event) => {
          updateMessage(convoId, pendingMsgId, (prev) => ({ toolExecutions: [...(prev?.toolExecutions || []), { tool: event.name, args: event.input, success: false }] }));
          if (event.name === 'file_write') {
            const fp = (event.input.path as string) || '';
            const fc = (event.input.content as string) || '';
            if (fp) addWorkspaceFile({ path: fp, content: fc });
          }
        },
        onToolResult: (event) => {
          updateMessage(convoId, pendingMsgId, (prev) => {
            const execs = [...(prev?.toolExecutions || [])];
            for (let i = execs.length - 1; i >= 0; i--) {
              if (execs[i].tool === event.tool && execs[i].success === false) { execs[i] = { ...execs[i], success: event.success, result: event.result }; break; }
            }
            const patch: any = { toolExecutions: execs };
            const rich = parseToolResult(event.tool, event.result);
            if (rich.images) {
              const imgs = [...(prev?.images || [])];
              const pi = imgs.findIndex((im: any) => im.pending);
              if (pi >= 0) imgs[pi] = rich.images[0]; else imgs.push(...rich.images);
              patch.images = imgs;
            }
            if (rich.webSearch && !prev?.webSearch) patch.webSearch = rich.webSearch;
            return patch;
          });
        },
        onDone: (event) => {
          setSessionForConversation(convoId, event.sessionId);
          updateMessage(convoId, pendingMsgId, { streaming: false, pending: false });
          setIsGenerating(false);
          abortRef.current = null;
        },
        onError: (msg) => {
          updateMessage(convoId, pendingMsgId, { streaming: false, pending: false, error: msg });
          setIsGenerating(false);
          abortRef.current = null;
        },
      }
    );
    abortRef.current = controller;
  }, [composerText, isGenerating, activeConversationId, composerAttachments, clearAttachments, addMessage, newConversation, setIsGenerating, updateMessage, setComposerText, selectedModel, activeProject, activeAssistant, thinkEnabled, webSearchEnabled, sessionByConversation, setSessionForConversation, addWorkspaceFile]);

  const handleStop = useCallback(() => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    setIsGenerating(false);
    if (activeConversationId) {
      const msgs = messagesByConversation[activeConversationId] || [];
      for (const m of msgs) {
        if (m.streaming || m.pending) updateMessage(activeConversationId, m.id, { streaming: false, pending: false, content: m.content || '_Stopped._' });
      }
    }
  }, [activeConversationId, messagesByConversation, updateMessage, setIsGenerating]);

  // Merge local + server conversations
  const allConversations = (() => {
    const map = new Map<string, any>();
    for (const c of conversations) map.set(c.id, c);
    for (const sc of serverConversations) {
      if (!map.has(sc.id)) map.set(sc.id, { id: sc.id, title: sc.title, createdAt: sc.createdAt, updatedAt: sc.updatedAt, projectId: sc.projectId, model: sc.model, assistantId: sc.assistantId });
      else if (map.get(sc.id).title === 'New Chat' && sc.title !== 'New Chat') map.set(sc.id, { ...map.get(sc.id), title: sc.title });
    }
    return Array.from(map.values()).sort((a: any, b: any) => b.updatedAt - a.updatedAt);
  })();

  const filteredConversations = allConversations.filter((c: any) => c.title.toLowerCase().includes(searchQuery.toLowerCase()));
  const activeConvos = filteredConversations.filter((c: any) => !archivedConversations.includes(c.id));
  const archivedConvos = filteredConversations.filter((c: any) => archivedConversations.includes(c.id));

  const currentModel = MODELS.find((m) => m.id === selectedModel) || MODELS[0];

  // Group by date
  const dateGroup = (ts: number) => {
    const diff = Date.now() - ts;
    const day = 86400000;
    if (diff < day) return 'Today';
    if (diff < 2 * day) return 'Yesterday';
    if (diff < 7 * day) return 'Previous 7 Days';
    return 'Older';
  };
  const groups = activeConvos.reduce((acc: Map<string, any[]>, c: any) => {
    const g = dateGroup(c.updatedAt);
    if (!acc.has(g)) acc.set(g, []);
    acc.get(g)!.push(c);
    return acc;
  }, new Map<string, any[]>());

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#16181A] text-zinc-100">
      {/* === SIDEBAR === */}
      {sidebarOpen && (
        <div className="flex h-full w-64 shrink-0 flex-col border-r border-zinc-800 bg-[#1A1C1E]">
          {/* Search + New */}
          <div className="flex items-center gap-2 p-3">
            <div className="flex h-9 flex-1 items-center gap-2 rounded-lg bg-zinc-800/80 px-3">
              <Search size={14} className="text-zinc-500 shrink-0" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search chats"
                className="w-full bg-transparent text-sm text-zinc-200 placeholder:text-zinc-500 outline-none"
              />
              {searchQuery && <button onClick={() => setSearchQuery('')} className="text-zinc-500 hover:text-zinc-300"><X size={12} /></button>}
            </div>
          </div>
          <button
            onClick={() => newConversation()}
            className="mx-3 mb-2 flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition"
          >
            <SquarePen size={14} /> New chat
          </button>

          {/* Conversation list */}
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
            {Array.from(groups.entries()).map(([label, items]) => (
              <div key={label} className="mb-2">
                <div className="px-2 py-1 text-[11px] font-medium text-zinc-500">{label}</div>
                {items.map((c: any) => (
                  <div key={c.id} className="group relative">
                    <button
                      onClick={() => setActiveConversation(c.id)}
                      className={`flex h-8 w-full items-center rounded-lg px-3 text-start text-sm transition ${
                        c.id === activeConversationId ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                      }`}
                    >
                      <span className="truncate">{c.title}</span>
                    </button>
                    {/* Hover menu */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpenFor(menuOpenFor === c.id ? null : c.id); }}
                      className="absolute end-1 top-1 hidden h-6 w-6 items-center justify-center rounded text-zinc-500 hover:bg-zinc-700 group-hover:flex"
                    >
                      <ChevronDown size={14} />
                    </button>
                    {menuOpenFor === c.id && (
                      <div className="absolute end-1 top-8 z-50 w-40 rounded-lg border border-zinc-700 bg-[#1A1C1E] py-1 shadow-xl" onMouseLeave={() => setMenuOpenFor(null)}>
                        <button onClick={() => { setRenameId(c.id); setRenameDraft(c.title); setMenuOpenFor(null); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-start text-xs text-zinc-300 hover:bg-zinc-800">
                          <Pen size={12} /> Rename
                        </button>
                        {archivedConversations.includes(c.id) ? (
                          <button onClick={() => { unarchiveConversation(c.id); setMenuOpenFor(null); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-start text-xs text-zinc-300 hover:bg-zinc-800">
                            <ArchiveRestore size={12} /> Unarchive
                          </button>
                        ) : (
                          <button onClick={() => { archiveConversation(c.id); setMenuOpenFor(null); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-start text-xs text-zinc-300 hover:bg-zinc-800">
                            <Archive size={12} /> Archive
                          </button>
                        )}
                        <button onClick={() => { deleteConversation(c.id); setMenuOpenFor(null); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-start text-xs text-red-400 hover:bg-zinc-800">
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>
                    )}
                    {renameId === c.id && (
                      <input
                        autoFocus
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onBlur={() => { if (renameDraft.trim()) renameConversation(c.id, renameDraft.trim()); setRenameId(null); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' && renameDraft.trim()) { renameConversation(c.id, renameDraft.trim()); setRenameId(null); } if (e.key === 'Escape') setRenameId(null); }}
                        className="absolute inset-x-1 top-1 h-6 rounded border border-zinc-600 bg-zinc-900 px-2 text-sm text-zinc-100 outline-none"
                      />
                    )}
                  </div>
                ))}
              </div>
            ))}

            {/* Archived */}
            {archivedConvos.length > 0 && (
              <div className="mt-4">
                <div className="px-2 py-1 text-[11px] font-medium text-zinc-500">Archived ({archivedConvos.length})</div>
                {archivedConvos.map((c: any) => (
                  <button key={c.id} onClick={() => setActiveConversation(c.id)} className="flex h-8 w-full items-center rounded-lg px-3 text-start text-sm text-zinc-500 hover:bg-zinc-800/50">
                    <span className="truncate opacity-60">{c.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bottom: Settings + Theme */}
          <div className="border-t border-zinc-800 p-2">
            <div className="flex items-center gap-1">
              <button onClick={() => setSettingsOpen(true)} className="flex h-8 flex-1 items-center gap-2 rounded-lg px-3 text-xs text-zinc-400 hover:bg-zinc-800">
                <Settings size={14} /> Settings
              </button>
              <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800">
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === MAIN CHAT === */}
      <div className="relative flex h-full min-w-0 flex-1 flex-col">
        {/* Top bar: sidebar toggle + model picker + share */}
        <div className="flex h-12 shrink-0 items-center gap-2 px-3">
          <button onClick={() => setSidebarOpen((v) => !v)} className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800">
            <PanelLeft size={16} />
          </button>

          {/* Model picker — centered */}
          <div className="relative mx-auto">
            <button
              onClick={() => setModelPickerOpen((v) => !v)}
              className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-zinc-200 hover:bg-zinc-800 transition"
            >
              <currentModel.icon size={14} className="text-teal-400" />
              {currentModel.name}
              <ChevronDown size={12} className="text-zinc-500" />
            </button>
            {modelPickerOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setModelPickerOpen(false)} />
                <div className="absolute left-1/2 top-full z-20 mt-1 w-64 -translate-x-1/2 rounded-xl border border-zinc-700 bg-[#1A1C1E] py-1 shadow-2xl">
                  {MODELS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { setSelectedModel(m.id); setModelPickerOpen(false); toast.success(`Model: ${m.name}`); }}
                      className={`flex w-full items-start gap-2.5 px-3 py-2 text-start transition ${selectedModel === m.id ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'}`}
                    >
                      <m.icon size={14} className="mt-0.5 shrink-0 text-teal-400" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-zinc-100">{m.name}</div>
                        <div className="truncate text-[11px] text-zinc-500">{m.desc}</div>
                      </div>
                      {selectedModel === m.id && <Check size={14} className="shrink-0 text-teal-400" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Share */}
          <button
            onClick={async () => {
              const cid = store.getState().activeConversationId;
              if (!cid) return toast.error('No conversation');
              toast.loading('Creating link…', { id: 'share' });
              try {
                const res = await fetch('/api/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', conversationId: cid }) });
                const data = await res.json();
                if (data.url) { await navigator.clipboard.writeText(data.url); toast.success('Link copied', { id: 'share' }); }
                else toast.error('Failed', { id: 'share' });
              } catch { toast.error('Failed', { id: 'share' }); }
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800"
          >
            <Share2 size={16} />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="scrollbar-gutter-stable min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          {activeMessages.length === 0 ? (
            /* === WELCOME SCREEN === */
            <div className="flex h-full flex-col items-center justify-center px-4 pb-24">
              <div className="w-full max-w-2xl">
                <h1 className="mb-6 text-center text-2xl font-semibold text-zinc-100">How can I help you today?</h1>
                {/* Composer in welcome screen */}
                <div className="rounded-2xl border border-zinc-700 bg-[#1A1C1E] p-3 shadow-lg">
                  <textarea
                    ref={textareaRef}
                    value={composerText}
                    onChange={(e) => setComposerText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    onPaste={(e) => {
                      for (const item of Array.from(e.clipboardData.items)) {
                        if (item.kind === 'file' && item.type.startsWith('image/')) {
                          const file = item.getAsFile();
                          if (file && file.size < 4 * 1024 * 1024) {
                            const r = new FileReader();
                            r.onload = () => store.getState().addAttachment({ id: genId('att'), kind: 'image', name: file.name, mime: file.type, size: file.size, dataUrl: r.result as string });
                            r.readAsDataURL(file);
                          }
                        }
                      }
                    }}
                    placeholder="Ask anything… (paste an image, type / for commands)"
                    rows={1}
                    className="max-h-[40vh] w-full resize-none bg-transparent px-2 py-1 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none"
                  />
                  <div className="mt-2 flex items-center gap-1.5">
                    <button onClick={() => setImageDialogOpen(true)} className="flex h-7 items-center gap-1 rounded-lg px-2 text-xs text-zinc-400 hover:bg-zinc-800">
                      <Plus size={14} /> Upload
                    </button>
                    <button onClick={toggleWebSearch} className={`flex h-7 items-center gap-1 rounded-lg border px-2 text-xs ${webSearchEnabled ? 'border-teal-500/40 bg-teal-500/10 text-teal-400' : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'}`}>
                      <Globe size={12} /> Web
                    </button>
                    <button onClick={toggleThink} className={`flex h-7 items-center gap-1 rounded-lg border px-2 text-xs ${thinkEnabled ? 'border-teal-500/40 bg-teal-500/10 text-teal-400' : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'}`}>
                      <Brain size={12} /> Think
                    </button>
                    <div className="flex-1" />
                    <button onClick={handleSend} disabled={!composerText.trim()} className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-500 text-white disabled:opacity-40 hover:bg-teal-600 transition">
                      <Send size={12} />
                    </button>
                  </div>
                </div>
                {/* Suggestion chips */}
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {STARTERS.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => setComposerText(s.prompt)}
                      className="flex flex-col items-center gap-1.5 rounded-xl border border-zinc-800 bg-[#1A1C1E] p-3 text-center transition hover:border-zinc-600"
                    >
                      <s.icon size={18} className={s.color} />
                      <span className="text-xs font-medium text-zinc-200">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* === MESSAGE LIST === */
            <div className="mx-auto max-w-3xl px-4 py-4">
              {activeMessages.map((m, i) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  isLast={i === activeMessages.length - 1}
                  isGenerating={isGenerating}
                  onRegenerate={() => {
                    // Find last user message
                    for (let j = activeMessages.length - 1; j >= 0; j--) {
                      if (activeMessages[j].role === 'user') {
                        removeMessage(activeConversationId!, m.id);
                        setComposerText(activeMessages[j].content);
                        return;
                      }
                    }
                  }}
                  onReadAloud={async () => {
                    if (m.audio?.url) { setReadAloud({ messageId: m.id, audioUrl: m.audio.url, playing: !(readAloud?.playing) }); return; }
                    toast.loading('Generating audio…', { id: 'tts' });
                    try {
                      const { tts } = await import('@/lib/api');
                      const url = await tts(m.content);
                      updateMessage(activeConversationId!, m.id, { audio: { url } });
                      setReadAloud({ messageId: m.id, audioUrl: url, playing: true });
                      toast.success('Playing', { id: 'tts' });
                    } catch { toast.error('Failed', { id: 'tts' }); }
                  }}
                  readAloudPlaying={readAloud?.messageId === m.id && readAloud?.playing}
                  onImageClick={(url, prompt) => openImageLightbox(url, prompt)}
                />
              ))}
              {isGenerating && activeMessages[activeMessages.length - 1]?.role === 'user' && (
                <div className="mb-4 flex gap-3">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-teal-500/10">
                    <Sparkles size={14} className="text-teal-400" />
                  </div>
                  <div className="flex items-center gap-1 pt-1.5">
                    <span className="size-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.3s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.15s]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-zinc-500" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* === COMPOSER (when messages exist) === */}
        {activeMessages.length > 0 && (
          <div className="shrink-0 pb-3 pt-1">
            <div className="mx-auto max-w-3xl px-4">
              <div className="rounded-2xl border border-zinc-700 bg-[#1A1C1E] p-3 shadow-lg">
                <textarea
                  ref={textareaRef}
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  onPaste={(e) => {
                    for (const item of Array.from(e.clipboardData.items)) {
                      if (item.kind === 'file' && item.type.startsWith('image/')) {
                        const file = item.getAsFile();
                        if (file && file.size < 4 * 1024 * 1024) {
                          const r = new FileReader();
                          r.onload = () => store.getState().addAttachment({ id: genId('att'), kind: 'image', name: file.name, mime: file.type, size: file.size, dataUrl: r.result as string });
                          r.readAsDataURL(file);
                        }
                      }
                    }
                  }}
                  placeholder="Ask anything… (paste an image, type / for commands)"
                  rows={1}
                  className="max-h-[40vh] w-full resize-none bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 outline-none"
                />
                <div className="mt-2 flex items-center gap-1.5">
                  <button onClick={() => setImageDialogOpen(true)} className="flex h-7 items-center gap-1 rounded-lg px-2 text-xs text-zinc-400 hover:bg-zinc-800">
                    <Plus size={14} /> Upload
                  </button>
                  <button onClick={toggleWebSearch} className={`flex h-7 items-center gap-1 rounded-lg border px-2 text-xs ${webSearchEnabled ? 'border-teal-500/40 bg-teal-500/10 text-teal-400' : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'}`}>
                    <Globe size={12} /> Web
                  </button>
                  <button onClick={toggleThink} className={`flex h-7 items-center gap-1 rounded-lg border px-2 text-xs ${thinkEnabled ? 'border-teal-500/40 bg-teal-500/10 text-teal-400' : 'border-zinc-700 text-zinc-400 hover:bg-zinc-800'}`}>
                    <Brain size={12} /> Think
                  </button>
                  <div className="flex-1" />
                  {isGenerating ? (
                    <button onClick={handleStop} className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-700 text-white hover:bg-zinc-600">
                      <Square size={10} fill="currentColor" />
                    </button>
                  ) : (
                    <button onClick={handleSend} disabled={!composerText.trim()} className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-500 text-white disabled:opacity-40 hover:bg-teal-600 transition">
                      <Send size={12} />
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-1.5 text-center text-[11px] text-zinc-600">
                GLM can use tools, search the web, generate images, and write files. Press Enter to send.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* === WORKSPACE === */}
      {showWorkspace && workspaceFiles.length > 0 && (
        <CodeWorkspace files={workspaceFiles} onClose={() => setShowWorkspace(false)} />
      )}

      {/* === DIALOGS === */}
      <ImageGenDialog open={imageDialogOpen} onOpenChange={setImageDialogOpen} onImageGenerated={(img) => {
        if (activeConversationId) addMessage(activeConversationId, { id: genId('msg'), role: 'assistant', content: `Generated: ${img.prompt}`, createdAt: Date.now(), images: [{ id: img.id, url: img.url, prompt: img.prompt, size: img.size, width: img.width, height: img.height }] });
      }} />
      <ImageLightbox />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <CommandPalette onGenerateImage={() => setImageDialogOpen(true)} onShowShortcuts={() => setShortcutsOpen(true)} />
      <KeyboardShortcutsHelp open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}

/** Clean message bubble — no "Assistant" label, just avatar + content. */
function MessageBubble({ message, isLast, isGenerating, onRegenerate, onReadAloud, readAloudPlaying, onImageClick }: {
  message: any; isLast: boolean; isGenerating: boolean; onRegenerate: () => void; onReadAloud: () => void; readAloudPlaying: boolean; onImageClick: (url: string, prompt?: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const copy = async () => { try { await navigator.clipboard.writeText(message.content); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} };

  if (isUser) {
    return (
      <div className="mb-4 flex justify-end">
        <div className="max-w-[80%]">
          {message.attachments?.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2 justify-end">
              {message.attachments.map((a: any) => (
                a.dataUrl ? <img key={a.id} src={a.dataUrl} alt={a.name} className="h-16 w-16 rounded-lg object-cover" /> : <div key={a.id} className="flex h-16 items-center rounded-lg border border-zinc-700 px-3 text-xs text-zinc-400">{a.name}</div>
              ))}
            </div>
          )}
          <div className="rounded-2xl rounded-br-md bg-zinc-800 px-4 py-2.5 text-sm text-zinc-100">
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group mb-4 flex gap-3">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-teal-500/10">
        <Sparkles size={14} className="text-teal-400" />
      </div>
      <div className="min-w-0 flex-1">
        {message.pending && !message.content ? (
          <div className="flex items-center gap-1 pt-1.5">
            <span className="size-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.3s]" />
            <span className="size-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.15s]" />
            <span className="size-1.5 animate-bounce rounded-full bg-zinc-500" />
          </div>
        ) : message.error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">{message.error}</div>
        ) : (
          <>
            {/* Web search results */}
            {message.webSearch && message.webSearch.results.length > 0 && (
              <details className="mb-2 rounded-lg border border-zinc-800 bg-zinc-800/30">
                <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs text-zinc-400">
                  <Globe size={12} className="text-teal-400" /> Searched the web · {message.webSearch.results.length} results
                </summary>
                <div className="space-y-1 px-3 pb-2">
                  {message.webSearch.results.slice(0, 5).map((r: any, i: number) => (
                    <a key={i} href={r.url} target="_blank" rel="noopener noreferrer" className="block rounded-md px-2 py-1.5 hover:bg-zinc-800">
                      <div className="text-[11px] text-zinc-500">{r.host_name}</div>
                      <div className="truncate text-xs font-medium text-zinc-200">{r.name}</div>
                      <div className="line-clamp-2 text-[11px] text-zinc-500">{r.snippet}</div>
                    </a>
                  ))}
                </div>
              </details>
            )}

            {/* Tool execution cards */}
            {message.toolExecutions?.length > 0 && (
              <div className="mb-2 space-y-1">
                {message.toolExecutions.map((t: any, i: number) => (
                  <div key={i} className={`flex items-center gap-2 rounded-md border px-2 py-1 text-xs ${t.success ? 'border-zinc-800 bg-zinc-800/30' : 'border-red-500/30 bg-red-500/5'}`}>
                    {t.tool === 'file_write' && <FileCode size={10} className="text-blue-400" />}
                    {t.tool === 'code_run' && <Code2 size={10} className="text-green-400" />}
                    {t.tool === 'web_search' && <Globe size={10} className="text-teal-400" />}
                    {t.tool === 'image_generate' && <Sparkles size={10} className="text-amber-400" />}
                    {!['file_write', 'code_run', 'web_search', 'image_generate'].includes(t.tool) && <span className="text-zinc-500">●</span>}
                    <span className="font-mono text-zinc-300">{t.tool}</span>
                    <span className="text-zinc-600">→</span>
                    <span className="truncate text-zinc-500">{t.tool === 'file_write' ? t.args.path : t.tool === 'code_run' ? `${t.args.language || 'js'}` : t.tool === 'web_search' ? t.args.query : t.tool === 'image_generate' ? String(t.args.prompt || '').slice(0, 40) : ''}</span>
                    <span className={`ml-auto ${t.success ? 'text-green-400' : 'text-red-400'}`}>{t.success ? '✓' : '✗'}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Generated images */}
            {message.images?.length > 0 && (
              <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {message.images.map((img: any) => (
                  <div key={img.id} className="group/img relative overflow-hidden rounded-xl border border-zinc-700">
                    {img.pending ? (
                      <div className="aspect-square animate-pulse bg-zinc-800" />
                    ) : (
                      <>
                        <button onClick={() => onImageClick(img.url, img.prompt)} className="block w-full">
                          <img src={img.url} alt={img.prompt} className="w-full cursor-zoom-in" />
                        </button>
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition group-hover/img:opacity-100">
                          <div className="flex items-center justify-between">
                            <span className="truncate text-[11px] text-white">{img.prompt}</span>
                            <div className="flex gap-1">
                              <a href={img.url} download className="rounded p-1 text-white hover:bg-white/20"><Download size={12} /></a>
                              <button onClick={onRegenerate} className="rounded p-1 text-white hover:bg-white/20"><RefreshCw size={12} /></button>
                              <button onClick={() => onImageClick(img.url, img.prompt)} className="rounded p-1 text-white hover:bg-white/20"><ExternalLink size={12} /></button>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Markdown content */}
            {message.content && <Markdown content={message.content} streaming={message.streaming} />}

            {/* Audio player */}
            {message.audio && (
              <div className="mt-2 flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2">
                <audio src={message.audio.url} controls className="h-8" />
                <span className="text-[11px] text-zinc-500">Read-aloud</span>
              </div>
            )}

            {/* Hover toolbar */}
            {!message.pending && !message.error && (
              <div className="mt-1 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                <button onClick={copy} className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300">
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                </button>
                <button onClick={onReadAloud} className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300">
                  <Sparkles size={12} />
                </button>
                {isLast && !isGenerating && (
                  <button onClick={onRegenerate} className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300">
                    <RefreshCw size={12} />
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
