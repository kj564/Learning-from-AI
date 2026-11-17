/**
 * POST /api/web/page
 *
 * Reads a web page's content via z-ai-web-dev-sdk's functions.invoke('page_reader', ...).
 * Returns title, HTML, published time, URL.
 *
 * Used by the AI to dig deeper into a search result.
 */

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = body as { url: string };
    if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });

    const zai = await ZAI.create();
    const result = await zai.functions.invoke('page_reader', { url });

    return NextResponse.json({
      success: true,
      url,
      title: result?.data?.title || '',
      html: result?.data?.html || '',
      publishedTime: result?.data?.publishedTime || null,
      tokens: result?.data?.usage?.tokens || 0,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
