/**
 * API: /api/v1/gamification/leaderboard/periods — available leaderboard periods.
 * Per pelajarin RE: GET /gamification/leaderboard/periods.
 */

import { NextRequest } from 'next/server';
import { ensureDevUser, setDevUserCookie, success } from '@/lib/learning';

export async function GET(req: NextRequest) {
  const user = await ensureDevUser(req);

  return setDevUserCookie(success({
    periods: [
      { id: 'daily', label: 'Harian', description: 'XP yang didapat hari ini' },
      { id: 'weekly', label: 'Mingguan', description: 'XP 7 hari terakhir' },
      { id: 'all', label: 'Sepanjang Waktu', description: 'Total XP selamanya' },
    ],
  }), user.id);
}
