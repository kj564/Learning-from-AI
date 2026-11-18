/**
 * Asset storage helpers — persists SDK-generated images/audio to disk + DB.
 *
 * All SDK calls return base64 (images) or audio buffers (TTS). We save them to
 * db/assets/<id>.<ext> and create an Asset row so they survive reloads and can
 * be served via /api/image/asset?id=... and /api/audio/asset?id=...
 */

import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { db } from './db';

export const ASSETS_DIR = path.join(process.cwd(), 'db', 'assets');

async function ensureAssetsDir() {
  if (!existsSync(ASSETS_DIR)) await mkdir(ASSETS_DIR, { recursive: true });
}

/** Save a base64-encoded PNG/WEBP image to disk + DB, return public URL. */
export async function saveBase64Image(
  base64: string,
  ext: 'png' | 'webp' | 'jpg' = 'png'
): Promise<{ id: string; url: string; path: string; size: number }> {
  await ensureAssetsDir();
  const id = `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const filename = `${id}.${ext}`;
  const fullPath = path.join(ASSETS_DIR, filename);
  const buffer = Buffer.from(base64, 'base64');
  await writeFile(fullPath, buffer);
  await db.asset.create({
    data: { id, kind: 'image', path: fullPath, mime: `image/${ext}`, size: buffer.length },
  });
  return { id, url: `/api/image/asset?id=${id}`, path: fullPath, size: buffer.length };
}

/** Save an audio buffer (WAV/MP3/PCM) to disk + DB, return public URL. */
export async function saveAudioBuffer(
  buf: Buffer,
  ext: 'wav' | 'mp3' | 'pcm' = 'wav'
): Promise<{ id: string; url: string; path: string; size: number }> {
  await ensureAssetsDir();
  const id = `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const filename = `${id}.${ext}`;
  const fullPath = path.join(ASSETS_DIR, filename);
  await writeFile(fullPath, buf);
  await db.asset.create({
    data: { id, kind: 'audio', path: fullPath, mime: `audio/${ext}`, size: buf.length },
  });
  return { id, url: `/api/audio/asset?id=${id}`, path: fullPath, size: buf.length };
}

/** Save an uploaded file (any kind) to disk + DB. */
export async function saveUploadedFile(
  buf: Buffer,
  name: string,
  mime: string
): Promise<{ id: string; url: string; path: string; size: number }> {
  await ensureAssetsDir();
  const id = `upl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  // Sanitize the extension: strip everything except [a-z0-9], lowercase, fallback to bin.
  // Prevents path traversal via names like "evil.png/../../foo" or "evil.PHP".
  const rawExt = (name.split('.').pop() || 'bin').toLowerCase();
  const safeExt = rawExt.replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin';
  const filename = `${id}.${safeExt}`;
  const fullPath = path.join(ASSETS_DIR, filename);
  await writeFile(fullPath, buf);
  const kind = mime.startsWith('image/') ? 'image' : mime.startsWith('audio/') ? 'audio' : 'file';
  await db.asset.create({
    data: { id, kind, path: fullPath, mime, size: buf.length },
  });
  return { id, url: `/api/asset?id=${id}`, path: fullPath, size: buf.length };
}

/** Read an asset's path from DB by id. */
export async function getAssetPath(id: string): Promise<{ path: string; mime: string; kind: string } | null> {
  const a = await db.asset.findUnique({ where: { id } });
  if (!a) return null;
  return { path: a.path, mime: a.mime, kind: a.kind };
}
