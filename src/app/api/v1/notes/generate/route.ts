/**
 * API: /api/v1/notes/generate — create a note from a text prompt (no upload).
 *
 * Per pelajarin RE (RECON-DEEP-v4 §2.1): `POST /notes/generate` takes a text
 * prompt like "Fotosintesis" and runs the full generation pipeline (chapters
 * + content) from the prompt alone — the LLM writes the teaching material.
 *
 * This is the endpoint the "What would you like to learn?" textarea should
 * fire (not the empty-placeholder `POST /notes`). Bimo's free tier allows
 * this (pelajarin gates it behind the upload-only flow for free users).
 *
 * Body: { prompt: string, title?: string }
 *   - prompt: the user's free-text learning request (e.g. "Jelaskan fotosintesis")
 *   - title: optional explicit title (defaults to a trimmed prompt)
 *
 * Response 201: { data: { id, title, status, job_id } }
 *   - status is "processing"; client polls GET /api/v1/notes/{id} or
 *     streams GET /api/v1/jobs/{id}/stream until status becomes "completed".
 */

import { NextRequest } from 'next/server';
import { ensureDevUser, setDevUserCookie, success, error, getUsage, incrementUsage } from '@/lib/learning';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const user = await ensureDevUser(req);

  // Check usage limit (same limit as note creation)
  const usage = await getUsage(user.id);
  if (usage && !usage.canCreateNote) {
    return setDevUserCookie(error('LIMIT_EXCEEDED', 'Notes limit reached for this period. Upgrade to Pro for unlimited.', 402), user.id);
  }

  const body = await req.json().catch(() => ({}));
  const { prompt, title } = body as { prompt?: string; title?: string };

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return setDevUserCookie(error('INVALID_PROMPT', 'prompt is required', 400), user.id);
  }

  // Derive a title: use explicit title, else first ~50 chars of prompt
  const noteTitle = (title && title.trim()) || prompt.trim().slice(0, 50).replace(/\s+/g, ' ');

  // Create the note in processing state
  const note = await db.studyNote.create({
    data: {
      userId: user.id,
      title: noteTitle,
      description: prompt.trim().slice(0, 300),
      fileIdsJson: '[]',
      status: 'processing',
    },
  });

  // Create a job for progress tracking
  const job = await db.studyJob.create({
    data: {
      jobType: 'note',
      userId: user.id,
      noteId: note.id,
      status: 'queued',
    },
  });
  await db.studyNote.update({ where: { id: note.id }, data: { jobId: job.id } });

  // Increment usage
  await incrementUsage(user.id, 'notesUsed');

  // Run generation in background
  processPromptNoteInBackground(note.id, prompt.trim()).catch(e => {
    console.error('[notes/generate] background processing failed:', e instanceof Error ? e.message : String(e));
  });

  return setDevUserCookie(success({
    id: note.id,
    title: note.title,
    status: 'processing',
    job_id: `note-${note.id}`,
  }, 201), user.id);
}

/**
 * Background: generate chapters + content from the text prompt, no file
 * extraction. Mirrors processNoteInBackground from /notes/route.ts but
 * uses generateNotesFromPrompt instead of extractText → generateNotes.
 */
async function processPromptNoteInBackground(noteId: string, prompt: string) {
  const { generateNotesFromPrompt } = await import('@/lib/study-generator');
  try {
    const note = await db.studyNote.findUnique({ where: { id: noteId } });
    if (!note) return;

    const job = await db.studyJob.findFirst({ where: { noteId, jobType: 'note' } });
    if (job) await db.studyJob.update({ where: { id: job.id }, data: { status: 'running', progress: 20, startedAt: new Date() } });

    // Generate chapters from the prompt (LLM writes the teaching material)
    const generated = await generateNotesFromPrompt(prompt, note.title);

    if (job) await db.studyJob.update({ where: { id: job.id }, data: { progress: 70 } });

    // Save chapters
    if (generated.chapters && generated.chapters.length > 0) {
      await db.chapter.deleteMany({ where: { noteId } });
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

    // Update note content
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

    console.log(`[notes/generate] background processing completed for note ${noteId}: ${generated.chapters?.length || 0} chapters`);
  } catch (e) {
    console.error('[notes/generate] background processing error:', e instanceof Error ? e.message : String(e));
    await db.studyNote.update({
      where: { id: noteId },
      data: { status: 'error', errorMessage: e instanceof Error ? e.message : String(e), canRetry: true },
    });
    const job = await db.studyJob.findFirst({ where: { noteId, jobType: 'note' } });
    if (job) await db.studyJob.update({ where: { id: job.id }, data: { status: 'failed', errorMessage: e instanceof Error ? e.message : String(e), finishedAt: new Date() } });
  }
}
