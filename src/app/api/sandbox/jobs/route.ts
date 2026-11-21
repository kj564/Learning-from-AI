/**
 * API: /api/sandbox/jobs — list recent SandboxJob rows.
 *
 *  GET ?workspaceId=...&status=...&limit=...
 *    — query the SandboxJob table for the sandbox dashboard.
 *
 * Returns each job's id, status, isolationTier, toolName, args (parsed),
 * stdout, stderr, exitCode, errorMessage, timing, and limits.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const workspaceId = url.searchParams.get('workspaceId');
  const status = url.searchParams.get('status');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);

  const where: any = {};
  if (workspaceId) where.workspaceId = workspaceId;
  if (status) where.status = status;

  const jobs = await db.sandboxJob.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return NextResponse.json({
    summary: {
      total: jobs.length,
      queued: jobs.filter((j) => j.status === 'QUEUED').length,
      running: jobs.filter((j) => j.status === 'RUNNING').length,
      completed: jobs.filter((j) => j.status === 'COMPLETED').length,
      failed: jobs.filter((j) => j.status === 'FAILED').length,
      timeout: jobs.filter((j) => j.status === 'TIMEOUT').length,
      cancelled: jobs.filter((j) => j.status === 'CANCELLED').length,
      byTier: countBy(jobs, 'isolationTier'),
    },
    jobs: jobs.map((j) => ({
      id: j.id,
      workspaceId: j.workspaceId,
      conversationId: j.conversationId,
      toolName: j.toolName,
      args: safeParse(j.argsJson),
      status: j.status,
      isolationTier: j.isolationTier,
      stdout: j.stdout,
      stderr: j.stderr,
      exitCode: j.exitCode,
      errorMessage: j.errorMessage,
      startedAt: j.startedAt,
      finishedAt: j.finishedAt,
      limits: safeParse(j.limitsJson),
      createdAt: j.createdAt,
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
