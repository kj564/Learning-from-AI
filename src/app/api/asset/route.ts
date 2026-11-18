/**
 * GET /api/asset?id=<assetId>
 *
 * Generic asset serving (uploaded files of any kind).
 * SECURITY: verifies the asset's path is inside ASSETS_DIR. Uploaded HTML/SVG
 * files are served with `application/octet-stream` to prevent stored XSS.
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { getAssetPath, ASSETS_DIR } from '@/lib/assets';

// MIME types that could execute scripts in the browser — force download instead.
const UNSAFE_MIMES = new Set([
  'text/html', 'application/xhtml+xml', 'text/xml',
  'image/svg+xml', 'application/javascript', 'text/javascript',
]);

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const meta = await getAssetPath(id);
  if (!meta) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!meta.path.startsWith(ASSETS_DIR + path.sep)) {
    return NextResponse.json({ error: 'Invalid asset path' }, { status: 400 });
  }
  if (!existsSync(meta.path)) return NextResponse.json({ error: 'File missing' }, { status: 404 });

  const buffer = await readFile(meta.path);
  // Force a safe Content-Type for unsafe mimes (stored XSS prevention).
  const safeMime = UNSAFE_MIMES.has(meta.mime) ? 'application/octet-stream' : meta.mime;
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': safeMime,
      // Defense: tell browsers never to sniff / render this inline.
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}
