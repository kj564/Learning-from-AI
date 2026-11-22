/**
 * API: /api/v1/chat/completions — chat with Bimo (the study AI).
 *
 * Per pelajarin E-AUTH-008: POST { note_id, session_id, message } where
 * session_id is UUID. Sessions must exist — BUT we improve on pelajarin:
 * auto-create the session if it doesn't exist (simpler UX, pelajarin
 * requires a separate session-creation step we couldn't find).
 *
 * Streaming: fetch + ReadableStream (per pelajarin E-008). Same pattern
 * as our existing /api/chat/stream — we reuse the ZAI SDK's streaming.
 *
 * Chat is RAG-scoped: only the note's extracted text (from uploaded
 * documents) is used as context. The Bimo persona is casual Indonesian,
 * Socratic when tutoring (per PRODUCT.md).
 *
 * Free tier: 50 chats/month (vs pelajarin 0 — chat_blocked=true on free).
 */

import { NextRequest } from 'next/server';
import { ensureDevUser, setDevUserCookie, error, validationError, notFound, getUsage, incrementUsage } from '@/lib/learning';
import { db } from '@/lib/db';
import ZAI from 'z-ai-web-dev-sdk';

const BIMO_SYSTEM_PROMPT = `Kamu adalah Bimo, teman belajar AI untuk siswa dan mahasiswa Indonesia. Gaya bicara kamu kasual, ramah, pakai bahasa Indonesia sehari-hari. Kamu menjelaskan step by step sampai user paham, bukan sekadar kasih jawaban. Kalau user bingung, kamu tanya balik untuk tau di mana yang bingung. Kamu selalu merujuk ke materi yang user upload kalau ada, dengan format "Berdasarkan materi [halaman X]...". Kalau user minta bantuan soal, kamu kasih petunjuk dulu, bukan jawaban langsung — biar user mikir. Tapi kalau user stuck, kamu jelasin jawabannya pelan-pelan. Kamu gak pernah meremehkan user. Gak pernah bilang "itu kan gampang". Selalu supportive.`;

export async function POST(req: NextRequest) {
  const user = await ensureDevUser(req);
  const body = await req.json().catch(() => ({}));
  const { note_id, session_id, message } = body as any;

  // Validate (per pelajarin 422 pattern)
  const errors: any[] = [];
  if (!note_id) errors.push({ field: 'body.note_id', message: 'Required', type: 'invalid_type' });
  if (!session_id) errors.push({ field: 'body.session_id', message: 'Required', type: 'invalid_type' });
  if (!message) errors.push({ field: 'body.message', message: 'Required', type: 'invalid_type' });
  if (errors.length > 0) return setDevUserCookie(validationError(errors), user.id);

  // Check note exists + belongs to user
  const note = await db.studyNote.findUnique({ where: { id: note_id } });
  if (!note || note.userId !== user.id) return setDevUserCookie(notFound('Note not found'), user.id);

  // Check chat usage limit
  const usage = await getUsage(user.id);
  if (usage && !usage.canSendChat) {
    return setDevUserCookie(error('LIMIT_EXCEEDED', 'Chat limit reached for this period. Upgrade to Pro for unlimited chat.', 402), user.id);
  }

  // Auto-create session if it doesn't exist (IMPROVEMENT over pelajarin)
  let session = await db.chatSession.findUnique({ where: { id: session_id } });
  if (!session) {
    session = await db.chatSession.create({
      data: { id: session_id, noteId: note_id },
    });
  } else if (session.noteId !== note_id) {
    return setDevUserCookie(error('INVALID_SESSION', 'Chat session does not belong to this note', 400), user.id);
  }

  // Save user message
  await db.chatMessage.create({
    data: { sessionId: session_id, role: 'user', content: message },
  });

  // Increment chat usage
  await incrementUsage(user.id, 'chatsUsed');

  // RAG: fetch the note's extracted text (from linked documents)
  const fileIds: string[] = JSON.parse(note.fileIdsJson || '[]');
  const docs = fileIds.length > 0 ? await db.studyDocument.findMany({ where: { id: { in: fileIds } } }) : [];
  const noteContent = note.content || '';
  const docTexts = docs.map(d => d.extractedText || d.transcriptText || '').filter(t => t.length > 0);
  const ragContext = [noteContent, ...docTexts].filter(t => t.length > 0).join('\n\n---\n\n').slice(0, 8000);

  // Fetch chat history (last 10 messages for context)
  const history = await db.chatMessage.findMany({
    where: { sessionId: session_id },
    orderBy: { createdAt: 'asc' },
    take: 20,
  });
  const historyMessages = history.map(m => ({ role: m.role, content: m.content }));

  // Build the full prompt
  const systemPrompt = ragContext.length > 0
    ? `${BIMO_SYSTEM_PROMPT}\n\nKamu sedang diskusi materi berikut (yang user upload):\n\n${ragContext}`
    : BIMO_SYSTEM_PROMPT;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...historyMessages,
    { role: 'user', content: message },
  ];

  // Stream via ZAI SDK
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

      try {
        const zai = await ZAI.create();
        const response: any = await zai.chat.completions.create({
          messages,
          stream: true,
          model: 'glm-4-flash',  // fast + cheap for chat
        });

        let fullText = '';
        if (response && typeof response[Symbol.asyncIterator] === 'function') {
          for await (const chunk of response) {
            let text: string = '';
            if (chunk instanceof Uint8Array) {
              text = new TextDecoder().decode(chunk);
            } else if (typeof chunk === 'string') {
              text = chunk;
            } else {
              text = chunk?.choices?.[0]?.delta?.content || chunk?.choices?.[0]?.message?.content || '';
            }

            // Parse SSE lines
            for (const line of text.split('\n')) {
              if (!line.startsWith('data:')) continue;
              const data = line.slice(5).trim();
              if (data === '[DONE]' || !data) continue;
              try {
                const parsed = JSON.parse(data);
                const delta = parsed?.choices?.[0]?.delta?.content || '';
                if (delta) {
                  fullText += delta;
                  emit('text-delta', { text: delta });
                }
              } catch {}
            }
          }
        } else {
          fullText = response?.choices?.[0]?.message?.content || '';
          if (fullText) emit('text-delta', { text: fullText });
        }

        // Save assistant message
        await db.chatMessage.create({
          data: { sessionId: session_id, role: 'assistant', content: fullText },
        });

        emit('done', { session_id, message_id: session.id });
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
