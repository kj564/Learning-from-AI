/**
 * API: /api/v1/documents — list user's uploaded documents.
 * Per pelajarin E-AUTH-004: cursor-based pagination.
 */

import { NextRequest } from 'next/server';
import { ensureDevUser, setDevUserCookie, success, cursorPaginationMeta } from '@/lib/learning';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await ensureDevUser(req);
  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)));
  const cursor = url.searchParams.get('cursor');

  const docs = await db.studyDocument.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });

  const hasMore = docs.length > limit;
  const items = hasMore ? docs.slice(0, limit) : docs;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return setDevUserCookie(success(
    items.map(d => ({
      id: d.id,
      filename: d.filename,
      content_type: d.contentType,
      size_bytes: d.sizeBytes,
      extraction_status: d.extractionStatus,
      duration_seconds: d.durationSeconds,
      youtube_video_id: d.youtubeVideoId,
      created_at: d.createdAt,
    })),
    cursorPaginationMeta(nextCursor, limit),
  ), user.id);
}
