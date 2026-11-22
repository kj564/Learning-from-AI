/**
 * API: /api/v1/notes — list + create study notes.
 *
 * GET  — list user's notes (page-based pagination, per pelajarin E-AUTH-004)
 * POST — create a note. Per pelajarin E-AUTH-005: empty body creates a
 *        placeholder (title "Catatan Baru", status "ready", study_mode
 *        "standard", tone "friendly"). Create-then-attach pattern.
 *        Body with file_ids triggers async generation job.
 *
 * Free tier: 15 notes/month (vs pelajarin 1). Pro: unlimited.
 */

import { NextRequest } from 'next/server';
import { ensureDevUser, setDevUserCookie, success, successWithPagination, error, validationError, parsePagination, pagePaginationMeta, getUsage, incrementUsage } from '@/lib/learning';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await ensureDevUser(req);
  const url = new URL(req.url);
  const { page, limit } = parsePagination(req);
  const subjectId = url.searchParams.get('subject_id');
  const status = url.searchParams.get('status');

  const where: any = { userId: user.id };
  if (subjectId) where.subjectId = subjectId;
  if (status) where.status = status;

  const [notes, totalCount] = await Promise.all([
    db.studyNote.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { subject: true },
    }),
    db.studyNote.count({ where }),
  ]);

  return setDevUserCookie(successWithPagination(
    notes.map(n => noteSummary(n)),
    pagePaginationMeta(page, limit, totalCount),
  ), user.id);
}

export async function POST(req: NextRequest) {
  const user = await ensureDevUser(req);

  // Check usage limit
  const usage = await getUsage(user.id);
  if (usage && !usage.canCreateNote) {
    return error('LIMIT_EXCEEDED', 'Notes limit reached for this period. Upgrade to Pro for unlimited.', 402);
  }

  const body = await req.json().catch(() => ({}));
  const { title, description, study_mode, tone, source_language, generation_language, subject_id, file_ids } = body as any;

  // Create-then-attach: empty body → placeholder note
  const note = await db.studyNote.create({
    data: {
      userId: user.id,
      title: title || 'Catatan Baru',
      description: description || null,
      studyMode: study_mode || 'standard',
      tone: tone || 'friendly',
      sourceLanguage: source_language || null,
      generationLanguage: generation_language || null,
      subjectId: subject_id || null,
      fileIdsJson: JSON.stringify(file_ids || []),
      status: file_ids && file_ids.length > 0 ? 'processing' : 'ready',
    },
  });

  // If files attached, create async job for processing
  if (file_ids && file_ids.length > 0) {
    const job = await db.studyJob.create({
      data: {
        jobType: 'note',
        userId: user.id,
        noteId: note.id,
        status: 'queued',
      },
    });
    await db.studyNote.update({ where: { id: note.id }, data: { jobId: job.id, status: 'processing' } });
  }

  // Increment usage
  await incrementUsage(user.id, 'notesUsed');

  const freshNote = await db.studyNote.findUnique({ where: { id: note.id }, include: { subject: true } });

  const response = success({
    id: freshNote.id,
    title: freshNote.title,
    description: freshNote.description,
    status: freshNote.status,
    study_mode: freshNote.studyMode,
    tone: freshNote.tone,
    source_language: freshNote.sourceLanguage,
    generation_language: freshNote.generationLanguage,
    subject_id: freshNote.subjectId,
    is_public: freshNote.isPublic,
    created_at: freshNote.createdAt,
    updated_at: freshNote.updatedAt,
    job_id: freshNote.jobId ? `note-${freshNote.id}` : null,
  }, 201);

  return setDevUserCookie(response, user.id);
}

function noteSummary(n: any) {
  return {
    id: n.id,
    title: n.title,
    description: n.description,
    status: n.status,
    subject_id: n.subjectId,
    subject: n.subject ? { id: n.subject.id, name: n.subject.name, icon: n.subject.icon, icon_color: n.subject.iconColor } : null,
    flashcard_count: n.flashcardCount,
    quiz_count: n.quizCount,
    total_chapters: n.totalChapters,
    is_public: n.isPublic,
    created_at: n.createdAt,
    updated_at: n.updatedAt,
  };
}
