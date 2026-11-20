/**
 * API: /api/chat/stream — SSE Streaming chat endpoint
 *
 * Improvements over v1:
 *   1. REAL LLM streaming via z-ai-web-dev-sdk's `stream: true` async iterable.
 *      Token-by-token output from the model — no more fake chunking.
 *   2. Conversation + messages are persisted to SQLite (via Prisma) on every turn.
 *   3. Server-side tool history (session) is keyed by conversationId, so even
 *      reloads don't lose context.
 *
 * SSE event protocol (Anthropic-flavored):
 *   event: text-delta   data: { "text": "..." }            — each LLM token
 *   event: tool_use      data: { "id": "...", "name": "...", "input": {...} }
 *   event: tool_result   data: { "tool_use_id":"...", "tool":"...", "success": bool, "result": "..." }
 *   event: done          data: { "sessionId": "...", "conversationId": "...", "messageCount": N, "model": "..." }
 *   event: error         data: { "message": "..." }
 *
 * Tool loop: model returns a `{"tool":"...","args":{...}}` JSON block; we extract,
 * execute via /api/tools, send the result back to the model as a user message,
 * and continue the loop (max 5 rounds).
 */

import { NextRequest } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { db } from '@/lib/db';
import { TOOL_DEFINITIONS, toolsToSystemPrompt } from '@/lib/tool-definitions';
import { buildSnapgentPrompt, extractSnapgentCommand } from '@/lib/snapgent-prompt';

export const AI_MODELS = [
  { id: 'glm-5.3', name: 'GLM-5.3', description: 'Most advanced — flagship model', glmModel: 'glm-5.3' },
  { id: 'glm-5.3-flash', name: 'GLM-5.3-Flash', description: 'Fast & free — no daily limit', glmModel: 'glm-5.3-flash' },
  { id: 'glm-4.7', name: 'GLM-4.7', description: 'Previous flagship — solid all-rounder', glmModel: 'glm-4.7' },
  { id: 'glm-4.6', name: 'GLM-4.6', description: 'Coding & agentic specialist', glmModel: 'glm-4.6' },
  { id: 'glm-4.5v', name: 'GLM-4.5V', description: 'Vision model — image understanding', glmModel: 'glm-4.5v' },
  { id: 'glm-4-plus', name: 'GLM-4-Plus', description: 'Balanced quality and speed', glmModel: 'glm-4-plus' },
  { id: 'glm-4-flash', name: 'GLM-4-Flash', description: 'Fast responses, lighter model', glmModel: 'glm-4-flash' },
] as const;

/** Map our internal model id → SDK model string. */
function resolveModel(id?: string): string | undefined {
  if (!id) return 'glm-5.3';
  const m = AI_MODELS.find((x) => x.id === id);
  return m?.glmModel ?? 'glm-5.3';
}

// In-memory session history (per conversationId) — used to drive the agentic tool loop.
// Messages are ALSO persisted to SQLite for cross-session continuity.
// TTL: entries are evicted 30 min after the last write to bound memory growth.
interface SessionEntry {
  history: { role: string; content: string }[];
  expiresAt: number;
}
const sessions = new Map<string, SessionEntry>();
const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_MESSAGES = 100;
const MAX_TOOL_ROUNDS = 10;

function saveSession(sid: string, history: { role: string; content: string }[]) {
  sessions.set(sid, { history, expiresAt: Date.now() + SESSION_TTL_MS });
}
function getSession(sid: string): { role: string; content: string }[] | null {
  const e = sessions.get(sid);
  if (!e) return null;
  if (e.expiresAt < Date.now()) {
    sessions.delete(sid);
    return null;
  }
  return e.history;
}
// Lazy cleaner — sweep expired entries every ~5 minutes.
let lastSweep = 0;
function sweepExpired() {
  const now = Date.now();
  if (now - lastSweep < 5 * 60 * 1000) return;
  lastSweep = now;
  for (const [k, v] of sessions) {
    if (v.expiresAt < now) sessions.delete(k);
  }
}

const BASE_SYSTEM_PROMPT = `# glm_behavior

## product_information

You are GLM-4.6, Z.ai's most capable model for coding, agentic tasks, and reasoning. You are running on chat.z.ai.

## tone_and_formatting

GLM uses a warm tone, treating people with kindness. GLM avoids over-formatting with bold emphasis, headers, lists, and bullet points, using the minimum formatting needed for clarity. In typical conversation GLM keeps a natural tone and responds in prose rather than lists unless asked; casual responses can be short.

## behavioral_guardrails

GLM doesn't help with creating malware, planning cyberattacks, or content that sexualizes minors.
GLM DOES help with legitimate security research, code generation, creative writing, technical explanations, and building full-stack web applications.

# Tool Use — CRITICAL

When the user asks you to create a file, write code, build something, run code, or look something up:
1. DO NOT just show them the code and say "here's the code"
2. Actually USE the appropriate tool (file_write, code_run, shell_run, web_search, knowledge_search, etc.)
3. Report what you did and the result.

To call a tool, respond with ONLY this JSON format and nothing else:
{"tool":"file_write","args":{"path":"src/app/page.tsx","content":"import React from 'react'\\nexport default function Home() {\\n  return <div>Hello</div>\\n}"}}

The system will execute the tool and send the result back. Then you can explain what happened to the user.`;

function buildSystemPrompt(project: any, assistant: any, tools = TOOL_DEFINITIONS, snapgent = false): string {
  let p = BASE_SYSTEM_PROMPT;
  if (assistant?.systemPrompt) {
    p += `\n\n# Assistant Persona\n\n${assistant.systemPrompt}`;
  }
  if (project) {
    let context = `\n\n# Current Project Context\n\n`;
    context += `Project: ${project.name}\n`;
    if (project.description) context += `Description: ${project.description}\n`;
    if (project.instructions) context += `\n## Project Instructions\n${project.instructions}\n`;
    if (project.documents && project.documents.length > 0) {
      context += `\n## Project Documents\n`;
      for (const doc of project.documents) {
        context += `\n### ${doc.name} (${doc.type}${doc.language ? `, ${doc.language}` : ''})\n`;
        context += '```\n' + doc.content + '\n```\n';
      }
    }
    p += context;
  }
  if (snapgent) {
    // Snapgent mode: inject the snapgent VS Code MCP system prompt instead of
    // the regular tool prompt. The AI outputs {"command":"...","params":{...}}
    // which we parse and forward to the local bridge.
    p += buildSnapgentPrompt();
  } else {
    p += toolsToSystemPrompt(tools);
  }
  return p;
}

/** Find the first balanced `{...}` substring that parses as a tool call. */
function findBalancedJson(text: string): { start: number; end: number; json: string } | null {
  let i = 0;
  while (i < text.length) {
    if (text[i] !== '{') { i++; continue; }
    // Walk forward matching braces, respecting strings + escapes
    let depth = 0;
    let inStr = false;
    let escape = false;
    let j = i;
    for (; j < text.length; j++) {
      const c = text[j];
      if (inStr) {
        if (escape) escape = false;
        else if (c === '\\') escape = true;
        else if (c === '"') inStr = false;
      } else {
        if (c === '"') inStr = true;
        else if (c === '{') depth++;
        else if (c === '}') {
          depth--;
          if (depth === 0) {
            const json = text.slice(i, j + 1);
            try {
              const parsed = JSON.parse(json);
              if (parsed && typeof parsed === 'object' && typeof parsed.tool === 'string') {
                return { start: i, end: j + 1, json };
              }
            } catch { /* not valid JSON, keep scanning */ }
            break; // move to next `{`
          }
        }
      }
    }
    i++;
  }
  return null;
}

/** Extract a tool call JSON block from the model's response (handles nested objects). */
function extractToolCall(text: string): { tool: string; args: Record<string, unknown> } | null {
  try {
    // Strict: entire response is a JSON object with tool+args
    const trimmed = text.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const parsed = JSON.parse(trimmed);
      if (parsed.tool && typeof parsed.tool === 'string' && parsed.args && typeof parsed.args === 'object') {
        return { tool: parsed.tool, args: parsed.args };
      }
    }
    // Balanced-brace scan: find first `{...}` that parses as a tool call
    const found = findBalancedJson(text);
    if (found) {
      const parsed = JSON.parse(found.json);
      if (parsed.tool && typeof parsed.tool === 'string') {
        return { tool: parsed.tool, args: parsed.args || {} };
      }
    }
  } catch {
    // not a tool call
  }
  return null;
}

/** Execute a tool by proxying to /api/tools. */
async function executeTool(toolCall: { tool: string; args: Record<string, unknown> }): Promise<{ success: boolean; result: string }> {
  try {
    const res = await fetch('http://localhost:3000/api/tools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toolCall),
    });
    const data = await res.json();
    if (data.success || res.ok) {
      return { success: true, result: JSON.stringify(data).slice(0, 4000) };
    }
    return { success: false, result: `Tool error: ${data.error || 'Unknown error'}` };
  } catch (e) {
    return { success: false, result: `Tool execution failed: ${e instanceof Error ? e.message : String(e)}` };
  }
}

function sseEmit(controller: ReadableStreamDefaultController, event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(new TextEncoder().encode(payload));
}

/**
 * Stream tokens from the LLM via the SDK's `stream: true` async iterable.
 *
 * The SDK returns raw SSE bytes (one or more Uint8Array chunks). We parse them
 * as standard OpenAI-format SSE events (`data: {...}\n\n` lines) and re-emit
 * each `choices[0].delta.content` as a `text-delta` SSE event to the client.
 *
 * Returns the full accumulated text.
 */
async function streamFromLLM(
  zai: any,
  messages: { role: string; content: string }[],
  model: string | undefined,
  controller: ReadableStreamDefaultController,
  abortSignal?: AbortSignal,
  think?: boolean
): Promise<string> {
  let full = '';
  let buf = ''; // accumulator for partial SSE events split across chunks
  try {
    const stream: any = await zai.chat.completions.create({
      messages,
      stream: true,
      // thinking mode: 'enabled' lets the model reason (visible as part of content
      // since SDK doesn't expose separate reasoning_content field for these models).
      thinking: { type: think ? 'enabled' : 'disabled' },
      ...(resolveModel(model) ? { model: resolveModel(model) } : {}),
      ...(abortSignal ? { signal: abortSignal } : {}),
    });

    if (stream && typeof stream[Symbol.asyncIterator] === 'function') {
      for await (const chunk of stream) {
        if (abortSignal?.aborted) break;
        // Decode chunk bytes to string
        let text: string;
        if (chunk instanceof Uint8Array || ArrayBuffer.isView(chunk)) {
          text = new TextDecoder().decode(chunk);
        } else if (typeof chunk === 'string') {
          text = chunk;
        } else {
          // Already-parsed object (some SDK versions)
          const delta: string =
            chunk?.choices?.[0]?.delta?.content ||
            chunk?.choices?.[0]?.message?.content || '';
          if (delta) {
            full += delta;
            sseEmit(controller, 'text-delta', { text: delta });
          }
          continue;
        }

        // Append to buffer and parse complete SSE events (separated by \n\n)
        buf += text;
        let sepIdx;
        while ((sepIdx = buf.indexOf('\n\n')) >= 0) {
          const rawEvent = buf.slice(0, sepIdx);
          buf = buf.slice(sepIdx + 2);

          // Each line starts with `data: ` — extract the JSON payload
          for (const line of rawEvent.split('\n')) {
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (data === '[DONE]' || !data) continue;
            try {
              const parsed = JSON.parse(data);
              const delta: string =
                parsed?.choices?.[0]?.delta?.content ||
                parsed?.choices?.[0]?.message?.content ||
                '';
              if (delta) {
                full += delta;
                sseEmit(controller, 'text-delta', { text: delta });
              }
            } catch {
              // ignore malformed lines
            }
          }
        }
      }
    } else {
      // Fallback: not actually a stream — emit the whole thing as one delta
      full = stream?.choices?.[0]?.message?.content || '';
      if (full) sseEmit(controller, 'text-delta', { text: full });
    }
  } catch (e) {
    sseEmit(controller, 'error', { message: e instanceof Error ? e.message : String(e) });
  }
  return full;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    message,
    sessionId,
    conversationId,
    project,
    model,
    assistant,
    think,
    snapgent, // NEW: boolean — when true, inject snapgent VS Code MCP system prompt + parse commands
  } = body as {
    message: string;
    sessionId?: string;
    conversationId?: string;
    project?: any;
    model?: string;
    assistant?: { id: string; name: string; systemPrompt: string } | null;
    think?: boolean;
    snapgent?: boolean;
  };

  if (!message || typeof message !== 'string') {
    return new Response('Message required', { status: 400 });
  }

  // Resolve / create the conversation record in SQLite
  let convoId = conversationId || sessionId;
  if (convoId) {
    // Persist the user's message immediately (best-effort)
    try {
      const exists = await db.conversation.findUnique({ where: { id: convoId } });
      if (exists) {
        await db.message.create({
          data: {
            conversationId: convoId,
            role: 'user',
            content: message,
            toolExecutions: '[]',
          },
        });
        await db.conversation.update({ where: { id: convoId }, data: { updatedAt: new Date() } });
      } else {
        // Conversation id from client doesn't exist in DB yet — create it
        await db.conversation.create({
          data: {
            id: convoId,
            title: message.slice(0, 40) + (message.length > 40 ? '…' : ''),
            model: model || 'default',
            assistantId: assistant?.id || null,
            messages: {
              create: [{ role: 'user', content: message, toolExecutions: '[]' }],
            },
          },
        });
      }
    } catch {
      // DB errors are non-fatal — keep streaming
    }
  }

  const sid = sessionId || convoId || `chat_${Date.now()}`;
  const systemPrompt = buildSystemPrompt(project, assistant, TOOL_DEFINITIONS, snapgent);

  // Get or create the session's in-memory history
  sweepExpired();
  let history = getSession(sid) || [{ role: 'assistant', content: systemPrompt }];
  history.push({ role: 'user', content: message });
  if (history.length > MAX_MESSAGES) {
    history = [history[0], ...history.slice(-(MAX_MESSAGES - 1))];
  }

  // Abort controller shared with the ReadableStream's cancel() — if the client
  // disconnects (clicks Stop), we abort the upstream SDK stream so we stop
  // paying for tokens nobody will read.
  const upstreamAbort = new AbortController();

  const stream = new ReadableStream({
    async start(controller) {
      const zai = await ZAI.create();
      let finalText = '';
      const toolExecutions: { tool: string; args: Record<string, unknown>; success: boolean }[] = [];

      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          if (upstreamAbort.signal.aborted) break;
          // Real LLM streaming — emits text-delta events as tokens arrive
          const raw = await streamFromLLM(zai, history, model, controller, upstreamAbort.signal, think);
          if (!raw && round === 0) {
            // streaming already emitted an error
            break;
          }

          const toolCall = extractToolCall(raw);

          // === Snapgent mode: PASS commands through to client ===
          // When snapgent=true, the AI outputs {"command":"...","params":{...}}.
          // The SERVER does NOT execute these — the browser (client-side) has the
          // WebSocket connection to the user's local bridge (ws://127.0.0.1:17613).
          // The server cannot reach the bridge because it runs in the cloud.
          //
          // So the server just passes the raw AI text through to the client.
          // The client detects the command in onDone, executes it via bridge,
          // and sends the result back as a new message (which starts a new stream).
          //
          // We still strip the JSON from visible text and emit tool_use/tool_result
          // events so the UI shows a clean tool card — but with a special
          // "snapgent:true" flag that tells the client "you handle execution".

          if (!toolCall && snapgent) {
            const snapgentCmd = extractSnapgentCommand(raw);
            if (snapgentCmd) {
              // Strip the JSON from visible text
              let visibleText = raw;
              const trimmed = raw.trim();
              if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                visibleText = '';
              } else {
                const found = findBalancedJson(raw);
                if (found) visibleText = (raw.slice(0, found.start) + raw.slice(found.end)).trim();
              }
              sseEmit(controller, 'text-replace', { text: visibleText });

              // Emit a "snapgent_command" event — client detects this and executes
              // the command via its own bridge WebSocket. Do NOT emit tool_result
              // here (the server can't execute it).
              sseEmit(controller, 'snapgent_command', {
                command: snapgentCmd.command,
                params: snapgentCmd.params,
              });

              // Stop the server-side loop — the client will send a new message
              // with the tool result, which starts a fresh stream.
              finalText = visibleText;
              history.push({ role: 'assistant', content: visibleText || `[executed: ${snapgentCmd.command}]` });
              break; // exit the tool loop — wait for client to send result
            }
          }

          if (!toolCall) {
            finalText = raw;
            history.push({ role: 'assistant', content: raw });
            break;
          }

          // The streamed text contained a tool call (raw JSON). Strip the JSON
          // part out of the visible content so the user doesn't see the raw
          // `{"tool":...,"args":...}` blob — the tool execution card (emitted
          // below as tool_use) is the user-facing representation.
          let visibleText = raw;
          const trimmed = raw.trim();
          if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            // Entire output was the tool call JSON → no visible prose
            visibleText = '';
          } else {
            // Tool call embedded mid-text → use balanced-brace scan to find it
            const found = findBalancedJson(raw);
            if (found) {
              visibleText = (raw.slice(0, found.start) + raw.slice(found.end)).trim();
            }
          }
          sseEmit(controller, 'text-replace', { text: visibleText });

          // We had a tool call — emit tool_use event, execute, emit tool_result event
          const toolUseId = `toolu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          sseEmit(controller, 'tool_use', { id: toolUseId, name: toolCall.tool, input: toolCall.args });

          const execResult = await executeTool(toolCall);
          toolExecutions.push({
            tool: toolCall.tool,
            args: toolCall.args,
            success: execResult.success,
          });

          sseEmit(controller, 'tool_result', {
            tool_use_id: toolUseId,
            tool: toolCall.tool,
            success: execResult.success,
            result: execResult.result.slice(0, 8000), // was 2000 — relaxed
          });

          history.push({ role: 'assistant', content: raw });
          history.push({ role: 'user', content: `Tool result: ${execResult.result}` });
          finalText = raw;
        }

        sessions.size; // touch for sweep
        saveSession(sid, history);

        // Persist the assistant's response to SQLite (best-effort)
        if (convoId && finalText) {
          try {
            const exists = await db.conversation.findUnique({ where: { id: convoId } });
            if (exists) {
              await db.message.create({
                data: {
                  conversationId: convoId,
                  role: 'assistant',
                  content: finalText,
                  toolExecutions: JSON.stringify(toolExecutions),
                  sessionId: sid,
                },
              });
              // Auto-title from the first user message if still default
              if (exists.title === 'New Chat') {
                await db.conversation.update({
                  where: { id: convoId },
                  data: {
                    title: message.slice(0, 40) + (message.length > 40 ? '…' : ''),
                    updatedAt: new Date(),
                  },
                });
              } else {
                await db.conversation.update({ where: { id: convoId }, data: { updatedAt: new Date() } });
              }
            }
          } catch {
            // ignore DB errors
          }
        }

        sseEmit(controller, 'done', {
          sessionId: sid,
          conversationId: convoId || sid,
          messageCount: history.length - 1,
          model: model || 'default',
          toolExecutions,
        });
      } catch (e) {
        sseEmit(controller, 'error', { message: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    },
    // Client disconnected (closed tab, clicked Stop) → abort upstream SDK call
    // so we stop consuming tokens that nobody will read.
    cancel() {
      upstreamAbort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function GET() {
  return new Response(JSON.stringify({ models: AI_MODELS }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
