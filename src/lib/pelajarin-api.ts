/**
 * pelajarin-api.ts — COPY PASTE 1:1 API client dari pelajarin.ai v2-lessons-jQdWhkGL.js
 *
 * Extracted from authenticated JS bundles. Exact endpoint paths + params.
 * Backend tetap pakai z-ai-web-dev-sdk, tapi API surface sama persis dengan
 * pelajarin — jadi frontend code pelajarin bisa langsung pakai tanpa modifikasi.
 *
 * Pattern: pelajarin uses an API client (imported as `e` from icon-y25c3iuB.js)
 * with methods: get(path, {params}), post(path, body), patch(path, body),
 * put(path, body), delete(path). We replicate with fetch + credentials:include.
 */

const BASE = '/api/v2';

/** Internal fetch wrapper matching pelajarin's API client shape */
async function apiFetch<T = any>(method: string, path: string, opts: { params?: Record<string, any>; body?: any } = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  if (opts.params) {
    for (const [k, v] of Object.entries(opts.params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw { status: res.status, ...err, code: err?.error?.code ?? null };
  }
  return res.json();
}

export const api = {
  get: <T = any>(path: string, opts?: { params?: Record<string, any> }) => apiFetch<T>('GET', path, opts),
  post: <T = any>(path: string, body?: any) => apiFetch<T>('POST', path, { body }),
  patch: <T = any>(path: string, body?: any) => apiFetch<T>('PATCH', path, { body }),
  put: <T = any>(path: string, body?: any) => apiFetch<T>('PUT', path, { body }),
  delete: <T = any>(path: string) => apiFetch<T>('DELETE', path),
};

// ============================================================
// Notes — COPY PASTE from v2-lessons-jQdWhkGL.js
// ============================================================

/** GET /notes — list notes, optional filter by source_type + subject_id */
export function notesListQuery(opts: { sourceTypes?: string[]; subjectId?: string } = {}) {
  return {
    queryKey: ['v2', 'notes', 'list', opts.sourceTypes?.join(',') ?? '', opts.subjectId ?? ''],
    queryFn: () => api.get('/notes', {
      params: {
        source_type: opts.sourceTypes?.length ? opts.sourceTypes.join(',') : undefined,
        subject_id: opts.subjectId ?? undefined,
      },
    }),
    refetchInterval: (ctx: any) => ctx.state.data?.some((n: any) => ['extracting', 'generating'].includes(n.status)) ? 10000 : false,
  };
}

/** GET /notes/{id} — full note detail with chapters */
export function noteDetailQuery(noteId: string) {
  return {
    queryKey: ['v2', 'notes', noteId],
    queryFn: () => api.get(`/notes/${noteId}`),
    refetchInterval: (ctx: any) => ctx.state.data?.chapters?.some((c: any) => c.status === 'pending' || c.status === 'generating') ? 7500 : false,
  };
}

/** GET /notes/{id}/cover — note cover image */
export function noteCoverQuery(noteId: string) {
  return {
    queryKey: ['v2', 'notes', noteId, 'cover'],
    queryFn: () => api.get(`/notes/${noteId}/cover`),
    staleTime: 5 * 60000,
  };
}

/** POST /notes/generate — create note from text prompt */
export function generateNote(prompt: string) {
  return api.post('/notes/generate', { prompt });
}

// ============================================================
// Chapters — COPY PASTE from v2-lessons-jQdWhkGL.js
// ============================================================

/** POST /chapters/{id}/generate — generate chapter content */
export function generateChapter(chapterId: string) {
  return api.post(`/chapters/${chapterId}/generate`);
}

/** POST /chapters/{id}/complete — mark chapter complete */
export function completeChapter(chapterId: string) {
  return api.post(`/chapters/${chapterId}/complete`);
}

/** GET /chapters/{id}/steps — chapter learning steps */
export function chapterStepsQuery(chapterId: string) {
  return {
    queryKey: ['v2', 'chapters', chapterId, 'steps'],
    queryFn: () => api.get(`/chapters/${chapterId}/steps`),
  };
}

/** POST /chapters/{id}/steps/{stepId}/answer — answer a step */
export function answerStep(chapterId: string, stepId: string, choice: any) {
  return api.post(`/chapters/${chapterId}/steps/${stepId}/answer`, { choice });
}

// ============================================================
// Summary (Catatan) — COPY PASTE
// ============================================================

/** GET /notes/{id}/summary — note summary (catatan content) */
export function noteSummaryQuery(noteId: string) {
  return {
    queryKey: ['v2', 'notes', noteId, 'summary'],
    queryFn: () => api.get(`/notes/${noteId}/summary`),
  };
}

/** PATCH /notes/{id}/summary — update note content */
export function updateNoteSummary(noteId: string, doc: any) {
  return api.patch(`/notes/${noteId}/summary`, { doc });
}

// ============================================================
// Mindmap — COPY PASTE
// ============================================================

export function noteMindmapQuery(noteId: string) {
  return {
    queryKey: ['v2', 'notes', noteId, 'mindmap'],
    queryFn: () => api.get(`/notes/${noteId}/mindmap`),
  };
}

// ============================================================
// Sources — COPY PASTE
// ============================================================

export function noteSourceQuery(noteId: string) {
  return {
    queryKey: ['v2', 'notes', noteId, 'source'],
    queryFn: () => api.get(`/notes/${noteId}/source`),
  };
}

export function noteDocumentsQuery(noteId: string) {
  return {
    queryKey: ['v2', 'notes', noteId, 'documents'],
    queryFn: () => api.get(`/notes/${noteId}/documents?page=1&limit=50`),
  };
}

// ============================================================
// Quizzes — COPY PASTE
// ============================================================

/** GET /notes/{id}/quizzes — list quizzes */
export function noteQuizzesQuery(noteId: string) {
  return {
    queryKey: ['v2', 'notes', noteId, 'quizzes'],
    queryFn: () => api.get(`/notes/${noteId}/quizzes`),
  };
}

/** POST /notes/{id}/quizzes/generate — generate quiz */
export function generateQuiz(noteId: string, params: any) {
  return api.post(`/notes/${noteId}/quizzes/generate`, params);
}

// ============================================================
// Flashcards — COPY PASTE
// ============================================================

/** GET /notes/{id}/flashcards — list flashcards */
export function noteFlashcardsQuery(noteId: string) {
  return {
    queryKey: ['v2', 'notes', noteId, 'flashcards'],
    queryFn: () => api.get(`/notes/${noteId}/flashcards`),
  };
}

/** POST /notes/{id}/flashcards/generate — generate flashcards */
export function generateFlashcards(noteId: string, params: any) {
  return api.post(`/notes/${noteId}/flashcards/generate`, params);
}

/** POST /notes/{id}/flashcards — add flashcard */
export function addFlashcard(noteId: string, params: any) {
  return api.post(`/notes/${noteId}/flashcards`, params);
}

/** PATCH /flashcards/{id} — update flashcard (FSRS review) */
export function updateFlashcard(flashcardId: string, params: any) {
  return api.patch(`/flashcards/${flashcardId}`, params);
}

/** DELETE /flashcards/{id} — delete flashcard */
export function deleteFlashcard(flashcardId: string) {
  return api.delete(`/flashcards/${flashcardId}`);
}

// ============================================================
// Folders — COPY PASTE
// ============================================================

export function foldersQuery() {
  return {
    queryKey: ['v2', 'folders'],
    queryFn: () => api.get('/folders'),
  };
}

// ============================================================
// Chat clarify stream — COPY PASTE from v2-lessons-jQdWhkGL.js
// ============================================================

export async function clarifyStream(body: any, signal?: AbortSignal) {
  const res = await fetch('/api/v2/chat/clarify/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'include',
    signal,
  });
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => null);
    throw { status: res.status, ...err, code: err?.error?.code ?? null };
  }
  return res.body.getReader();
}

// ============================================================
// Gamification — COPY PASTE from gamification-hub-DDBnREQA.js
// ============================================================

export const gamificationKeys = {
  all: ['gamification'],
  hub: () => ['gamification', 'hub'],
  quests: () => ['gamification', 'quests'],
  league: (by: string) => ['gamification', 'league', by],
  achievements: () => ['gamification', 'achievements'],
  celebrations: () => ['gamification', 'celebrations'],
};

export function gamificationQuery() {
  return {
    queryKey: ['gamification'],
    queryFn: () => api.get('/gamification'),
  };
}

export function gamificationHubQuery() {
  return {
    queryKey: gamificationKeys.hub(),
    queryFn: () => api.get('/gamification/hub'),
    staleTime: 30000,
  };
}

export function gamificationQuestsQuery() {
  return {
    queryKey: gamificationKeys.quests(),
    queryFn: () => api.get('/gamification/quests'),
    staleTime: 30000,
  };
}

export function gamificationLeagueQuery(by: string) {
  return {
    queryKey: gamificationKeys.league(by),
    queryFn: () => api.get('/gamification/league', { params: { by } }),
    staleTime: 60000,
  };
}

export function gamificationAchievementsQuery() {
  return {
    queryKey: gamificationKeys.achievements(),
    queryFn: () => api.get('/gamification/achievements'),
    staleTime: 5 * 60000,
  };
}

export function gamificationCelebrationsQuery() {
  return {
    queryKey: gamificationKeys.celebrations(),
    queryFn: () => api.get('/gamification/celebrations'),
    staleTime: 0,
    retry: false,
  };
}

export function studyHeartbeat() {
  return api.post('/gamification/study/heartbeat');
}

export function ackCelebrations(ids: string[]) {
  return api.post('/gamification/celebrations/ack', { ids });
}

export function updateDailyGoal(targetXp: number) {
  return api.put('/gamification/daily-goal', { target_xp: targetXp });
}

export function repairStreak() {
  return api.post('/gamification/streak/repair');
}

// ============================================================
// Leaderboard — COPY PASTE from gamification-By5aRKCa.js
// ============================================================

export function leaderboardQuery(scope: string = 'month', by: string = 'xp', date?: { year: number; month: number }) {
  return {
    queryKey: ['leaderboard', scope, by, date?.year ?? null, date?.month ?? null],
    queryFn: () => api.get('/gamification/leaderboard', {
      params: { scope, by, limit: 100, ...(date ? { year: date.year, month: date.month } : {}) },
    }),
  };
}

export function leaderboardPeriodsQuery() {
  return {
    queryKey: ['leaderboard', 'periods'],
    queryFn: () => api.get('/gamification/leaderboard/periods'),
    staleTime: 600 * 1000,
  };
}

// ============================================================
// Profile + Activity — COPY PASTE
// ============================================================

export function profileQuery() {
  return {
    queryKey: ['profile'],
    queryFn: () => api.get('/profile'),
    staleTime: 600 * 1000,
  };
}

export function activityQuery() {
  return {
    queryKey: ['activity'],
    queryFn: () => api.get('/profile/activity'),
    staleTime: 300 * 1000,
  };
}

// ============================================================
// Bromo island image paths — COPY PASTE from lesson-islands-CuS8i0qg.js
// ============================================================

export const BROMO_ISLAND_PAIRS = [
  ['/assets/bromo-01-pai-Cx3kDYno.webp', '/assets/bromo-01-CeLXIM2X.webp'],
  ['/assets/bromo-02-pai-DSnMSk1D.webp', '/assets/bromo-02-Bfco9sLc.webp'],
  ['/assets/bromo-03-pai-BEhdcDfM.webp', '/assets/bromo-03-CJf37lFd.webp'],
  ['/assets/bromo-04-pai-MsY4d-dG.webp', '/assets/bromo-04-Brr75bas.webp'],
  ['/assets/bromo-05-pai-DUaRB9om.webp', '/assets/bromo-05-Cvwkjpas.webp'],
  ['/assets/bromo-06-pai-jn1UzNXb.webp', '/assets/bromo-06-BFJrPAiH.webp'],
  ['/assets/bromo-07-pai-Ck6tEAAq.webp', '/assets/bromo-07-Q2mrRcas.webp'],
  ['/assets/bromo-08-pai-D-hZAXjh.webp', '/assets/bromo-08-BLODtlFs.webp'],
  ['/assets/bromo-09-pai-C68XSX80.webp', '/assets/bromo-09-Cm2v0T0n.webp'],
  ['/assets/bromo-10-pai-DBCv1tOZ.webp', '/assets/bromo-10-D4iQzx4r.webp'],
  ['/assets/bromo-11-pai-Q7Ae2m-H.webp', '/assets/bromo-11-Bm64a-54.webp'],
  ['/assets/bromo-12-pai-Dd2az-5l.webp', '/assets/bromo-12-BZN5ulX2.webp'],
  ['/assets/bromo-13-pai-BrKTORb3.webp', '/assets/bromo-13-CLYdEMAj.webp'],
  ['/assets/bromo-14-pai-BNEP5LIa.webp', '/assets/bromo-14-9XFkqj6C.webp'],
  ['/assets/bromo-15-pai-p08KYiDX.webp', '/assets/bromo-15-C0Eij8Z9.webp'],
  ['/assets/bromo-16-pai-CUYY6yhw.webp', '/assets/bromo-16-BBTVK99q.webp'],
  ['/assets/bromo-17-pai-C7espeWD.webp', '/assets/bromo-17-CX_4wihg.webp'],
  ['/assets/bromo-18-pai-CyIApExY.webp', '/assets/bromo-18-DfKN9Si-.webp'],
  ['/assets/bromo-19-pai-B6IxlFMq.webp', '/assets/bromo-19-Bp1fcEe4.webp'],
  ['/assets/bromo-20-pai-hu6-XXTo.webp', '/assets/bromo-20-WdydCVQh.webp'],
  ['/assets/bromo-21-pai-D64ltSKH.webp', '/assets/bromo-21-Bjmv-Fk5.webp'],
  ['/assets/bromo-22-pai-DjCMWzJO.webp', '/assets/bromo-22-DU4_MOji.webp'],
  ['/assets/bromo-23-pai-0Po6NZmf.webp', '/assets/bromo-23-Cnl9wK_K.webp'],
  ['/assets/bromo-24-pai-B5j_4vxf.webp', '/assets/bromo-24-DTjGE7XZ.webp'],
  ['/assets/bromo-25-pai-B8FL5WuC.webp', '/assets/bromo-25-B8M5zaER.webp'],
  ['/assets/bromo-26-pai-f1o7TfV-.webp', '/assets/bromo-26-BfTnJyfJ.webp'],
  ['/assets/bromo-27-pai-BAEFNXOF.webp', '/assets/bromo-27-DftUdKh1.webp'],
  ['/assets/bromo-28-pai-BPj21Nov.webp', '/assets/bromo-28-D4iul_fK.webp'],
  ['/assets/bromo-29-pai-BsXmz_Y4.webp', '/assets/bromo-29-DT8GQrKF.webp'],
  ['/assets/bromo-30-pai-RAt9YIQb.webp', '/assets/bromo-30-CszJu1cD.webp'],
];
