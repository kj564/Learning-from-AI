/**
 * API: /api/v1/subscriptions — plan limits + current usage.
 * Per pelajarin E-AUTH-003: returns {plan: {id, name, limits: {...}},
 * usage: {...}, variant_key, subscription_details}.
 *
 * Our free tier is far more generous than pelajarin (15 notes, 50 chats,
 * full quiz/flashcard vs their 1 note, 0 chat, first-only).
 */

import { NextRequest } from 'next/server';
import { ensureDevUser, setDevUserCookie, getUsage, PLAN_LIMITS, success } from '@/lib/learning';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await ensureDevUser(req);
  const sub = await db.subscription.findUnique({ where: { userId: user.id } });
  if (!sub) {
    return setDevUserCookie(success({
      plan: PLAN_LIMITS.free,
      usage: null,
      variant_key: 'control',
      subscription_details: { plan: 'free', subscription: null },
    }), user.id);
  }

  const plan = PLAN_LIMITS[sub.plan] || PLAN_LIMITS.free;
  const usage = await getUsage(user.id);

  return setDevUserCookie(success({
    plan,
    usage,
    variant_key: 'control',
    podcast_styles: ['podcast'],
    subscription_details: {
      plan: sub.plan,
      subscription: sub.stripeSubscriptionId ? {
        id: sub.stripeSubscriptionId,
        status: sub.status,
      } : null,
    },
  }), user.id);
}
