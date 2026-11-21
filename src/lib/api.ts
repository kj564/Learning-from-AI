/**
 * Typed API helpers for the existing Next.js API routes:
 *   - POST /api/chat       (non-streaming, returns {response, toolCall, toolExecutions, ...})
 *   - GET  /api/chat       (returns {models})
 *   - DELETE /api/chat?sessionId=...
 *   - GET  /api/projects   (returns {projects})
 *   - POST /api/projects   (multi-action: create / get / update / delete / addDocument / ...)
 *   - POST /api/tools      (execute a single tool)
 *   - GET  /api/mcp/canva?action=status|authorize|disconnect
 */

export type AiModelId = 'default' | 'fast' | 'smart';

export interface AiModel {
  id: AiModelId;
  name: string;
  description: string;
}

export interface ProjectDocument {
  id: string;
  name: string;
  type: 'code' | 'text' | 'instruction' | 'config';
  content: string;
  language?: string;
  updatedAt: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  documents: ProjectDocument[];
  instructions: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProjectListItem {
  id: string;
  name: string;
  description: string;
  documentCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface ToolExecution {
  tool: string;
  args: Record<string, unknown>;
  success: boolean;
}

export interface ChatResponse {
  success: boolean;
  sessionId: string;
  response: string;
  toolCall: { tool: string; args: Record<string, unknown> } | null;
  toolExecutions: ToolExecution[];
  messageCount: number;
  model: string;
}

/** Send a chat message and get the AI's response (non-streaming). */
export async function sendChat(opts: {
  message: string;
  sessionId?: string;
  model?: AiModelId;
  project?: Project;
  mcpTools?: string[];
}): Promise<ChatResponse> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: opts.message,
      sessionId: opts.sessionId,
      model: opts.model,
      project: opts.project,
      mcpTools: opts.mcpTools,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/** Reset a conversation (clears server-side history). */
export async function clearChat(sessionId: string): Promise<void> {
  await fetch(`/api/chat?sessionId=${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
}

/** Get the list of available AI models. */
export async function getModels(): Promise<AiModel[]> {
  const res = await fetch('/api/chat');
  if (!res.ok) return [];
  const data = await res.json();
  return (data.models || []) as AiModel[];
}

/** List projects. */
export async function getProjects(): Promise<ProjectListItem[]> {
  const res = await fetch('/api/projects');
  if (!res.ok) return [];
  const data = await res.json();
  return (data.projects || []) as ProjectListItem[];
}

/** Create a new project. */
export async function createProject(name: string, description = ''): Promise<Project | null> {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create', name, description }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.project as Project) || null;
}

/** Get a full project (with documents + instructions). */
export async function getProject(id: string): Promise<Project | null> {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'get', id }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.project as Project) || null;
}

/** Update a project's name/description/instructions. */
export async function updateProject(id: string, updates: Partial<Pick<Project, 'name' | 'description' | 'instructions'>>): Promise<Project | null> {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'update', id, ...updates }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.project as Project) || null;
}

/** Delete a project. */
export async function deleteProject(id: string): Promise<boolean> {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'delete', id }),
  });
  return res.ok;
}

/** Add a document to a project. */
export async function addDocument(projectId: string, doc: Omit<ProjectDocument, 'id' | 'updatedAt'>): Promise<ProjectDocument | null> {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'addDocument',
      id: projectId,
      documentName: doc.name,
      documentType: doc.type,
      documentContent: doc.content,
      documentLanguage: doc.language,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.document as ProjectDocument) || null;
}

/** Update a document in a project. */
export async function updateDocument(projectId: string, documentId: string, updates: Partial<ProjectDocument>): Promise<ProjectDocument | null> {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'updateDocument',
      id: projectId,
      documentId,
      documentName: updates.name,
      documentType: updates.type,
      documentContent: updates.content,
      documentLanguage: updates.language,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.document as ProjectDocument) || null;
}

/** Delete a document from a project. */
export async function deleteDocument(projectId: string, documentId: string): Promise<boolean> {
  const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'deleteDocument', id: projectId, documentId }),
  });
  return res.ok;
}

/** Get Canva MCP connection status. */
export async function getCanvaStatus(): Promise<{ connected: boolean; expired: boolean }> {
  const res = await fetch('/api/mcp/canva?action=status');
  if (!res.ok) return { connected: false, expired: true };
  return res.json();
}

// ============================================================
// Streaming chat (SSE) — bolt.diy-inspired
// ============================================================

export interface StreamChatCallbacks {
  onTextDelta?: (text: string) => void;
  onTextReplace?: (text: string) => void;
  onSnapgentCommand?: (event: { command: string; params: Record<string, unknown> }) => void;
  onToolUse?: (event: { id: string; name: string; input: Record<string, unknown> }) => void;
  onToolResult?: (event: { tool_use_id: string; tool: string; success: boolean; result: string }) => void;
  onDone?: (event: { sessionId: string; messageCount: number; model: string; toolExecutions: { tool: string; args: Record<string, unknown>; success: boolean }[] }) => void;
  onError?: (message: string) => void;
}

/**
 * Stream a chat turn via SSE.
 *
 * Returns an AbortController so the caller can cancel the stream (e.g. when the user clicks Stop).
 */
export function streamChat(
  opts: {
    message: string;
    sessionId?: string;
    conversationId?: string;
    model?: AiModelId;
    project?: Project;
    assistant?: { id: string; name: string; systemPrompt: string } | null;
    think?: boolean;
  },
  cb: StreamChatCallbacks
): AbortController {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: opts.message,
          sessionId: opts.sessionId,
          conversationId: opts.conversationId,
          model: opts.model,
          project: opts.project,
          assistant: opts.assistant,
          think: opts.think,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        cb.onError?.(`HTTP ${res.status}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        // Parse complete SSE events (separated by \n\n)
        let sepIdx;
        while ((sepIdx = buf.indexOf('\n\n')) >= 0) {
          const rawEvent = buf.slice(0, sepIdx);
          buf = buf.slice(sepIdx + 2);

          // Parse "event: <name>\ndata: <json>"
          let event = 'message';
          let data = '';
          for (const line of rawEvent.split('\n')) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            else if (line.startsWith('data:')) data = line.slice(5).trim();
          }
          if (!data) continue;

          try {
            const payload = JSON.parse(data);
            switch (event) {
              case 'text-delta':
                cb.onTextDelta?.(payload.text || '');
                break;
              case 'text-replace':
                cb.onTextReplace?.(payload.text || '');
                break;
              case 'snapgent_command':
                cb.onSnapgentCommand?.({ command: payload.command, params: payload.params || {} });
                break;
              case 'tool_use':
                cb.onToolUse?.({ id: payload.id, name: payload.name, input: payload.input || {} });
                break;
              case 'tool_result':
                cb.onToolResult?.({
                  tool_use_id: payload.tool_use_id,
                  tool: payload.tool,
                  success: !!payload.success,
                  result: payload.result || '',
                });
                break;
              case 'done':
                cb.onDone?.(payload);
                break;
              case 'error':
                cb.onError?.(payload.message || 'Unknown error');
                break;
            }
          } catch {
            // ignore malformed events
          }
        }
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      cb.onError?.(e instanceof Error ? e.message : String(e));
    }
  })();

  return controller;
}

// ============================================================
// Assistants (Onyx-style CRUD)
// ============================================================

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

export async function getAssistants(): Promise<Assistant[]> {
  const res = await fetch('/api/assistants');
  if (!res.ok) return [];
  const data = await res.json();
  return (data.assistants || []) as Assistant[];
}

export async function createAssistant(payload: Partial<Assistant>): Promise<Assistant | null> {
  const res = await fetch('/api/assistants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create', ...payload }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.assistant as Assistant) || null;
}

export async function updateAssistant(id: string, updates: Partial<Assistant>): Promise<Assistant | null> {
  const res = await fetch('/api/assistants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'update', id, ...updates }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.assistant as Assistant) || null;
}

export async function deleteAssistant(id: string): Promise<boolean> {
  const res = await fetch('/api/assistants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'delete', id }),
  });
  return res.ok;
}

// ============================================================
// Knowledge base (RAG-lite, Onyx-inspired)
// ============================================================

export interface KnowledgeDocMeta {
  id: string;
  title: string;
  source: string;
  tags: string[];
  contentLength: number;
  createdAt: number;
  updatedAt: number;
}

export interface KnowledgeSearchResult {
  docId: string;
  source: string;
  title: string;
  content: string;
  score: number;
}

export async function getKnowledgeDocs(): Promise<KnowledgeDocMeta[]> {
  const res = await fetch('/api/knowledge');
  if (!res.ok) return [];
  const data = await res.json();
  return (data.docs || []) as KnowledgeDocMeta[];
}

export async function createKnowledgeDoc(payload: { title: string; source?: string; content: string; tags?: string[] }): Promise<KnowledgeDocMeta | null> {
  const res = await fetch('/api/knowledge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create', ...payload }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.doc as KnowledgeDocMeta) || null;
}

export async function deleteKnowledgeDoc(id: string): Promise<boolean> {
  const res = await fetch('/api/knowledge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'delete', id }),
  });
  return res.ok;
}

export async function searchKnowledge(query: string, topK = 4): Promise<KnowledgeSearchResult[]> {
  const res = await fetch('/api/knowledge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'search', query, topK }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.snippets || []) as KnowledgeSearchResult[];
}

// ============================================================
// Multimodal: image generation, image search, vision, TTS, ASR, web search
// ============================================================

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  size: string;
  width: number;
  height: number;
}

/** Generate an image from a text prompt. */
export async function generateImage(opts: {
  prompt: string;
  size?: string;
  conversationId?: string;
  messageId?: string;
}): Promise<GeneratedImage | null> {
  const res = await fetch('/api/image/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.image as GeneratedImage) || null;
}

export interface ImageSearchResult {
  original_url: string;
  caption: string;
  source: string;
  original_width?: string;
  original_height?: string;
}

/** Search the web for existing images. */
export async function imageSearch(query: string, count = 4): Promise<ImageSearchResult[]> {
  const res = await fetch('/api/image/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, count }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []) as ImageSearchResult[];
}

/** Understand an image (data URL, http URL, or our asset URL). Returns the AI's description. */
export async function vision(opts: {
  imageUrl: string;
  prompt?: string;
  history?: { role: string; content: string }[];
}): Promise<string> {
  const res = await fetch('/api/vision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return (data.text as string) || '';
}

/** Text-to-speech. Returns a /api/audio/asset?id=... URL. */
export async function tts(text: string, voice?: string): Promise<string> {
  const res = await fetch('/api/audio/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return (data.audioUrl as string) || '';
}

/** Speech-to-text. Pass base64-encoded audio (webm/wav/mp3 from MediaRecorder). */
export async function asr(fileBase64: string): Promise<string> {
  const res = await fetch('/api/audio/asr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_base64: fileBase64 }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const data = await res.json();
  return (data.text as string) || '';
}

export interface WebSearchResult {
  url: string;
  name: string;
  snippet: string;
  host_name: string;
  rank: number;
  date: string;
  favicon: string;
}

/** Real web search via the SDK's built-in functions.invoke('web_search'). */
export async function webSearch(query: string, num = 6): Promise<WebSearchResult[]> {
  const res = await fetch('/api/web/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, num }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []) as WebSearchResult[];
}

// ============================================================
// Video generation (async)
// ============================================================

export interface VideoGenerateResponse {
  success: boolean;
  taskId: string;
  status: 'PROCESSING' | 'SUCCESS' | 'FAIL';
}

export interface VideoStatusResponse {
  success: boolean;
  taskId: string;
  status: 'PROCESSING' | 'SUCCESS' | 'FAIL';
  videoUrl: string | null;
}

/** Start a video generation task. Returns a taskId. */
export async function generateVideo(opts: {
  prompt?: string;
  image_url?: string | string[];
  quality?: 'speed' | 'quality';
  with_audio?: boolean;
  duration?: number;
}): Promise<VideoGenerateResponse> {
  const res = await fetch('/api/video/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/** Poll a video generation task's status. */
export async function videoStatus(taskId: string): Promise<VideoStatusResponse> {
  const res = await fetch(`/api/video/status?taskId=${encodeURIComponent(taskId)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ============================================================
// Image editing
// ============================================================

/** Edit an existing image with a text prompt. */
export async function editImage(opts: {
  prompt: string;
  image: string;
  size?: string;
  conversationId?: string;
}): Promise<GeneratedImage | null> {
  const res = await fetch('/api/image/edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.image as GeneratedImage) || null;
}

// ============================================================
// Conversation persistence (load from server)
// ============================================================

export interface ConversationListItem {
  id: string;
  title: string;
  model: string;
  assistantId: string | null;
  projectId: string | null;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolExecutions: { tool: string; args: Record<string, unknown>; success: boolean }[];
  sessionId: string | null;
  createdAt: number;
}

export interface ConversationDetail extends ConversationListItem {
  messages?: ConversationMessage[];
}

export async function listConversations(): Promise<ConversationListItem[]> {
  const res = await fetch('/api/conversations');
  if (!res.ok) return [];
  const data = await res.json();
  return (data.conversations || []) as ConversationListItem[];
}

export async function getConversation(id: string): Promise<ConversationDetail | null> {
  const res = await fetch(`/api/conversations?id=${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return (data.conversation as ConversationDetail) || null;
}

export async function deleteConversation(id: string): Promise<boolean> {
  const res = await fetch('/api/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'delete', id }),
  });
  return res.ok;
}

export async function createConversation(opts?: {
  title?: string;
  model?: string;
  assistantId?: string;
  projectId?: string;
}): Promise<ConversationListItem | null> {
  const res = await fetch('/api/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create', ...(opts || {}) }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.conversation as ConversationListItem) || null;
}
