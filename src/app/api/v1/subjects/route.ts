/**
 * API: /api/v1/subjects — CRUD for note/exam subjects.
 * Per pelajarin E-AUTH-012: subjects are first-class with {id, name, icon, icon_color}.
 */

import { NextRequest } from 'next/server';
import { ensureDevUser, setDevUserCookie, success, successWithPagination, validationError, parsePagination, pagePaginationMeta } from '@/lib/learning';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await ensureDevUser(req);
  const { page, limit } = parsePagination(req);

  const [subjects, totalCount] = await Promise.all([
    db.subject.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.subject.count({ where: { userId: user.id } }),
  ]);

  return setDevUserCookie(successWithPagination(
    subjects.map(s => ({ id: s.id, name: s.name, icon: s.icon, icon_color: s.iconColor, created_at: s.createdAt })),
    pagePaginationMeta(page, limit, totalCount),
  ), user.id);
}

export async function POST(req: NextRequest) {
  const user = await ensureDevUser(req);
  const body = await req.json().catch(() => ({}));
  const { name, icon, icon_color } = body as any;

  if (!name) return setDevUserCookie(validationError([{ field: 'body.name', message: 'Required', type: 'invalid_type' }]), user.id);

  const subject = await db.subject.create({
    data: {
      userId: user.id,
      name,
      icon: icon || null,
      iconColor: icon_color || null,
    },
  });

  return setDevUserCookie(success({
    id: subject.id,
    name: subject.name,
    icon: subject.icon,
    icon_color: subject.iconColor,
    created_at: subject.createdAt,
  }, 201), user.id);
}
