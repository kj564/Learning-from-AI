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
  error?: string;
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

  // === Actions ===
  newConversation: () => string;
  setActiveConversation: (id: string | null) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;

  addMessage: (convoId: string, msg: ChatMessage) => void;
  updateMessage: (convoId: string, msgId: string, patch: Partial<ChatMessage>) => void;
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

  setAssistants: (a: Assistant[]) => void;
  setActiveAssistant: (id: string | null) => void;

  setKnowledgeDocs: (d: KnowledgeDocMeta[]) => void;
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
      assistants: [],
      activeAssistantId: null,
      knowledgeDocs: [],

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
              [convoId]: list.map((m) => (m.id === msgId ? { ...m, ...patch } : m)),
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

      setAssistants: (assistants) => set({ assistants }),
      setActiveAssistant: (id) => set({ activeAssistantId: id }),

      setKnowledgeDocs: (knowledgeDocs) => set({ knowledgeDocs }),
    }),
    {
      name: 'librechat-workspace-v1',
      // Persist only what should survive reload — NOT transient flags like isGenerating/drawerOpen
      partialize: (s) => ({
        conversations: s.conversations,
        activeConversationId: s.activeConversationId,
        messagesByConversation: s.messagesByConversation,
        sessionByConversation: s.sessionByConversation,
        selectedModel: s.selectedModel,
        sidebarExpanded: s.sidebarExpanded,
        showDocumentsPanel: s.showDocumentsPanel,
        activeProject: s.activeProject,
        activeAssistantId: s.activeAssistantId,
      }),
    }
  )
);
