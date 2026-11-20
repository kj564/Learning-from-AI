/**
 * Snapgent bridge client — CLIENT-SIDE ONLY (browser connects to user's bridge).
 *
 * Protocol (from bridge.py — EXACT match):
 *   → { "type": "ping", "id": N }
 *   ← { "type": "pong", "id": N }
 *
 *   → { "type": "call_tool", "id": N, "name": "read_file", "arguments": { "path": "..." }, "server": "vscode" }
 *   ← { "type": "tool_result", "id": N, "ok": true, "text": "...", "images": [...] }
 *   ← { "type": "tool_result", "id": N, "ok": false, "error": "..." }
 *
 *   → { "type": "list_tools", "id": N }
 *   ← { "type": "tools", "id": N, "tools": [...], "servers": [...] }
 *
 *   On connect, bridge sends: { "type": "connected", "bridge_version": "...", "mcp_alive": bool, "tools": [...], "servers": [...] }
 */

'use client';

import { useState, useEffect } from 'react';

const BRIDGE_URL = 'ws://127.0.0.1:17613';
const REQUEST_TIMEOUT = 130000;

let ws: WebSocket | null = null;
let connected = false;
let bridgeReady = false; // true after "connected" message from bridge
let nextId = 1;
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void; timer: any }>();
let listeners: ((connected: boolean) => void)[] = [];
let reconnectTimer: any = null;

function notify() {
  for (const fn of listeners) { try { fn(connected); } catch {} }
}

export function connectBridge(): Promise<boolean> {
  return new Promise((resolve) => {
    if (connected && ws && ws.readyState === WebSocket.OPEN) { resolve(true); return; }
    if (ws) { try { ws.close(); } catch {} }
    try { ws = new WebSocket(BRIDGE_URL); } catch { resolve(false); return; }
    const timeout = setTimeout(() => { if (!connected) resolve(false); }, 3000);

    ws.onopen = () => { clearTimeout(timeout); connected = true; if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; } notify(); resolve(true); };
    ws.onclose = () => {
      clearTimeout(timeout); connected = false; bridgeReady = false; ws = null;
      for (const [id, req] of pending) { clearTimeout(req.timer); req.reject(new Error('disconnected')); pending.delete(id); }
      notify();
      if (!reconnectTimer) reconnectTimer = setTimeout(() => { reconnectTimer = null; connectBridge(); }, 5000);
      if (!connected) resolve(false);
    };
    ws.onerror = () => {};
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        // Handle "connected" message (bridge sends on connect)
        if (msg.type === 'connected') { bridgeReady = true; return; }
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

export function onBridgeStatus(fn: (connected: boolean) => void): () => void {
  listeners.push(fn); fn(isBridgeConnected());
  return () => { listeners = listeners.filter((f) => f !== fn); };
}

async function bridgeRequest(type: string, payload: Record<string, unknown> = {}): Promise<any> {
  if (!connected || !ws || ws.readyState !== WebSocket.OPEN) throw new Error('Bridge not connected');
  const id = nextId++;
  const msg = JSON.stringify({ type, id, ...payload });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('timeout')); }, REQUEST_TIMEOUT);
    pending.set(id, { resolve, reject, timer });
    try { ws!.send(msg); } catch (e) { clearTimeout(timer); pending.delete(id); reject(e); }
  });
}

export async function pingBridge(): Promise<boolean> {
  try { await bridgeRequest('ping'); return true; } catch { return false; }
}

export async function listServers(): Promise<any[]> {
  try {
    const r = await bridgeRequest('list_tools');
    return r.servers || [];
  } catch { return []; }
}

export async function listTools(server: string): Promise<any[]> {
  try {
    const r = await bridgeRequest('list_tools');
    return r.tools || [];
  } catch { return []; }
}

/** Execute a tool. Returns { success, text, images } matching bridge protocol. */
export async function runTool(server: string, name: string, args: Record<string, unknown>): Promise<{ success: boolean; text?: string; images?: any[]; error?: string }> {
  try {
    const r = await bridgeRequest('call_tool', { name, arguments: args, server });
    // Bridge returns: { type: "tool_result", id, ok: true/false, text, images, error }
    return {
      success: r.ok !== false,
      text: r.text,
      images: r.images,
      error: r.error,
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

export function useAutoConnectBridge() {
  useEffect(() => {
    connectBridge();
    return () => {};
  }, []);
}

export { extractSnapgentCommand } from './snapgent-prompt';
