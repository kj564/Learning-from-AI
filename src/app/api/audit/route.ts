/**
 * API: /api/audit
 *
 *  GET ?conversationId=...&tool=...&status=...&limit=...&since=...
 *    — query the ToolCallAudit log for observability.
 *
 * Powers the audit log viewer (and the future evaluator agent). No auth in this
 * single-user sandbox; a production deployment gates this behind an admin role.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const conversationId = url.searchParams.get('conversationId');
  const tool = url.searchParams.get('tool');
  const status = url.searchParams.get('status');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 500);
  const sinceParam = url.searchParams.get('since');
  const since = sinceParam ? new Date(sinceParam) : undefined;

  const where: any = {};
  if (conversationId) where.conversationId = conversationId;
  if (tool) where.toolName = tool;
  if (status) where.status = status;
  if (since) where.createdAt = { gt: since };

  const rows = await db.toolCallAudit.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const summary = {
    total: rows.length,
    success: rows.filter((r) => r.status === 'success').length,
    failure: rows.filter((r) => r.status === 'failure').length,
    denied: rows.filter((r) => r.status === 'denied').length,
    invalid: rows.filter((r) => r.status === 'invalid').length,
    pending: rows.filter((r) => r.status === 'pending').length,
    totalDurationMs: rows.reduce((a, r) => a + r.durationMs, 0),
    totalRetries: rows.reduce((a, r) => a + r.retries, 0),
    truncated: rows.filter((r) => r.resultTruncated).length,
    byTool: countBy(rows, 'toolName'),
  };

  return NextResponse.json({
    summary,
    audits: rows.map((r) => ({
      id: r.id,
      conversationId: r.conversationId,
      sessionId: r.sessionId,
      toolName: r.toolName,
      args: safeParse(r.argsJson),
      status: r.status,
      durationMs: r.durationMs,
      retries: r.retries,
      errorMessage: r.errorMessage,
      resultTruncated: r.resultTruncated,
      resultBytes: r.resultBytes,
      approvalId: r.approvalId,
      validationError: r.validationError ? safeParse(r.validationError) : null,
      createdAt: r.createdAt,
    })),
  });
}

function countBy(rows: any[], key: string): Record<string, number> {
  const m: Record<string, number> = {};
  for (const r of rows) m[r[key]] = (m[r[key]] || 0) + 1;
  return m;
}

function safeParse(s: string): any {
  try { return JSON.parse(s); } catch { return s; }
}
