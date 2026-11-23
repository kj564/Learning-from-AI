/**
 * API: /api/v1/gamification/streak/repair — repair a broken streak.
 * Per pelajarin RE: POST /gamification/streak/repair. Pelajarin gates this
 * behind Pro (or coins). Bimo lets free users repair once per week.
 *
 * Body: { } (no params)
 * Resets current streak to 1 with lastActivityDate = today. Does NOT change
 * longestStreak (that's historical). Records the repair as an XPEvent for audit.
 */

import { NextRequest } from 'next/server';
import { ensureDevUser, setDevUserCookie, success, error } from '@/lib/learning';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const user = await ensureDevUser(req);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const streak = await db.userStreak.findUnique({ where: { userId: user.id } });

  if (!streak) {
    // No streak to repair — create one
    await db.userStreak.create({
      data: { userId: user.id, currentStreak: 1, longestStreak: 1, lastActivityDate: today },
    });
  } else {
    // Already active today?
    if (streak.lastActivityDate && streak.lastActivityDate.getTime() === today.getTime() && streak.currentStreak > 0) {
      return setDevUserCookie(error('STREAK_ACTIVE', 'Streak masih aktif. Gak perlu di-repair.', 400), user.id);
    }
    // Repair: set currentStreak to 1 (preserve longestStreak)
    await db.userStreak.update({
      where: { userId: user.id },
      data: {
        currentStreak: 1,
        lastActivityDate: today,
      },
    });
  }

  // Record the repair as an XP event for audit
  await db.xPEvent.create({
    data: { userId: user.id, amount: 0, reason: 'streak_repaired', metadataJson: JSON.stringify({ from: streak?.currentStreak || 0, to: 1 }) },
  });

  return setDevUserCookie(success({
    repaired: true,
    current_streak: 1,
    longest_streak: streak?.longestStreak || 1,
    message: 'Streak berhasil di-repair. Selamat belajar!',
  }), user.id);
}
