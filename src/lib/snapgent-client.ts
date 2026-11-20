/**
 * Snapgent bridge client — CLIENT-SIDE ONLY (runs in browser).
 *
 * The browser connects directly to ws://127.0.0.1:17613 on the USER's machine.
 * The server (cloud) cannot reach the user's local bridge, so all bridge
 * communication must happen from the browser.
 *
 * Flow:
 *   1. Browser opens WebSocket to ws://127.0.0.1:17613
 *   2. If connected → snapgent mode is available
 *   3. Client detects snapgent commands in AI streamed text
 *   4. Client executes commands via bridge
 *   5. Client sends results back as new chat messages
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const BRIDGE_URL = 'ws://127.0.0.1:17613';
const REQUEST_TIMEOUT = 130000;

let ws: WebSocket | null = null;
let connected = false;
let nextId = 1;
const pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void; timer: any }>();
let listeners: ((connected: boolean) => void)[] = [];
let reconnectTimer: any = null;

function notify() {
  for (const fn of listeners) { try { fn(connected); } catch {} }
}

/** Connect to the bridge (browser → ws://127.0.0.1:17613 on user's machine). */
export function connectBridge(): Promise<boolean> {
  return new Promise((resolve) => {
    if (connected && ws && ws.readyState === WebSocket.OPEN) { resolve(true); return; }
    if (ws) { try { ws.close(); } catch {} }

    try {
      ws = new WebSocket(BRIDGE_URL);
    } catch {
      resolve(false);
      return;
    }

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
      connected = false;
      ws = null;
      for (const [id, req] of pending) { clearTimeout(req.timer); req.reject(new Error('disconnected')); pending.delete(id); }
      notify();
      if (!reconnectTimer) reconnectTimer = setTimeout(() => { reconnectTimer = null; connectBridge(); }, 5000);
      if (!connected) resolve(false);
    };

    ws.onerror = () => {};

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        const id = msg.id;
        if (id && pending.has(id)) {
          const req = pending.get(id)!;
          clearTimeout(req.timer);
          pending.delete(id);
          if (msg.type === 'error' || msg.error) req.reject(new Error(msg.error || 'error'));
          else req.resolve(msg.result ?? msg);
        }
      } catch {}
    };
  });
}

export function disconnectBridge() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (ws) { try { ws.close(); } catch {} ws = null; }
  connected = false;
  notify();
}

export function isBridgeConnected(): boolean {
  return connected;
}

export function onBridgeStatus(fn: (connected: boolean) => void): () => void {
  listeners.push(fn);
  fn(connected);
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
  try { const r = await bridgeRequest('list_mcp_servers'); return Array.isArray(r) ? r : (r?.servers || []); } catch { return []; }
}

export async function listTools(server: string): Promise<any[]> {
  try { const r = await bridgeRequest('list_tools', { server }); return Array.isArray(r) ? r : (r?.tools || []); } catch { return []; }
}

export async function runTool(server: string, name: string, args: Record<string, unknown>): Promise<{ success: boolean; result?: any; error?: string }> {
  try {
    const r = await bridgeRequest('run_tool', { server, name, arguments: args });
    if (r && typeof r === 'object' && 'success' in r) return r;
    return { success: true, result: r };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** React hook for bridge status. */
export function useBridgeStatus() {
  const [status, setStatus] = useState(connected);
  useEffect(() => {
    const unsub = onBridgeStatus(setStatus);
    return unsub;
  }, []);
  return status;
}

/** Auto-connect on first client render. */
export function useAutoConnectBridge() {
  useEffect(() => {
    connectBridge();
    return () => { /* don't disconnect on unmount — keep for app lifetime */ };
  }, []);
}

/** Extract snapgent command from AI text (re-exported from snapgent-prompt). */
export { extractSnapgentCommand } from './snapgent-prompt';
