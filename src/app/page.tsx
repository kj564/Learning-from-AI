'use client';

/**
 * AI Chat — multimodal workspace (chat.z.ai-inspired).
 *
 * Layout:
 *   - Desktop (>= 768px): IconRail (52px) + Sidebar (280px) + Chat pane + [DocumentsPanel]
 *   - Mobile  (<  768px): Chat pane only; drawer (IconRail + Sidebar) slides over scrim.
 *
 * Multimodal features (powered by z-ai-web-dev-sdk, all server-side):
 *   - Streaming chat with tool loop (Anthropic-style tool_use → tool_result)
 *   - Image generation (text-to-image) — inline cards + regenerate + lightbox
 *   - Image understanding (vision) — paste/upload image + ask
 *   - Voice input (ASR) + Read-aloud (TTS)
 *   - Real web search (SDK functions.invoke('web_search'))
 *   - Onyx-style Assistants + Knowledge base (BM25 RAG)
 *   - Prisma/SQLite persistence for everything
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useStore } from '@/lib/store';
import { streamChat, generateImage, vision, webSearch, generateVideo, type GeneratedImage } from '@/lib/api';
import { toast } from 'sonner';
import IconRail, { type PanelId } from '@/components/librechat/IconRail';
import Sidebar from '@/components/librechat/Sidebar';
import ChatHeader from '@/components/librechat/ChatHeader';
import MessagesView from '@/components/librechat/MessagesView';
import ChatInput from '@/components/librechat/ChatInput';
import DocumentsPanel from '@/components/librechat/DocumentsPanel';
import ImageGenDialog from '@/components/librechat/ImageGenDialog';
import ImageLightbox from '@/components/librechat/ImageLightbox';
import CommandPalette from '@/components/librechat/CommandPalette';
import KeyboardShortcutsHelp from '@/components/librechat/KeyboardShortcutsHelp';
import type { GeneratedImageRef } from '@/lib/store';

const genId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/** Parse a tool_result's JSON-encoded result payload to extract rich media (images, web search, videos, edits). */
function parseToolResult(
  tool: string,
  resultStr: string
): {
  images?: GeneratedImageRef[];
  videos?: { taskId: string; prompt: string; status?: 'PROCESSING' | 'SUCCESS' | 'FAIL' }[];
  webSearch?: { query: string; results: any[] };
} {
  try {
    const parsed = JSON.parse(resultStr);
    if ((tool === 'image_generate' || tool === 'image_edit') && parsed.image) {
      return {
        images: [
          {
            id: parsed.image.id,
            url: parsed.image.url,
            prompt: parsed.image.prompt,
            size: parsed.image.size,
            width: parsed.image.width,
            height: parsed.image.height,
          },
        ],
      };
    }
    if (tool === 'video_generate' && parsed.taskId) {
      return {
        videos: [{ taskId: parsed.taskId, prompt: String(parsed.prompt || ''), status: parsed.status || 'PROCESSING' }],
      };
    }
    if (tool === 'web_search' && Array.isArray(parsed.results)) {
      return {
        webSearch: { query: parsed.query || '', results: parsed.results.slice(0, 8) },
      };
    }
  } catch {
    // resultStr wasn't JSON — ignore
  }
  return {};
}

export default function Page() {
  const [activePanel, setActivePanel] = useState<PanelId>('conversations');
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Layout state
  const isMobile = useStore((s) => s.isMobile);
  const setIsMobile = useStore((s) => s.setIsMobile);
  const sidebarExpanded = useStore((s) => s.sidebarExpanded);
  const drawerOpen = useStore((s) => s.drawerOpen);
  const setDrawerOpen = useStore((s) => s.setDrawerOpen);
  const showDocumentsPanel = useStore((s) => s.showDocumentsPanel);
  const activeProject = useStore((s) => s.activeProject);

  // Composer multimodal state
  const composerAttachments = useStore((s) => s.composerAttachments);
  const clearAttachments = useStore((s) => s.clearAttachments);
  const webSearchEnabled = useStore((s) => s.webSearchEnabled);

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
  const activeAssistant = assistants.find((a) => a.id === activeAssistantId) || null;

  // Active stream abort controller (for Stop button)
  const abortRef = useRef<AbortController | null>(null);

  // Track viewport size — switch to mobile below 768px
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [setIsMobile]);

  // Keyboard shortcuts: cmd+n (new chat), cmd+b (toggle sidebar/drawer)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        newConversation();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        if (isMobile) setDrawerOpen(true);
        else useStore.getState().toggleSidebar();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [newConversation, isMobile, setDrawerOpen]);

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

  // === Chat send (streaming, with vision pre-flight + web-search pre-flight) ===

  const sendOneTurn = useCallback(
    async (convoId: string, userText: string, attachments: typeof composerAttachments, pendingMsgId: string) => {
      setIsGenerating(true);
      updateMessage(convoId, pendingMsgId, { streaming: true, pending: false });

      // === Vision pre-flight: if any image attachments, describe them first ===
      let augmentedText = userText;
      if (attachments.some((a) => a.kind === 'image' && a.dataUrl)) {
        for (const a of attachments) {
          if (a.kind === 'image' && a.dataUrl) {
            try {
              const description = await vision({
                imageUrl: a.dataUrl,
                prompt: 'Describe this image concisely so the AI assistant can use it as context.',
              });
              augmentedText += `\n\n[Image: ${a.name}]\n${description}`;
            } catch (e) {
              toast.error('Image understanding failed', {
                description: e instanceof Error ? e.message : String(e),
              });
            }
          }
        }
      }

      // === Web search pre-flight: if webSearchEnabled, do a real search and inject results ===
      let webSearchResults: { query: string; results: any[] } | null = null;
      if (webSearchEnabled) {
        try {
          const query = userText.slice(0, 80);
          const results = await webSearch(query, 6);
          if (results.length > 0) {
            webSearchResults = { query, results };
            augmentedText += `\n\n[Web search results for "${query}"]:\n${results
              .slice(0, 6)
              .map((r, i) => `${i + 1}. ${r.name}\n   ${r.url}\n   ${r.snippet}`)
              .join('\n\n')}`;
            // Add the web search panel to the pending message immediately
            updateMessage(convoId, pendingMsgId, { webSearch: webSearchResults });
          }
        } catch (e) {
          toast.error('Web search failed', { description: e instanceof Error ? e.message : String(e) });
        }
      }

      const sessionId = sessionByConversation[convoId];
      const controller = streamChat(
        {
          message: augmentedText,
          sessionId,
          conversationId: convoId,
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
          onTextReplace: (text) => {
            // Server tells us the streamed-so-far content should be replaced
            // (used to strip out raw `{"tool":...,"args":...}` JSON after the
            // model emits a tool call, so the user sees prose + tool card, not JSON)
            updateMessage(convoId, pendingMsgId, { content: text });
          },
          onToolUse: (event) => {
            updateMessage(convoId, pendingMsgId, (prev) => ({
              toolExecutions: [
                ...(prev?.toolExecutions || []),
                { tool: event.name, args: event.input, success: false },
              ],
            }));
            // Optimistic placeholder for image_generate / image_edit
            if (event.name === 'image_generate' || event.name === 'image_edit') {
              const prompt = (event.input.prompt as string) || '';
              const size = (event.input.size as string) || '1024x1024';
              const placeholderId = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
              updateMessage(convoId, pendingMsgId, (prev) => ({
                images: [
                  ...(prev?.images || []),
                  { id: placeholderId, url: '', prompt, size, width: 1024, height: 1024, pending: true },
                ],
              }));
            }
            // Optimistic placeholder for video_generate
            if (event.name === 'video_generate') {
              const prompt = (event.input.prompt as string) || '';
              const placeholderTaskId = `pending_${Date.now()}`;
              updateMessage(convoId, pendingMsgId, (prev) => ({
                videos: [
                  ...(prev?.videos || []),
                  { taskId: placeholderTaskId, prompt, status: 'PROCESSING' },
                ],
              }));
            }
          },
          onToolResult: (event) => {
            // Update the matching tool execution entry
            updateMessage(convoId, pendingMsgId, (prev) => {
              const execs = [...(prev?.toolExecutions || [])];
              for (let i = execs.length - 1; i >= 0; i--) {
                if (execs[i].tool === event.tool && execs[i].success === false) {
                  execs[i] = { ...execs[i], success: event.success, result: event.result };
                  break;
                }
              }
              const patch: any = { toolExecutions: execs };
              // Parse rich results: images, videos, web search
              const rich = parseToolResult(event.tool, event.result);
              if (rich.images) {
                // Replace the placeholder image(s) with the real one
                const imgs = [...(prev?.images || [])];
                const placeholderIdx = imgs.findIndex((im) => im.pending);
                if (placeholderIdx >= 0) {
                  imgs[placeholderIdx] = rich.images[0];
                } else {
                  imgs.push(...rich.images);
                }
                patch.images = imgs;
              }
              if (rich.videos) {
                // Replace the placeholder video with the real taskId
                const vids = [...(prev?.videos || [])];
                const placeholderIdx = vids.findIndex((v) => v.taskId.startsWith('pending_'));
                if (placeholderIdx >= 0) {
                  vids[placeholderIdx] = rich.videos[0];
                } else {
                  vids.push(...rich.videos);
                }
                patch.videos = vids;
              }
              if (rich.webSearch && !prev?.webSearch) {
                patch.webSearch = rich.webSearch;
              }
              return patch;
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
      webSearchEnabled,
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
      // Snapshot the attachments (they'll be cleared after send)
      const attachments = [...composerAttachments];
      const userMsg = {
        id: genId('msg'),
        role: 'user' as const,
        content: text,
        createdAt: Date.now(),
        attachments: attachments.length > 0 ? attachments : undefined,
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

      // Clear attachments from the composer
      clearAttachments();

      void sendOneTurn(convoId, text, attachments, pendingMsgId);
    },
    [activeConversationId, newConversation, addMessage, sendOneTurn, composerAttachments, clearAttachments]
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

    void sendOneTurn(activeConversationId, lastUser.content, lastUser.attachments || [], pendingMsgId);
  }, [activeConversationId, messagesByConversation, removeMessage, addMessage, sendOneTurn]);

  const handleStop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsGenerating(false);
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

  // === Slash commands handler (/new, /clear, /model, /image, /web, /help) ===
  const handleSlashCommand = useCallback((cmd: string, args: string) => {
    switch (cmd) {
      case 'new':
        newConversation();
        toast.success('New chat started');
        break;
      case 'clear': {
        if (!activeConversationId) return;
        const msgs = messagesByConversation[activeConversationId] || [];
        // Remove all messages from current conversation
        useStore.setState((s) => {
          const { [activeConversationId]: _m, ...rest } = s.messagesByConversation;
          return { messagesByConversation: { ...rest, [activeConversationId]: [] } };
        });
        toast.success('Conversation cleared');
        break;
      }
      case 'model': {
        const m = (args || '').trim().toLowerCase();
        const map: Record<string, 'default' | 'fast' | 'smart'> = {
          opus: 'default', sonnet: 'smart', haiku: 'fast',
          default: 'default', fast: 'fast', smart: 'smart',
        };
        if (map[m]) {
          useStore.getState().setSelectedModel(map[m]);
          toast.success(`Model: ${args.trim()}`);
        } else {
          toast.error('Unknown model. Try: /model opus | sonnet | haiku');
        }
        break;
      }
      case 'image':
        setImageDialogOpen(true);
        break;
      case 'web':
        useStore.getState().toggleWebSearch();
        toast.success(useStore.getState().webSearchEnabled ? 'Web search ON' : 'Web search OFF');
        break;
      case 'help':
        setShortcutsOpen(true);
        break;
      default:
        toast.error(`Unknown command: /${cmd}`);
    }
  }, [activeConversationId, newConversation, messagesByConversation]);

  // === Image generation (manual flow from ImageGenDialog) ===
  const handleImageGenerated = useCallback(
    (image: GeneratedImage) => {
      if (!activeConversationId) return;
      addMessage(activeConversationId, {
        id: genId('msg'),
        role: 'assistant',
        content: `Generated image: ${image.prompt}`,
        createdAt: Date.now(),
        images: [
          {
            id: image.id,
            url: image.url,
            prompt: image.prompt,
            size: image.size,
            width: image.width,
            height: image.height,
          },
        ],
      });
    },
    [activeConversationId, addMessage]
  );

  const handleRegenerateImage = useCallback(
    async (img: GeneratedImageRef) => {
      toast.loading('Regenerating image…', { id: 'img-regen' });
      try {
        const newImg = await generateImage({ prompt: img.prompt, size: img.size });
        if (newImg && activeConversationId) {
          // Append a new assistant message with the regenerated image
          addMessage(activeConversationId, {
            id: genId('msg'),
            role: 'assistant',
            content: `Regenerated image: ${img.prompt}`,
            createdAt: Date.now(),
            images: [
              {
                id: newImg.id,
                url: newImg.url,
                prompt: newImg.prompt,
                size: newImg.size,
                width: newImg.width,
                height: newImg.height,
              },
            ],
          });
          toast.success('Image regenerated', { id: 'img-regen' });
        }
      } catch (e) {
        toast.error('Regeneration failed', {
          id: 'img-regen',
          description: e instanceof Error ? e.message : String(e),
        });
      }
    },
    [activeConversationId, addMessage]
  );

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
        <MessagesView onRegenerate={handleRegenerate} onRegenerateImage={handleRegenerateImage} />
        <div className="relative z-30 shrink-0 pb-3 pt-1">
          <ChatInput
            onSend={handleSend}
            onStop={handleStop}
            onGenerateImage={() => setImageDialogOpen(true)}
            onSlashCommand={handleSlashCommand}
          />
        </div>
      </div>

      {/* Right-side documents panel */}
      {showDocumentsPanel && activeProject && <DocumentsPanel />}

      {/* Image generation dialog */}
      <ImageGenDialog
        open={imageDialogOpen}
        onOpenChange={setImageDialogOpen}
        onImageGenerated={handleImageGenerated}
      />

      {/* Image lightbox */}
      <ImageLightbox />

      {/* Command palette (⌘K) */}
      <CommandPalette
        onGenerateImage={() => setImageDialogOpen(true)}
        onShowShortcuts={() => setShortcutsOpen(true)}
      />

      {/* Keyboard shortcuts help (⌘/) */}
      <KeyboardShortcutsHelp open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}
