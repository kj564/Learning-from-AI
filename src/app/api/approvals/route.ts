/**
 * API: /api/approvals
 *
 *  GET  ?conversationId=...  — list PENDING approvals for a conversation (UI poll).
 *  POST { toolName, toolUseId, args, conversationId } — create a new approval
 *       (internal: called by /api/tools when a dangerous tool needs approval).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApproval, getPendingApprovals } from '@/lib/approval';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const conversationId = url.searchParams.get('conversationId');
  const rows = await getPendingApprovals(conversationId);
  // Don't leak token hashes; only return draft + id + status + expiry.
  return NextResponse.json({
    approvals: rows.map((r) => ({
      id: r.id,
      toolName: r.toolName,
      toolUseId: r.toolUseId,
      args: JSON.parse(r.argsJson),
      status: r.status,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { toolName, toolUseId, args, conversationId, ttlMs } = body as {
    toolName: string;
    toolUseId?: string;
    args: Record<string, unknown>;
    conversationId?: string;
    ttlMs?: number;
  };
  if (!toolName || !args) {
    return NextResponse.json({ error: 'toolName + args required' }, { status: 400 });
  }
  try {
    const result = await createApproval({
      toolName,
      toolUseId: toolUseId ?? null,
      args,
      conversationId: conversationId ?? null,
      ttlMs,
    });
    return NextResponse.json({
      approvalId: result.approvalId,
      token: result.token, // plaintext — UI must keep this; backend stores only the hash
      status: result.status,
      expiresAt: result.expiresAt,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
