/**
 * API: /api/v1/documents/[id]/file — serve the raw stored file.
 *
 * Used by the Sumber (Sources) tab PDF iframe viewer, exactly like pelajarin:
 * GET /api/v1/documents/<id>/file → streams the file inline
 * (content-disposition: inline, content-type from the document record).
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureDevUser } from '@/lib/learning';
import { db } from '@/lib/db';
import { createReadStream, existsSync, statSync } from 'fs';
import path from 'path';
import { Readable } from 'stream';

const STORAGE_ROOT = process.env.WORKSPACE_STORAGE_ROOT || '/home/z/agent-workspaces';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await ensureDevUser(req);
  const { id } = await params;

  const doc = await db.studyDocument.findUnique({ where: { id } });
  if (!doc) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Document not found' } }, { status: 404 });
  }
  if (doc.userId !== user.id) {
    return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'You do not have access to this document' } }, { status: 403 });
  }

  const safeKey = doc.storageKey.replace(/\.\./g, '');
  const fullPath = path.join(STORAGE_ROOT, safeKey);
  if (!existsSync(fullPath)) {
    return NextResponse.json({ error: { code: 'FILE_MISSING', message: 'File not found on disk' } }, { status: 404 });
  }

  const stat = statSync(fullPath);
  // Node read stream → web stream → Response body
  const nodeStream = createReadStream(fullPath);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

  return new NextResponse(webStream as any, {
    status: 200,
    headers: {
      'Content-Type': doc.contentType || 'application/octet-stream',
      'Content-Length': String(stat.size),
      'Content-Disposition': `inline; filename="${encodeURIComponent(doc.filename)}"`,
      'Cache-Control': 'private, max-age=300',
    },
  });
}
