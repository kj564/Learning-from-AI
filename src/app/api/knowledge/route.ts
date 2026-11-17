/**
 * API: /api/knowledge — Knowledge base CRUD + RAG-lite BM25 search (Onyx-inspired)
 *
 * Persisted via Prisma (SQLite). Each doc has:
 *   - id, title, source, content
 *   - tags (JSON array)
 *   - createdAt, updatedAt
 *
 * BM25 search: k1=1.5, b=0.75, with IDF weighting + snippet extraction.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export interface KnowledgeDocDTO {
  id: string;
  title: string;
  source: string;
  tags: string[];
  contentLength: number;
  createdAt: number;
  updatedAt: number;
}

function toDTO(d: {
  id: string;
  title: string;
  source: string;
  content: string;
  tags: string;
  createdAt: Date;
  updatedAt: Date;
}): KnowledgeDocDTO {
  return {
    id: d.id,
    title: d.title,
    source: d.source,
    tags: JSON.parse(d.tags || '[]'),
    contentLength: d.content.length,
    createdAt: d.createdAt.getTime(),
    updatedAt: d.updatedAt.getTime(),
  };
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

function termFreq(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) || 0) + 1);
  return m;
}

function bm25Score(
  queryTokens: string[],
  docTokens: string[],
  avgDocLen: number,
  docCount: number,
  dfMap: Map<string, number>
): number {
  const docLen = docTokens.length;
  const tf = termFreq(docTokens);
  const k1 = 1.5;
  const b = 0.75;
  let score = 0;
  for (const qt of queryTokens) {
    const f = tf.get(qt) || 0;
    if (f === 0) continue;
    const df = dfMap.get(qt) || 0;
    const idf = Math.log((docCount - df + 0.5) / (df + 0.5) + 1);
    score += (idf * (f * (k1 + 1))) / (f + k1 * (1 - b + b * (docLen / Math.max(1, avgDocLen))));
  }
  return score;
}

function extractSnippet(content: string, queryTokens: string[], window = 240): string {
  const lower = content.toLowerCase();
  for (const qt of queryTokens) {
    const idx = lower.indexOf(qt);
    if (idx >= 0) {
      const start = Math.max(0, idx - window / 2);
      const end = Math.min(content.length, idx + qt.length + window / 2);
      return (start > 0 ? '… ' : '') + content.slice(start, end) + (end < content.length ? ' …' : '');
    }
  }
  return content.slice(0, window);
}

export async function GET() {
  const list = await db.knowledgeDoc.findMany({ orderBy: { updatedAt: 'desc' } });
  return NextResponse.json({ docs: list.map(toDTO) });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action, id, title, source, content, tags, query, topK } = body;

  switch (action) {
    case 'create': {
      if (!title || !content) return NextResponse.json({ error: 'title + content required' }, { status: 400 });
      const d = await db.knowledgeDoc.create({
        data: {
          title,
          source: source || title,
          content,
          tags: JSON.stringify(tags || []),
        },
      });
      return NextResponse.json({ success: true, doc: toDTO(d) });
    }

    case 'get': {
      if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
      const d = await db.knowledgeDoc.findUnique({ where: { id } });
      if (!d) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({ doc: { ...toDTO(d), content: d.content } });
    }

    case 'update': {
      if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
      const existing = await db.knowledgeDoc.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const data: Record<string, string> = {};
      if (title !== undefined) data.title = title;
      if (source !== undefined) data.source = source;
      if (content !== undefined) data.content = content;
      if (tags !== undefined) data.tags = JSON.stringify(tags);
      const d = await db.knowledgeDoc.update({ where: { id }, data });
      return NextResponse.json({ success: true, doc: toDTO(d) });
    }

    case 'delete': {
      if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
      try {
        await db.knowledgeDoc.delete({ where: { id } });
        return NextResponse.json({ success: true });
      } catch {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
    }

    case 'search': {
      if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 });
      const k = Math.max(1, Math.min(20, topK || 4));
      const queryTokens = tokenize(query);
      if (queryTokens.length === 0) return NextResponse.json({ query, snippets: [] });

      const allDocs = await db.knowledgeDoc.findMany();
      if (allDocs.length === 0) return NextResponse.json({ query, snippets: [] });

      const allDocTokens = allDocs.map((d) => tokenize(d.title + ' ' + d.content));
      const avgDocLen = allDocTokens.reduce((s, t) => s + t.length, 0) / allDocTokens.length;

      // Build document frequency map
      const df = new Map<string, number>();
      for (const tokens of allDocTokens) {
        const seen = new Set(tokens);
        for (const t of seen) df.set(t, (df.get(t) || 0) + 1);
      }

      const scored = allDocs
        .map((d, i) => ({ doc: d, score: bm25Score(queryTokens, allDocTokens[i], avgDocLen, allDocs.length, df) }))
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, k);

      const snippets = scored.map((s) => ({
        docId: s.doc.id,
        source: s.doc.source,
        title: s.doc.title,
        content: extractSnippet(s.doc.content, queryTokens),
        score: Number(s.score.toFixed(3)),
      }));

      return NextResponse.json({ query, snippets });
    }

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
}
