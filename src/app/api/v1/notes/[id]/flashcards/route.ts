/**
 * API: /api/v1/notes/[id]/flashcards — GET list + POST generate.
 * GET returns existing flashcards; POST triggers LLM generation.
 */

import { NextRequest } from 'next/server';
import { ensureDevUser, setDevUserCookie, successWithPagination, success, error, notFound, cursorPaginationMeta } from '@/lib/learning';
import { db } from '@/lib/db';
import { generateFlashcards } from '@/lib/study-generator';
import { extractText } from '@/lib/document-processing';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await ensureDevUser(req);
  const { id } = await params;
  const url = new URL(req.url);
  const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '20', 10));
  const cursor = url.searchParams.get('cursor');

  const note = await db.studyNote.findUnique({ where: { id } });
  if (!note || note.userId !== user.id) return setDevUserCookie(notFound('Note not found'), user.id);

  const cards = await db.flashcard.findMany({
    where: { noteId: id },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });
  const hasMore = cards.length > limit;
  const items = hasMore ? cards.slice(0, limit) : cards;
  return setDevUserCookie(successWithPagination(
    items.map(c => ({ id: c.id, front: c.front, back: c.back, fsrs_state: c.fsrsStateJson })),
    cursorPaginationMeta(hasMore ? items[items.length - 1].id : null, limit),
  ), user.id);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await ensureDevUser(req);
  const { id } = await params;

  const note = await db.studyNote.findUnique({ where: { id } });
  if (!note || note.userId !== user.id) return setDevUserCookie(notFound('Note not found'), user.id);

  const body = await req.json().catch(() => ({}));
  const count = body.count || 10;

  // Get text from note content + linked documents
  let text = note.content || '';
  const fileIds: string[] = JSON.parse(note.fileIdsJson || '[]');
  if (fileIds.length > 0) {
    const docs = await db.studyDocument.findMany({ where: { id: { in: fileIds } } });
    text = docs.map(d => d.extractedText || '').join('\n\n') + '\n\n' + text;
  }

  if (!text.trim()) return setDevUserCookie(error('NO_CONTENT', 'Note has no content. Upload a file first.', 400), user.id);

  // Generate flashcards
  try {
    const flashcards = await generateFlashcards(text, count);
    // Delete existing flashcards
    await db.flashcard.deleteMany({ where: { noteId: id } });
    // Create new ones
    for (const fc of flashcards) {
      await db.flashcard.create({ data: { noteId: id, front: fc.front, back: fc.back } });
    }
    // Update count on note
    await db.studyNote.update({ where: { id }, data: { flashcardCount: flashcards.length } });
    // Record event
    await fetch(`${req.nextUrl.origin}/api/v1/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_name: 'flashcard_reviewed', note_id: id }) }).catch(() => {});
    return setDevUserCookie(success({ count: flashcards.length, flashcards }, 201), user.id);
  } catch (e) {
    return setDevUserCookie(error('GENERATION_FAILED', e instanceof Error ? e.message : String(e), 500), user.id);
  }
}
