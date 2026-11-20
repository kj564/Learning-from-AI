/**
 * Snapgent bridge client — WebSocket connection to the local snapgent bridge
 * at ws://127.0.0.1:17613.
 *
 * The bridge routes commands to configured MCP servers (VS Code, FigCraft,
 * EffectCraft, Word). Each request is a JSON-RPC message; the bridge forwards
 * it to the selected MCP server and returns the result.
 *
 * Protocol (from bridge.py):
 *   → { "type": "run_tool", "server": "vscode", "name": "read_file", "arguments": { "path": "src/app.ts" } }
 *   ← { "type": "result", "id": <req_id>, "success": true, "result": { ... } }
 *
 *   → { "type": "list_tools", "server": "vscode" }
 *   ← { "type": "tools", "tools": [ { "name": "...", "description": "..." } ] }
 *
 *   → { "type": "ping" }
 *   ← { "type": "pong" }
 *
 *   → { "type": "list_mcp_servers" }
 *   ← { "type": "servers", "servers": [ { "id": "vscode", "title": "VS Code" } ] }
 */

export interface SnapgentTool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

export interface SnapgentServer {
  id: string;
  title?: string;
  connected: boolean;
}

export interface SnapgentResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

type PendingRequest = {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timer: ReturnType<typeof setTimeout>;
};

const BRIDGE_URL = 'ws://127.0.0.1:17613';
const REQUEST_TIMEOUT = 130000; // 130s (matches bridge's REQUEST_TIMEOUT_DEFAULT)
const RECONNECT_INTERVAL = 5000;

let ws: WebSocket | null = null;
let connected = false;
let connecting = false;
let nextId = 1;
const pending = new Map<number, PendingRequest>();
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let statusListeners: ((connected: boolean) => void)[] = [];

function notifyStatus() {
  for (const fn of statusListeners) {
    try { fn(connected); } catch { /* */ }
  }
}

/** Connect to the bridge (idempotent — safe to call when already connected). */
export async function connectBridge(): Promise<boolean> {
  if (connected || connecting) return connected;
  connecting = true;

  return new Promise((resolve) => {
    try {
      ws = new WebSocket(BRIDGE_URL);

      ws.onopen = () => {
        connected = true;
        connecting = false;
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
        console.log('[snapgent] Bridge connected');
        notifyStatus();
        resolve(true);
      };

      ws.onclose = () => {
        connected = false;
        connecting = false;
        ws = null;
        // Reject all pending requests
        for (const [id, req] of pending) {
          clearTimeout(req.timer);
          req.reject(new Error('Bridge disconnected'));
          pending.delete(id);
        }
        console.log('[snapgent] Bridge disconnected');
        notifyStatus();
        // Auto-reconnect
        if (!reconnectTimer) {
          reconnectTimer = setTimeout(() => { reconnectTimer = null; connectBridge(); }, RECONNECT_INTERVAL);
        }
        resolve(false);
      };

      ws.onerror = () => {
        // onclose will fire after this
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const id = msg.id;
          if (id && pending.has(id)) {
            const req = pending.get(id)!;
            clearTimeout(req.timer);
            pending.delete(id);
            if (msg.type === 'error' || msg.error) {
              req.reject(new Error(msg.error || msg.message || 'Bridge error'));
            } else {
              req.resolve(msg.result ?? msg);
            }
          }
        } catch {
          // Non-JSON or no id — ignore
        }
      };
    } catch (e) {
      connecting = false;
      resolve(false);
    }
  });
}

/** Disconnect from the bridge. */
export function disconnectBridge() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (ws) { ws.close(); ws = null; }
  connected = false;
  notifyStatus();
}

/** Check if the bridge is connected. */
export function isBridgeConnected(): boolean {
  return connected;
}

/** Subscribe to connection status changes. Returns an unsubscribe function. */
export function onBridgeStatus(fn: (connected: boolean) => void): () => void {
  statusListeners.push(fn);
  fn(connected); // immediately call with current state
  return () => { statusListeners = statusListeners.filter((f) => f !== fn); };
}

/** Send a request to the bridge and wait for the response. */
async function bridgeRequest(type: string, payload: Record<string, unknown> = {}): Promise<any> {
  if (!connected || !ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error('Bridge is not connected');
  }

  const id = nextId++;
  const message = JSON.stringify({ type, id, ...payload });

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Bridge request timed out'));
    }, REQUEST_TIMEOUT);

    pending.set(id, { resolve, reject, timer });

    try {
      ws!.send(message);
    } catch (e) {
      clearTimeout(timer);
      pending.delete(id);
      reject(new Error(`Failed to send to bridge: ${e instanceof Error ? e.message : String(e)}`));
    }
  });
}

/** Ping the bridge (fast — 6s timeout). */
export async function pingBridge(): Promise<boolean> {
  try {
    await bridgeRequest('ping', {});
    return true;
  } catch {
    return false;
  }
}

/** List available MCP servers. */
export async function listServers(): Promise<SnapgentServer[]> {
  try {
    const result = await bridgeRequest('list_mcp_servers', {});
    if (Array.isArray(result)) return result as SnapgentServer[];
    if (result?.servers) return result.servers as SnapgentServer[];
    return [];
  } catch {
    return [];
  }
}

/** List tools for a specific MCP server. */
export async function listTools(server: string): Promise<SnapgentTool[]> {
  try {
    const result = await bridgeRequest('list_tools', { server });
    if (Array.isArray(result)) return result as SnapgentTool[];
    if (result?.tools) return result.tools as SnapgentTool[];
    return [];
  } catch {
    return [];
  }
}

/** Execute a tool on a specific MCP server. */
export async function runTool(server: string, name: string, args: Record<string, unknown>): Promise<SnapgentResult> {
  try {
    const result = await bridgeRequest('run_tool', { server, name, arguments: args });
    if (result && typeof result === 'object' && 'success' in result) {
      return result as SnapgentResult;
    }
    return { success: true, result };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Auto-connect on module load (best-effort, non-blocking)
if (typeof window !== 'undefined') {
  connectBridge();
}
