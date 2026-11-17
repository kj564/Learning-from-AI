/**
 * POST /api/image/generate
 *
 * Text-to-image generation via z-ai-web-dev-sdk's images.generations.create.
 * Saves the returned base64 PNG to disk + DB and returns a public URL.
 *
 * Body: { prompt, size?, conversationId?, messageId? }
 *  - size: '1024x1024' | '768x1344' | '864x1152' | '1344x768' | '1152x864' | '1440x720' | '720x1440'
 *    (default: '1024x1024')
 *
 * Response: { success, image: { id, url, prompt, size, width, height } }
 */

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { saveBase64Image } from '@/lib/assets';
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, size = '1024x1024', conversationId, messageId } = body as {
      prompt: string;
      size?: string;
      conversationId?: string;
      messageId?: string;
    };

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'prompt required' }, { status: 400 });
    }
    if (!SIZE_DIMS[size]) {
      return NextResponse.json({ error: `Invalid size: ${size}` }, { status: 400 });
    }

    const zai = await ZAI.create();
    const result: any = await zai.images.generations.create({ prompt, size: size as any });
    const base64 = result?.data?.[0]?.base64;
    if (!base64) {
      return NextResponse.json({ error: 'No image returned by SDK' }, { status: 500 });
    }

    const saved = await saveBase64Image(base64, 'png');
    const dims = SIZE_DIMS[size];

    // Persist a GeneratedImage record
    const gi = await db.generatedImage.create({
      data: {
        prompt,
        size,
        path: saved.path,
        width: dims.w,
        height: dims.h,
        conversationId: conversationId || null,
        messageId: messageId || null,
      },
    });

    return NextResponse.json({
      success: true,
      image: {
        id: gi.id,
        url: saved.url,
        prompt,
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
