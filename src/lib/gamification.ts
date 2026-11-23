/**
 * Gamification helpers — shared by /api/v1/gamification/* routes.
 *
 * - level calc: 100 XP per level (level = floor(xp/100) + 1)
 * - daily quests: auto-seeded for today if none exist
 * - study heartbeat: increments todayMinutes + awards XP per 5 min
 * - streak repair: resets streak to 1, costs Pro (or free with ad-like flag)
 */

import { db } from './db';

export const XP_PER_LEVEL = 100;

export function calcLevel(totalXp: number): { level: number; xpIntoLevel: number; xpToNext: number } {
  const level = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const xpIntoLevel = totalXp % XP_PER_LEVEL;
  return { level, xpIntoLevel, xpToNext: XP_PER_LEVEL - xpIntoLevel };
}

export async function getTotalXp(userId: string): Promise<number> {
  const agg = await db.xPEvent.aggregate({ where: { userId }, _sum: { amount: true } });
  return agg._sum.amount || 0;
}

/** Ensure today's daily quests exist (idempotent — only creates if missing). */
export async function ensureDailyQuests(userId: string): Promise<void> {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);

  const existing = await db.quest.count({
    where: { type: 'daily', startsAt: todayStart },
  });
  if (existing >= 4) return; // 4 daily quests

  // Seed 4 standard daily quests
  const templates = [
    { title: 'Selesaikan 1 kuis', metric: 'quiz_passed', targetCount: 1, xpReward: 10 },
    { title: 'Review 5 flashcard', metric: 'flashcard_reviewed', targetCount: 5, xpReward: 10 },
    { title: 'Chat 3 kali dengan Bimo', metric: 'chat_session', targetCount: 3, xpReward: 10 },
    { title: 'Buat 1 catatan baru', metric: 'note_created', targetCount: 1, xpReward: 10 },
  ];

  for (const t of templates) {
    await db.quest.create({
      data: {
        type: 'daily',
        title: t.title,
        metric: t.metric,
        targetCount: t.targetCount,
        xpReward: t.xpReward,
        startsAt: todayStart,
        endsAt: todayEnd,
        isActive: true,
      },
    });
  }
}

/** Seed standard achievements if the table is empty (one-time). */
export async function ensureAchievements(): Promise<void> {
  const count = await db.achievement.count();
  if (count > 0) return;

  const achievements = [
    // Streak milestones
    { category: 'streak', tier: 'bronze', title: '3 Hari Beruntun', description: 'Belajar 3 hari berturut-turut', iconKey: 'flame', metric: 'streak_days', threshold: 3, xpReward: 20 },
    { category: 'streak', tier: 'silver', title: '7 Hari Beruntun', description: 'Belajar 1 minggu penuh', iconKey: 'flame', metric: 'streak_days', threshold: 7, xpReward: 50 },
    { category: 'streak', tier: 'gold', title: '30 Hari Beruntun', description: 'Belajar 1 bulan penuh', iconKey: 'flame', metric: 'streak_days', threshold: 30, xpReward: 200 },
    // Notes
    { category: 'notes', tier: 'bronze', title: 'Catatan Pertama', description: 'Buat catatan pertama', iconKey: 'book', metric: 'total_notes', threshold: 1, xpReward: 10 },
    { category: 'notes', tier: 'silver', title: '10 Catatan', description: 'Buat 10 catatan', iconKey: 'book', metric: 'total_notes', threshold: 10, xpReward: 30 },
    { category: 'notes', tier: 'gold', title: '50 Catatan', description: 'Buat 50 catatan', iconKey: 'book', metric: 'total_notes', threshold: 50, xpReward: 100 },
    // Quizzes
    { category: 'quiz', tier: 'bronze', title: 'Kuis Pertama', description: 'Selesaikan kuis pertama', iconKey: 'brain', metric: 'total_quizzes', threshold: 1, xpReward: 10 },
    { category: 'quiz', tier: 'silver', title: '20 Kuis', description: 'Selesaikan 20 kuis', iconKey: 'brain', metric: 'total_quizzes', threshold: 20, xpReward: 50 },
    // Chats
    { category: 'chat', tier: 'bronze', title: 'Obrolan Pertama', description: 'Chat pertama dengan Bimo', iconKey: 'chat', metric: 'total_chats', threshold: 1, xpReward: 5 },
    { category: 'chat', tier: 'silver', title: '50 Chat', description: '50 sesi chat', iconKey: 'chat', metric: 'total_chats', threshold: 50, xpReward: 50 },
    // Level
    { category: 'level', tier: 'bronze', title: 'Level 5', description: 'Capai level 5', iconKey: 'star', metric: 'level', threshold: 5, xpReward: 30 },
    { category: 'level', tier: 'silver', title: 'Level 10', description: 'Capai level 10', iconKey: 'star', metric: 'level', threshold: 10, xpReward: 100 },
    { category: 'level', tier: 'gold', title: 'Level 25', description: 'Capai level 25', iconKey: 'trophy', metric: 'level', threshold: 25, xpReward: 500 },
  ];

  for (const a of achievements) {
    await db.achievement.create({ data: a });
  }
}
