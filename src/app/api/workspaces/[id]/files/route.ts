/**
 * API: /api/workspaces/[id]/files
 *
 *  GET   ?path=documents  — list files/folders under a relative path in the workspace.
 *  POST  multipart: file=<upload>, path=input/filename.pdf
 *        OR JSON: { path, content } (text upload) — store a file in the workspace.
 *
 * The model can't send file bytes directly — uploads come from the UI. The model
 * then reads the uploaded file via `read_file` with the returned relative path.
 */

import { NextRequest, NextResponse } from 'next/server';
import { listWorkspaceFiles, uploadWorkspaceFile, writeWorkspaceFile } from '@/lib/workspace';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const dir = url.searchParams.get('path') || '.';
  const res = await listWorkspaceFiles(id, dir, 'default');
  if (!res.ok) {
    return NextResponse.json({ error: res.error, accessDecision: res.accessDecision }, { status: 400 });
  }
  return NextResponse.json({ workspaceId: id, path: dir, entries: res.entries });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const contentType = req.headers.get('content-type') || '';

  try {
    if (contentType.includes('multipart/form-data')) {
      // Binary upload from the UI.
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const path = (formData.get('path') as string) || `input/${file?.name || 'upload'}`;
      if (!file) return NextResponse.json({ error: 'file field required' }, { status: 400 });
      const bytes = Buffer.from(await file.arrayBuffer());
      const res = await uploadWorkspaceFile(id, path, bytes, 'default');
      if (!res.ok) return NextResponse.json({ error: res.error, accessDecision: res.accessDecision }, { status: 400 });
      return NextResponse.json({ ok: true, path: res.path, size: res.size, checksum: res.checksum });
    } else {
      // Text upload (JSON body with path + content).
      const body = await req.json();
      const { path, content } = body as { path: string; content: string };
      if (!path || content === undefined) {
        return NextResponse.json({ error: 'path + content required' }, { status: 400 });
      }
      const res = await writeWorkspaceFile(id, path, content, 'default');
      if (!res.ok) return NextResponse.json({ error: res.error, accessDecision: res.accessDecision }, { status: 400 });
      return NextResponse.json({ ok: true, path: res.path, size: res.size });
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
