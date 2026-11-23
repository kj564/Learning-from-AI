/**
 * API: /api/v1/gamification/hub — composite hub view.
 * Per pelajarin RE: quests + leaderboard preview + achievements snapshot.
 */

import { NextRequest } from 'next/server';
import { ensureDevUser, setDevUserCookie, success } from '@/lib/learning';
import { db } from '@/lib/db';
import { getTotalXp, calcLevel, ensureAchievements, ensureDailyQuests } from '@/lib/gamification';

export async function GET(req: NextRequest) {
  const user = await ensureDevUser(req);
  await Promise.all([ensureAchievements(), ensureDailyQuests(user.id)]);

  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);

  const [totalXp, streak, quests, achievementsUnlocked, topUsers] = await Promise.all([
    getTotalXp(user.id),
    db.userStreak.findUnique({ where: { userId: user.id } }),
    db.quest.findMany({
      where: { isActive: true, type: 'daily', startsAt: todayStart },
      include: { progress: { where: { userId: user.id } } },
    }),
    db.userAchievement.count({ where: { userId: user.id } }),
    getTopUsersByXp(5),
  ]);
  const { level } = calcLevel(totalXp);

  return setDevUserCookie(success({
    level,
    total_xp: totalXp,
    streak: streak?.currentStreak || 0,
    today_quests: quests.map(q => ({
      id: q.id,
      title: q.title,
      metric: q.metric,
      target: q.targetCount,
      progress: q.progress[0]?.progress || 0,
      completed: q.progress[0]?.completed || false,
      xp_reward: q.xpReward,
    })),
    achievements_unlocked: achievementsUnlocked,
    leaderboard_preview: topUsers,
  }), user.id);
}

async function getTopUsersByXp(limit: number) {
  // SQLite aggregate: sum XP per user, return top N
  const rows = await db.xPEvent.groupBy({
    by: ['userId'],
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: limit,
  });
  return rows.map((r, i) => ({
    rank: i + 1,
    user_id: r.userId,
    name: r.userId.startsWith('dev_') ? 'Bimo Dev User' : r.userId,
    avatar: null,
    total_xp: r._sum.amount || 0,
  }));
}
