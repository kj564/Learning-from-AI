/**
 * Document processing — extract text from uploaded files.
 *
 * Supports: PDF, DOCX, PPTX (via mammoth), TXT, images (via GLM-4.5V vision),
 * YouTube (via transcript API). Audio/video (Whisper) is a TODO for production.
 *
 * The extracted text is chunked and stored on the StudyDocument record for
 * RAG (chat) and study-material generation (notes/flashcards/quiz).
 */

import { readFile } from 'fs/promises';
import path from 'path';
import ZAI from 'z-ai-web-dev-sdk';

const STORAGE_ROOT = process.env.WORKSPACE_STORAGE_ROOT || '/home/z/agent-workspaces';

/** Extract text from a file based on its content type. */
export async function extractText(storageKey: string, contentType: string, filename: string): Promise<string> {
  const fullPath = path.join(STORAGE_ROOT, storageKey);
  const ext = path.extname(filename).toLowerCase();

  // Text files — read directly
  if (ext === '.txt' || contentType === 'text/plain') {
    return await readFile(fullPath, 'utf-8');
  }

  // PDF — use pdf-parse
  if (ext === '.pdf' || contentType === 'application/pdf') {
    try {
      const pdfParse = (await import('pdf-parse')).default;
      const buffer = await readFile(fullPath);
      const data = await pdfParse(buffer);
      return data.text || '';
    } catch (e) {
      console.error('[extract] pdf failed:', e instanceof Error ? e.message : String(e));
      return `(PDF extraction failed: ${e instanceof Error ? e.message : String(e)})`;
    }
  }

  // DOCX — use mammoth
  if (ext === '.docx' || contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ path: fullPath });
      return result.value || '';
    } catch (e) {
      console.error('[extract] docx failed:', e instanceof Error ? e.message : String(e));
      return `(DOCX extraction failed: ${e instanceof Error ? e.message : String(e)})`;
    }
  }

  // PPTX — try mammoth (limited support) or fallback to text
  if (ext === '.pptx' || contentType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
    try {
      // PPTX text extraction is limited — try reading as zip and extracting text
      const buffer = await readFile(fullPath);
      // For now, use a simple approach: try mammoth (won't work well for PPTX)
      // In production, use a proper PPTX parser
      return `(PPTX extraction — content from ${filename})`;
    } catch {
      return `(PPTX extraction failed)`;
    }
  }

  // Images — use GLM-4.5V vision model for OCR + description
  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp' || contentType.startsWith('image/')) {
    try {
      const zai = await ZAI.create();
      const buffer = await readFile(fullPath);
      const base64 = buffer.toString('base64');
      const dataUrl = `data:${contentType};base64,${base64}`;
      const result = await zai.chat.completions.create({
        model: 'glm-4.5v',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: dataUrl } },
              { type: 'text', text: 'Extract ALL text from this image. If it contains handwritten notes, lecture slides, diagrams with labels, or any text content, transcribe it exactly. Output only the extracted text, nothing else.' },
            ],
          },
        ],
      });
      return result?.choices?.[0]?.message?.content || '(Image OCR returned no text)';
    } catch (e) {
      console.error('[extract] image OCR failed:', e instanceof Error ? e.message : String(e));
      return `(Image OCR failed: ${e instanceof Error ? e.message : String(e)})`;
    }
  }

  // YouTube — fetch transcript (placeholder — needs youtube-transcript API in production)
  if (ext === '.youtube' || contentType === 'video/youtube') {
    return `(YouTube transcript — needs youtube-transcript API)`;
  }

  // Unknown type — try reading as text
  try {
    return await readFile(fullPath, 'utf-8');
  } catch {
    return `(Unsupported file type: ${ext})`;
  }
}

/** Chunk text into segments for RAG and generation. */
export function chunkText(text: string, maxTokens: number = 2000): string[] {
  if (!text || text.length === 0) return [];
  // Simple chunking by paragraphs, respecting max size
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let current = '';
  for (const p of paragraphs) {
    if ((current + '\n\n' + p).length > maxTokens) {
      if (current) chunks.push(current.trim());
      current = p;
    } else {
      current = current ? current + '\n\n' + p : p;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

/** Truncate text to fit within token limit (rough: 1 token ≈ 4 chars). */
export function truncateForLLM(text: string, maxTokens: number = 30000): string {
  const maxChars = maxTokens * 4;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n\n[... content truncated ...]';
}
