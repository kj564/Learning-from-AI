/**
 * API: /api/snapgent — Snapgent status endpoint (server-side passthrough)
 *
 * The actual bridge WebSocket runs CLIENT-SIDE (browser → ws://127.0.0.1:17613).
 * This endpoint just returns a static "client-side" flag so the UI knows
 * bridge communication happens from the browser, not from the server.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    connected: false, // Server can't reach the bridge — it's on the user's machine
    clientSide: true,  // Client handles bridge via WebSocket directly
    bridgeUrl: 'ws://127.0.0.1:17613',
  });
}

export async function POST() {
  return NextResponse.json({
    error: 'Bridge communication is client-side only. Use snapgent-client.ts from the browser.',
    clientSide: true,
  });
}
