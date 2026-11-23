/**
 * API: /api/v2/chat/clarify/stream — clarify/refine a chat answer via SSE.
 *
 * Per pelajarin RE (RECON-DEEP-v4 §2.1): this is the SSE sibling of
 * /api/v1/chat/completions. It's used when the user clicks "jelaskan ulang"
 * or "buat lebih simpel" in the Ask AI tab — re-generates the last assistant
 * answer with a different style, streaming the new response.
 *
 * Body: { session_id, mode: 'simpler'|'shorter'|'detailed'|'example', message? }
 *   - session_id: chat session to refine within
 *   - mode: how to rephrase (simpler = pakai analogi sederhana, shorter =
 *     lebih ringkas, detailed = lebih lengkap, example = dengan contoh)
 *   - message: optional explicit rephrase instruction (overrides mode)
 *
 * Response: SSE stream with text-delta events (same shape as
 * /api/v1/chat/completions) + a final done event with the new message id.
 */

import { NextRequest } from 'next/server';
import { ensureDevUser, setDevUserCookie, error, notFound, validationError } from '@/lib/learning';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

const MODE_INSTRUCTIONS: Record<string, string> = {
  simpler: 'Jelaskan ulang dengan bahasa yang lebih simpel dan analogi yang relate ke kehidupan sehari-hari siswa Indonesia.',
  shorter: 'Jelaskan ulang tapi lebih ringkas — hanya poin-poin penting, gak perlu panjang lebar.',
  detailed: 'Jelaskan ulang dengan lebih lengkap dan detail. Tambahkan contoh dan step by step.',
  example: 'Jelaskan ulang dengan banyak contoh konkret yang relate ke kehidupan siswa Indonesia.',
};

const BIMO_SYSTEM_PROMPT = `Kamu adalah Bimo, teman belajar AI untuk siswa Indonesia. Gaya bicara kasual, ramah, pakai bahasa Indonesia sehari-hari. Kamu menjelaskan step by step sampai user paham. Selalu supportive, gak pernah meremehkan.`;

export async function POST(req: NextRequest) {
  const user = await ensureDevUser(req);
  const body = await req.json().catch(() => ({}));
  const { session_id, mode = 'simpler', message } = body as { session_id?: string; mode?: string; message?: string };

  const errors: any[] = [];
  if (!session_id) errors.push({ field: 'body.session_id', message: 'Required', type: 'invalid_type' });
  if (!message && !MODE_INSTRUCTIONS[mode]) errors.push({ field: 'body.mode', message: 'Must be one of: simpler, shorter, detailed, example', type: 'invalid_enum' });
  if (errors.length > 0) return setDevUserCookie(validationError(errors), user.id);

  // Validate session
  const session = await db.chatSession.findUnique({ where: { id: session_id } });
  if (!session) return setDevUserCookie(notFound('Chat session not found'), user.id);
  if (session.noteId) {
    const note = await db.studyNote.findUnique({ where: { id: session.noteId } });
    if (!note || note.userId !== user.id) return setDevUserCookie(notFound('Note not found'), user.id);
  }

  // Fetch the last assistant + user messages
  const history = await db.chatMessage.findMany({
    where: { sessionId: session_id },
    orderBy: { createdAt: 'asc' },
    take: 20,
  });
  if (history.length === 0) {
    return setDevUserCookie(error('NO_HISTORY', 'No messages to clarify. Send a message first.', 400), user.id);
  }

  const lastAssistant = [...history].reverse().find(m => m.role === 'assistant');
  const lastUser = [...history].reverse().find(m => m.role === 'user');
  if (!lastAssistant) {
    return setDevUserCookie(error('NO_ASSISTANT', 'No assistant message to clarify', 400), user.id);
  }

  // RAG context (same as /api/v1/chat/completions)
  let ragContext = '';
  if (session.noteId) {
    const note = await db.studyNote.findUnique({ where: { id: session.noteId } });
    if (note) {
      const fileIds: string[] = JSON.parse(note.fileIdsJson || '[]');
      const docs = fileIds.length > 0 ? await db.studyDocument.findMany({ where: { id: { in: fileIds } } }) : [];
      const docTexts = docs.map(d => d.extractedText || '').filter(t => t.length > 0);
      ragContext = [note.content || '', ...docTexts].filter(Boolean).join('\n\n---\n\n').slice(0, 8000);
    }
  }

  const instruction = message || MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS.simpler;
  const systemPrompt = ragContext.length > 0
    ? `${BIMO_SYSTEM_PROMPT}\n\nKamu sedang diskusi materi ini:\n\n${ragContext}\n\nTugasmu: ambil jawaban terakhir kamu, dan ${instruction}`
    : `${BIMO_SYSTEM_PROMPT}\n\nTugasmu: ambil jawaban terakhir kamu, dan ${instruction}`;

  // Build the clarify messages — include the original user question + the
  // assistant answer to clarify, plus the new instruction
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: lastUser?.content || 'Pertanyaan sebelumnya' },
    { role: 'assistant', content: lastAssistant.content },
    { role: 'user', content: `${instruction}\n\nBerikan versi barunya saja, jangan ulangi "baik, ini versi barunya" atau basa-basi.` },
  ];

  // Stream the clarified answer via SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (event: string, data: any) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const heartbeat = setInterval(() => { try { emit('ping', { t: Date.now() }); } catch {} }, 8000);

      try {
        const zai = await ZAI.create();
        const response: any = await zai.chat.completions.create({
          messages,
          stream: true,
          model: 'glm-4-flash',
        });

        let fullText = '';
        if (response && typeof response[Symbol.asyncIterator] === 'function') {
          for await (const chunk of response) {
            let text: string = '';
            if (chunk instanceof Uint8Array) text = new TextDecoder().decode(chunk);
            else if (typeof chunk === 'string') text = chunk;
            else text = chunk?.choices?.[0]?.delta?.content || chunk?.choices?.[0]?.message?.content || '';

            for (const line of text.split('\n')) {
              if (!line.startsWith('data:')) continue;
              const data = line.slice(5).trim();
              if (data === '[DONE]' || !data) continue;
              try {
                const parsed = JSON.parse(data);
                const delta = parsed?.choices?.[0]?.delta?.content || '';
                if (delta) { fullText += delta; emit('text-delta', { text: delta }); }
              } catch {}
            }
          }
        } else {
          fullText = response?.choices?.[0]?.message?.content || '';
          if (fullText) emit('text-delta', { text: fullText });
        }

        // Save the clarified message as a new assistant message
        const saved = await db.chatMessage.create({
          data: { sessionId: session_id, role: 'assistant', content: fullText },
        });
        emit('done', { session_id, message_id: saved.id, mode });
      } catch (e: any) {
        emit('error', { message: e.message || String(e) });
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
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
