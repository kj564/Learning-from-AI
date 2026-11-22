/**
 * API: /api/v1/documents/presign — get a presigned upload URL.
 *
 * Per pelajarin E-AUTH-009: POST { filename, content_type, size_bytes }
 * → { data: { key, upload_url, expires_in } }.
 *
 * Storage key pattern: owned/<user_id>/uploads/<file_uuid>.<ext>
 * In dev, we store to local disk under WORKSPACE_STORAGE_ROOT (not R2).
 * In prod, swap to Cloudflare R2 presigned URLs (S3-compatible).
 */

import { NextRequest } from 'next/server';
import { ensureDevUser, setDevUserCookie, success, error, validationError, PLAN_LIMITS, getUsage } from '@/lib/learning';
import { db } from '@/lib/db';
import { randomUUID } from 'crypto';
import path from 'path';
import { mkdir } from 'fs/promises';

const STORAGE_ROOT = process.env.WORKSPACE_STORAGE_ROOT || '/home/z/agent-workspaces';
const PRESIGN_EXPIRY_SECONDS = 300;

export async function POST(req: NextRequest) {
  const user = await ensureDevUser(req);
  const body = await req.json().catch(() => ({}));
  const { filename, content_type, size_bytes } = body as any;

  // Validate
  const errors: any[] = [];
  if (!filename) errors.push({ field: 'body.filename', message: 'Required', type: 'invalid_type' });
  if (!content_type) errors.push({ field: 'body.content_type', message: 'Required', type: 'invalid_type' });
  if (size_bytes === undefined || size_bytes === null) errors.push({ field: 'body.size_bytes', message: 'Required', type: 'invalid_type' });
  if (errors.length > 0) return setDevUserCookie(validationError(errors), user.id);

  // Check size against plan limit
  const usage = await getUsage(user.id);
  if (usage) {
    const sub = await db.subscription.findUnique({ where: { userId: user.id } });
    const plan = PLAN_LIMITS[sub?.plan || 'free'];
    const maxBytes = plan.limits.mediaDurationLimitSeconds * 1024 * 1024; // rough: 1MB per second of media
    if (size_bytes > 500 * 1024 * 1024) {
      return setDevUserCookie(error('FILE_TOO_LARGE', 'File exceeds 500MB maximum', 413), user.id);
    }
  }

  // Generate storage key (per pelajarin pattern: owned/<user_id>/uploads/<uuid>.<ext>)
  const ext = filename.split('.').pop() || 'bin';
  const fileUuid = randomUUID();
  const storageKey = `owned/${user.id}/uploads/${fileUuid}.${ext}`;

  // Create StudyDocument record
  const doc = await db.studyDocument.create({
    data: {
      userId: user.id,
      filename,
      contentType: content_type,
      sizeBytes: size_bytes,
      storageKey,
      extractionStatus: 'pending',
    },
  });

  // In dev: construct a local upload URL (PUT to /api/v1/documents/[id]/upload)
  // In prod: construct R2 presigned URL (S3 AWS4-HMAC-SHA256)
  const uploadUrl = `${req.nextUrl.origin}/api/v1/documents/${doc.id}/upload`;

  return setDevUserCookie(success({
    key: storageKey,
    upload_url: uploadUrl,
    expires_in: PRESIGN_EXPIRY_SECONDS,
    document_id: doc.id,
  }), user.id);
}
