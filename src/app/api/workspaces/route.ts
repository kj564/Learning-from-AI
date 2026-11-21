/**
 * API: /api/workspaces
 *
 *  GET  — list workspaces for the current user (default user in single-user sandbox).
 *  POST — create a new workspace. Auto-creates default folders on disk.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createWorkspace, listWorkspaces } from '@/lib/workspace';

export async function GET() {
  const workspaces = await listWorkspaces('default');
  return NextResponse.json({
    workspaces: workspaces.map((w) => ({
      id: w.id,
      userId: w.userId,
      projectId: w.projectId,
      name: w.name,
      // Do NOT return rootPath — the model/UI never needs it.
      fileCount: (w as any)._count?.files ?? 0,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { name, projectId, userId } = body as { name?: string; projectId?: string; userId?: string };
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  try {
    const ws = await createWorkspace({ name, projectId: projectId ?? null, userId: userId || 'default' });
    return NextResponse.json({
      id: ws.id,
      userId: ws.userId,
      projectId: ws.projectId,
      name: ws.name,
      createdAt: ws.createdAt,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
