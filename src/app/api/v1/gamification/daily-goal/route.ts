/**
 * API: /api/v1/gamification/daily-goal — update daily study goal (minutes).
 * Per pelajarin RE: PUT /gamification/daily-goal.
 *
 * Body: { minutes: number } (range 5-240, default 30)
 */

import { NextRequest } from 'next/server';
import { ensureDevUser, setDevUserCookie, success, validationError, error } from '@/lib/learning';
import { db } from '@/lib/db';

export async function PUT(req: NextRequest) {
  const user = await ensureDevUser(req);
  const body = await req.json().catch(() => ({}));
  const { minutes } = body as { minutes?: number };

  if (minutes === undefined || typeof minutes !== 'number') {
    return setDevUserCookie(validationError([{ field: 'body.minutes', message: 'Required (number)', type: 'invalid_type' }]), user.id);
  }
  if (minutes < 5 || minutes > 240) {
    return setDevUserCookie(error('INVALID_RANGE', 'Daily goal must be between 5 and 240 minutes', 400), user.id);
  }

  // Upsert the streak row (it holds the dailyGoalMinutes field)
  const existing = await db.userStreak.findUnique({ where: { userId: user.id } });
  if (existing) {
    await db.userStreak.update({
      where: { userId: user.id },
      data: { dailyGoalMinutes: minutes },
    });
  } else {
    await db.userStreak.create({
      data: { userId: user.id, currentStreak: 0, longestStreak: 0, dailyGoalMinutes: minutes },
    });
  }

  return setDevUserCookie(success({
    daily_goal_minutes: minutes,
    updated: true,
  }), user.id);
}
