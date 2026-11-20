/**
 * Snapgent bridge client — CLIENT-SIDE ONLY (browser connects to user's bridge).
 *
 * Protocol (EXACT from bridge.py):
 *   → { "type": "ping", "id": N }
 *   ← { "type": "pong", "id": N }
 *
 *   → { "type": "list_tools", "id": N }
 *   ← { "type": "tools", "id": N, "tools": [...], "servers": [...], "bridge_version": "...", "mcp_alive": true }
 *
 *   → { "type": "call_tool", "id": N, "name": "read_file", "arguments": {"path":"..."}, "server": "vscode", "timeout": 120000 }
 *   ← { "type": "tool_result", "id": N, "ok": true, "text": "...", "images": [...] }
 *   ← { "type": "tool_result", "id": N, "ok": false, "kind": "timeout"|"tool_error"|"unknown_tool", "error": "..." }
 *
 *   On connect, bridge sends: { "type": "connected", "bridge_version": "...", "mcp_alive": true, "tools": [...], "servers": [...] }
 *   On server health change, bridge broadcasts same "connected" message to all clients.
 */

'use client';

import { useState, useEffect } from 'react';

const BRIDGE_URL = 'ws://127.0.0.1:17613';
const REQUEST_TIMEOUT = 130000;
const FAST_TIMEOUT = 6000;
const RECONNECT_INTERVAL = 5000;

// Fast probe types (bypass long timeout)
const FAST_TYPES = new Set(['ping', 'list_tools', 'list_mcp_servers', 'get_servers']);

let ws: WebSocket | null = null;
let connected = false;
let bridgeReady = false;
let nextId = 1;
let toolsCache: any[] = [];
let serversCache: any[] = [];
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void; timer: any; fast: boolean }>();
let listeners: ((connected: boolean) => void)[] = [];
let toolsListeners: ((tools: any[], servers: any[]) => void)[] = [];
let reconnectTimer: any = null;

function notify() {
  for (const fn of listeners) { try { fn(connected && bridgeReady); } catch {} }
}
function notifyTools() {
  for (const fn of toolsListeners) { try { fn(toolsCache, serversCache); } catch {} }
}

export function connectBridge(): Promise<boolean> {
  return new Promise((resolve) => {
    if (connected && ws && ws.readyState === WebSocket.OPEN) { resolve(true); return; }
    if (ws) { try { ws.close(); } catch {} }
    try { ws = new WebSocket(BRIDGE_URL); } catch { resolve(false); return; }
    const timeout = setTimeout(() => { if (!connected) resolve(false); }, 3000);

    ws.onopen = () => {
      clearTimeout(timeout);
      connected = true;
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      notify();
      resolve(true);
    };

    ws.onclose = () => {
      clearTimeout(timeout);
      connected = false; bridgeReady = false; ws = null;
      for (const [id, req] of pending) { clearTimeout(req.timer); req.reject(new Error('disconnected')); pending.delete(id); }
      notify();
      if (!reconnectTimer) reconnectTimer = setTimeout(() => { reconnectTimer = null; connectBridge(); }, RECONNECT_INTERVAL);
      if (!connected) resolve(false);
    };

    ws.onerror = () => {};

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        // Handle "connected" message (bridge sends on connect + on server health change)
        if (msg.type === 'connected') {
          bridgeReady = true;
          toolsCache = msg.tools || [];
          serversCache = msg.servers || [];
          notify();
          notifyTools();
          return;
        }
        // Handle response to our request
        const id = msg.id;
        if (id && pending.has(id)) {
          const req = pending.get(id)!;
          clearTimeout(req.timer);
          pending.delete(id);
          if (msg.ok === false || msg.type === 'error') {
            req.reject(new Error(msg.error || msg.text || 'Bridge error'));
          } else {
            req.resolve(msg);
          }
        }
      } catch {}
    };
  });
}

export function disconnectBridge() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (ws) { try { ws.close(); } catch {} ws = null; }
  connected = false; bridgeReady = false; notify();
}

export function isBridgeConnected(): boolean { return connected && bridgeReady; }
export function getToolsCache(): any[] { return toolsCache; }
export function getServersCache(): any[] { return serversCache; }

export function onBridgeStatus(fn: (connected: boolean) => void): () => void {
  listeners.push(fn); fn(isBridgeConnected());
  return () => { listeners = listeners.filter((f) => f !== fn); };
}

export function onToolsUpdate(fn: (tools: any[], servers: any[]) => void): () => void {
  toolsListeners.push(fn); fn(toolsCache, serversCache);
  return () => { toolsListeners = toolsListeners.filter((f) => f !== fn); };
}

async function bridgeRequest(type: string, payload: Record<string, unknown> = {}): Promise<any> {
  if (!connected || !ws || ws.readyState !== WebSocket.OPEN) throw new Error('Bridge not connected');
  const id = nextId++;
  const msg = JSON.stringify({ type, id, ...payload });
  const fast = FAST_TYPES.has(type);
  const timeoutMs = fast ? FAST_TIMEOUT : (payload.timeout as number || REQUEST_TIMEOUT);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('timeout')); }, timeoutMs);
    pending.set(id, { resolve, reject, timer, fast });
    try { ws!.send(msg); } catch (e) { clearTimeout(timer); pending.delete(id); reject(e); }
  });
}

export async function pingBridge(): Promise<boolean> {
  try { await bridgeRequest('ping'); return true; } catch { return false; }
}

export async function listServers(): Promise<any[]> {
  try {
    const r = await bridgeRequest('list_tools');
    return r.servers || serversCache || [];
  } catch { return serversCache || []; }
}

export async function listTools(): Promise<any[]> {
  try {
    const r = await bridgeRequest('list_tools');
    return r.tools || toolsCache || [];
  } catch { return toolsCache || []; }
}

export async function runTool(server: string, name: string, args: Record<string, unknown>): Promise<{ success: boolean; text?: string; images?: any[]; error?: string; kind?: string }> {
  try {
    const r = await bridgeRequest('call_tool', { name, arguments: args, server, timeout: 120000 });
    return {
      success: r.ok !== false,
      text: r.text,
      images: r.images,
      error: r.error,
      kind: r.kind,
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function useBridgeStatus() {
  const [status, setStatus] = useState(isBridgeConnected());
  useEffect(() => {
    const unsub = onBridgeStatus(setStatus);
    return unsub;
  }, []);
  return status;
}

export function useBridgeTools() {
  const [data, setData] = useState<{ tools: any[]; servers: any[] }>({ tools: toolsCache, servers: serversCache });
  useEffect(() => {
    const unsub = onToolsUpdate((tools, servers) => setData({ tools, servers }));
    return unsub;
  }, []);
  return data;
}

export function useAutoConnectBridge() {
  useEffect(() => {
    connectBridge();
    return () => {};
  }, []);
}

export { extractSnapgentCommand, stripSnapgentCommand, hasCommandSignature, toolCategory, formatListCommands, buildSnapgentPrompt, SNAPGENT_TOOLS } from './snapgent-prompt';
