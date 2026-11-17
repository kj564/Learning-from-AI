/**
 * POST /api/audio/tts
 *
 * Text-to-speech via z-ai-web-dev-sdk's audio.tts.create.
 * Saves the returned audio buffer to disk + DB, returns a public URL.
 *
 * Body: { text, voice?, speed?, response_format? }
 *  - voice: SDK voice name (default 'tongtong' — SDK default)
 *  - speed: 0.5..2.0 (default 1.0)
 *  - response_format: 'wav' | 'pcm' (default 'wav')
 *
 * Response: { success, audioUrl }
 */

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { saveAudioBuffer } from '@/lib/assets';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, voice, speed = 1.0, response_format = 'wav' } = body as {
      text: string;
      voice?: string;
      speed?: number;
      response_format?: string;
    };

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'text required' }, { status: 400 });
    }
    // TTS limit raised to 8000 chars (was 2000) — for long read-aloud sessions
    const truncated = text.length > 8000 ? text.slice(0, 8000) + '…' : text;

    const zai = await ZAI.create();
    const ttsResponse: any = await zai.audio.tts.create({
      input: truncated,
      ...(voice ? { voice } : {}),
      speed,
      response_format,
      stream: false,
    });

    // ttsResponse is a fetch Response — extract the audio buffer
    let audioBuffer: Buffer;
    if (ttsResponse instanceof Response) {
      const ab = await ttsResponse.arrayBuffer();
      audioBuffer = Buffer.from(ab);
    } else if (ttsResponse instanceof ArrayBuffer) {
      audioBuffer = Buffer.from(ttsResponse);
    } else if (ttsResponse?.buffer || ttsResponse?.data) {
      audioBuffer = Buffer.from(ttsResponse.buffer || ttsResponse.data);
    } else {
      // Try blob
      const blob = ttsResponse as Blob;
      if (blob?.arrayBuffer) {
        const ab = await blob.arrayBuffer();
        audioBuffer = Buffer.from(ab);
      } else {
        return NextResponse.json({ error: 'Unexpected TTS response shape' }, { status: 500 });
      }
    }

    const ext = response_format === 'pcm' ? 'pcm' : 'wav';
    const saved = await saveAudioBuffer(audioBuffer, ext as 'wav' | 'pcm');

    return NextResponse.json({ success: true, audioUrl: saved.url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
