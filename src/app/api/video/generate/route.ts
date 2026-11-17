/**
 * POST /api/video/generate
 *
 * Text-to-video (or image-to-video) generation via z-ai-web-dev-sdk.
 * Returns a taskId — client polls /api/video/status until task_status === 'SUCCESS'.
 *
 * Body: { prompt, image_url?, quality?, with_audio?, size?, fps?, duration? }
 *  - prompt: required (unless image_url alone)
 *  - image_url: optional URL or array of URLs to seed the video
 *  - quality: 'speed' | 'quality' (default 'quality')
 *  - with_audio: boolean (default true)
 *  - size: e.g. '1280x720'
 *  - fps: 1..60
 *  - duration: seconds (1..10 typical)
 *
 * Response: { success, taskId, status }
 */

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, image_url, quality = 'quality', with_audio = true, size, fps, duration } = body as {
      prompt?: string;
      image_url?: string | string[];
      quality?: 'speed' | 'quality';
      with_audio?: boolean;
      size?: string;
      fps?: number;
      duration?: number;
    };

    if (!prompt && !image_url) {
      return NextResponse.json({ error: 'prompt or image_url required' }, { status: 400 });
    }

    const zai = await ZAI.create();
    const result: any = await zai.video.generations.create({
      prompt,
      ...(image_url ? { image_url } : {}),
      quality,
      with_audio,
      ...(size ? { size } : {}),
      ...(fps ? { fps } : {}),
      ...(duration ? { duration } : {}),
    });

    return NextResponse.json({
      success: true,
      taskId: result.id,
      status: result.task_status,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
