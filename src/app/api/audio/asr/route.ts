/**
 * POST /api/audio/asr
 *
 * Speech-to-text via z-ai-web-dev-sdk's audio.asr.create.
 * Accepts a base64-encoded audio file (webm/wav/mp3 from MediaRecorder).
 *
 * SECURITY: request body capped at 20 MB to prevent DoS.
 *
 * Body: { file_base64 }
 * Response: { success, text }
 */

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

const MAX_BODY_BYTES = 20 * 1024 * 1024; // 20 MB

export async function POST(req: NextRequest) {
  try {
    // Reject oversized payloads before parsing JSON.
    const contentLength = parseInt(req.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: `Request body too large (max ${MAX_BODY_BYTES} bytes)` },
        { status: 413 }
      );
    }

    const body = await req.json();
    const { file_base64 } = body as { file_base64?: string };

    if (!file_base64) return NextResponse.json({ error: 'file_base64 required' }, { status: 400 });
    if (file_base64.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: `Audio payload too large (max ${MAX_BODY_BYTES} bytes base64)` },
        { status: 413 }
      );
    }

    const zai = await ZAI.create();
    const result: any = await zai.audio.asr.create({ file_base64 });

    const text = result?.text || result?.transcript || '';
    if (!text) {
      return NextResponse.json({ success: false, error: 'No transcription returned' }, { status: 422 });
    }

    return NextResponse.json({ success: true, text });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
