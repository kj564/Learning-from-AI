/**
 * API: /api/approvals/[id]/reject
 *  POST { token } — user rejects the draft. Marks REJECTED. Token consumed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { rejectWithToken } from '@/lib/approval';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 });

  const decision = await rejectWithToken(id, token);
  if (!decision.ok) {
    return NextResponse.json({ error: decision.error, message: decision.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, status: 'REJECTED', approvalId: id });
}
