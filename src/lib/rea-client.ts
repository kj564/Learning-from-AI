/**
 * REA MCP client — connects to REA's HTTP MCP server.
 *
 * REA (https://github.com/morluto/rea) runs as a Streamable HTTP MCP server:
 *   npx rea-agents mcp --http --port 9849
 *
 * Protocol:
 *   POST /mcp with Content-Type: application/json, Accept: application/json, text/event-stream
 *   First request: initialize → response includes Mcp-Session-Id header
 *   Subsequent requests: must include Mcp-Session-Id header
 *   Responses are SSE: event: message\ndata: {jsonrpc result}
 *
 * 263 tools for reverse engineering: binaries, native code, JavaScript, browser, Android, etc.
 */

'use client';

import { useState, useEffect, useRef } from 'react';

const REA_PORT = 9849;
const REA_URL = `http://127.0.0.1:${REA_PORT}/mcp`;
const REQUEST_TIMEOUT = 300000; // 5 min for analysis tools

let sessionId: string | null = null;
let initialized = false;
let nextId = 1;
let toolsCache: any[] = [];
let listeners: ((connected: boolean) => void)[] = [];
let toolsListeners: ((tools: any[]) => void)[] = [];
let connected = false;
let reconnectTimer: any = null;

function notify() { for (const fn of listeners) { try { fn(connected); } catch {} } }
function notifyTools() { for (const fn of toolsListeners) { try { fn(toolsCache); } catch {} } }

export function isReaConnected(): boolean { return connected; }

export function onReaStatus(fn: (connected: boolean) => void): () => void {
  listeners.push(fn); fn(connected);
  return () => { listeners = listeners.filter((f) => f !== fn); };
}

export function onReaTools(fn: (tools: any[]) => void): () => void {
  toolsListeners.push(fn); fn(toolsCache);
  return () => { toolsListeners = toolsListeners.filter((f) => f !== fn); };
}

export function getReaTools(): any[] { return toolsCache; }

async function reaRequest(method: string, params: Record<string, unknown> = {}): Promise<any> {
  const id = nextId++;
  const body = JSON.stringify({ jsonrpc: '2.0', id, method, params });
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
  };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const res = await fetch(REA_URL, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    // Capture session ID from initialize response
    const sid = res.headers.get('mcp-session-id');
    if (sid) sessionId = sid;

    const text = await res.text();

    // Parse SSE response (event: message\ndata: {...})
    for (const line of text.split('\n')) {
      if (line.startsWith('data:')) {
        const data = JSON.parse(line.slice(5).trim());
        if (data.error) throw new Error(data.error.message || 'REA error');
        return data.result || data;
      }
    }

    // Try plain JSON
    try {
      const data = JSON.parse(text);
      if (data.error) throw new Error(data.error.message || 'REA error');
      return data.result || data;
    } catch {
      throw new Error('Invalid REA response');
    }
  } catch (e) {
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function connectRea(): Promise<boolean> {
  if (connected && initialized) return true;

  try {
    // Initialize
    const result = await reaRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'zai-chat', version: '1.0' },
    });

    if (!result) throw new Error('No initialize response');

    // Send initialized notification
    await reaRequest('notifications/initialized', {});

    initialized = true;
    connected = true;
    notify();

    // List tools
    try {
      const toolsResult = await reaRequest('tools/list', {});
      toolsCache = toolsResult?.tools || [];
      notifyTools();
    } catch { /* */ }

    return true;
  } catch (e) {
    connected = false;
    initialized = false;
    sessionId = null;
    notify();
    return false;
  }
}

export function disconnectRea() {
  connected = false;
  initialized = false;
  sessionId = null;
  toolsCache = [];
  notify();
  notifyTools();
}

export async function listReaTools(): Promise<any[]> {
  if (!connected) return toolsCache;
  try {
    const result = await reaRequest('tools/list', {});
    toolsCache = result?.tools || toolsCache;
    notifyTools();
    return toolsCache;
  } catch {
    return toolsCache;
  }
}

export async function runReaTool(name: string, args: Record<string, unknown>): Promise<{ success: boolean; text?: string; error?: string }> {
  if (!connected) return { success: false, error: 'REA not connected' };
  try {
    const result = await reaRequest('tools/call', { name, arguments: args });
    // REA returns { content: [{ type: "text", text: "..." }] }
    const text = Array.isArray(result?.content)
      ? result.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n')
      : JSON.stringify(result);
    return { success: true, text };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function useReaStatus() {
  const [status, setStatus] = useState(connected);
  useEffect(() => {
    const unsub = onReaStatus(setStatus);
    // Auto-connect on mount
    if (!connected) connectRea();
    return unsub;
  }, []);
  return status;
}

export function useReaTools() {
  const [tools, setTools] = useState<any[]>(toolsCache);
  useEffect(() => {
    const unsub = onReaTools(setTools);
    return unsub;
  }, []);
  return tools;
}
