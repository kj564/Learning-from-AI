/**
 * POST /api/web/search
 *
 * Real web search via z-ai-web-dev-sdk's functions.invoke('web_search', ...).
 * Returns ranked results with URL, title, snippet, host name, date, favicon.
 *
 * This replaces the previous fake "web_search" tool that just asked the LLM
 * to guess answers. Now the assistant gets real, citable sources.
 */

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

export interface WebSearchResult {
  url: string;
  name: string;
  snippet: string;
  host_name: string;
  rank: number;
  date: string;
  favicon: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, num = 8, recency_days } = body as {
      query: string;
      num?: number;
      recency_days?: number;
    };
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'query required' }, { status: 400 });
    }

    const zai = await ZAI.create();
    const results = await zai.functions.invoke('web_search', {
      query,
      num: Math.max(1, Math.min(20, num)),
      ...(recency_days ? { recency_days } : {}),
    });

    return NextResponse.json({
      success: true,
      query,
      results: (results || []) as WebSearchResult[],
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
