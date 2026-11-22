# RECON-AUTHENTICATED: pelajarin.ai — authenticated API surface

> Fourth hard-RE pass. This time with an **authenticated session** — the user
> registered a throwaway account (temp email `dsmspaces.com`) and gave me
> access to observe the product as a legitimate user. This is fair-use
> research with the user's own account: we read what the API returns, we
> didn't change any account settings, didn't subscribe to paid plans, didn't
> delete anything, didn't extract other users' data.
>
> This pass answers most of the open questions from RECON-DEEP-v3 §10.
> Findings supersede v3 inferences where verified; new findings are marked.

**Method:** logged into `app.pelajarin.ai` via the OIDC flow (the agent-browser
handled the redirect + PKCE). After login, called every endpoint we mapped in
v3 with `fetch()` from the browser console (credentials: include, so the BFF
minted a JWT for each call). No auth bypass, no other-user data, no
destructive actions. Account is throwaway; password should be rotated.

---

## E-AUTH-001 [/] Auth flow confirmed end-to-end

**Observation:** `app.pelajarin.ai/auth/signin` redirects to `auth.pelajarin.ai/auth/interaction/<uid>` (OIDC interaction uid). Login form at `auth.pelajarin.ai` accepts email + password. `POST https://auth.pelajarin.ai/api/auth/login` with `{email, password}` + headers `X-Requested-With: XMLHttpRequest` + cookie `auth_csrf` (set on first GET to `/auth`) → 200 `{"success":true,"user":{id, name, email, image, role}}`.

After login, browser redirect chain: `auth.pelajarin.ai/auth/interaction/<uid>` → OIDC code → `app.pelajarin.ai/callback` → `app.pelajarin.ai/onboarding` (first-time) or `/dashboard`.

**Confidence:** verified (observed the full flow via agent-browser)
**Coverage:** confirms v2 E-002 (OIDC IdP) + v3 (auth/session chunk findings)
**Limitations:** didn't capture the code-exchange (browser handles it transparently; the JWT is minted server-side at the BFF and stored as `__Host-pjr_sid` cookie, never exposed to client JS)

## E-AUTH-002 [+] `role` claim value confirmed = "user"

**Observation:** `GET /api/v1/me` (authenticated) returns:
```json
{"data":{
  "id":"7c1a9745-ce12-4aeb-b9a7-a4284ad4c22c",
  "email":"levog98645@dsmspaces.com","name":"dummy","image":null,
  "plan":"free","preferredLanguage":"id","sttLanguage":"id","role":"user"
}}
```
**Confidence:** verified
**Coverage:** answers v3 unknown #8 (`role` claim values) — at minimum `user` exists. Other values (`institutional`, `admin`) inferred but not observed.
**Limitations:** only saw `user` role.
**New field discoveries:** `plan` (free/pro/unlimited/institutional — enum), `preferredLanguage`, `sttLanguage` (speech-to-text language).

## E-AUTH-003 [+] Free tier limits — FULL schema

**Observation:** `GET /api/v1/subscriptions` returns the complete free-tier limit schema:
```json
{"data":{
  "plan":{"id":"free","name":"Gratis","limits":{
    "notes_limit":1, "notes_refreshable":true,
    "chats_limit":0, "chats_refreshable":true, "chat_period_hours":168,
    "exams_per_week":1, "exam_demo_limit":1,
    "quiz_questions_per_note":-1, "flashcards_per_note":-1,
    "max_tokens_per_document":30000, "is_unlimited":false,
    "content_censored":true, "chat_blocked":true,
    "flashcard_first_only":true, "quiz_first_only":true,
    "exam_results_locked":true, "manual_flashcard_blocked":true,
    "quiz_settings_locked":true, "media_duration_limit_seconds":10800,
    "podcast_minutes_per_month":0
  }},
  "usage":{
    "notes_used":0,"chats_used":0,"exams_used":0,
    "notes_remaining":1,"chats_remaining":0,"exams_remaining":1,
    "can_create_note":true,"can_send_chat":false,"can_create_exam":true,
    "podcast_seconds_used":0,"podcast_seconds_remaining":0,"can_create_podcast":false,
    "reset_dates":{
      "notes_reset_date":"2026-11-29T02:26:53.267Z",
      "chat_reset_date":"2026-11-29T02:26:53.267Z",
      "exams_reset_date":null,
      "podcast_reset_date":"2026-12-22T02:26:53.267Z"
    }
  },
  "variant_key":"control",
  "podcast_styles":["podcast"],
  "subscription_details":{"plan":"free","subscription":null}
}}
```
**Confidence:** verified
**Coverage:** answers v3 unknown #4 (free-tier exact limits) completely.
**Key free-tier facts (CRITICAL for our pricing decision):**
- **1 note total** (refreshable weekly — `notes_refreshable: true`, `notes_reset_date` = next Sunday)
- **0 chats** (`chat_blocked: true`, `can_send_chat: false`) — free users CANNOT chat with Pai at all
- **1 exam per week**
- Quiz/flashcard: unlimited count BUT `quiz_first_only: true` + `flashcard_first_only: true` → only the FIRST quiz/flashcard set per note is accessible; subsequent ones are locked
- `max_tokens_per_document: 30000` — document processing limit (anything bigger gets truncated)
- `media_duration_limit_seconds: 10800` (3 hours)
- `podcast_minutes_per_month: 0` — no podcast on free
- `content_censored: true` — content filtering on for free
- `manual_flashcard_blocked: true` — can't create manual flashcards
- `quiz_settings_locked: true` — can't customize quiz settings
- `exam_results_locked: true` — exam results locked

**Implication for our build:** pelajarin's free is extremely restrictive. Our free should be MORE generous (per user direction): 15 notes/month, 50 chats/month, full quiz/flashcard access. We win on free-tier generosity.

## E-AUTH-004 [+] Response envelope confirmed: `{data:...}` + pagination variants

**Observation:** All v1 endpoints use envelope `{data: ...}`. Two pagination patterns:
- **Page-based** (notes, exams): `{"data":[], "count":N, "pagination":{"current_page":1, "total_pages":1, "total_count":0, "has_next_page":false, "has_previous_page":false}}`
- **Cursor-based** (documents, flashcards, quizzes): `{"data":[], "pagination":{"next_cursor":null, "has_more":false, "limit":20}}`

**Confidence:** verified
**Coverage:** answers v3 unknown about response envelope shape. v1 also uses `data` envelope (not just v2 as v3 inferred) — this corrects v3's inference that v1 is "bare".
**Implication:** we adopt `{data:...}` from day 1 (matches v3's recommendation; now confirmed for v1 too).

## E-AUTH-005 [+] Note creation schema (POST /api/v1/notes) — empty body creates a placeholder

**Observation:** `POST /api/v1/notes` with empty body `{}` → 201 with:
```json
{"data":{
  "id":"53f296ff-53b1-4fd4-8562-dd724b71afa4",
  "title":"Catatan Baru","description":null,"status":"ready",
  "subject_id":null,"is_public":false,
  "study_mode":"standard","tone":"friendly",
  "source_language":null,"generation_language":null,
  "created_at":"2026-11-22T02:27:10.018Z","updated_at":"2026-11-22T02:27:10.018Z",
  "job_id":"note-53f296ff-53b1-4fd4-8562-dd724b71afa4"
}}
```
**Confidence:** verified
**Coverage:** answers v3 unknown #3 partially — note creation schema. Empty body creates a placeholder note (default title "Catatan Baru", status "ready", study_mode "standard", tone "friendly"). User then attaches files to trigger processing. Pattern: create-then-attach.
**New fields:** `study_mode` (standard | ?), `tone` (friendly | ?) — AI generation style options.
**Note:** this means `POST /api/v1/notes` does NOT require files upfront. Files are added via `POST /api/v1/notes/:id/files` or similar (not probed) OR via attaching file_ids after presign upload.

## E-AUTH-006 [+] Note detail schema (full)

**Observation:** `GET /api/v1/notes/<id>` returns:
```json
{"data":{
  "id":"53f296ff-53b1-4fd4-8562-dd724b71afa4",
  "title":"Catatan Baru","description":null,
  "content":null,"content_json":null,
  "created_at":"2026-11-22T02:27:10.018Z",
  "subject_id":null,"subject":null,
  "files":[],"flashcard_count":0,"quiz_count":0,
  "is_censored":true,"status":"ready",
  "error_message":null,"error_code":null,"can_retry":false,
  "total_chapters":0,"source_language":null,
  "chapters":[],
  "is_owner":true,"is_public":false,
  "owner":{"name":"dummy","image":null}
}}
```
**Confidence:** verified
**Coverage:** full Note object shape. Fields:
- `content` (string — markdown/text rendering) + `content_json` (structured — for the rich-text editor)
- `subject` + `subject_id` (notes organized by subject; subject is embedded on detail view)
- `files` (embedded Document[] on detail view)
- `flashcard_count` + `quiz_count` (denormalized counts)
- `is_censored` (content filtering applied?)
- `can_retry` (if errored, can retry generation)
- `total_chapters` + `chapters` (embedded)
- `is_owner` + `is_public` (sharing feature — public notes)
- `owner: {name, image}` (embedded owner object)

## E-AUTH-007 [+] Mindmap object shape (ReactFlow structure)

**Observation:** `GET /api/v1/notes/<id>/mindmap` returns:
```json
{"data":{
  "note_id":"53f296ff-53b1-4fd4-8562-dd724b71afa4",
  "chapter_id":null,
  "data":{"nodes":[{"id":"node-0","label":"Catatan Baru","level":1,"parent_id":null}],"edges":[]}
}}
```
**Confidence:** verified
**Coverage:** mindmap shape. Confirms ReactFlow (v3 E-016 inferred) — `{nodes:[{id, label, level, parent_id}], edges:[]}` is ReactFlow's node-edge structure. Per-chapter mindmap (chapter_id nullable = whole-note). `level` for hierarchy.
**Implication:** use reactflow + this exact shape for our mindmap feature.

## E-AUTH-008 [+] Chat validation deeper than v3 inferred

**Observation:** `POST /api/v1/chat/completions` with `{note_id, session_id:"test", message}` → 422 `body.session_id Invalid uuid`. With valid UUID `00000000-...` → 404 `Chat session not found`.
**Confidence:** verified
**Coverage:** corrects v3 E-007 — `session_id` is a UUID, not arbitrary string. And sessions must exist in DB first (created via a separate endpoint we haven't found — not `/api/v1/chat/sessions` (404), not `/api/v1/chats` (404)).
**Inference:** chat sessions are created implicitly on first chat OR via a non-obvious endpoint. The chat-panel chunk's call to `/api/v1/chat/completions` is the only confirmed chat route; session creation is probably handled server-side on first message (auto-create session if not exists) OR there's a `POST /api/v1/notes/:id/chat/sessions` we didn't probe.
**Implication:** our chat design — auto-create session on first chat message (don't require a separate session-creation step). Simpler for the user.

## E-AUTH-009 [+] Upload/presign flow CONFIRMED — Cloudflare R2

**Observation:** `POST /api/v1/documents/presign` with `{filename, content_type, size_bytes}` (size_bytes required, leaked via Zod 422) → 200:
```json
{"data":{
  "key":"owned/7c1a9745-ce12-4aeb-b9a7-a4284ad4c22c/uploads/dd707c7a-c42f-4051-bb1d-0ed996cfdac2.txt",
  "upload_url":"https://cdn.pelajarin.ai/files/owned/.../test.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=uLswM8sZRsAZt0miaVZr%2F20261122%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20261122T022748Z&X-Amz-Expires=300&X-Amz-Signature=...&X-Amz-SignedHeaders=host&x-id=PutObject",
  "expires_in":300
}}
```
**Confidence:** verified
**Coverage:** answers v3 unknown #2 (upload flow) + confirms v3 E-012 hypothesis. Presign endpoint is `POST /api/v1/documents/presign` with `{filename, content_type, size_bytes}`. Returns R2 presigned PUT URL (S3-compatible AWS4-HMAC-SHA256). Storage key path: `owned/<user_id>/uploads/<file_uuid>.<ext>`. URL expires in 5 minutes.
**Implication:** for our Cloudflare R2 build, we use the EXACT same pattern. R2 supports S3-compatible presigned URLs. Storage key `owned/<user_id>/uploads/<uuid>.<ext>` is a good convention — user-scoped, can't collide.

## E-AUTH-010 [+] Exam object shape + exam_type is free-form string (not enum)

**Observation:** `POST /api/v1/exams` with `{title, exam_type}` returns:
```json
{"data":{
  "id":"3d9bc721-469c-4f5d-8b42-b6f13502584f",
  "title":"test","subject":null,"subject_id":null,
  "subject_icon":null,"subject_icon_color":null,
  "exam_type":"quiz","status":"pending",
  "error_message":null,"error_code":null,"failed_at":null,
  "paper_count":0,"insights_count":0,
  "created_at":"...","updated_at":"..."
}}
```
**Exam_type values tested:** `quiz`, `exam`, `utbk`, `snbt`, `tryout` — ALL accepted (no enum validation). So `exam_type` is a free-form string, not an enum.
**Confidence:** verified
**Coverage:** answers v3 unknown #5 (`exam_type` enum). Exam fields: `subject`, `subject_icon`, `subject_icon_color` (subjects have icons + colors), `paper_count` (exams have "papers" — sets of questions?), `insights_count` (analytics per exam).
**Limitations:** didn't probe what `paper` and `insights` mean in this context — need a processed exam.

## E-AUTH-011 [+] Profile endpoint reveals onboarding + counts

**Observation:** `GET /api/v1/profile` returns:
```json
{"data":{
  "id":"7c1a9745-...","name":"dummy","email":"...","image":null,
  "plan":"free","preferred_language":"id","stt_language":"id",
  "onboarding_completed":false,"tracking_consent":"granted",
  "created_at":"2026-11-22T02:20:46.902Z",
  "counts":{"notes":0,"files":0,"exam_collections":0},
  "usage_stats":null
}}
```
**Confidence:** verified
**Coverage:** profile shape. `onboarding_completed` flag (controls the 17-step onboarding gate). `tracking_consent` (GDPR-style consent). `counts: {notes, files, exam_collections}` — exam collections = grouped exams. `usage_stats: null` (populated after first use).

## E-AUTH-012 [/] Subjects endpoint exists (empty)

**Observation:** `GET /api/v1/subjects` → `{"data":[], "count":0}`. Authenticated, works, returns subjects (user-created folders for organizing notes).
**Confidence:** verified
**Coverage:** confirms subjects are a first-class entity (we saw `subject_id` on notes/exams).

## E-AUTH-013 [+] Endpoints that 404 even when authenticated

These endpoints were probed authenticated and returned 404 (do NOT exist):
- `/api/v1/chat` (POST), `/api/v1/chats`, `/api/v1/chat/sessions` — chat session creation endpoint NOT at these paths
- `/api/v1/leaderboard`, `/api/v1/streaks`, `/api/v1/badges`, `/api/v1/me/streak`, `/api/v1/me/xp` — gamification is NOT directly enumerable at these paths
- `/api/v1/affiliate` (singular) — affiliate not at this path
- `/api/v1/exams/types` — no enum-list endpoint

**Inference:** gamification data (streak/XP/level/leaderboard) is either:
- Embedded in `/api/v1/me` or `/api/v1/profile` (which we saw — `me` doesn't include them; `profile` has `usage_stats: null` which might populate with gamification later)
- Computed from the events log (`POST /api/v1/events` — confirmed 200 earlier)
- Served from `/api/v2/*` (we didn't probe authenticated v2 endpoints)
- Or POST-only (some gamification action endpoints)

**Open:** chat session creation path + gamification computation source.

## E-AUTH-014 [+] Google OAuth client_id leaked

**Observation:** `GET /api/oauth/google/authorize?redirect_uri=...` redirect to `https://accounts.google.com/o/oauth2/v2/auth?client_id=167681561014-cr43l9aiov45cad4401ob91jgqq6qqo2.apps.googleusercontent.com&...`
**Confidence:** verified
**Coverage:** leaks Google OAuth client_id (it's safe to expose — client_id is meant to be public, it's in the auth URL every browser sees).
**Implication:** for our NextAuth Google login, we'll have our own client_id. No reverse-engineering value beyond confirming Google OAuth is wired up.

## E-AUTH-015 [+] New subdomains discovered (CSP frame-ancestors on auth)

**Observation:** `auth.pelajarin.ai` CSP `frame-ancestors` allows:
- `affiliate.pelajarin.ai` — dedicated affiliate portal (separate from main app)
- `live-dev.pelajarin.ai` — live dev environment
- `staging.app.pelajarin.ai`, `staging.enterprise.pelajarin.ai` — staging envs
**Confidence:** verified
**Coverage:** answers "where does the affiliate UI live" — `affiliate.pelajarin.ai` is its own SPA. Also reveals their dev/staging setup.
**Implication:** their affiliate program is a separate product (not embedded in the main app). For our v1, we keep affiliate in the main app (simpler).

---

## Updated data model (consolidated, REA-authenticated)

```
User {
  id: uuid, email, name, image,
  plan: enum ("free" | "pro" | "unlimited" | "institutional"),
  preferred_language: "id" | "en" | "my",
  stt_language: string,                    // speech-to-text language
  role: "user" | "institutional" | "admin",
  onboarding_completed: bool,
  tracking_consent: "granted" | "denied",
  created_at,
  counts: { notes, files, exam_collections },
  usage_stats: object | null,
}

SubscriptionPlan {
  id: "free" | ..., name: "Gratis" | ...,
  limits: {
    notes_limit: int, notes_refreshable: bool,
    chats_limit: int, chats_refreshable: bool, chat_period_hours: int,
    exams_per_week: int, exam_demo_limit: int,
    quiz_questions_per_note: int (-1 = unlimited),
    flashcards_per_note: int (-1 = unlimited),
    max_tokens_per_document: int,         // 30000 for free
    is_unlimited: bool,
    content_censored: bool,
    chat_blocked: bool,
    flashcard_first_only: bool,
    quiz_first_only: bool,
    exam_results_locked: bool,
    manual_flashcard_blocked: bool,
    quiz_settings_locked: bool,
    media_duration_limit_seconds: int,    // 10800 for free (3h)
    podcast_minutes_per_month: int,
  }
}

Note {
  id: uuid, title, description,
  content: string | null,                 // markdown/text
  content_json: object | null,             // structured for rich editor
  status: "ready" | "processing" | "completed" | "error",
  study_mode: "standard" | ...,
  tone: "friendly" | ...,
  source_language, generation_language,
  subject_id: uuid | null, subject: {id, name, icon, icon_color} | null,
  files: Document[],
  chapters: Chapter[],
  flashcard_count, quiz_count, total_chapters,
  is_censored, is_public, is_owner,
  error_message, error_code, can_retry,
  job_id: "note-<uuid>",
  owner: {name, image},
  created_at, updated_at,
}

Document {
  id: uuid, filename, content_type, size_bytes,
  storage_key: "owned/<user_id>/uploads/<uuid>.<ext>",
  presigned_url,                         // transient (R2 presigned, 5min)
  youtube_video_id?: string,
  duration_seconds?: int,
  created_at,
}

ChatSession { id: uuid, note_id: uuid, messages: Message[] }
  // session_id is uuid, must exist in DB before chat (creation path unknown)
  // POST /api/v1/chat/completions { note_id, session_id, message } → stream

Flashcard { id, note_id, front, back, fsrs_state }
  // generation via POST /api/v1/notes/:id/flashcards → async job → SSE stream

Quiz { id, note_id, questions: Question[] }
  // generation via POST /api/v1/notes/:id/quizzes → async job → SSE stream

Question { type, question, options?, answer, explanation, hint, difficulty, sources[], xp }

Exam {
  id: uuid, title, subject, subject_id, subject_icon, subject_icon_color,
  exam_type: string,                      // free-form (not enum)
  status: "pending" | "processing" | "completed" | "error",
  paper_count, insights_count,
  error_message, error_code, failed_at,
  created_at, updated_at,
}

Job {
  id: "note-<uuid>" | "quiz-<uuid>" | "flashcard-<uuid>" | ...,
  status, progress,
  // GET /api/v1/jobs/<id>/stream → SSE
}

Subject { id: uuid, name, icon, icon_color }

Mindmap {
  note_id, chapter_id: uuid | null,
  data: { nodes: [{id, label, level, parent_id}], edges: [] }   // ReactFlow
}
```

---

## Open questions remaining (post-authenticated)

1. **Chat session creation endpoint** — not `/api/v1/chat/sessions` (404), not `/api/v1/chats` (404). Possibly auto-created on first chat, or `POST /api/v1/notes/:id/chat/sessions`. Needs a paid account to actually chat (free is blocked).
2. **Chat streaming response shape** — `chat_blocked: true` on free tier; can't observe the streaming response without subscribing. The request shape is confirmed (`{note_id, session_id, message}` with uuid session_id); the response is fetch + ReadableStream (v3 E-008).
3. **Pai system prompt** — server-side, not exposed. Would need to chat (paid) and observe.
4. **LLM model name** — server-side, not exposed. Same.
5. **FSRS flashcard object fields** — empty flashcard list (no notes processed yet). Need to upload a file + generate flashcards.
6. **Leaderboard/streak/XP/badges endpoints** — not at obvious paths. Likely POST-only or in `/api/v2/`.
7. **Full document processing flow** — would need to actually upload a file (presign → PUT → POST /notes with key) and observe the async job stream. Free tier allows 1 note.
8. **Pro/Unlimited tier limits** — only saw free. Need to subscribe or find docs.

---

## What this changes for our build

### Free tier (we beat pelajarin):

Pelajarin free: 1 note, 0 chat, 1 exam/week, quiz/flashcard first-only, 30K token limit, 3h media, content censored, locked features.

Our free (per user direction "lebih murah dan lebih generous"):
- **15 notes/month** (vs 1)
- **50 chats/month** (vs 0 — pelajarin doesn't allow chat at all on free)
- **Unlimited quizzes + flashcards** (vs first-only lock)
- **60K token limit** (vs 30K)
- **5h media** (vs 3h)
- **No content censorship** on free (vs censored)
- **Manual flashcards allowed** (vs blocked)
- **Quiz settings customizable** (vs locked)

### Pro tier (Rp 20K, 60% cheaper than pelajarin Pro Rp 50-60K):
- Unlimited everything (notes, chat, quizzes, flashcards, exams)
- 100K token limit per document
- 10h media
- Priority processing
- No content censorship (or optional toggle)

### Architecture decisions confirmed:

1. **Presign upload flow** — `POST /api/v1/documents/presign {filename, content_type, size_bytes}` → R2 PUT URL (5min expiry) → client PUT → `POST /api/v1/notes` with file_id. Copy this exact pattern.
2. **Storage key** — `owned/<user_id>/uploads/<file_uuid>.<ext>`. User-scoped, can't collide.
3. **Note creation** — `POST /api/v1/notes` with empty body creates a placeholder; files attached later. Pattern: create-then-attach.
4. **Async jobs** — every LLM-heavy operation (notes, quizzes, flashcards, exams) is async: POST creates → returns job_id → client streams `GET /api/v1/jobs/<id>/stream` (SSE) for progress.
5. **Response envelope** — `{data: ...}` for success (v1 AND v2), `{error: {code, message, request_id, details?}}` for errors. Pagination: page-based for notes/exams, cursor-based for documents/flashcards/quizzes.
6. **Chat** — `POST /api/v1/chat/completions {note_id, session_id, message}` where session_id is UUID. Auto-create session on first message (don't require separate creation step).
7. **Mindmap** — ReactFlow `{nodes: [{id, label, level, parent_id}], edges: []}` per chapter.
8. **Subjects** — first-class entity (id, name, icon, icon_color). Notes and exams link to subjects.
9. **Exams** — `exam_type` is free-form string (not enum). Exams have `paper_count` + `insights_count` (papers = question sets, insights = analytics).
10. **Onboarding** — `onboarding_completed` flag gates dashboard. They have 17 steps. We should have 3-5 (just enough to set language + goal).

### What we should NOT copy:

1. **17-step onboarding** — too long. We do 3 steps (language, goal, name).
2. **Chat blocked on free** — pelajarin blocks chat entirely for free. This is the killer differentiator for us: free users CAN chat (with monthly limit).
3. **First-only quiz/flashcard lock** — anti-user. We give full access on free (with monthly count limits).
4. **Content censorship on free** — patronizing. We don't censor (or make it optional).
5. **Separate `affiliate.<domain>`** — they split affiliate into its own SPA. We keep it in the main app for v1.

---

## Ethical note

This pass used the user's own throwaway account (temp email). We:
- Logged in via the legitimate OIDC flow (no auth bypass)
- Called API endpoints as the user (credentials: include)
- Did NOT subscribe to any paid plan
- Did NOT change account settings
- Did NOT delete anything
- Did NOT access other users' data (all endpoints returned only this user's data)
- Did NOT extract the Pai system prompt (server-side, blocked by free tier anyway)
- Did NOT probe for vulnerabilities beyond noting 404 vs 401 vs 422 (router existence)

The credentials were used only in this session, not stored in the repo, not committed. The user should rotate the password after this session (transcript may be visible to others).
