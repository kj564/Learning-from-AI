/**
 * API: /api/v1/gamification/achievements — badge list (unlocked + locked).
 * Per pelajarin RE: GET /gamification/achievements.
 */

import { NextRequest } from 'next/server';
import { ensureDevUser, setDevUserCookie, success } from '@/lib/learning';
import { db } from '@/lib/db';
import { ensureAchievements } from '@/lib/gamification';

export async function GET(req: NextRequest) {
  const user = await ensureDevUser(req);
  await ensureAchievements();

  const [achievements, unlocked] = await Promise.all([
    db.achievement.findMany({ orderBy: [{ category: 'asc' }, { threshold: 'asc' }] }),
    db.userAchievement.findMany({ where: { userId: user.id }, select: { achievementId: true, unlockedAt: true } }),
  ]);
  const unlockedMap = new Map(unlocked.map(u => [u.achievementId, u.unlockedAt]));

  return setDevUserCookie(success({
    total: achievements.length,
    unlocked_count: unlocked.length,
    achievements: achievements.map(a => ({
      id: a.id,
      category: a.category,
      tier: a.tier,
      title: a.title,
      description: a.description,
      icon_key: a.iconKey,
      metric: a.metric,
      threshold: a.threshold,
      xp_reward: a.xpReward,
      unlocked: unlockedMap.has(a.id),
      unlocked_at: unlockedMap.get(a.id) || null,
    })),
  }), user.id);
}
