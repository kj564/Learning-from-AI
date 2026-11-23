/**
 * API: /api/v1/gamification/leaderboard — top users by XP.
 * Per pelajarin RE: GET /gamification/leaderboard. Supports period param
 * (daily/weekly/all-time) via ?period=.
 */

import { NextRequest } from 'next/server';
import { ensureDevUser, setDevUserCookie, success } from '@/lib/learning';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await ensureDevUser(req);
  const url = new URL(req.url);
  const period = url.searchParams.get('period') || 'all';
  const limit = Math.min(100, parseInt(url.searchParams.get('limit') || '50', 10));

  let since: Date | null = null;
  if (period === 'daily') {
    since = new Date(); since.setHours(0, 0, 0, 0);
  } else if (period === 'weekly') {
    since = new Date(); since.setDate(since.getDate() - 7);
  }

  const where = since ? { createdAt: { gte: since } } : {};
  const rows = await db.xPEvent.groupBy({
    by: ['userId'],
    where,
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: limit,
  });

  const leaderboard = rows.map((r, i) => ({
    rank: i + 1,
    user_id: r.userId,
    name: r.userId.startsWith('dev_') ? 'Bimo Dev User' : r.userId,
    avatar: null,
    total_xp: r._sum.amount || 0,
    is_current_user: r.userId === user.id,
  }));

  const myRank = leaderboard.findIndex(u => u.is_current_user) + 1;

  return setDevUserCookie(success({
    period,
    my_rank: myRank || null,
    leaderboard,
  }), user.id);
}
