/**
 * API: /api/snapgent — Snapgent bridge proxy + status
 *
 * GET  ?action=status              → { connected, servers }
 * GET  ?action=tools&server=vscode → { tools: [...] }
 * POST { action:'run', server, name, args } → { success, result }
 * POST { action:'connect' }                   → { connected }
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectBridge, isBridgeConnected, pingBridge, listServers, listTools, runTool } from '@/lib/snapgent';

export async function GET(req: NextRequest) {
  const action = new URL(req.url).searchParams.get('action') || 'status';

  if (action === 'status') {
    const connected = isBridgeConnected();
    let servers: any[] = [];
    if (connected) {
      try { servers = await listServers(); } catch { /* */ }
    }
    return NextResponse.json({ connected, servers });
  }

  if (action === 'tools') {
    const server = new URL(req.url).searchParams.get('server') || 'vscode';
    const tools = await listTools(server);
    return NextResponse.json({ tools });
  }

  if (action === 'ping') {
    const ok = await pingBridge();
    return NextResponse.json({ connected: ok });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'connect') {
      const ok = await connectBridge();
      return NextResponse.json({ connected: ok });
    }

    if (action === 'run') {
      const { server, name, args } = body;
      if (!server || !name) return NextResponse.json({ error: 'server + name required' }, { status: 400 });
      const result = await runTool(server, name, args || {});
      return NextResponse.json(result);
    }

    if (action === 'list_tools') {
      const { server } = body;
      const tools = await listTools(server || 'vscode');
      return NextResponse.json({ tools });
    }

    if (action === 'list_servers') {
      const servers = await listServers();
      return NextResponse.json({ servers });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
