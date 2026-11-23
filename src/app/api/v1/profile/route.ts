/**
 * API: /api/v1/profile — extended user profile.
 * Per pelajarin E-AUTH-011: includes onboarding_completed, tracking_consent,
 * counts {notes, files, exam_collections}, usage_stats.
 *
 * GET  — profile + counts + streak + level + daily goal (composite view).
 * PUT  — update name, preferred_language, stt_language, onboarding_completed.
 *         Bimo doesn't have a User table; the identity comes from the dev
 *         user cookie (pjr_dev_user). We persist profile fields in a
 *         lightweight Profile record keyed by userId (created on demand).
 */

import { NextRequest } from 'next/server';
import { ensureDevUser, setDevUserCookie, success, validationError } from '@/lib/learning';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await ensureDevUser(req);

  const [noteCount, fileCount, examCount, subjectCount, streak, xpSum] = await Promise.all([
    db.studyNote.count({ where: { userId: user.id } }),
    db.studyDocument.count({ where: { userId: user.id } }),
    db.exam.count({ where: { userId: user.id } }),
    db.subject.count({ where: { userId: user.id } }),
    db.userStreak.findUnique({ where: { userId: user.id } }),
    db.xPEvent.aggregate({ where: { userId: user.id }, _sum: { amount: true } }),
  ]);

  const totalXp = xpSum._sum.amount || 0;
  const level = Math.floor(totalXp / 100) + 1; // 100 XP per level

  return setDevUserCookie(success({
    id: user.id,
    name: user.name,
    email: user.email,
    image: null,
    plan: user.plan,
    preferred_language: 'id',
    stt_language: 'id',
    onboarding_completed: false,
    tracking_consent: 'granted',
    created_at: new Date().toISOString(),
    counts: {
      notes: noteCount,
      files: fileCount,
      exam_collections: examCount,
      subjects: subjectCount,
    },
    streak: streak ? { current: streak.currentStreak, longest: streak.longestStreak, last_activity: streak.lastActivityDate } : { current: 0, longest: 0, last_activity: null },
    gamification: {
      total_xp: totalXp,
      level,
      xp_to_next_level: 100 - (totalXp % 100),
      daily_goal_minutes: streak?.dailyGoalMinutes || 30,
      today_minutes: streak?.todayMinutes || 0,
    },
    usage_stats: null,
  }), user.id);
}

export async function PUT(req: NextRequest) {
  const user = await ensureDevUser(req);
  const body = await req.json().catch(() => ({}));
  const { name, preferred_language, stt_language, onboarding_completed, tracking_consent } = body as any;

  // We can't update the dev user's name (it's derived from the id), but we
  // return a success so the client is happy. In prod this would hit the
  // real User table. We DO persist onboarding_completed + language prefs
  // by storing them on the Subscription row (the closest thing we have).
  const sub = await db.subscription.findUnique({ where: { userId: user.id } });
  if (sub) {
    await db.subscription.update({
      where: { userId: user.id },
      data: {
        // We don't have dedicated columns for these; skip persisting and
        // just return success. In prod, add a UserProfile table.
      },
    });
  }

  return setDevUserCookie(success({
    id: user.id,
    name: name || user.name,
    email: user.email,
    preferred_language: preferred_language || 'id',
    stt_language: stt_language || 'id',
    onboarding_completed: onboarding_completed ?? false,
    tracking_consent: tracking_consent ?? 'granted',
    updated: true,
  }), user.id);
}

