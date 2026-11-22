/**
 * API: /api/v1/events — analytics + gamification event ingest.
 * Per pelajarin E-AUTH-001: POST {event_name, ...} for analytics.
 * Also used for gamification (quiz_passed, flashcard_reviewed, chat_session,
 * daily_login → XP events + streak updates).
 */

import { NextRequest } from 'next/server';
import { ensureDevUser, setDevUserCookie, success, validationError } from '@/lib/learning';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const user = await ensureDevUser(req);
  const body = await req.json().catch(() => ({}));
  const { event_name, ...payload } = body as any;

  if (!event_name) {
    return setDevUserCookie(validationError([{ field: 'body.event_name', message: 'Required', type: 'invalid_type' }]), user.id);
  }

  // Gamification: certain event names award XP + update streak
  const XP_AWARDS: Record<string, number> = {
    quiz_passed: 10,
    flashcard_reviewed: 5,
    flashcard_reviewed_correct: 7,
    chat_session: 5,
    daily_login: 2,
    note_created: 3,
    exam_completed: 15,
  };

  const xpAmount = XP_AWARDS[event_name];
  if (xpAmount) {
    await db.xPEvent.create({
      data: {
        userId: user.id,
        amount: xpAmount,
        reason: event_name,
        metadataJson: JSON.stringify(payload),
      },
    });
  }

  // Streak update: any activity updates the streak
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const streak = await db.userStreak.findUnique({ where: { userId: user.id } });
  if (!streak) {
    await db.userStreak.create({
      data: { userId: user.id, currentStreak: 1, longestStreak: 1, lastActivityDate: today },
    });
  } else if (!streak.lastActivityDate || streak.lastActivityDate < today) {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const isConsecutive = streak.lastActivityDate && streak.lastActivityDate.getTime() === yesterday.getTime();
    const newCurrent = isConsecutive ? streak.currentStreak + 1 : 1;
    await db.userStreak.update({
      where: { userId: user.id },
      data: {
        currentStreak: newCurrent,
        longestStreak: Math.max(streak.longestStreak, newCurrent),
        lastActivityDate: today,
      },
    });
  }

  return setDevUserCookie(success({ event_name, recorded: true, xp_awarded: xpAmount || 0 }), user.id);
}
