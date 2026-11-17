/**
 * POST /api/audio/asr
 *
 * Speech-to-text via z-ai-web-dev-sdk's audio.asr.create.
 * Accepts a base64-encoded audio file (webm/wav/mp3 from MediaRecorder).
 *
 * Body: { file_base64 }
 * Response: { success, text }
 */

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { file_base64 } = body as { file_base64?: string };

    if (!file_base64) return NextResponse.json({ error: 'file_base64 required' }, { status: 400 });

    const zai = await ZAI.create();
    const result: any = await zai.audio.asr.create({ file_base64 });

    // Result shape: { text: string } per the SDK types
    const text = result?.text || result?.transcript || '';
    if (!text) {
      return NextResponse.json({ success: false, error: 'No transcription returned', raw: JSON.stringify(result).slice(0, 500) });
    }

    return NextResponse.json({ success: true, text });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
