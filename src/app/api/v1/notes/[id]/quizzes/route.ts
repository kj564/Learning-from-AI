/**
 * API: /api/v1/notes/[id]/quizzes — GET list + POST generate.
 */

import { NextRequest } from 'next/server';
import { ensureDevUser, setDevUserCookie, success, error, notFound, cursorPaginationMeta } from '@/lib/learning';
import { db } from '@/lib/db';
import { generateQuiz } from '@/lib/study-generator';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await ensureDevUser(req);
  const { id } = await params;
  const url = new URL(req.url);
  const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '20', 10));
  const cursor = url.searchParams.get('cursor');

  const note = await db.studyNote.findUnique({ where: { id } });
  if (!note || note.userId !== user.id) return setDevUserCookie(notFound('Note not found'), user.id);

  const quizzes = await db.quiz.findMany({
    where: { noteId: id },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    include: { questions: true },
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });
  const hasMore = quizzes.length > limit;
  const items = hasMore ? quizzes.slice(0, limit) : quizzes;
  return setDevUserCookie(success(
    items.map(q => ({ id: q.id, title: q.title, question_count: q.questions.length, questions: q.questions.map(qs => ({ id: qs.id, type: qs.type, question: qs.question, options: qs.optionsJson ? JSON.parse(qs.optionsJson) : null, answer: qs.answer, explanation: qs.explanation, hint: qs.hint, difficulty: qs.difficulty, xp: qs.xp })) })),
    cursorPaginationMeta(hasMore ? items[items.length - 1].id : null, limit),
  ), user.id);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await ensureDevUser(req);
  const { id } = await params;

  const note = await db.studyNote.findUnique({ where: { id } });
  if (!note || note.userId !== user.id) return setDevUserCookie(notFound('Note not found'), user.id);

  const body = await req.json().catch(() => ({}));
  const count = body.count || 5;

  // Get text
  let text = note.content || '';
  const fileIds: string[] = JSON.parse(note.fileIdsJson || '[]');
  if (fileIds.length > 0) {
    const docs = await db.studyDocument.findMany({ where: { id: { in: fileIds } } });
    text = docs.map(d => d.extractedText || '').join('\n\n') + '\n\n' + text;
  }
  if (!text.trim()) return setDevUserCookie(error('NO_CONTENT', 'Note has no content.', 400), user.id);

  try {
    const questions = await generateQuiz(text, count);
    // Create quiz
    const quiz = await db.quiz.create({ data: { noteId: id, title: `Kuis - ${note.title}` } });
    // Create questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await db.question.create({
        data: {
          quizId: quiz.id,
          order: i,
          type: q.type || 'mc',
          question: q.question,
          optionsJson: q.options ? JSON.stringify(q.options) : null,
          answer: q.answer,
          explanation: q.explanation || '',
          hint: q.hint || '',
          difficulty: q.difficulty || 'medium',
          xp: q.xp || 10,
        },
      });
    }
    await db.studyNote.update({ where: { id }, data: { quizCount: 1 } });
    return setDevUserCookie(success({ id: quiz.id, question_count: questions.length, questions }, 201), user.id);
  } catch (e) {
    return setDevUserCookie(error('GENERATION_FAILED', e instanceof Error ? e.message : String(e), 500), user.id);
  }
}
