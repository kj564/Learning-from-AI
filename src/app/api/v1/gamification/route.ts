/**
 * API: /api/v1/gamification — root gamification state.
 * Per pelajarin RE (RECON-DEEP-v4 §2.6): returns XP, level, streak, daily goal.
 * Drives the header badges (Streak, Level) in the Bimo UI.
 */

import { NextRequest } from 'next/server';
import { ensureDevUser, setDevUserCookie, success } from '@/lib/learning';
import { db } from '@/lib/db';
import { getTotalXp, calcLevel, ensureAchievements } from '@/lib/gamification';

export async function GET(req: NextRequest) {
  const user = await ensureDevUser(req);
  await ensureAchievements();

  const [totalXp, streak] = await Promise.all([
    getTotalXp(user.id),
    db.userStreak.findUnique({ where: { userId: user.id } }),
  ]);
  const { level, xpIntoLevel, xpToNext } = calcLevel(totalXp);

  return setDevUserCookie(success({
    total_xp: totalXp,
    level,
    xp_into_level: xpIntoLevel,
    xp_to_next_level: xpToNext,
    streak: {
      current: streak?.currentStreak || 0,
      longest: streak?.longestStreak || 0,
      last_activity: streak?.lastActivityDate || null,
    },
    daily_goal_minutes: streak?.dailyGoalMinutes || 30,
    today_minutes: streak?.todayMinutes || 0,
    today_date: streak?.todayDate || null,
  }), user.id);
}
