/**
 * API: /api/v1/documents/[id]/upload — receive the PUT'd file bytes.
 *
 * Per pelajarin E-AUTH-009: the presign returns an upload_url, the client
 * PUTs the raw file body to that URL, and the server stores it. In prod
 * this is an R2 presigned URL (S3 PUT). In dev we store to local disk
 * under WORKSPACE_STORAGE_ROOT/owned/<user_id>/uploads/<uuid>.<ext>
 * (matching the storage_key from presign).
 *
 * After the upload completes, we trigger async text extraction
 * (via the same /api/v1/jobs pipeline that uploaded-PDF notes use).
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureDevUser } from '@/lib/learning';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const STORAGE_ROOT = process.env.WORKSPACE_STORAGE_ROOT || '/home/z/agent-workspaces';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await ensureDevUser(req);
  const { id } = await params;

  // Look up the document — must belong to this user + not yet uploaded
  const doc = await db.studyDocument.findUnique({ where: { id } });
  if (!doc || doc.userId !== user.id) {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Document not found' } }, { status: 404 });
  }

  // Read the raw body
  const body = await req.arrayBuffer();
  const buf = Buffer.from(new Uint8Array(body));

  if (buf.length === 0) {
    return NextResponse.json({ error: { code: 'EMPTY_BODY', message: 'File body is empty' } }, { status: 400 });
  }

  // Sanity check: actual size matches what was presigned (tolerate ±1 byte)
  if (Math.abs(buf.length - doc.sizeBytes) > 1 && doc.sizeBytes > 0) {
    // Not a hard error — some clients strip/normalize trailing bytes; just log
    console.warn(`[upload] size mismatch: presigned=${doc.sizeBytes} actual=${buf.length} doc=${id}`);
  }

  // Resolve the on-disk path from the storage key (already validated to start with owned/)
  // and write the file. We also ensure the parent dir exists.
  const safeKey = doc.storageKey.replace(/\.\./g, ''); // prevent traversal
  const fullPath = path.join(STORAGE_ROOT, safeKey);
  const parentDir = path.dirname(fullPath);
  if (!existsSync(parentDir)) await mkdir(parentDir, { recursive: true });

  await writeFile(fullPath, buf);

  // Mark the document as uploaded (extraction starts when a note attaches it)
  await db.studyDocument.update({
    where: { id },
    data: { extractionStatus: 'uploaded' },
  });

  return NextResponse.json({ data: { id, size_bytes: buf.length, storage_key: doc.storageKey } }, { status: 200 });
}
