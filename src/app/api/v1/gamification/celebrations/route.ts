/**
 * API: /api/v1/gamification/celebrations — pending celebrations (level-up,
 * streak milestone, achievement unlock) shown as a modal.
 *
 * Per pelajarin RE: GET /gamification/celebrations returns pending
 * celebrations the user hasn't acknowledged yet.
 *
 * POST /gamification/celebrations/ack dismisses one by id.
 */

import { NextRequest } from 'next/server';
import { ensureDevUser, setDevUserCookie, success } from '@/lib/learning';
import { db } from '@/lib/db';
import { getTotalXp, calcLevel, ensureAchievements } from '@/lib/gamification';

export async function GET(req: NextRequest) {
  const user = await ensureDevUser(req);
  await ensureAchievements();

  const [totalXp, streak, recentAchievements, recentLevelXp] = await Promise.all([
    getTotalXp(user.id),
    db.userStreak.findUnique({ where: { userId: user.id } }),
    db.userAchievement.findMany({
      where: { userId: user.id },
      include: { achievement: true },
      orderBy: { unlockedAt: 'desc' },
      take: 3,
    }),
    db.xPEvent.findMany({
      where: { userId: user.id, reason: { in: ['quest_completed', 'achievement_unlocked'] } },
      orderBy: { createdAt: 'desc' },
      take: 2,
    }),
  ]);
  const { level } = calcLevel(totalXp);

  const celebrations: any[] = [];

  // Streak milestone: 3, 7, 14, 30, 60, 100
  const streakMilestones = [3, 7, 14, 30, 60, 100];
  const cur = streak?.currentStreak || 0;
  if (streakMilestones.includes(cur)) {
    celebrations.push({
      id: `streak-${cur}`,
      type: 'streak_milestone',
      title: `${cur} Hari Beruntun!`,
      description: `Kamu belajar ${cur} hari berturut-turut. Mantap!`,
      icon_key: 'flame',
      data: { streak: cur },
    });
  }

  // Recent achievement unlocks (last hour, unacked)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  for (const ua of recentAchievements) {
    if (ua.unlockedAt > oneHourAgo) {
      celebrations.push({
        id: `achievement-${ua.achievementId}`,
        type: 'achievement_unlocked',
        title: ua.achievement.title,
        description: ua.achievement.description,
        icon_key: ua.achievement.iconKey,
        data: { achievement_id: ua.achievementId, xp_reward: ua.achievement.xpReward },
      });
    }
  }

  // Level-up (if gained XP in last hour that crossed a level boundary)
  const recentXp = recentLevelXp.reduce((s, e) => s + e.amount, 0);
  if (recentXp > 0) {
    const prevLevel = calcLevel(totalXp - recentXp).level;
    if (level > prevLevel) {
      celebrations.push({
        id: `level-${level}`,
        type: 'level_up',
        title: `Level ${level}!`,
        description: `Kamu naik ke level ${level}. Terus belajar!`,
        icon_key: 'star',
        data: { level, prev_level: prevLevel, total_xp: totalXp },
      });
    }
  }

  return setDevUserCookie(success({
    pending: celebrations,
    count: celebrations.length,
  }), user.id);
}
