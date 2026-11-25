/**
 * API: /api/v1/documents/[id]/cover — render the first page of a PDF as PNG.
 *
 * Note cards in pelajarin show the actual document cover as the card thumbnail.
 * We render page 1 via pdftoppm (poppler) and cache it under db/assets/.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureDevUser } from '@/lib/learning';
import { db } from '@/lib/db';
import { existsSync, mkdirSync, promises as fsp } from 'fs';
import path from 'path';
import { execFile } from 'child_process';

const STORAGE_ROOT = process.env.WORKSPACE_STORAGE_ROOT || '/home/z/agent-workspaces';
const ASSETS_DIR = path.join(process.cwd(), 'db', 'assets');

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

  const cachePath = path.join(ASSETS_DIR, `cover-${doc.id}.png`);
  if (!existsSync(cachePath)) {
    if (!doc.contentType.includes('pdf')) {
      return NextResponse.json({ error: { code: 'NOT_PDF', message: 'Cover only available for PDF documents' } }, { status: 415 });
    }
    const safeKey = doc.storageKey.replace(/\.\./g, '');
    const fullPath = path.join(STORAGE_ROOT, safeKey);
    if (!existsSync(fullPath)) {
      return NextResponse.json({ error: { code: 'FILE_MISSING', message: 'File not found on disk' } }, { status: 404 });
    }
    if (!existsSync(ASSETS_DIR)) mkdirSync(ASSETS_DIR, { recursive: true });
    await new Promise<void>((resolve, reject) => {
      execFile('pdftoppm', ['-png', '-r', '72', '-f', '1', '-l', '1', '-singlefile', fullPath, cachePath.replace(/\.png$/, '')], (err) => {
        if (err) reject(err); else resolve();
      });
    }).catch(() => {});
    if (!existsSync(cachePath)) {
      return NextResponse.json({ error: { code: 'RENDER_FAILED', message: 'Could not render PDF cover' } }, { status: 500 });
    }
  }

  const png = await fsp.readFile(cachePath);
  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(png.length),
      'Cache-Control': 'private, max-age=86400',
    },
  });
}
