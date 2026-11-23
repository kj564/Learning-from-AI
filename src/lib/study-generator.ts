/**
 * Study material generation — LLM calls for notes, flashcards, quiz.
 *
 * Uses z-ai-web-dev-sdk (GLM models) with structured output prompts.
 * Each function takes extracted text + returns structured JSON.
 *
 * Generation is async: caller creates a StudyJob, calls these functions,
 * updates the job progress via SSE, and writes results to the DB.
 */

import ZAI from 'z-ai-web-dev-sdk';
import { truncateForLLM } from '@/lib/document-processing';

// ============================================================
// Notes generation — chapters from extracted text
// ============================================================

export interface GeneratedChapter {
  title: string;
  content: string;
  keyTerms: { term: string; definition: string }[];
}

export async function generateNotes(extractedText: string, noteTitle: string): Promise<{ chapters: GeneratedChapter[]; content: string }> {
  const zai = await ZAI.create();
  const text = truncateForLLM(extractedText, 30000);

  const prompt = `Anda adalah Bimo, AI tutor untuk siswa Indonesia. Berikut adalah materi yang diupload user berjudul "${noteTitle}".

Materi:
${text}

Tugas: Buat catatan belajar yang terstruktur dalam bahasa Indonesia. Bagus materi menjadi beberapa bab (chapter). Setiap bab punya:
1. Judul bab yang jelas
2. Ringkasan isi bab (dalam format markdown, 200-400 kata per bab)
3. Istilah penting (key terms) dengan definisinya

Output dalam format JSON persis seperti ini:
{
  "chapters": [
    {
      "title": "Judul Bab 1",
      "content": "Isi bab dalam markdown...",
      "keyTerms": [
        {"term": "Istilah", "definition": "Definisi singkat"}
      ]
    }
  ]
}

Jangan tambahkan teks di luar JSON. Output JSON saja.`;

  const response = await zai.chat.completions.create({
    model: 'glm-4-flash',
    messages: [{ role: 'user', content: prompt }],
  });

  const rawContent = response?.choices?.[0]?.message?.content || '';
  return parseJSONResponse(rawContent, { chapters: [], content: rawContent });
}

// ============================================================
// Notes generation from a text prompt (no uploaded file needed)
// ============================================================

/**
 * Generate a full note (chapters + content) from a short user prompt like
 * "Fotosintesis" or "Sejarah Indonesia kemerdekaan". This powers the
 * `POST /api/v1/notes/generate` endpoint that pelajarin exposes — the
 * "What would you like to learn?" textarea fires this instead of creating
 * an empty placeholder note.
 *
 * The LLM acts as a subject-matter expert and writes the teaching material
 * itself (chapters + key terms), in the same JSON shape as generateNotes
 * so the downstream pipeline is identical.
 */
export async function generateNotesFromPrompt(prompt: string, noteTitle: string): Promise<{ chapters: GeneratedChapter[]; content: string }> {
  const zai = await ZAI.create();
  const cleanPrompt = prompt.trim().slice(0, 500);

  const systemPrompt = `Anda adalah Bimo, AI tutor untuk siswa Indonesia. User minta materi belajar tentang: "${noteTitle}".

Prompt user: "${cleanPrompt}"

Tugas: Buat catatan belajar yang lengkap dan terstruktur dalam bahasa Indonesia tentang topik tersebut. Seolah-olah Anda adalah guru yang menjelaskan topik ini dari awal untuk siswa. Bagi materi menjadi 3-5 bab. Setiap bab punya:
1. Judul bab yang jelas
2. Isi bab dalam format markdown (200-400 kata per bab) — jelaskan konsep, beri contoh, pakai analogi yang relate ke kehidupan siswa Indonesia
3. Istilah penting (key terms) dengan definisinya

Pastikan materi akurat, lengkap, dan sesuai kurikulum. Output JSON persis:
{
  "chapters": [
    {
      "title": "Judul Bab 1",
      "content": "Isi bab dalam markdown...",
      "keyTerms": [
        {"term": "Istilah", "definition": "Definisi singkat"}
      ]
    }
  ]
}

JSON saja, tanpa teks lain.`;

  const response = await zai.chat.completions.create({
    model: 'glm-4-flash',
    messages: [{ role: 'user', content: systemPrompt }],
  });

  const rawContent = response?.choices?.[0]?.message?.content || '';
  return parseJSONResponse(rawContent, { chapters: [], content: rawContent });
}

// ============================================================
// Flashcard generation — Q/A pairs from text
// ============================================================

export interface GeneratedFlashcard {
  front: string;
  back: string;
}

export async function generateFlashcards(extractedText: string, count: number = 10): Promise<GeneratedFlashcard[]> {
  const zai = await ZAI.create();
  const text = truncateForLLM(extractedText, 20000);

  const prompt = `Anda adalah Bimo, AI tutor. Dari materi berikut, buat ${count} flashcard untuk belajar.

Materi:
${text}

Setiap flashcard punya:
- front: pertanyaan singkat (maks 100 kata)
- back: jawaban yang jelas dan lengkap (maks 200 kata)

Output JSON:
{"flashcards": [{"front": "pertanyaan", "back": "jawaban"}]}

JSON saja, tanpa teks lain.`;

  const response = await zai.chat.completions.create({
    model: 'glm-4-flash',
    messages: [{ role: 'user', content: prompt }],
  });

  const rawContent = response?.choices?.[0]?.message?.content || '';
  const parsed = parseJSONResponse(rawContent, { flashcards: [] });
  return parsed.flashcards || [];
}

// ============================================================
// Quiz generation — MC questions from text
// ============================================================

export interface GeneratedQuestion {
  type: 'mc' | 'sa';
  question: string;
  options?: string[];
  answer: string;
  explanation: string;
  hint: string;
  difficulty: 'easy' | 'medium' | 'hard';
  xp: number;
}

export async function generateQuiz(extractedText: string, count: number = 5): Promise<GeneratedQuestion[]> {
  const zai = await ZAI.create();
  const text = truncateForLLM(extractedText, 20000);

  const prompt = `Anda adalah Bimo, AI tutor. Dari materi berikut, buat ${count} soal kuis pilihan ganda.

Materi:
${text}

Setiap soal punya:
- type: "mc" (pilihan ganda)
- question: pertanyaan yang jelas
- options: 4 pilihan jawaban (array string)
- answer: jawaban yang benar (harus sama persis dengan salah satu option)
- explanation: penjelasan kenapa jawaban itu benar (1-2 kalimat)
- hint: petunjuk singkat untuk membantu siswa (tanpa memberikan jawaban langsung)
- difficulty: "easy" | "medium" | "hard"
- xp: 10 (default)

Output JSON:
{"questions": [
  {"type":"mc","question":"...","options":["A","B","C","D"],"answer":"B","explanation":"...","hint":"...","difficulty":"medium","xp":10}
]}

JSON saja, tanpa teks lain.`;

  const response = await zai.chat.completions.create({
    model: 'glm-4-flash',
    messages: [{ role: 'user', content: prompt }],
  });

  const rawContent = response?.choices?.[0]?.message?.content || '';
  const parsed = parseJSONResponse(rawContent, { questions: [] });
  return parsed.questions || [];
}

// ============================================================
// Mindmap generation — node-edge graph from text
// ============================================================

export interface MindmapNode {
  id: string;
  label: string;
  level: number;
  parentId: string | null;
}
export interface MindmapEdge {
  source: string;
  target: string;
}
export interface GeneratedMindmap {
  nodes: MindmapNode[];
  edges: MindmapEdge[];
}

export async function generateMindmap(extractedText: string, noteTitle: string): Promise<GeneratedMindmap> {
  const zai = await ZAI.create();
  const text = truncateForLLM(extractedText, 15000);

  const prompt = `Dari materi berjudul "${noteTitle}", buat mindmap dalam format JSON.

Materi:
${text}

Mindmap punya:
- nodes: array node dengan {id, label, level (1=root, 2=subtopic, 3=detail), parentId}
- edges: array edge dengan {source, target}

Contoh:
{
  "nodes": [
    {"id":"node-0","label":"${noteTitle}","level":1,"parentId":null},
    {"id":"node-1","label":"Subtopic 1","level":2,"parentId":"node-0"},
    {"id":"node-2","label":"Detail 1","level":3,"parentId":"node-1"}
  ],
  "edges": [
    {"source":"node-0","target":"node-1"},
    {"source":"node-1","target":"node-2"}
  ]
}

Buat 5-15 node. JSON saja.`;

  const response = await zai.chat.completions.create({
    model: 'glm-4-flash',
    messages: [{ role: 'user', content: prompt }],
  });

  const rawContent = response?.choices?.[0]?.message?.content || '';
  return parseJSONResponse(rawContent, { nodes: [{ id: 'node-0', label: noteTitle, level: 1, parentId: null }], edges: [] });
}

// ============================================================
// Helper: parse JSON from LLM response (handles markdown code blocks)
// ============================================================

function parseJSONResponse<T>(raw: string, fallback: T): T {
  try {
    // Try direct parse
    return JSON.parse(raw);
  } catch {
    // Try extracting from markdown code block
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[1].trim()); } catch {}
    }
    // Try finding first { ... } block
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return JSON.parse(raw.slice(start, end + 1)); } catch {}
    }
    console.error('[generator] JSON parse failed, returning fallback');
    return fallback;
  }
}
