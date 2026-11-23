/**
 * API: /api/v1/profile/activity — user activity feed.
 * Per pelajarin RE (RECON-DEEP-v4 §2.4): returns recent activity (notes
 * created, quiz completions, streak milestones, XP gains).
 *
 * GET — merged timeline from:
 *   - XPEvent (all XP gains, with reason + amount)
 *   - recent StudyNote (note_created)
 *   - recent Quiz (quiz_passed)
 *
 * Ordered by timestamp desc, cursor-paginated (limit default 20).
 */

import { NextRequest } from 'next/server';
import { ensureDevUser, setDevUserCookie, successWithPagination, cursorPaginationMeta } from '@/lib/learning';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await ensureDevUser(req);
  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
  const cursor = url.searchParams.get('cursor');

  // Gather XP events + recent notes + recent quizzes, merge by time
  const [xpEvents, recentNotes, recentQuizzes, recentChats] = await Promise.all([
    db.xPEvent.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    }),
    db.studyNote.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, title: true, createdAt: true, totalChapters: true, flashcardCount: true, quizCount: true },
    }),
    db.quiz.findMany({
      where: { note: { userId: user.id } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, title: true, createdAt: true, noteId: true },
    }),
    db.chatSession.findMany({
      where: { note: { userId: user.id } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, noteId: true, createdAt: true },
    }),
  ]);

  // Build unified activity items
  type Activity = { id: string; type: string; description: string; amount?: number; created_at: string; metadata?: any };
  const items: Activity[] = [];

  for (const xp of xpEvents) {
    items.push({
      id: xp.id,
      type: 'xp',
      description: humanizeReason(xp.reason),
      amount: xp.amount,
      created_at: xp.createdAt.toISOString(),
      metadata: xp.metadataJson ? JSON.parse(xp.metadataJson) : null,
    });
  }
  for (const n of recentNotes) {
    items.push({
      id: `note-${n.id}`,
      type: 'note_created',
      description: `Membuat catatan "${n.title}"`,
      created_at: n.createdAt.toISOString(),
      metadata: { note_id: n.id, chapters: n.totalChapters, flashcards: n.flashcardCount, quizzes: n.quizCount },
    });
  }
  for (const q of recentQuizzes) {
    items.push({
      id: `quiz-${q.id}`,
      type: 'quiz_generated',
      description: `Generate kuis "${q.title || 'Kuis'}"`,
      created_at: q.createdAt.toISOString(),
      metadata: { quiz_id: q.id, note_id: q.noteId },
    });
  }
  for (const c of recentChats) {
    items.push({
      id: `chat-${c.id}`,
      type: 'chat_session',
      description: 'Sesi chat dengan Bimo',
      created_at: c.createdAt.toISOString(),
      metadata: { session_id: c.id, note_id: c.noteId },
    });
  }

  // Sort merged timeline desc, slice to limit
  items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const sliced = items.slice(0, limit);
  const hasMore = items.length > limit;
  const nextCursor = hasMore ? sliced[sliced.length - 1]?.id : null;

  return setDevUserCookie(successWithPagination(sliced, cursorPaginationMeta(nextCursor, limit)), user.id);
}

function humanizeReason(reason: string): string {
  const map: Record<string, string> = {
    quiz_passed: 'Kuis selesai',
    flashcard_reviewed: 'Review flashcard',
    flashcard_reviewed_correct: 'Flashcard benar',
    chat_session: 'Sesi chat',
    daily_login: 'Login harian',
    note_created: 'Catatan dibuat',
    exam_completed: 'Ujian selesai',
    podcast_generated: 'Podcast dibuat',
  };
  return map[reason] || reason;
}
