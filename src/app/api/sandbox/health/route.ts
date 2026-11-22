/**
 * API: /api/sandbox/health — proxy to the sandbox worker.
 *
 * The worker runs on port 3030 (separate process). The UI can't reach it
 * directly (same-origin policy + the gateway routing), so this route proxies
 * the worker's /health endpoint. Returns the isolation tier the worker is
 * running, the hard limits, and the count of jobs processed.
 */

import { NextResponse } from 'next/server';
import { pingSandboxWorker } from '@/lib/sandbox-client';

export async function GET() {
  const health = await pingSandboxWorker();
  return NextResponse.json(health);
}
