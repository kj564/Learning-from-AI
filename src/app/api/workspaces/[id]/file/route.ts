/**
 * API: /api/workspaces/[id]/file
 *
 *  GET ?path=documents/report.md&format=json
 *    — read a single file's content + metadata for the UI preview pane.
 *      Returns JSON: { content, isBinary, mimeType, sniffedMimeType, size,
 *      status, quarantineReason, modified }.
 *      For binary files (images, PDFs), content is empty and isBinary=true;
 *      the UI then fetches ?format=raw for the bytes with the right Content-Type.
 *
 *  GET ?path=...&format=raw
 *    — return the raw file bytes with Content-Type from sniffed MIME. Used to
 *      embed images / PDFs in the preview pane without a separate fetch.
 *
 * The model can't reach this route (it goes through /api/tools → read_file).
 * This is a UI-only convenience endpoint that reads via the same workspace
 * resolver + file-security lifecycle gate as the tool executor.
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolveWorkspacePath } from '@/lib/workspace';
import { sniffMimeType, isFileReadable } from '@/lib/file-security';
import { readFile, stat } from 'fs/promises';
import path from 'path';

const BINARY_MIMES = /^(image\/|application\/pdf|application\/zip|application\/gzip|application\/x-)/;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const filePath = url.searchParams.get('path');
  const format = url.searchParams.get('format') || 'json';

  if (!filePath) {
    return NextResponse.json({ error: 'path required' }, { status: 400 });
  }

  // Resolve + validate the path (workspace isolation, symlink check).
  const res = await resolveWorkspacePath(id, filePath, 'default');
  if (!res.ok) {
    return NextResponse.json({ error: res.error, accessDecision: res.accessDecision }, { status: 400 });
  }

  // Lifecycle gate: only READY/INDEXED uploaded files (or agent-created files
  // that aren't in the WorkspaceFile table) are readable. T27, T28.
  const readable = await isFileReadable(id, filePath);
  if (!readable.ok) {
    return NextResponse.json({
      error: 'file not readable',
      status: readable.status,
      quarantineReason: readable.reason,
    }, { status: 403 });
  }

  let st;
  try {
    st = await stat(res.absolutePath);
  } catch {
    return NextResponse.json({ error: 'file not found' }, { status: 404 });
  }

  // Sniff the MIME type from magic bytes (P1-2).
  const sniffedMime = await sniffMimeType(res.absolutePath);
  const extMime = guessExtMime(filePath);
  const mimeType = sniffedMime !== 'application/octet-stream' ? sniffedMime : extMime;
  const isBinary = BINARY_MIMES.test(mimeType);

  // raw format: stream the bytes with the right Content-Type (for images/PDFs).
  if (format === 'raw') {
    try {
      const bytes = await readFile(res.absolutePath);
      return new NextResponse(bytes, {
        status: 200,
        headers: {
          'Content-Type': mimeType || 'application/octet-stream',
          'Content-Length': String(st.size),
          'Cache-Control': 'private, max-age=60',
        },
      });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
  }

  // json format: return metadata + text content (for text files).
  let content = '';
  if (!isBinary && st.size < 5 * 1024 * 1024) {
    // Only read text files < 5 MB inline to avoid huge payloads.
    try {
      content = await readFile(res.absolutePath, 'utf-8');
    } catch (e) {
      content = `(unreadable: ${e instanceof Error ? e.message : String(e)})`;
    }
  } else if (!isBinary) {
    content = `(file too large to preview inline: ${st.size} bytes; use the download button)`;
  }

  return NextResponse.json({
    path: filePath,
    content,
    isBinary,
    mimeType,
    sniffedMime,
    size: st.size,
    modified: st.mtime.toISOString(),
    status: readable.status || 'READY',
    // The raw-bytes URL the UI can use to embed images/PDFs.
    rawUrl: `/api/workspaces/${id}/file?path=${encodeURIComponent(filePath)}&format=raw`,
  });
}

function guessExtMime(p: string): string {
  const ext = path.extname(p).toLowerCase();
  const map: Record<string, string> = {
    '.md': 'text/markdown', '.txt': 'text/plain', '.json': 'application/json',
    '.csv': 'text/csv', '.tsv': 'text/tab-separated-values',
    '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
    '.ts': 'text/typescript', '.tsx': 'text/typescript', '.jsx': 'text/javascript',
    '.py': 'text/x-python', '.sh': 'text/x-shellscript', '.rb': 'text/x-ruby',
    '.go': 'text/x-go', '.rs': 'text/x-rust', '.java': 'text/x-java',
    '.xml': 'text/xml', '.yaml': 'text/yaml', '.yml': 'text/yaml', '.toml': 'text/x-toml',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
  };
  return map[ext] || 'application/octet-stream';
}
