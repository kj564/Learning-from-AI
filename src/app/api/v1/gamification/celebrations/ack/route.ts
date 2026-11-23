/**
 * API: /api/v1/gamification/celebrations/ack — acknowledge a celebration.
 * Per pelajarin RE: POST /gamification/celebrations/ack dismisses one.
 *
 * Body: { id: string }
 * We don't persist ack state (celebrations are derived from recent activity,
 * so they auto-expire after an hour). This endpoint just returns success.
 */

import { NextRequest } from 'next/server';
import { ensureDevUser, setDevUserCookie, success, validationError } from '@/lib/learning';

export async function POST(req: NextRequest) {
  const user = await ensureDevUser(req);
  const body = await req.json().catch(() => ({}));
  const { id } = body as { id?: string };

  if (!id) {
    return setDevUserCookie(validationError([{ field: 'body.id', message: 'Required', type: 'invalid_type' }]), user.id);
  }

  // In a real app we'd mark the celebration as acked in a table. Here we
  // just confirm receipt — the GET endpoint recomputes celebrations from
  // recent activity, so they naturally expire after an hour.
  return setDevUserCookie(success({ acked: id, at: new Date().toISOString() }), user.id);
}
