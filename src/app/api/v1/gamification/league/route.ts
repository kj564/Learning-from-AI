/**
 * API: /api/v1/gamification/league — competitive tier standings.
 * Per pelajarin RE: returns user's league (bronze/silver/gold/platinum)
 * based on XP, + nearby users.
 */

import { NextRequest } from 'next/server';
import { ensureDevUser, setDevUserCookie, success } from '@/lib/learning';
import { db } from '@/lib/db';
import { getTotalXp, calcLevel } from '@/lib/gamification';

const LEAGUES = [
  { name: 'Bronze', min_xp: 0, max_xp: 500 },
  { name: 'Silver', min_xp: 500, max_xp: 1500 },
  { name: 'Gold', min_xp: 1500, max_xp: 5000 },
  { name: 'Platinum', min_xp: 5000, max_xp: Infinity },
];

export async function GET(req: NextRequest) {
  const user = await ensureDevUser(req);
  const totalXp = await getTotalXp(user.id);
  const league = LEAGUES.find(l => totalXp >= l.min_xp && totalXp < l.max_xp) || LEAGUES[0];
  const { level } = calcLevel(totalXp);

  // Find users in the same league, ordered by XP
  const allUsersXp = await db.xPEvent.groupBy({
    by: ['userId'],
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
  });
  const leagueUsers = allUsersXp
    .filter(u => {
      const xp = u._sum.amount || 0;
      return xp >= league.min_xp && xp < league.max_xp;
    })
    .map((u, i) => ({
      rank: i + 1,
      user_id: u.userId,
      name: u.userId.startsWith('dev_') ? 'Bimo Dev User' : u.userId,
      avatar: null,
      total_xp: u._sum.amount || 0,
      is_current_user: u.userId === user.id,
    }));

  const myRank = leagueUsers.findIndex(u => u.is_current_user) + 1;

  return setDevUserCookie(success({
    league_name: league.name,
    level,
    total_xp: totalXp,
    my_rank: myRank || null,
    total_in_league: leagueUsers.length,
    standings: leagueUsers.slice(0, 20),
  }), user.id);
}
