/**
 * API: /api/approvals/[id]/edit
 *  POST { token, args } — user edits the draft before approving. Creates a NEW
 *  ApprovalRequest with parentApprovalId=this, marks this one SUPERSEDED (old
 *  token invalidated). Returns the new approvalId + plaintext token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { editApproval } from '@/lib/approval';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { token, args } = await req.json();
  if (!token || !args) return NextResponse.json({ error: 'token + args required' }, { status: 400 });

  const result = await editApproval(id, token, args);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    approvalId: result.approvalId,
    token: result.token,
    status: result.status,
    expiresAt: result.expiresAt,
    parentApprovalId: id,
  });
}
