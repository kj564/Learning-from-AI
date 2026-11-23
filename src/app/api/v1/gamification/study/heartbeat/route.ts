/**
 * API: /api/v1/gamification/study/heartbeat — keep streak alive during study.
 * Per pelajarin RE: POST /gamification/study/heartbeat. Called periodically
 * (e.g. every 30s) while the user is actively studying. Increments
 * todayMinutes + awards XP per 5-minute milestone.
 *
 * Body: { minutes?: number } (default 1 minute per heartbeat)
 */

import { NextRequest } from 'next/server';
import { ensureDevUser, setDevUserCookie, success } from '@/lib/learning';
import { db } from '@/lib/db';

const XP_PER_5_MIN = 3; // 3 XP per 5 minutes of study

export async function POST(req: NextRequest) {
  const user = await ensureDevUser(req);
  const body = await req.json().catch(() => ({}));
  const minutes = Math.max(1, Math.min(60, body.minutes || 1));

  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);

  // Ensure streak row exists
  let streak = await db.userStreak.findUnique({ where: { userId: user.id } });
  if (!streak) {
    streak = await db.userStreak.create({
      data: { userId: user.id, currentStreak: 1, longestStreak: 1, lastActivityDate: todayStart, todayDate: todayStart, todayMinutes: 0 },
    });
  }

  // Reset todayMinutes if it's a new day
  const isNewDay = !streak.todayDate || streak.todayDate < todayStart;
  const currentTodayMinutes = isNewDay ? 0 : streak.todayMinutes;
  const newTodayMinutes = currentTodayMinutes + minutes;

  // Check if we crossed a 5-minute boundary (award XP once per crossing)
  const prevMilestone = Math.floor(currentTodayMinutes / 5);
  const newMilestone = Math.floor(newTodayMinutes / 5);
  let xpAwarded = 0;
  if (newMilestone > prevMilestone) {
    xpAwarded = (newMilestone - prevMilestone) * XP_PER_5_MIN;
    await db.xPEvent.create({
      data: { userId: user.id, amount: xpAwarded, reason: 'study_minutes', metadataJson: JSON.stringify({ minutes: newMilestone * 5 }) },
    });
  }

  // Update streak + todayMinutes + todayDate
  const yesterday = new Date(todayStart); yesterday.setDate(yesterday.getDate() - 1);
  const isConsecutive = streak.lastActivityDate && streak.lastActivityDate.getTime() === yesterday.getTime();
  const newCurrent = isNewDay ? 1 : (streak.lastActivityDate && streak.lastActivityDate < todayStart ? (isConsecutive ? streak.currentStreak + 1 : 1) : streak.currentStreak);

  await db.userStreak.update({
    where: { userId: user.id },
    data: {
      currentStreak: newCurrent,
      longestStreak: Math.max(streak.longestStreak, newCurrent),
      lastActivityDate: todayStart,
      todayDate: todayStart,
      todayMinutes: newTodayMinutes,
    },
  });

  return setDevUserCookie(success({
    recorded: true,
    minutes_added: minutes,
    today_total_minutes: newTodayMinutes,
    daily_goal: streak.dailyGoalMinutes,
    goal_reached: newTodayMinutes >= streak.dailyGoalMinutes,
    xp_awarded: xpAwarded,
  }), user.id);
}
