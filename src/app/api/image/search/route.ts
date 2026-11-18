/**
 * POST /api/image/search
 *
 * Real image search via z-ai-web-dev-sdk's images.search.create.
 * Returns real image URLs from the web (no generation, no cost).
 *
 * Body: { query, count?, gl?, rank? }
 *  - count: 1..20 (default 6)
 *  - gl: geolocation (e.g. 'us', 'id')
 *  - rank: rank by relevance (default true)
 *
 * Response: { success, query, results: [{ original_url, caption, source, original_width, original_height }] }
 */

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, count, gl, rank = true } = body as {
      query: string;
      count?: number;
      gl?: string;
      rank?: boolean;
    };
    if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 });
    const safeCount = typeof count === 'number' && isFinite(count) ? Math.max(1, Math.min(20, Math.floor(count))) : 6;

    const zai = await ZAI.create();
    const result = await zai.images.search.create({
      query,
      count: safeCount,
      ...(gl ? { gl } : {}),
      rank,
    });

    return NextResponse.json({
      success: result.success !== false,
      query,
      results: (result.results || []).map((r: any) => ({
        original_url: r.original_url,
        caption: r.caption || '',
        source: r.source || '',
        original_width: r.original_width || '',
        original_height: r.original_height || '',
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
