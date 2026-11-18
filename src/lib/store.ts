/**
 * Global UI state for the LibreChat-style workspace.
 * Persisted to localStorage via zustand persist middleware.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AiModelId, Project } from './api';

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  projectId?: string | null;
  model: AiModelId;
  assistantId?: string | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  /** True while waiting for assistant response. */
  pending?: boolean;
  /** Tool calls reported by the backend for this turn. */
  toolExecutions?: { tool: string; args: Record<string, unknown>; success: boolean; result?: string }[];
  /** True while the assistant is still streaming text into this message. */
  streaming?: boolean;
  /** User-uploaded attachments (images/files/audio) shown as thumbnails above the bubble. */
  attachments?: Attachment[];
  /** AI-generated images shown as inline cards in the assistant message. */
  images?: GeneratedImageRef[];
  /** AI-generated videos — taskId for polling, url filled in on completion */
  videos?: { taskId: string; prompt: string; url?: string; status?: 'PROCESSING' | 'SUCCESS' | 'FAIL' }[];
  /** Web search results shown as a collapsible "Searched the web" panel above the content. */
  webSearch?: { query: string; results: WebSearchSource[] };
  /** Read-aloud audio URL (cached after first TTS call). */
  audio?: { url: string; playing?: boolean };
  error?: string;
}

export interface Attachment {
  id: string;
  kind: 'image' | 'file' | 'audio';
  name: string;
  mime: string;
  size: number;
  /** For images: a data URL or /api/asset?id=... URL. */
  url?: string;
  /** For images: a thumbnail data URL (small preview). */
  dataUrl?: string;
}

export interface GeneratedImageRef {
  id: string;
  url: string;
  prompt: string;
  size: string;
  width: number;
  height: number;
  /** True while generating. */
  pending?: boolean;
}

export interface WebSearchSource {
  url: string;
  name: string;
  snippet: string;
  host_name: string;
  date?: string;
  favicon?: string;
}

/** A conversation as the server returns it from GET /api/conversations. */
export interface ServerConversation {
  id: string;
  title: string;
  model: string;
  assistantId: string | null;
  projectId: string | null;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface Assistant {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  model: AiModelId | string;
  tools: string[];
  knowledgeIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface KnowledgeDocMeta {
  id: string;
  title: string;
  source: string;
  tags: string[];
  contentLength: number;
  createdAt: number;
  updatedAt: number;
}

interface WorkspaceState {
  // === Conversations ===
  conversations: Conversation[];
  activeConversationId: string | null;

  // Messages keyed by conversation id
  messagesByConversation: Record<string, ChatMessage[]>;

  // Server-side session id (the /api/chat sessionId)
  sessionByConversation: Record<string, string>;

  // === Composer ===
  composerText: string;
  selectedModel: AiModelId;
  isGenerating: boolean;

  // === Sidebar / layout ===
  sidebarExpanded: boolean;
  showDocumentsPanel: boolean;
  isMobile: boolean;
  drawerOpen: boolean;

  // === Projects ===
  projects: Project[];
  activeProject: Project | null;

  // === Assistants (Onyx-style) ===
  assistants: Assistant[];
  activeAssistantId: string | null;

  // === Knowledge base ===
  knowledgeDocs: KnowledgeDocMeta[];

  // === Composer multimodal state ===
  composerAttachments: Attachment[];
  webSearchEnabled: boolean;
  voiceRecording: { isRecording: boolean; seconds: number } | null;
  readAloud: { messageId: string; audioUrl: string; playing: boolean } | null;
  imageLightbox: { url: string; prompt?: string } | null;
  commandPaletteOpen: boolean;

  // === Actions ===
  newConversation: () => string;
  setActiveConversation: (id: string | null) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;

  addMessage: (convoId: string, msg: ChatMessage) => void;
  updateMessage: (convoId: string, msgId: string, patch: Partial<ChatMessage> | ((prev: ChatMessage) => Partial<ChatMessage>)) => void;
  removeMessage: (convoId: string, msgId: string) => void;
  setSessionForConversation: (convoId: string, sessionId: string) => void;

  setComposerText: (text: string) => void;
  setSelectedModel: (model: AiModelId) => void;
  setIsGenerating: (b: boolean) => void;

  toggleSidebar: () => void;
  setSidebarExpanded: (b: boolean) => void;
  toggleDocumentsPanel: () => void;
  setShowDocumentsPanel: (b: boolean) => void;
  setIsMobile: (b: boolean) => void;
  setDrawerOpen: (b: boolean) => void;

  setProjects: (projects: Project[]) => void;
  setActiveProject: (p: Project | null) => void;

  // Server-side conversations (loaded from /api/conversations, NOT localStorage)
  serverConversations: ServerConversation[];
  setServerConversations: (list: ServerConversation[]) => void;

  setAssistants: (a: Assistant[]) => void;
  setActiveAssistant: (id: string | null) => void;

  setKnowledgeDocs: (d: KnowledgeDocMeta[]) => void;

  // Composer multimodal actions
  addAttachment: (a: Attachment) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
  toggleWebSearch: () => void;
  setVoiceRecording: (state: { isRecording: boolean; seconds: number } | null) => void;
  setReadAloud: (state: { messageId: string; audioUrl: string; playing: boolean } | null) => void;
  openImageLightbox: (url: string, prompt?: string) => void;
  closeImageLightbox: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
}

const genId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const useStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeConversationId: null,
      messagesByConversation: {},
      sessionByConversation: {},
      composerText: '',
      selectedModel: 'default',
      isGenerating: false,
      sidebarExpanded: true,
      showDocumentsPanel: false,
      isMobile: false,
      drawerOpen: false,
      projects: [],
      activeProject: null,
      serverConversations: [],
      assistants: [],
      activeAssistantId: null,
      knowledgeDocs: [],
      composerAttachments: [],
      webSearchEnabled: false,
      voiceRecording: null,
      readAloud: null,
      imageLightbox: null,
      commandPaletteOpen: false,

      newConversation: () => {
        const id = genId('convo');
        const convo: Conversation = {
          id,
          title: 'New Chat',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          projectId: get().activeProject?.id || null,
          model: get().selectedModel,
        };
        set((s) => ({
          conversations: [convo, ...s.conversations],
          activeConversationId: id,
          messagesByConversation: { ...s.messagesByConversation, [id]: [] },
          drawerOpen: false,
        }));
        return id;
      },

      setActiveConversation: (id) => {
        set({ activeConversationId: id, drawerOpen: false });
      },

      deleteConversation: (id) => {
        set((s) => {
          const conversations = s.conversations.filter((c) => c.id !== id);
          const { [id]: _m, ...messagesByConversation } = s.messagesByConversation;
          const { [id]: _s, ...sessionByConversation } = s.sessionByConversation;
          const activeConversationId =
            s.activeConversationId === id ? (conversations[0]?.id ?? null) : s.activeConversationId;
          return { conversations, messagesByConversation, sessionByConversation, activeConversationId };
        });
      },

      renameConversation: (id, title) => {
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, title, updatedAt: Date.now() } : c
          ),
        }));
      },

      addMessage: (convoId, msg) => {
        set((s) => {
          const list = s.messagesByConversation[convoId] || [];
          return {
            messagesByConversation: { ...s.messagesByConversation, [convoId]: [...list, msg] },
            // Auto-title the conversation from the first user message
            conversations:
              msg.role === 'user' && s.conversations.find((c) => c.id === convoId)?.title === 'New Chat'
                ? s.conversations.map((c) =>
                    c.id === convoId
                      ? { ...c, title: msg.content.slice(0, 40) + (msg.content.length > 40 ? '…' : ''), updatedAt: Date.now() }
                      : c
                  )
                : s.conversations,
          };
        });
      },

      updateMessage: (convoId, msgId, patch) => {
        set((s) => {
          const list = s.messagesByConversation[convoId] || [];
          return {
            messagesByConversation: {
              ...s.messagesByConversation,
              [convoId]: list.map((m) => {
                if (m.id !== msgId) return m;
                // Support updater-function form (like React setState) so callers
                // can compute the next patch based on the current message — e.g.
                // onTextDelta appends to content: (prev) => ({ content: prev.content + text })
                const resolvedPatch = typeof patch === 'function' ? (patch as (prev: ChatMessage) => Partial<ChatMessage>)(m) : patch;
                return { ...m, ...resolvedPatch };
              }),
            },
          };
        });
      },

      removeMessage: (convoId, msgId) => {
        set((s) => {
          const list = s.messagesByConversation[convoId] || [];
          return {
            messagesByConversation: {
              ...s.messagesByConversation,
              [convoId]: list.filter((m) => m.id !== msgId),
            },
          };
        });
      },

      setSessionForConversation: (convoId, sessionId) => {
        set((s) => ({
          sessionByConversation: { ...s.sessionByConversation, [convoId]: sessionId },
        }));
      },

      setComposerText: (text) => set({ composerText: text }),
      setSelectedModel: (model) => set({ selectedModel: model }),
      setIsGenerating: (b) => set({ isGenerating: b }),

      toggleSidebar: () => set((s) => ({ sidebarExpanded: !s.sidebarExpanded })),
      setSidebarExpanded: (b) => set({ sidebarExpanded: b }),
      toggleDocumentsPanel: () => set((s) => ({ showDocumentsPanel: !s.showDocumentsPanel })),
      setShowDocumentsPanel: (b) => set({ showDocumentsPanel: b }),
      setIsMobile: (b) => set({ isMobile: b }),
      setDrawerOpen: (b) => set({ drawerOpen: b }),

      setProjects: (projects) => set({ projects }),
      setActiveProject: (p) => set({ activeProject: p }),

      setServerConversations: (list) => set({ serverConversations: list }),

      setAssistants: (assistants) => set({ assistants }),
      setActiveAssistant: (id) => set({ activeAssistantId: id }),

      setKnowledgeDocs: (knowledgeDocs) => set({ knowledgeDocs }),

      addAttachment: (a) => set((s) => ({ composerAttachments: [...s.composerAttachments, a] })),
      removeAttachment: (id) => set((s) => ({ composerAttachments: s.composerAttachments.filter((a) => a.id !== id) })),
      clearAttachments: () => set({ composerAttachments: [] }),
      toggleWebSearch: () => set((s) => ({ webSearchEnabled: !s.webSearchEnabled })),
      setVoiceRecording: (state) => set({ voiceRecording: state }),
      setReadAloud: (state) => set({ readAloud: state }),
      openImageLightbox: (url, prompt) => set({ imageLightbox: { url, prompt } }),
      closeImageLightbox: () => set({ imageLightbox: null }),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
    }),
    {
      name: 'librechat-workspace-v1',
      version: 2,
      // Migrate older persisted state to current shape.
      migrate: (persisted: any, version: number) => {
        if (!persisted || typeof persisted !== 'object') return persisted;
        // v1 → v2: strip base64 dataUrl from message attachments (localStorage quota)
        if (version < 2 && persisted.messagesByConversation) {
          for (const convoId of Object.keys(persisted.messagesByConversation)) {
            const msgs = persisted.messagesByConversation[convoId];
            if (!Array.isArray(msgs)) continue;
            persisted.messagesByConversation[convoId] = msgs.map((m: any) => {
              if (m.attachments && Array.isArray(m.attachments)) {
                m.attachments = m.attachments.map((a: any) => ({ ...a, dataUrl: undefined }));
              }
              return m;
            });
          }
        }
        return persisted;
      },
      // Persist only what should survive reload — NOT transient flags like isGenerating/drawerOpen.
      // Strip base64 dataUrl from attachments before persisting (localStorage quota is 5-10MB;
      // base64 thumbnails blow it quickly).
      partialize: (s) => {
        const trimmed: any = {
          conversations: s.conversations,
          activeConversationId: s.activeConversationId,
          sessionByConversation: s.sessionByConversation,
          selectedModel: s.selectedModel,
          sidebarExpanded: s.sidebarExpanded,
          showDocumentsPanel: s.showDocumentsPanel,
          activeProject: s.activeProject,
          activeAssistantId: s.activeAssistantId,
          webSearchEnabled: s.webSearchEnabled,
          messagesByConversation: {},
        };
        // Strip base64 dataUrl from attachments before persisting (they're regenerated
        // from the asset URL on reload; keeping them would exhaust localStorage).
        for (const convoId of Object.keys(s.messagesByConversation)) {
          const msgs = s.messagesByConversation[convoId];
          if (!Array.isArray(msgs)) continue;
          trimmed.messagesByConversation[convoId] = msgs.map((m) => {
            if (m.attachments && m.attachments.length > 0) {
              return {
                ...m,
                attachments: m.attachments.map((a) => ({ ...a, dataUrl: undefined })),
              };
            }
            return m;
          });
        }
        return trimmed;
      },
    }
  )
);
