/**
 * API: /api/approvals/[id] — fetch one approval (UI reads the draft).
 *  GET  — return the draft args + status. Token is NOT returned here; the UI
 *         already has it from the create response.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApproval } from '@/lib/approval';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await getApproval(id);
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({
    id: row.id,
    toolName: row.toolName,
    toolUseId: row.toolUseId,
    args: JSON.parse(row.argsJson),
    status: row.status,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    parentApprovalId: row.parentApprovalId,
  });
}
