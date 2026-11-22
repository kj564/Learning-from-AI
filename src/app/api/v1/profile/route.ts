/**
 * API: /api/v1/profile — extended user profile.
 * Per pelajarin E-AUTH-011: includes onboarding_completed, tracking_consent,
 * counts {notes, files, exam_collections}, usage_stats.
 */

import { NextRequest } from 'next/server';
import { ensureDevUser, setDevUserCookie, success } from '@/lib/learning';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await ensureDevUser(req);

  const noteCount = await db.studyNote.count({ where: { userId: user.id } });
  const fileCount = await db.studyDocument.count({ where: { userId: user.id } });
  const examCount = await db.exam.count({ where: { userId: user.id } });
  const subjectCount = await db.subject.count({ where: { userId: user.id } });

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
    usage_stats: null,
  }), user.id);
}
