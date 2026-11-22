/**
 * Learning product — shared helpers.
 *
 * Auth: getLearningUser() reads the user from the request (NextAuth session
 * or our temp-session cookie for dev). Returns {id, plan, role} or null.
 *
 * Plans: PLAN_LIMITS defines our generous free tier (per user direction:
 * "lebih murah dan lebih generous dari pelajarin"). Pelajarin free is
 * 1 note + 0 chat + first-only quiz/flashcard. Ours: 15 notes, 50 chats,
 * full quiz/flashcard access.
 *
 * Response: success() and error() helpers enforce the {data:...} /
 * {error:{code,message,request_id,details?}} envelope (per pelajarin v2
 * + our decision to use one envelope from day 1).
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { db } from '@/lib/db';

// ============================================================
// Auth (temp dev pattern — replace with NextAuth in production)
// ============================================================
//
// For dev, we use a simple cookie `pjr_dev_user` with the user id.
// In production, swap to NextAuth (Google/Discord/email) — the function
// signature stays the same (getLearningUser(req) → {id, plan, role} | null).
//
// We auto-provision a dev user on first call so the API "just works"
// during development without a real auth flow.

const DEV_COOKIE = 'pjr_dev_user';
const DEV_USER_ID_KEY = 'pjr_dev_user_id';

export interface LearningUser {
  id: string;
  email: string;
  name: string;
  plan: 'free' | 'pro' | 'unlimited' | 'institutional';
  role: 'user' | 'institutional' | 'admin';
}

export async function getLearningUser(req?: NextRequest): Promise<LearningUser | null> {
  let userId: string | null = null;

  if (req) {
    // Read from cookie
    const cookie = req.headers.get('cookie') || '';
    const match = cookie.match(new RegExp(`${DEV_COOKIE}=([^;]+)`));
    if (match) userId = decodeURIComponent(match[1]);
  }

  if (!userId) return null;

  // Look up the user in the Subscription table (which has plan) — we don't
  // have a separate User table in this schema; the user identity comes from
  // auth and the Subscription row carries plan + usage. For dev, we create
  // a Subscription row on first sight.
  let sub = await db.subscription.findUnique({ where: { userId } });
  if (!sub) {
    sub = await db.subscription.create({
      data: { userId, plan: 'free', status: 'active', notesResetDate: nextWeek(), chatResetDate: nextWeek(), examsResetDate: nextWeek() },
    });
  }

  return {
    id: userId,
    email: 'dev@bimo.local',
    name: 'Bimo Dev User',
    plan: sub.plan as LearningUser['plan'],
    role: 'user',
  };
}

/** Ensure a dev user exists (call at start of any authenticated route). */
export async function ensureDevUser(req: NextRequest): Promise<LearningUser> {
  const cookie = req.headers.get('cookie') || '';
  const match = cookie.match(new RegExp(`${DEV_COOKIE}=([^;]+)`));
  let userId = match ? decodeURIComponent(match[1]) : null;

  if (!userId) {
    // Auto-provision: create a new dev user id + set cookie via response.
    userId = `dev_${randomUUID()}`;
    // We'll set the cookie on the response; for now just return the user.
  }

  let sub = await db.subscription.findUnique({ where: { userId } });
  if (!sub) {
    sub = await db.subscription.create({
      data: { userId, plan: 'free', status: 'active', notesResetDate: nextWeek(), chatResetDate: nextWeek(), examsResetDate: nextWeek() },
    });
  }

  return {
    id: userId,
    email: 'dev@bimo.local',
    name: 'Bimo Dev User',
    plan: sub.plan as LearningUser['plan'],
    role: 'user',
  };
}

/** Set the dev-user cookie on a NextResponse (call once when provisioning). */
export function setDevUserCookie(res: NextResponse, userId: string): NextResponse {
  // Use the NextResponse cookies API (not raw headers) — works with JSON responses.
  res.cookies.set(DEV_COOKIE, encodeURIComponent(userId), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });
  return res;
}

function nextWeek(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d;
}

// ============================================================
// Plan limits (per user direction: lebih murah dan lebih generous)
// ============================================================
//
// Pelajarin free: 1 note, 0 chat, 1 exam/week, first-only quiz/flashcard,
// 30K token limit, 3h media, content censored, locked features.
//
// Our free: 15 notes/month, 50 chats/month, full quiz/flashcard, 60K
// token, 5h media, no censorship, all features unlocked. This is the
// killer differentiator — pelajarin blocks chat entirely on free.

export interface PlanLimits {
  notesLimit: number;            // -1 = unlimited
  notesRefreshable: boolean;
  chatsLimit: number;
  chatsRefreshable: boolean;
  chatPeriodHours: number;
  examsPerWeek: number;
  quizQuestionsPerNote: number; // -1 = unlimited
  flashcardsPerNote: number;    // -1 = unlimited
  maxTokensPerDocument: number;
  isUnlimited: boolean;
  contentCensored: boolean;
  chatBlocked: boolean;
  flashcardFirstOnly: boolean;
  quizFirstOnly: boolean;
  examResultsLocked: boolean;
  manualFlashcardBlocked: boolean;
  quizSettingsLocked: boolean;
  mediaDurationLimitSeconds: number;
  podcastMinutesPerMonth: number;
}

export const PLAN_LIMITS: Record<string, { id: string; name: string; limits: PlanLimits }> = {
  free: {
    id: 'free',
    name: 'Gratis',
    limits: {
      notesLimit: 15,                    // vs pelajarin 1
      notesRefreshable: true,
      chatsLimit: 50,                    // vs pelajarin 0 (chat_blocked=true)
      chatsRefreshable: true,
      chatPeriodHours: 168,              // weekly reset
      examsPerWeek: 5,                   // vs pelajarin 1
      quizQuestionsPerNote: -1,          // unlimited (vs pelajarin first-only)
      flashcardsPerNote: -1,             // unlimited
      maxTokensPerDocument: 60000,       // vs pelajarin 30000
      isUnlimited: false,
      contentCensored: false,             // vs pelajarin true
      chatBlocked: false,                 // vs pelajarin true — KEY differentiator
      flashcardFirstOnly: false,          // vs pelajarin true
      quizFirstOnly: false,               // vs pelajarin true
      examResultsLocked: false,           // vs pelajarin true
      manualFlashcardBlocked: false,      // vs pelajarin true
      quizSettingsLocked: false,          // vs pelajarin true
      mediaDurationLimitSeconds: 18000,   // 5h vs pelajarin 3h
      podcastMinutesPerMonth: 30,         // vs pelajarin 0
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    limits: {
      notesLimit: -1, chatsLimit: -1, notesRefreshable: false, chatsRefreshable: false,
      chatPeriodHours: 0, examsPerWeek: -1, quizQuestionsPerNote: -1, flashcardsPerNote: -1,
      maxTokensPerDocument: 100000, isUnlimited: true, contentCensored: false,
      chatBlocked: false, flashcardFirstOnly: false, quizFirstOnly: false,
      examResultsLocked: false, manualFlashcardBlocked: false, quizSettingsLocked: false,
      mediaDurationLimitSeconds: 36000, podcastMinutesPerMonth: 120,
    },
  },
  unlimited: {
    id: 'unlimited',
    name: 'Unlimited',
    limits: {
      notesLimit: -1, chatsLimit: -1, notesRefreshable: false, chatsRefreshable: false,
      chatPeriodHours: 0, examsPerWeek: -1, quizQuestionsPerNote: -1, flashcardsPerNote: -1,
      maxTokensPerDocument: 200000, isUnlimited: true, contentCensored: false,
      chatBlocked: false, flashcardFirstOnly: false, quizFirstOnly: false,
      examResultsLocked: false, manualFlashcardBlocked: false, quizSettingsLocked: false,
      mediaDurationLimitSeconds: 72000, podcastMinutesPerMonth: 300,
    },
  },
  institutional: {
    id: 'institutional',
    name: 'Institusi',
    limits: {
      notesLimit: -1, chatsLimit: -1, notesRefreshable: false, chatsRefreshable: false,
      chatPeriodHours: 0, examsPerWeek: -1, quizQuestionsPerNote: -1, flashcardsPerNote: -1,
      maxTokensPerDocument: 500000, isUnlimited: true, contentCensored: false,
      chatBlocked: false, flashcardFirstOnly: false, quizFirstOnly: false,
      examResultsLocked: false, manualFlashcardBlocked: false, quizSettingsLocked: false,
      mediaDurationLimitSeconds: 144000, podcastMinutesPerMonth: 600,
    },
  },
};

/** Compute current usage + remaining for a user. */
export async function getUsage(userId: string) {
  const sub = await db.subscription.findUnique({ where: { userId } });
  if (!sub) return null;

  const now = new Date();
  // Reset counters if past reset dates
  let notesUsed = sub.notesUsed;
  let chatsUsed = sub.chatsUsed;
  let examsUsed = sub.examsUsed;
  if (sub.notesResetDate && sub.notesResetDate < now) {
    notesUsed = 0;
    await db.subscription.update({ where: { userId }, data: { notesUsed: 0, notesResetDate: nextWeek() } });
  }
  if (sub.chatResetDate && sub.chatResetDate < now) {
    chatsUsed = 0;
    await db.subscription.update({ where: { userId }, data: { chatsUsed: 0, chatResetDate: nextWeek() } });
  }
  if (sub.examsResetDate && sub.examsResetDate < now) {
    examsUsed = 0;
    await db.subscription.update({ where: { userId }, data: { examsUsed: 0, examsResetDate: nextWeek() } });
  }

  const plan = PLAN_LIMITS[sub.plan] || PLAN_LIMITS.free;
  const limits = plan.limits;

  const notesRemaining = limits.notesLimit === -1 ? -1 : Math.max(0, limits.notesLimit - notesUsed);
  const chatsRemaining = limits.chatsLimit === -1 ? -1 : Math.max(0, limits.chatsLimit - chatsUsed);
  const examsRemaining = limits.examsPerWeek === -1 ? -1 : Math.max(0, limits.examsPerWeek - examsUsed);

  return {
    notesUsed, chatsUsed, examsUsed,
    notesRemaining, chatsRemaining, examsRemaining,
    canCreateNote: limits.notesLimit === -1 || notesUsed < limits.notesLimit,
    canSendChat: !limits.chatBlocked && (limits.chatsLimit === -1 || chatsUsed < limits.chatsLimit),
    canCreateExam: limits.examsPerWeek === -1 || examsUsed < limits.examsPerWeek,
    podcastSecondsUsed: sub.podcastSecondsUsed,
    podcastSecondsRemaining: limits.podcastMinutesPerMonth * 60 - sub.podcastSecondsUsed,
    canCreatePodcast: limits.podcastMinutesPerMonth > 0,
    resetDates: {
      notesResetDate: sub.notesResetDate,
      chatResetDate: sub.chatResetDate,
      examsResetDate: sub.examsResetDate,
      podcastResetDate: sub.podcastResetDate,
    },
  };
}

/** Increment a usage counter (call when user creates a note/chat/exam). */
export async function incrementUsage(userId: string, field: 'notesUsed' | 'chatsUsed' | 'examsUsed' | 'podcastSecondsUsed', amount: number = 1) {
  await db.subscription.update({
    where: { userId },
    data: { [field]: { increment: amount } },
  });
}

// ============================================================
// Response envelope helpers (per pelajarin v1+v2 + our decision)
// ============================================================
//
// Success: { data: ... } — optionally with pagination metadata.
// Error:   { error: { code, message, request_id, details? } }
//
// Pagination: page-based ({ count, pagination: { current_page, total_pages,
// total_count, has_next_page, has_previous_page } }) OR cursor-based
// ({ pagination: { next_cursor, has_more, limit } }).

export function success<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

export function successWithPagination<T>(data: T, pagination: {
  count?: number;
  current_page?: number;
  total_pages?: number;
  total_count?: number;
  has_next_page?: boolean;
  has_previous_page?: boolean;
  next_cursor?: string | null;
  has_more?: boolean;
  limit?: number;
}, status: number = 200): NextResponse {
  return NextResponse.json({ data, ...pagination }, { status });
}

export function error(code: string, message: string, status: number = 400, details?: any): NextResponse {
  return NextResponse.json({
    error: { code, message, request_id: randomUUID().slice(0, 8), ...(details ? { details } : {}) },
  }, { status });
}

export function unauthorized(): NextResponse {
  return error('UNAUTHORIZED', 'Missing or invalid Authorization header', 401);
}

export function notFound(message: string = 'Not Found'): NextResponse {
  return error('NOT_FOUND', message, 404);
}

export function validationError(details: any[]): NextResponse {
  return error('VALIDATION_ERROR', 'Validation error', 422, details);
}

export function forbidden(message: string = 'Forbidden'): NextResponse {
  return error('FORBIDDEN', message, 403);
}

export function rateLimited(message: string = 'Rate limit exceeded'): NextResponse {
  return error('RATE_LIMITED', message, 429);
}

export function conflict(message: string = 'Conflict'): NextResponse {
  return error('CONFLICT', message, 409);
}

// ============================================================
// Pagination helpers
// ============================================================

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export function parsePagination(req: NextRequest): { page: number; limit: number } {
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || String(DEFAULT_PAGE), 10));
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get('limit') || String(DEFAULT_LIMIT), 10)));
  return { page, limit };
}

export function pagePaginationMeta(currentPage: number, limit: number, totalCount: number) {
  const totalPages = Math.ceil(totalCount / limit);
  return {
    count: totalCount,
    pagination: {
      current_page: currentPage,
      total_pages: totalPages,
      total_count: totalCount,
      has_next_page: currentPage < totalPages,
      has_previous_page: currentPage > 1,
    },
  };
}

export function cursorPaginationMeta(nextCursor: string | null, limit: number) {
  return {
    pagination: {
      next_cursor: nextCursor,
      has_more: !!nextCursor,
      limit,
    },
  };
}
