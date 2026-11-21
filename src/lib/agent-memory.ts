/**
 * Agent memory — persistent storage for user preferences, project decisions,
 * and learned patterns. Claude-style three-layer memory:
 *   - Conversation memory (in zustand store)
 *   - User memory (preferences, language, work style)
 *   - Project/task memory (decisions, key files, research, progress)
 */

import { db } from './db';

export type MemoryCategory = 'preference' | 'decision' | 'finding' | 'error_pattern' | 'source';

export interface MemoryNote {
  id: string;
  title: string;
  content: string;
  category: MemoryCategory;
  createdAt: Date;
}

/** Save a note to persistent memory (Prisma). */
export async function createNote(title: string, content: string, category: MemoryCategory): Promise<MemoryNote | null> {
  try {
    // Use the KnowledgeDoc table as memory storage (same BM25 search)
    const doc = await db.knowledgeDoc.create({
      data: {
        title,
        source: `memory:${category}`,
        content,
        tags: JSON.stringify([category, 'memory']),
      },
    });
    return {
      id: doc.id,
      title: doc.title,
      content: doc.content,
      category,
      createdAt: doc.createdAt,
    };
  } catch {
    return null;
  }
}

/** Recall notes from persistent memory using BM25 search. */
export async function recallMemory(query: string, topK = 5): Promise<MemoryNote[]> {
  try {
    const res = await fetch('http://localhost:3000/api/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'search', query: `memory ${query}`, topK }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.snippets || [])
      .filter((s: any) => s.source?.startsWith('memory:'))
      .map((s: any) => ({
        id: s.docId,
        title: s.title,
        content: s.content,
        category: (s.source?.replace('memory:', '') || 'finding') as MemoryCategory,
        createdAt: new Date(),
      }));
  } catch {
    return [];
  }
}

/** Get memory context for the system prompt. */
export async function getMemoryContext(query?: string): Promise<string> {
  if (!query) return '';
  const notes = await recallMemory(query, 3);
  if (notes.length === 0) return '';
  const lines = notes.map((n) => `[${n.category}] ${n.title}: ${n.content.slice(0, 200)}`);
  return `\n\n# Memory (relevant past notes)\n\n${lines.join('\n')}\n`;
}
