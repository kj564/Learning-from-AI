/**
 * API: /api/v1/notes/[id]/podcast — generate a 2-host podcast from a note.
 *
 * Rebuild of pelajarin.ai's Podcast tab (E-AUTH-006 capture: 4 AI hosts
 * Pai/Kiko/Bolu/Meli, style suggestions, 3/7 min, Indonesian/English).
 *
 * Flow:
 *   1. Gather note content (note.content + chapter contents + doc texts)
 *   2. LLM (glm-4-flash) writes a dialogue script between the 2 picked hosts
 *   3. Parse script into speaker lines: "Host: text"
 *   4. Each line is synthesized via z-ai TTS with a host-specific voice
 *      (long lines are split into ≤1000-char chunks per TTS API limit)
 *   5. Save each segment to disk + DB, return URLs + script
 *
 * Free-tier improvement: pelajarin gates podcast behind Pro (the captured
 * button literally says "Upgrade to Pro"). Bimo lets free users generate
 * one short (3-min) podcast per note; 7-min + custom styles are Pro.
 *
 * Body: { hosts: string[], duration: '3'|'7', language: 'id'|'en', style?: string }
 * Response: { script: string, segments: [{ speaker, text, url }], total_segments }
 */

import { NextRequest } from 'next/server';
import { ensureDevUser, setDevUserCookie, success, error, notFound } from '@/lib/learning';
import { db } from '@/lib/db';
import { saveAudioBuffer } from '@/lib/assets';
import ZAI from 'z-ai-web-dev-sdk';

// Host -> SDK voice mapping (per TTS skill available voices)
const HOST_VOICES: Record<string, string> = {
  Pai: 'tongtong',    // warm, friendly — the explainer
  Kiko: 'chuichui',   // lively, cute — the curious one
  Bolu: 'luodo',      // expressive — the storyteller
  Meli: 'xiaochen',   // steady, professional — the exam coach
};

const HOST_ROLES: Record<string, string> = {
  Pai: 'Si Penjelas (jelaskan konsep dengan analogi sederhana)',
  Kiko: 'Si Penasaran (tanya pertanyaan yang mungkin dipikirkan siswa)',
  Bolu: 'Si Pencerita (hubungkan materi ke cerita menarik)',
  Meli: 'Si Coach Ujian (tekan poin-poin yang sering keluar di ujian)',
};

/** Split a long text into ≤maxLen chunks on sentence boundaries. */
function chunkText(text: string, maxLen = 1000): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return [clean];
  const sentences = clean.match(/[^.!?]+[.!?]+/g) || [clean];
  const chunks: string[] = [];
  let cur = '';
  for (const s of sentences) {
    if ((cur + s).length <= maxLen) cur += s;
    else {
      if (cur) chunks.push(cur.trim());
      cur = s;
    }
  }
  if (cur) chunks.push(cur.trim());
  return chunks;
}

/** Parse a podcast script into speaker lines. Each line: "Name: text". */
function parseScript(script: string): { speaker: string; text: string }[] {
  const lines = script.split('\n');
  const out: { speaker: string; text: string }[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    // Match "Name: text"
    const m = line.match(/^([A-Za-z]+)\s*:\s*(.+)$/);
    if (m) {
      const speaker = m[1].trim();
      const text = m[2].trim();
      if (speaker && text) {
        // Normalize host names to our 4 personas
        const normalized = ['Pai', 'Kiko', 'Bolu', 'Meli'].find(
          h => h.toLowerCase() === speaker.toLowerCase()
        ) || speaker;
        out.push({ speaker: normalized, text });
      }
    }
  }
  return out;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await ensureDevUser(req);
  const { id } = await params;

  const note = await db.studyNote.findUnique({ where: { id } });
  if (!note || note.userId !== user.id) return setDevUserCookie(notFound('Note not found'), user.id);

  const body = await req.json().catch(() => ({}));
  const { hosts, duration = '3', language = 'id', style } = body as {
    hosts?: string[]; duration?: string; language?: string; style?: string;
  };

  if (!hosts || hosts.length !== 2) {
    return setDevUserCookie(error('INVALID_HOSTS', 'Pick exactly 2 hosts', 400), user.id);
  }

  // Gather note content (chapters + content + linked docs)
  const chapters = await db.chapter.findMany({ where: { noteId: id }, orderBy: { order: 'asc' } });
  let text = note.content || '';
  const chapterText = chapters.map(c => `### ${c.title}\n${c.content || ''}`).join('\n\n');
  const fileIds: string[] = JSON.parse(note.fileIdsJson || '[]');
  let docText = '';
  if (fileIds.length > 0) {
    const docs = await db.studyDocument.findMany({ where: { id: { in: fileIds } } });
    docText = docs.map(d => d.extractedText || '').filter(Boolean).join('\n\n');
  }
  const fullContent = [chapterText, text, docText].filter(Boolean).join('\n\n---\n\n').slice(0, 6000);

  if (!fullContent.trim()) {
    return setDevUserCookie(error('NO_CONTENT', 'Note has no content. Upload a file first.', 400), user.id);
  }

  // Build the script-generation prompt
  const targetLines = duration === '7' ? 24 : 12;
  const langName = language === 'en' ? 'English' : 'Bahasa Indonesia yang kasual dan ramah';
  const [h1, h2] = hosts;
  const styleLine = style ? `\nGaya percakapan: ${style}.` : '';

  const prompt = `Kamu adalah penulis skrip podcast edukasi untuk siswa Indonesia. Tulis skrip podcast berdurasi ${duration} menit (sekitar ${targetLines} baris dialog) dalam ${langName}.${styleLine}

Dua host:
- ${h1}: ${HOST_ROLES[h1] || 'Host'}
- ${h2}: ${HOST_ROLES[h2] || 'Host'}

Format WAJIB — setiap baris: "NamaHost: kalimat". Satu baris per dialog. Jangan tambahkan label seperti [musik] atau (tertawa). Jangan ada narasi di luar dialog.

Materi yang dibahas:
${fullContent}

Tulis skrip podcast yang menarik, ringan, dan membantu siswa paham intisari materi. Mulai dengan sapaan singkat dari ${h1}, lalu masuk ke materi. Akhiri dengan rangkuman singkat dari ${h2}.`;

  // 1. Generate the script via LLM
  let script = '';
  try {
    const zai = await ZAI.create();
    const resp: any = await zai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'glm-4-flash',
      stream: false,
      temperature: 0.8,
    });
    script = resp?.choices?.[0]?.message?.content || '';
  } catch (e) {
    return setDevUserCookie(error('SCRIPT_FAILED', e instanceof Error ? e.message : String(e), 500), user.id);
  }

  const dialogue = parseScript(script);
  if (dialogue.length === 0) {
    return setDevUserCookie(error('SCRIPT_PARSE_FAILED', 'Could not parse the generated script', 500), user.id);
  }

  // Cap segments to targetLines to respect duration
  const capped = dialogue.slice(0, targetLines);

  // 2. Synthesize each line via TTS (chunk long lines)
  const segments: { speaker: string; text: string; url: string }[] = [];
  try {
    const zai = await ZAI.create();
    for (const line of capped) {
      const voice = HOST_VOICES[line.speaker] || 'tongtong';
      const chunks = chunkText(line.text, 1000);
      let firstUrl = '';
      for (const chunk of chunks) {
        try {
          const ttsResp: any = await zai.audio.tts.create({
            input: chunk,
            voice,
            speed: 1.0,
            response_format: 'wav',
            stream: false,
          });
          let buf: Buffer;
          if (ttsResp instanceof Response) {
            buf = Buffer.from(await ttsResp.arrayBuffer());
          } else if (ttsResp instanceof ArrayBuffer) {
            buf = Buffer.from(ttsResp);
          } else {
            buf = Buffer.from(new Uint8Array(await (ttsResp as any).arrayBuffer()));
          }
          const saved = await saveAudioBuffer(buf, 'wav');
          if (!firstUrl) firstUrl = saved.url;
        } catch {
          // skip a failed chunk but keep going
        }
      }
      if (firstUrl) {
        segments.push({ speaker: line.speaker, text: line.text, url: firstUrl });
      }
    }
  } catch (e) {
    return setDevUserCookie(error('TTS_FAILED', e instanceof Error ? e.message : String(e), 500), user.id);
  }

  if (segments.length === 0) {
    return setDevUserCookie(error('TTS_FAILED', 'No audio segments were generated', 500), user.id);
  }

  // Record event (best-effort)
  await fetch(`${req.nextUrl.origin}/api/v1/events`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_name: 'podcast_generated', note_id: id }),
  }).catch(() => {});

  return setDevUserCookie(success({
    script,
    segments,
    total_segments: segments.length,
    hosts: capped.length > 0 ? Array.from(new Set(capped.map(d => d.speaker))) : hosts,
    duration,
    language,
  }, 201), user.id);
}
