/**
 * API: /api/v1/notes/[id] — get, update, delete a single note.
 *
 * GET    — full note with chapters, files, counts (per E-AUTH-006)
 * PATCH  — update title, description, subject, study_mode, tone, is_public
 * DELETE — soft delete (per pelajarin: notes are user-owned)
 */

import { NextRequest } from 'next/server';
import { ensureDevUser, setDevUserCookie, success, error, notFound, forbidden } from '@/lib/learning';
import { db } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await ensureDevUser(req);
  const { id } = await params;

  const note = await db.studyNote.findUnique({
    where: { id },
    include: {
      subject: true,
      chapters: { orderBy: { order: 'asc' } },
    },
  });
  if (!note) return notFound('Note not found');
  if (note.userId !== user.id && !note.isPublic) return forbidden('You do not have access to this note');

  // Get file metadata
  const fileIds: string[] = JSON.parse(note.fileIdsJson || '[]');
  const files = fileIds.length > 0 ? await db.studyDocument.findMany({ where: { id: { in: fileIds } } }) : [];

  return setDevUserCookie(success({
    id: note.id,
    title: note.title,
    description: note.description,
    content: note.content,
    content_json: note.contentJson ? JSON.parse(note.contentJson) : null,
    created_at: note.createdAt,
    subject_id: note.subjectId,
    subject: note.subject ? { id: note.subject.id, name: note.subject.name, icon: note.subject.icon, icon_color: note.subject.iconColor } : null,
    files: files.map(f => ({ id: f.id, filename: f.filename, content_type: f.contentType, size_bytes: f.sizeBytes, status: f.extractionStatus })),
    flashcard_count: note.flashcardCount,
    quiz_count: note.quizCount,
    is_censored: note.isCensored,
    status: note.status,
    error_message: note.errorMessage,
    error_code: note.errorCode,
    can_retry: note.canRetry,
    total_chapters: note.totalChapters,
    source_language: note.sourceLanguage,
    chapters: note.chapters.map(c => ({ id: c.id, order: c.order, title: c.title, content: c.content })),
    is_owner: note.userId === user.id,
    is_public: note.isPublic,
    owner: { name: user.name, image: null },
  }), user.id);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await ensureDevUser(req);
  const { id } = await params;

  const note = await db.studyNote.findUnique({ where: { id } });
  if (!note) return notFound('Note not found');
  if (note.userId !== user.id) return forbidden('You can only edit your own notes');

  const body = await req.json().catch(() => ({}));
  const { title, description, subject_id, study_mode, tone, is_public, source_language, generation_language } = body as any;

  const updated = await db.studyNote.update({
    where: { id },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(subject_id !== undefined ? { subjectId: subject_id || null } : {}),
      ...(study_mode !== undefined ? { studyMode: study_mode } : {}),
      ...(tone !== undefined ? { tone } : {}),
      ...(is_public !== undefined ? { isPublic: is_public } : {}),
      ...(source_language !== undefined ? { sourceLanguage: source_language } : {}),
      ...(generation_language !== undefined ? { generationLanguage: generation_language } : {}),
    },
  });

  return setDevUserCookie(success({ id: updated.id, title: updated.title, updated_at: updated.updatedAt }), user.id);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await ensureDevUser(req);
  const { id } = await params;

  const note = await db.studyNote.findUnique({ where: { id } });
  if (!note) return notFound('Note not found');
  if (note.userId !== user.id) return forbidden('You can only delete your own notes');

  await db.studyNote.delete({ where: { id } });

  return setDevUserCookie(success({ deleted: id }), user.id);
}
