/**
 * API: /api/workspaces/[id]
 *
 *  GET    — fetch one workspace (without rootPath).
 *  DELETE — delete the workspace and its on-disk files.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspace } from '@/lib/workspace';
import { db } from '@/lib/db';
import { rm } from 'fs/promises';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ws = await getWorkspace(id, 'default');
  if (!ws) return NextResponse.json({ error: 'not found or cross-user access denied' }, { status: 404 });
  return NextResponse.json({
    id: ws.id,
    userId: ws.userId,
    projectId: ws.projectId,
    name: ws.name,
    createdAt: ws.createdAt,
    updatedAt: ws.updatedAt,
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ws = await getWorkspace(id, 'default');
  if (!ws) return NextResponse.json({ error: 'not found or cross-user access denied' }, { status: 404 });
  try {
    // Delete files on disk (best-effort) then the DB rows.
    await rm(ws.rootPath, { recursive: true, force: true }).catch(() => {});
    await db.workspaceFile.deleteMany({ where: { workspaceId: id } });
    await db.workspace.delete({ where: { id } });
    return NextResponse.json({ ok: true, deleted: id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
