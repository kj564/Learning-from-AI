/**
 * POST /api/vision
 *
 * Image understanding via z-ai-web-dev-sdk's chat.completions.createVision.
 * Accepts a data: URL, http(s) URL, or our own /api/image/asset?id=... URL.
 *
 * IMPORTANT: The SDK only accepts data: URLs (its server can't fetch our
 * localhost). So we fetch any http(s) or local asset URL server-side and
 * re-encode as a data: URL before passing to the SDK.
 *
 * Body: { imageUrl, prompt?, history? }
 *  - imageUrl: 'data:image/png;base64,...' OR 'https://...' OR '/api/image/asset?id=...'
 *  - prompt: default 'Describe this image in detail.'
 *
 * Response: { success, text }
 */

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { getAssetPath } from '@/lib/assets';

/** Convert any imageUrl to a data: URL (base64-encoded). */
async function toDataUrl(url: string, req: NextRequest): Promise<string> {
  // Already a data URL — pass through
  if (url.startsWith('data:')) return url;

  // Our own asset route — read directly from disk via DB lookup
  if (url.startsWith('/api/image/asset?') || url.startsWith('/api/asset?')) {
    const id = new URL('http://x' + url).searchParams.get('id');
    if (!id) throw new Error('asset id missing in URL');
    const meta = await getAssetPath(id);
    if (!meta || !existsSync(meta.path)) throw new Error('Asset not found');
    const buf = await readFile(meta.path);
    const b64 = buf.toString('base64');
    return `data:${meta.mime};base64,${b64}`;
  }

  // http(s) URL — fetch server-side (the SDK can't fetch external URLs)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch image: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get('content-type') || 'image/png';
    const b64 = buf.toString('base64');
    return `data:${mime};base64,${b64}`;
  }

  // Local file path (absolute) — read directly
  if (existsSync(url)) {
    const buf = await readFile(url);
    const ext = path.extname(url).slice(1).toLowerCase() || 'png';
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
    return `data:${mime};base64,${buf.toString('base64')}`;
  }

  throw new Error(`Unsupported imageUrl format: ${url.slice(0, 50)}`);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrl, prompt = 'Describe this image in detail.', history = [] } = body as {
      imageUrl: string;
      prompt?: string;
      history?: { role: string; content: string }[];
    };

    if (!imageUrl) return NextResponse.json({ error: 'imageUrl required' }, { status: 400 });

    const dataUrl = await toDataUrl(imageUrl, req);

    const messages: any[] = [
      ...(history || []).map((m) => ({ role: m.role, content: m.content })),
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ];

    const zai = await ZAI.create();
    const result: any = await zai.chat.completions.createVision({
      messages,
      thinking: { type: 'disabled' },
    });

    const text = result?.choices?.[0]?.message?.content || '';
    return NextResponse.json({ success: true, text });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
