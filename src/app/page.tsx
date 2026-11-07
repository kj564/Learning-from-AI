'use client';

/**
 * LibreChat — AI Workspace (frontend rebuild, streaming + assistants + knowledge).
 *
 * Faithful layout:
 *   - Desktop (>= 768px): IconRail (52px) + Sidebar (280px) + Chat pane + [DocumentsPanel]
 *   - Mobile  (<  768px): Chat pane only; drawer (IconRail + Sidebar) slides over scrim.
 *
 * Backend:
 *   - SSE streaming at /api/chat/stream (bolt.diy-style text-delta + tool_use + tool_result events)
 *   - Onyx-style Assistants (/api/assistants CRUD)
 *   - Onyx-style Knowledge base (/api/knowledge CRUD + BM25 search)
 *   - Anthropic-format tool definitions in /lib/tool-definitions.ts
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useStore } from '@/lib/store';
import { streamChat } from '@/lib/api';
import IconRail, { type PanelId } from '@/components/librechat/IconRail';
import Sidebar from '@/components/librechat/Sidebar';
import ChatHeader from '@/components/librechat/ChatHeader';
import MessagesView from '@/components/librechat/MessagesView';
import ChatInput from '@/components/librechat/ChatInput';
import DocumentsPanel from '@/components/librechat/DocumentsPanel';
import KnowledgePanel from '@/components/librechat/KnowledgePanel';

const genId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export default function Page() {
  const [activePanel, setActivePanel] = useState<PanelId>('conversations');

  // Layout state
  const isMobile = useStore((s) => s.isMobile);
  const setIsMobile = useStore((s) => s.setIsMobile);
  const sidebarExpanded = useStore((s) => s.sidebarExpanded);
  const drawerOpen = useStore((s) => s.drawerOpen);
  const setDrawerOpen = useStore((s) => s.setDrawerOpen);
  const showDocumentsPanel = useStore((s) => s.showDocumentsPanel);
  const activeProject = useStore((s) => s.activeProject);

  // Conversation state
  const conversations = useStore((s) => s.conversations);
  const activeConversationId = useStore((s) => s.activeConversationId);
  const newConversation = useStore((s) => s.newConversation);
  const messagesByConversation = useStore((s) => s.messagesByConversation);
  const sessionByConversation = useStore((s) => s.sessionByConversation);
  const addMessage = useStore((s) => s.addMessage);
  const updateMessage = useStore((s) => s.updateMessage);
  const removeMessage = useStore((s) => s.removeMessage);
  const setSessionForConversation = useStore((s) => s.setSessionForConversation);
  const isGenerating = useStore((s) => s.isGenerating);
  const setIsGenerating = useStore((s) => s.setIsGenerating);
  const selectedModel = useStore((s) => s.selectedModel);

  // Assistants state
  const assistants = useStore((s) => s.assistants);
  const activeAssistantId = useStore((s) => s.activeAssistantId);

  // Active assistant to pass into chat
  const activeAssistant = assistants.find((a) => a.id === activeAssistantId) || null;

  // Active stream abort controller (for Stop button)
  const abortRef = useRef<AbortController | null>(null);

  // Track viewport size — switch to mobile below 768px (LibreChat breakpoint)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [setIsMobile]);

  // Close drawer when switching to desktop
  useEffect(() => {
    if (!isMobile && drawerOpen) setDrawerOpen(false);
  }, [isMobile, drawerOpen, setDrawerOpen]);

  // Ensure there's at least one conversation on first load
  useEffect(() => {
    if (conversations.length === 0) {
      newConversation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // === Chat send (streaming) ===

  const sendOneTurn = useCallback(
    (convoId: string, userText: string, pendingMsgId: string) => {
      setIsGenerating(true);
      // Mark the pending message as streaming (so MessageRow shows streaming caret)
      updateMessage(convoId, pendingMsgId, { streaming: true, pending: false });

      const sessionId = sessionByConversation[convoId];
      const controller = streamChat(
        {
          message: userText,
          sessionId,
          model: selectedModel,
          project: activeProject || undefined,
          assistant: activeAssistant
            ? { id: activeAssistant.id, name: activeAssistant.name, systemPrompt: activeAssistant.systemPrompt }
            : null,
        },
        {
          onTextDelta: (text) => {
            updateMessage(convoId, pendingMsgId, (prev) => ({
              content: (prev?.content || '') + text,
            }));
          },
          onToolUse: (event) => {
            // Add a tool execution entry to the pending message (running state)
            updateMessage(convoId, pendingMsgId, (prev) => ({
              toolExecutions: [
                ...(prev?.toolExecutions || []),
                { tool: event.name, args: event.input, success: false },
              ],
            }));
          },
          onToolResult: (event) => {
            // Update the matching tool execution entry with the success flag
            updateMessage(convoId, pendingMsgId, (prev) => {
              const execs = [...(prev?.toolExecutions || [])];
              // Find the last matching tool entry that's still in `success: false` state
              for (let i = execs.length - 1; i >= 0; i--) {
                if (execs[i].tool === event.tool && execs[i].success === false) {
                  execs[i] = { ...execs[i], success: event.success, result: event.result };
                  break;
                }
              }
              return { toolExecutions: execs };
            });
          },
          onDone: (event) => {
            setSessionForConversation(convoId, event.sessionId);
            updateMessage(convoId, pendingMsgId, { streaming: false, pending: false });
            setIsGenerating(false);
            abortRef.current = null;
          },
          onError: (message) => {
            updateMessage(convoId, pendingMsgId, {
              streaming: false,
              pending: false,
              error: message,
            });
            setIsGenerating(false);
            abortRef.current = null;
          },
        }
      );
      abortRef.current = controller;
    },
    [
      sessionByConversation,
      selectedModel,
      activeProject,
      activeAssistant,
      setIsGenerating,
      updateMessage,
      setSessionForConversation,
    ]
  );

  const handleSend = useCallback(
    (text: string) => {
      let convoId = activeConversationId;
      if (!convoId) {
        convoId = newConversation();
      }
      const userMsg = {
        id: genId('msg'),
        role: 'user' as const,
        content: text,
        createdAt: Date.now(),
      };
      addMessage(convoId, userMsg);

      const pendingMsgId = genId('msg');
      addMessage(convoId, {
        id: pendingMsgId,
        role: 'assistant',
        content: '',
        createdAt: Date.now(),
        pending: true,
        streaming: true,
      });

      void sendOneTurn(convoId, text, pendingMsgId);
    },
    [activeConversationId, newConversation, addMessage, sendOneTurn]
  );

  const handleRegenerate = useCallback(() => {
    if (!activeConversationId) return;
    const msgs = messagesByConversation[activeConversationId] || [];
    let lastUserIdx = -1;
    let lastAssistantIdx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'assistant' && lastAssistantIdx === -1 && !msgs[i].pending) {
        lastAssistantIdx = i;
      } else if (msgs[i].role === 'user' && lastUserIdx === -1) {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx === -1) return;
    const lastUser = msgs[lastUserIdx];

    if (lastAssistantIdx !== -1) {
      removeMessage(activeConversationId, msgs[lastAssistantIdx].id);
    }

    const pendingMsgId = genId('msg');
    addMessage(activeConversationId, {
      id: pendingMsgId,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      pending: true,
      streaming: true,
    });

    void sendOneTurn(activeConversationId, lastUser.content, pendingMsgId);
  }, [activeConversationId, messagesByConversation, removeMessage, addMessage, sendOneTurn]);

  const handleStop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsGenerating(false);
    // Mark any streaming messages as done
    if (activeConversationId) {
      const msgs = messagesByConversation[activeConversationId] || [];
      for (const m of msgs) {
        if (m.streaming || m.pending) {
          updateMessage(activeConversationId, m.id, {
            streaming: false,
            pending: false,
            content: m.content || '_Generation stopped._',
          });
        }
      }
    }
  }, [activeConversationId, messagesByConversation, updateMessage, setIsGenerating]);

  const showSidebar = !isMobile && sidebarExpanded;
  const showDrawer = isMobile && drawerOpen;

  return (
    <div className="bg-surface-canvas flex h-screen w-full overflow-hidden">
      {/* Desktop sidebar (icon rail + expanded panel) */}
      {showSidebar && (
        <div className="flex h-full shrink-0">
          <IconRail activePanel={activePanel} onPanelChange={setActivePanel} />
          <Sidebar activePanel={activePanel} onPanelChange={setActivePanel} />
        </div>
      )}

      {/* Desktop collapsed rail (when sidebar is collapsed) */}
      {!isMobile && !sidebarExpanded && (
        <IconRail activePanel={activePanel} onPanelChange={setActivePanel} />
      )}

      {/* Mobile drawer: scrim + IconRail + Sidebar over the pane */}
      {showDrawer && (
        <>
          <div
            className="absolute inset-0 z-40 bg-black/50"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 start-0 z-50 flex drawer-transition">
            <IconRail activePanel={activePanel} onPanelChange={setActivePanel} />
            <Sidebar
              activePanel={activePanel}
              onPanelChange={setActivePanel}
              isDrawer
              onCloseDrawer={() => setDrawerOpen(false)}
            />
          </div>
        </>
      )}

      {/* Chat pane */}
      <div
        className="relative isolate flex h-full min-w-0 flex-1 flex-col overflow-hidden"
        inert={showDrawer ? '' : undefined}
      >
        <ChatHeader />
        <MessagesView onRegenerate={handleRegenerate} />
        <div className="shrink-0 pb-3 pt-1">
          <ChatInput onSend={handleSend} onStop={handleStop} />
        </div>
      </div>

      {/* Right-side documents panel */}
      {showDocumentsPanel && activeProject && <DocumentsPanel />}
    </div>
  );
}
