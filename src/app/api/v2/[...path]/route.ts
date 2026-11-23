/**
 * API proxy: maps pelajarin v2 endpoints → Bimo v1 endpoints.
 *
 * Pelajarin frontend JS calls /api/v2/notes, /api/v2/chapters/{id}/generate, etc.
 * Our backend has /api/v1/notes, /api/v1/notes/{id}/flashcards, etc.
 * This proxy translates so the pelajarin API client works without modification.
 *
 * Pattern from v2-lessons-jQdWhkGL.js:
 *   GET  /notes                    → GET  /api/v1/notes
 *   GET  /notes/{id}               → GET  /api/v1/notes/{id}
 *   POST /notes/generate           → POST /api/v1/notes/generate
 *   GET  /notes/{id}/summary       → GET  /api/v1/notes/{id} (content field)
 *   PATCH /notes/{id}/summary      → PATCH /api/v1/notes/{id}
 *   GET  /notes/{id}/mindmap       → GET  /api/v1/notes/{id} (chapters)
 *   GET  /notes/{id}/source        → GET  /api/v1/notes/{id} (files)
 *   GET  /notes/{id}/documents     → GET  /api/v1/documents
 *   GET  /notes/{id}/quizzes       → GET  /api/v1/notes/{id}/quizzes
 *   POST /notes/{id}/quizzes/generate → POST /api/v1/notes/{id}/quizzes
 *   GET  /notes/{id}/flashcards    → GET  /api/v1/notes/{id}/flashcards
 *   POST /notes/{id}/flashcards/generate → POST /api/v1/notes/{id}/flashcards
 *   POST /notes/{id}/flashcards    → POST /api/v1/notes/{id}/flashcards
 *   GET  /folders                  → GET  /api/v1/folders
 *   GET  /gamification             → GET  /api/v1/gamification
 *   GET  /gamification/hub         → GET  /api/v1/gamification/hub
 *   GET  /gamification/quests      → GET  /api/v1/gamification/quests
 *   GET  /gamification/league       → GET  /api/v1/gamification/league
 *   GET  /gamification/achievements → GET /api/v1/gamification/achievements
 *   GET  /gamification/celebrations → GET /api/v1/gamification/celebrations
 *   POST /gamification/study/heartbeat → POST /api/v1/gamification/study/heartbeat
 *   POST /gamification/celebrations/ack → POST /api/v1/gamification/celebrations/ack
 *   PUT  /gamification/daily-goal  → PUT  /api/v1/gamification/daily-goal
 *   POST /gamification/streak/repair → POST /api/v1/gamification/streak/repair
 *   GET  /gamification/leaderboard → GET  /api/v1/gamification/leaderboard
 *   GET  /gamification/leaderboard/periods → GET /api/v1/gamification/leaderboard/periods
 *   GET  /profile                  → GET  /api/v1/profile
 *   GET  /profile/activity          → GET  /api/v1/profile/activity
 *   POST /api/v2/chat/clarify/stream → POST /api/v2/chat/clarify/stream (direct)
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, params);
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, params);
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, params);
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, params);
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, params);
}

async function proxy(req: NextRequest, paramsPromise: Promise<{ path: string[] }>) {
  const { path } = await paramsPromise;
  const method = req.method;
  const pelajarinPath = '/' + path.join('/');
  const searchParams = new URL(req.url).searchParams;

  // Map pelajarin v2 path → Bimo v1 path
  const v1Path = mapPath(pelajarinPath, method);
  const targetUrl = new URL(v1Path, req.url);
  // Copy query params
  searchParams.forEach((v, k) => targetUrl.searchParams.set(k, v));

  // Forward request to v1 endpoint
  const headers = new Headers();
  // Forward cookies
  const cookie = req.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);
  headers.set('Content-Type', 'application/json');
  const body = method !== 'GET' && method !== 'DELETE' ? await req.text() : undefined;

  const res = await fetch(targetUrl.toString(), {
    method,
    headers,
    body: body || undefined,
  });

  const respBody = await res.text();
  const responseHeaders: Record<string, string> = {
    'Content-Type': res.headers.get('Content-Type') || 'application/json',
  };
  // Forward set-cookie if present
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) responseHeaders['set-cookie'] = setCookie;

  return new NextResponse(respBody, {
    status: res.status,
    headers: responseHeaders,
  });
}

function mapPath(pelajarinPath: string, method: string): string {
  // Direct passthrough for gamification + profile
  if (pelajarinPath.startsWith('/gamification')) return `/api/v1${pelajarinPath}`;
  if (pelajarinPath.startsWith('/profile')) return `/api/v1${pelajarinPath}`;

  // Notes
  if (pelajarinPath === '/notes' && method === 'GET') return '/api/v1/notes';
  if (pelajarinPath === '/notes/generate' && method === 'POST') return '/api/v1/notes/generate';

  // /notes/{id} sub-resources
  const noteMatch = pelajarinPath.match(/^\/notes\/([^/]+)(\/.*)?$/);
  if (noteMatch) {
    const noteId = noteMatch[1];
    const sub = noteMatch[2];
    if (!sub) return `/api/v1/notes/${noteId}`;
    if (sub === '/summary') return `/api/v1/notes/${noteId}`;
    if (sub === '/mindmap') return `/api/v1/notes/${noteId}`;
    if (sub === '/source') return `/api/v1/notes/${noteId}`;
    if (sub === '/documents') return '/api/v1/documents';
    if (sub === '/cover') return `/api/v1/notes/${noteId}`;
    if (sub === '/quizzes') return `/api/v1/notes/${noteId}/quizzes`;
    if (sub === '/quizzes/generate') return `/api/v1/notes/${noteId}/quizzes`;
    if (sub === '/flashcards' && method === 'GET') return `/api/v1/notes/${noteId}/flashcards`;
    if (sub === '/flashcards/generate') return `/api/v1/notes/${noteId}/flashcards`;
    if (sub === '/flashcards' && method === 'POST') return `/api/v1/notes/${noteId}/flashcards`;
  }

  // Flashcards (individual)
  const flashMatch = pelajarinPath.match(/^\/flashcards\/([^/]+)$/);
  if (flashMatch) return `/api/v1/notes/${flashMatch[1]}/flashcards`;

  // Folders
  if (pelajarinPath === '/folders') return '/api/v1/folders';

  // Chapters (map to note detail — chapters are embedded in note response)
  const chapMatch = pelajarinPath.match(/^\/chapters\/([^/]+)(\/.*)?$/);
  if (chapMatch) {
    return `/api/v1/notes/${chapMatch[1]}`;
  }

  // Default: try v1 passthrough
  return `/api/v1${pelajarinPath}`;
}
