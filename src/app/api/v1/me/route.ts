/**
 * API: /api/v1/me — current user info (authenticated).
 * Per pelajarin E-AUTH-002: returns { id, email, name, image, plan,
 * preferredLanguage, sttLanguage, role }.
 */

import { NextRequest } from 'next/server';
import { ensureDevUser, getUsage, setDevUserCookie, success, PLAN_LIMITS } from '@/lib/learning';

export async function GET(req: NextRequest) {
  const user = await ensureDevUser(req);
  return setDevUserCookie(success({
    id: user.id,
    email: user.email,
    name: user.name,
    image: null,
    plan: user.plan,
    preferredLanguage: 'id',
    sttLanguage: 'id',
    role: user.role,
  }), user.id);
}
