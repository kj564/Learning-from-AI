/**
 * API: /api/v1/jobs/[id]/stream — SSE progress stream for async jobs.
 * Per pelajarin E-AUTH-001 + E-009: async jobs stream progress via SSE.
 * Pattern: POST creates job → client polls GET /jobs/<id>/stream.
 *
 * In this dev version, we poll the StudyJob DB row every 2s and emit SSE
 * events for progress changes. When the job completes/fails, we emit a
 * final event and close the stream.
 *
 * SSE event protocol:
 *   event: progress  data: { "progress": 50, "status": "running" }
 *   event: completed data: { "result": {...} }
 *   event: failed    data: { "error": "..." }
 *   event: ping      data: { "t": <ms> }   (heartbeat)
 */

import { NextRequest } from 'next/server';
import { ensureDevUser } from '@/lib/learning';
import { db } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await ensureDevUser(req);
  const { id } = await params;

  // Verify the job belongs to the user
  const job = await db.studyJob.findUnique({ where: { id } });
  if (!job || job.userId !== user.id) {
    return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Job not found' } }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      // Heartbeat
      const heartbeat = setInterval(() => {
        try { emit('ping', { t: Date.now() }); } catch {}
      }, 8000);

      // Poll DB every 2s for status changes
      let lastProgress = -1;
      let lastStatus = '';
      const pollInterval = setInterval(async () => {
        try {
          const current = await db.studyJob.findUnique({ where: { id } });
          if (!current) {
            emit('failed', { error: 'Job not found' });
            clearInterval(pollInterval);
            clearInterval(heartbeat);
            controller.close();
            return;
          }

          if (current.progress !== lastProgress || current.status !== lastStatus) {
            lastProgress = current.progress;
            lastStatus = current.status;
            emit('progress', { progress: current.progress, status: current.status });
          }

          if (current.status === 'completed') {
            emit('completed', { result: current.resultJson ? JSON.parse(current.resultJson) : null });
            clearInterval(pollInterval);
            clearInterval(heartbeat);
            controller.close();
          } else if (current.status === 'failed' || current.status === 'timeout' || current.status === 'cancelled') {
            emit('failed', { error: current.errorMessage || current.status });
            clearInterval(pollInterval);
            clearInterval(heartbeat);
            controller.close();
          }
        } catch (e) {
          // continue polling
        }
      }, 2000);

      // Emit initial state
      emit('progress', { progress: job.progress, status: job.status });

      // Clean up on abort
      req.signal.addEventListener('abort', () => {
        clearInterval(pollInterval);
        clearInterval(heartbeat);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
