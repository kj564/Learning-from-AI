/**
 * POST /api/files/upload
 *
 * Upload a file (multipart/form-data) → extract text → return as context.
 * Used by the composer's "+" menu → "Upload file".
 *
 * Supported:
 *   - text/*, application/json, code files → read as UTF-8
 *   - application/pdf → pdf-parse
 *   - image/* → save + return asset URL (vision handles extraction later)
 *   - other → save as asset, return binary reference (no text extraction)
 *
 * Response: { success, file: { id, name, mime, size, text?, image?, assetUrl? } }
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { db } from '@/lib/db';

const ASSETS_DIR = path.join(process.cwd(), 'db', 'assets');
const MAX_SIZE = 20 * 1024 * 1024; // 20 MB

const TEXT_EXTS = new Set(['.txt', '.md', '.markdown', '.json', '.csv', '.tsv', '.yaml', '.yml', '.xml', '.html', '.css', '.js', '.jsx', '.ts', '.tsx', '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.php', '.sh', '.bash', '.sql', '.toml', '.ini', '.env', '.log', '.gitignore', '.dockerfile']);
const CODE_MIMES = new Set(['text/', 'application/json', 'application/xml', 'application/javascript', 'application/typescript', 'application/x-sh']);

async function extractTextFromPdf(buf: Buffer): Promise<string> {
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buf);
    return data.text.slice(0, 50000); // cap at 50k chars
  } catch (e) {
    return `[PDF parse failed: ${e instanceof Error ? e.message : String(e)}]`;
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: `File too large (max ${MAX_SIZE / 1024 / 1024}MB)` }, { status: 413 });
    }

    const name = file.name;
    const mime = file.type || 'application/octet-stream';
    const buf = Buffer.from(await file.arrayBuffer());

    // Images — save as asset, return URL (vision will describe on send)
    if (mime.startsWith('image/')) {
      if (!existsSync(ASSETS_DIR)) await mkdir(ASSETS_DIR, { recursive: true });
      const id = `upl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const ext = (name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
      const filename = `${id}.${ext}`;
      const fullPath = path.join(ASSETS_DIR, filename);
      await writeFile(fullPath, buf);
      await db.asset.create({ data: { id, kind: 'image', path: fullPath, mime, size: buf.length } });
      return NextResponse.json({
        success: true,
        file: { id, name, mime, size: buf.length, image: true, assetUrl: `/api/image/asset?id=${id}` },
      });
    }

    // PDFs — extract text via pdf-parse
    if (mime === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) {
      const text = await extractTextFromPdf(buf);
      return NextResponse.json({
        success: true,
        file: { id: `txt_${Date.now()}`, name, mime, size: buf.length, text },
      });
    }

    // Text/code files — read as UTF-8
    const ext = path.extname(name).toLowerCase();
    if (TEXT_EXTS.has(ext) || CODE_MIMES.has(mime) || mime.startsWith('text/')) {
      const text = buf.toString('utf-8').slice(0, 50000);
      return NextResponse.json({
        success: true,
        file: { id: `txt_${Date.now()}`, name, mime, size: buf.length, text },
      });
    }

    // Unknown — save as asset, no text extraction
    if (!existsSync(ASSETS_DIR)) await mkdir(ASSETS_DIR, { recursive: true });
    const id = `upl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const safeExt = (ext || '.bin').replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
    const filename = `${id}.${safeExt}`;
    const fullPath = path.join(ASSETS_DIR, filename);
    await writeFile(fullPath, buf);
    await db.asset.create({ data: { id, kind: 'file', path: fullPath, mime, size: buf.length } });
    return NextResponse.json({
      success: true,
      file: { id, name, mime, size: buf.length, assetUrl: `/api/asset?id=${id}` },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
