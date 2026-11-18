/**
 * POST /api/vision
 *
 * Image understanding via z-ai-web-dev-sdk's chat.completions.createVision.
 * Accepts a data: URL, http(s) URL, or our own /api/image/asset?id=... URL.
 *
 * SECURITY: All http(s) URLs are fetched via `safeFetch` (DNS resolves, no
 * private/loopback/link-local, size cap). Local-file branch deleted to prevent
 * arbitrary file disclosure via prompt-injection.
 *
 * Body: { imageUrl, prompt?, history? }
 * Response: { success, text }
 */

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { getAssetPath } from '@/lib/assets';
import { safeFetch } from '@/lib/net-security';

async function toDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;

  // Our own asset routes — read directly from disk via DB lookup
  if (url.startsWith('/api/image/asset?') || url.startsWith('/api/asset?')) {
    const id = new URL('http://x' + url).searchParams.get('id');
    if (!id) throw new Error('asset id missing in URL');
    const meta = await getAssetPath(id);
    if (!meta || !existsSync(meta.path)) throw new Error('Asset not found');
    const buf = await readFile(meta.path);
    return `data:${meta.mime};base64,${buf.toString('base64')}`;
  }

  // External http(s) URL — fetch safely (SSRF guard)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const { buffer, mime } = await safeFetch(url, { maxBytes: 10 * 1024 * 1024 });
    return `data:${mime};base64,${buffer.toString('base64')}`;
  }

  throw new Error(`Unsupported imageUrl format (local file paths are blocked for security)`);
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

    const dataUrl = await toDataUrl(imageUrl);

    // Filter history to only user/assistant roles (no system injection)
    const safeHistory = (history || [])
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content }));

    const messages: any[] = [
      ...safeHistory,
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
