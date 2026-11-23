/**
 * API: /api/v1/gamification/quests — daily/weekly challenges with progress.
 * Per pelajarin RE: returns active quests for the current period.
 */

import { NextRequest } from 'next/server';
import { ensureDevUser, setDevUserCookie, success } from '@/lib/learning';
import { db } from '@/lib/db';
import { ensureDailyQuests } from '@/lib/gamification';

export async function GET(req: NextRequest) {
  const user = await ensureDevUser(req);
  await ensureDailyQuests(user.id);

  const url = new URL(req.url);
  const type = url.searchParams.get('type') || 'daily'; // daily | weekly | all

  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);

  const where: any = { isActive: true };
  if (type === 'daily') {
    where.type = 'daily';
    where.startsAt = todayStart;
  } else if (type === 'weekly') {
    where.type = 'weekly';
  }

  const quests = await db.quest.findMany({
    where,
    orderBy: { startsAt: 'asc' },
    include: { progress: { where: { userId: user.id } } },
  });

  return setDevUserCookie(success(quests.map(q => ({
    id: q.id,
    type: q.type,
    title: q.title,
    description: q.description,
    metric: q.metric,
    target: q.targetCount,
    progress: q.progress[0]?.progress || 0,
    completed: q.progress[0]?.completed || false,
    claimed_xp: q.progress[0]?.claimedXp || false,
    xp_reward: q.xpReward,
    starts_at: q.startsAt,
    ends_at: q.endsAt,
  }))), user.id);
}
