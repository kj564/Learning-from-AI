/**
 * API: /api/v1/analytics/track — analytics event ingest (pelajarin-compatible alias).
 *
 * Per pelajarin RE (RECON-DEEP-v4 §2.7): POST /analytics/track is the
 * public event-tracking endpoint. Bimo already has /api/v1/events which
 * does the same thing (and also awards XP + updates streak). This route
 * is a thin alias so frontend code targeting the pelajarin API surface
 * works without changes.
 *
 * Body: { event_name: string, ...payload }
 * Response: { data: { event_name, recorded, xp_awarded } }
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

  // Same XP awards as /api/v1/events
  const XP_AWARDS: Record<string, number> = {
    quiz_passed: 10,
    flashcard_reviewed: 5,
    flashcard_reviewed_correct: 7,
    chat_session: 5,
    daily_login: 2,
    note_created: 3,
    exam_completed: 15,
    podcast_generated: 8,
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

  // Streak update
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

  // Quest progress: increment matching quest metrics
  await incrementQuestProgress(user.id, event_name);

  // Achievement unlock check (best-effort)
  await checkAchievements(user.id).catch(() => {});

  return setDevUserCookie(success({ event_name, recorded: true, xp_awarded: xpAmount || 0 }), user.id);
}

/** Increment quest progress for matching metric events. */
async function incrementQuestProgress(userId: string, event: string) {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

  // Find active quests that match this event metric
  const quests = await db.quest.findMany({
    where: {
      isActive: true,
      metric: event,
      startsAt: { lte: now },
      endsAt: { gte: todayStart },
    },
  });

  for (const q of quests) {
    const progress = await db.userQuestProgress.findUnique({
      where: { userId_questId: { userId, questId: q.id } },
    });
    if (progress?.completed) continue;

    const newProgress = (progress?.progress || 0) + 1;
    const completed = newProgress >= q.targetCount;

    await db.userQuestProgress.upsert({
      where: { userId_questId: { userId, questId: q.id } },
      create: { userId, questId: q.id, progress: newProgress, completed, completedAt: completed ? now : null },
      update: { progress: newProgress, completed, completedAt: completed ? now : null },
    });

    // Award XP on completion (one-time)
    if (completed && progress && !progress.completed) {
      await db.xPEvent.create({
        data: { userId, amount: q.xpReward, reason: 'quest_completed', metadataJson: JSON.stringify({ quest_id: q.id, title: q.title }) },
      });
    }
  }
}

/** Check + unlock achievements based on cumulative metrics. */
async function checkAchievements(userId: string) {
  // Gather cumulative metrics
  const [noteCount, quizCount, chatCount, xpSum, streak] = await Promise.all([
    db.studyNote.count({ where: { userId } }),
    db.quiz.count({ where: { note: { userId } } }),
    db.chatSession.count({ where: { note: { userId } } }),
    db.xPEvent.aggregate({ where: { userId }, _sum: { amount: true } }),
    db.userStreak.findUnique({ where: { userId } }),
  ]);
  const totalXp = xpSum._sum.amount || 0;
  const level = Math.floor(totalXp / 100) + 1;
  const streakDays = streak?.currentStreak || 0;

  const metrics: Record<string, number> = {
    total_notes: noteCount,
    total_quizzes: quizCount,
    total_chats: chatCount,
    level,
    streak_days: streakDays,
  };

  // Find achievements whose threshold is met for these metrics
  const achievements = await db.achievement.findMany({
    where: { metric: { in: Object.keys(metrics) } },
  });

  for (const a of achievements) {
    const current = metrics[a.metric] || 0;
    if (current < a.threshold) continue;
    const existing = await db.userAchievement.findUnique({
      where: { userId_achievementId: { userId, achievementId: a.id } },
    });
    if (existing) continue;
    await db.userAchievement.create({
      data: { userId, achievementId: a.id, metadataJson: JSON.stringify({ value: current, threshold: a.threshold }) },
    });
    if (a.xpReward > 0) {
      await db.xPEvent.create({
        data: { userId, amount: a.xpReward, reason: 'achievement_unlocked', metadataJson: JSON.stringify({ achievement_id: a.id, title: a.title }) },
      });
    }
  }
}
