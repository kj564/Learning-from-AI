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
import { listWorkspaceFiles, uploadWorkspaceFile, writeWorkspaceFile, resolveWorkspacePath } from '@/lib/workspace';
import { sanitizeFilename, scanUploadedFile } from '@/lib/file-security';
import { checkUploadSize } from '@/lib/workspace-quotas';
import { db } from '@/lib/db';

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
      const rawPath = (formData.get('path') as string) || `input/${file?.name || 'upload'}`;
      if (!file) return NextResponse.json({ error: 'file field required' }, { status: 400 });
      // Sanitize the filename before joining into the workspace path.
      const safeName = sanitizeFilename(file.name || 'upload');
      const path = rawPath.endsWith(safeName) ? rawPath : `${rawPath.replace(/\/$/, '')}/${safeName}`;
      const bytes = Buffer.from(await file.arrayBuffer());

      // Check upload size quota (P1-1).
      const sizeCheck = checkUploadSize(bytes.length);
      if (!sizeCheck.ok) {
        return NextResponse.json({ error: sizeCheck.message, quota: sizeCheck.quota }, { status: 413 });
      }

      const res = await uploadWorkspaceFile(id, path, bytes, 'default');
      if (!res.ok) return NextResponse.json({ error: res.error, accessDecision: res.accessDecision }, { status: 400 });

      // Run the security scan (P1-2, P1-3). This sniffs magic bytes, checks the
      // blocklist, and moves executables / shell scripts to .quarantine/. The
      // WorkspaceFile row status transitions UPLOADED → SCANNING → READY | QUARANTINED.
      let scan: { ok: boolean; sniffedMime: string; quarantineReason?: string } | null = null;
      try {
        const wsRes = await resolveWorkspacePath(id, path, 'default', { followSymlinks: false });
        if (wsRes.ok) {
          // Find the WorkspaceFile row we just upserted.
          const wf = await db.workspaceFile.findUnique({ where: { workspaceId_path: { workspaceId: id, path } } });
          if (wf) {
            scan = await scanUploadedFile(wf.id, wsRes.absolutePath, safeName);
          }
        }
      } catch (e) {
        // Scan failure is non-fatal — the file is already on disk. Log and return.
        console.error('[upload] scan failed:', e instanceof Error ? e.message : String(e));
      }

      if (scan && !scan.ok) {
        return NextResponse.json({
          ok: false,
          quarantined: true,
          path,
          size: res.size,
          checksum: res.checksum,
          sniffedMime: scan.sniffedMime,
          quarantineReason: scan.quarantineReason,
          message: `File uploaded but quarantined: ${scan.quarantineReason}. The agent cannot read it until you review it.`,
        }, { status: 202 });
      }

      return NextResponse.json({
        ok: true, path: res.path, size: res.size, checksum: res.checksum,
        sniffedMime: scan?.sniffedMime ?? null,
      });
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
