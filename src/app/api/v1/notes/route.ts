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

  // If files attached, create async job for processing — extract text + generate notes
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

    // Run processing in background (don't block the response)
    processNoteInBackground(note.id, user.id, file_ids).catch(e => {
      console.error('[notes] background processing failed:', e instanceof Error ? e.message : String(e));
    });
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
  // File metadata for the card cover (per pelajarin: note cards show the PDF cover)
  let fileIds: string[] = [];
  try { fileIds = JSON.parse(n.fileIdsJson || '[]'); } catch {}
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
    file_ids: fileIds,
    has_document: fileIds.length > 0,
  };
}

// ============================================================
// Background processing: extract text → generate notes + chapters
// ============================================================

async function processNoteInBackground(noteId: string, userId: string, fileIds: string[]) {
  const { db } = await import('@/lib/db');
  const { extractText, chunkText } = await import('@/lib/document-processing');
  const { generateNotes } = await import('@/lib/study-generator');

  try {
    // Update job status
    const job = await db.studyJob.findFirst({ where: { noteId, jobType: 'note' } });
    if (job) await db.studyJob.update({ where: { id: job.id }, data: { status: 'running', progress: 10, startedAt: new Date() } });

    // 1. Extract text from all uploaded files
    const docs = await db.studyDocument.findMany({ where: { id: { in: fileIds } } });
    let allText = '';
    for (const doc of docs) {
      const text = await extractText(doc.storageKey, doc.contentType, doc.filename);
      allText += text + '\n\n';
      // Store extracted text on the document
      await db.studyDocument.update({
        where: { id: doc.id },
        data: { extractedText: text.slice(0, 100000), extractionStatus: 'completed' },
      });
    }

    if (job) await db.studyJob.update({ where: { id: job.id }, data: { progress: 40 } });

    // 2. Generate structured notes (chapters)
    const note = await db.studyNote.findUnique({ where: { id: noteId } });
    if (!note) return;
    const generated = await generateNotes(allText, note.title);

    if (job) await db.studyJob.update({ where: { id: job.id }, data: { progress: 60 } });

    // 3. Save chapters to DB
    if (generated.chapters && generated.chapters.length > 0) {
      // Delete existing chapters first
      await db.chapter.deleteMany({ where: { noteId } });
      // Create new chapters
      for (let i = 0; i < generated.chapters.length; i++) {
        const ch = generated.chapters[i];
        await db.chapter.create({
          data: {
            noteId,
            order: i,
            title: ch.title,
            content: ch.content,
            sourcesJson: JSON.stringify(ch.keyTerms || []),
          },
        });
      }
    }

    // 4. Update note with generated content
    const contentMd = generated.chapters
      ? generated.chapters.map((c, i) => `## ${i + 1}. ${c.title}\n\n${c.content}`).join('\n\n')
      : generated.content || '';

    await db.studyNote.update({
      where: { id: noteId },
      data: {
        content: contentMd,
        contentJson: JSON.stringify(generated),
        status: 'completed',
        totalChapters: generated.chapters?.length || 0,
      },
    });

    if (job) await db.studyJob.update({
      where: { id: job.id },
      data: { status: 'completed', progress: 100, finishedAt: new Date(), resultJson: JSON.stringify({ chapters: generated.chapters?.length || 0 }) },
    });

    console.log(`[notes] background processing completed for note ${noteId}: ${generated.chapters?.length || 0} chapters`);
  } catch (e) {
    console.error('[notes] background processing error:', e instanceof Error ? e.message : String(e));
    await db.studyNote.update({
      where: { id: noteId },
      data: { status: 'error', errorMessage: e instanceof Error ? e.message : String(e), canRetry: true },
    });
    const job = await db.studyJob.findFirst({ where: { noteId, jobType: 'note' } });
    if (job) await db.studyJob.update({ where: { id: job.id }, data: { status: 'failed', errorMessage: e instanceof Error ? e.message : String(e), finishedAt: new Date() } });
  }
}
