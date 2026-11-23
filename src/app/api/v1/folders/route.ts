/**
 * API: /api/v1/folders — note organization.
 * Per pelajarin RE (RECON-DEEP-v4 §2.3): GET + POST /folders. Notes can be
 * assigned to a folder via the existing /api/v1/notes PATCH (folder_id field).
 *
 * GET  — list user's folders (with note counts)
 * POST — create a folder { name, color?, icon? }
 */

import { NextRequest } from 'next/server';
import { ensureDevUser, setDevUserCookie, success, error, validationError } from '@/lib/learning';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await ensureDevUser(req);

  const folders = await db.folder.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
  });

  // Count notes in each folder
  const counts = await db.studyNote.groupBy({
    by: ['folderId'],
    where: { userId: user.id, folderId: { not: null } },
    _count: { id: true },
  });
  const countMap = new Map(counts.map(c => [c.folderId, c._count.id]));

  return setDevUserCookie(success(folders.map(f => ({
    id: f.id,
    name: f.name,
    color: f.color,
    icon: f.icon,
    note_count: countMap.get(f.id) || 0,
    created_at: f.createdAt,
    updated_at: f.updatedAt,
  }))), user.id);
}

export async function POST(req: NextRequest) {
  const user = await ensureDevUser(req);
  const body = await req.json().catch(() => ({}));
  const { name, color, icon } = body as { name?: string; color?: string; icon?: string };

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return setDevUserCookie(validationError([{ field: 'body.name', message: 'Required', type: 'invalid_type' }]), user.id);
  }
  if (name.length > 50) {
    return setDevUserCookie(error('NAME_TOO_LONG', 'Folder name max 50 characters', 400), user.id);
  }

  const folder = await db.folder.create({
    data: {
      userId: user.id,
      name: name.trim(),
      color: color || '#f76703',
      icon: icon || 'folder',
    },
  });

  return setDevUserCookie(success({
    id: folder.id,
    name: folder.name,
    color: folder.color,
    icon: folder.icon,
    note_count: 0,
    created_at: folder.createdAt,
  }, 201), user.id);
}
