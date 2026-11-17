/**
 * GET /api/audio/asset?id=<assetId>
 *
 * Serves a TTS/ASR audio file from disk. Long-cacheable.
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { getAssetPath } from '@/lib/assets';

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const meta = await getAssetPath(id);
  if (!meta || meta.kind !== 'audio') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!existsSync(meta.path)) {
    return NextResponse.json({ error: 'File missing on disk' }, { status: 404 });
  }

  const buffer = await readFile(meta.path);
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': meta.mime,
      'Cache-Control': 'private, max-age=31536000, immutable',
      'Accept-Ranges': 'bytes',
    },
  });
}
