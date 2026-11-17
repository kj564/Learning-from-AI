/**
 * POST /api/image/edit
 *
 * Image editing via z-ai-web-dev-sdk's images.generations.edit.
 * Accepts a prompt + source image (data URL or asset URL).
 */

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { saveBase64Image, getAssetPath } from '@/lib/assets';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { db } from '@/lib/db';

const SIZE_DIMS: Record<string, { w: number; h: number }> = {
  '1024x1024': { w: 1024, h: 1024 },
  '768x1344': { w: 768, h: 1344 },
  '864x1152': { w: 864, h: 1152 },
  '1344x768': { w: 1344, h: 768 },
  '1152x864': { w: 1152, h: 864 },
  '1440x720': { w: 1440, h: 720 },
  '720x1440': { w: 720, h: 1440 },
};

async function toDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  if (url.startsWith('/api/image/asset?') || url.startsWith('/api/asset?')) {
    const id = new URL('http://x' + url).searchParams.get('id');
    if (!id) throw new Error('asset id missing');
    const meta = await getAssetPath(id);
    if (!meta || !existsSync(meta.path)) throw new Error('Asset not found');
    const buf = await readFile(meta.path);
    return `data:${meta.mime};base64,${buf.toString('base64')}`;
  }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get('content-type') || 'image/png';
    return `data:${mime};base64,${buf.toString('base64')}`;
  }
  throw new Error(`Unsupported image URL: ${url.slice(0, 50)}`);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, image, size = '1024x1024', conversationId } = body as {
      prompt: string;
      image: string;
      size?: string;
      conversationId?: string;
    };

    if (!prompt) return NextResponse.json({ error: 'prompt required' }, { status: 400 });
    if (!image) return NextResponse.json({ error: 'image required' }, { status: 400 });
    if (!SIZE_DIMS[size]) return NextResponse.json({ error: `Invalid size: ${size}` }, { status: 400 });

    const dataUrl = await toDataUrl(image);

    const zai = await ZAI.create();
    // The SDK's API expects `images` as an array of {url} objects (image_to_image task).
    // The type signature says `image?: string` but the actual API rejects it — pass `images`.
    const result: any = await zai.images.generations.edit({
      prompt,
      // @ts-expect-error — SDK types are wrong; the actual API wants `images: [{url}]`
      images: [{ url: dataUrl }],
      size: size as any,
    });

    const base64 = result?.data?.[0]?.base64;
    if (!base64) return NextResponse.json({ error: 'No image returned' }, { status: 500 });

    const saved = await saveBase64Image(base64, 'png');
    const dims = SIZE_DIMS[size];

    const gi = await db.generatedImage.create({
      data: {
        prompt: `[edit] ${prompt}`,
        size,
        path: saved.path,
        width: dims.w,
        height: dims.h,
        conversationId: conversationId || null,
      },
    });

    return NextResponse.json({
      success: true,
      image: {
        id: gi.id,
        url: saved.url,
        prompt: `[edit] ${prompt}`,
        size,
        width: dims.w,
        height: dims.h,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
