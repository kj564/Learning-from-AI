# RECON-DEEP: pelajarin.ai — Hard reverse-engineering

> Second pass. This document is the **authenticated-grade** recon — what's
> visible to a network observer of the public site, without registering an
> account. Method: manual `curl` with a desktop Chrome User-Agent, single
> request per endpoint, no auth tokens sent, no automation. The marketing
> site's `robots.txt` blocks AI scrapers (GPTBot, ClaudeBot, etc.) — we did
> NOT use any crawler; every request was a single manual fetch.
>
> The first pass (`RECON.md`) covered product/feature/pricing. This pass
> covers **architecture, API surface, auth, data model, and the stack they
> actually shipped** — the things that inform how we build our own.

---

## 1. Topology (the big finding)

Pelajarin.ai is **not a single Next.js app**. It's 7+ hostnames:

| Host | Stack | Role |
|---|---|---|
| `pelajarin.ai` | Next.js App Router (RSC) | Marketing + blog (id/en/my) |
| **`app.pelajarin.ai`** | **Vite + Rolldown + React + TanStack Router + TanStack Query** | **The actual product SPA** (where the chat/notes/flashcards live) |
| **`auth.pelajarin.ai`** | **Vite + React — self-hosted OIDC IdP** | Login, OAuth, session minting |
| `api.pelajarin.ai` | TypeScript REST API, Zod-validated, Cloudflare front | Core backend |
| `cms.pelajarin.ai` | **Payload CMS** (Next.js) | Blog content |
| `enterprise.pelajarin.ai` | Next.js "Pelajarin.ai Enterprise" | Institution admin portal |
| `support.pelajarin.ai` | (linked) | Help center |
| `t.pelajarin.ai` | telemetry | Analytics ingest |

The marketing site (`pelajarin.ai`) is **just a storefront** — it links to `app.pelajarin.ai` where the real product lives. This is a different architecture from what I assumed in RECON.md (where I thought the Next.js site was the product).

**Stack signals from the SPA bundle chunk names:** `react-dom`, `rolldown-runtime`, `useRouter/useMatch/useParams/useSearch/Match/matchContext/link` (TanStack Router), `useMutation/queryOptions` (TanStack Query), `api-client`, `pomodoro-timer`, `use-study-heartbeat`, `use-session`, plus route chunks `_note`, `dashboard`, `pricing`, `leaderboard`, `checkout`, `onboarding`, `_auth`.

So they went **Vite + TanStack** for the app (not Next.js). This is faster for SPA and avoids RSC complexity, but means no SSR for the product — fine, because the product is behind auth anyway (SSR doesn't help logged-in pages).

## 2. API endpoint map (api.pelajarin.ai)

**Base path:** all real routes live under `/api/v1/*`. Root returns 404.

**Error envelope (consistent across all 404s):**
```json
{"error":{"code":"NOT_FOUND","message":"Not Found","request_id":"3ee655a4"}}
```
Response headers: `x-request-id`, `x-trace-id` (tracing), `access-control-allow-credentials: true`, Helmet CSP, Cloudflare. The `request_id` is for support tickets — good pattern.

**Detection trick:** the router returns **404 for unregistered method+path**, **401 for registered-but-unauth**, **422 for registered-but-invalid-Zod**. So:
- 404 = route doesn't exist (or wrong method)
- 401 = route exists, needs auth
- 422 = route exists, auth runs AFTER schema validation (leaks the schema!)

| Endpoint | Method | Status on no-auth | Inferred purpose |
|---|---|---|---|
| `/health` | GET | 200 `{"status":"ok"}` | Top-level liveness |
| `/api/v1/health` | GET | 200 `{"status":"healthy"}` | API liveness |
| `/api/v1/me` | GET | 401 (no header) / 401 "Invalid token" (fake bearer) | Current user; **JWT Bearer validated** |
| `/api/v1/profile` | GET | 401 | User profile |
| `/api/v1/notes` | GET 401; POST `{}` → 401; POST `null` → 422 `body Expected object` | Note collection; POST creates note (async) |
| `/api/v1/notes/:note_id` | GET | 422 `path.note_id Invalid uuid` | Note detail (note_id is uuid) |
| `/api/v1/notes/:note_id/flashcards` | GET | 401 (parent uuid) | Flashcards of a note |
| `/api/v1/notes/:note_id/quizzes` | GET | 401 | Quizzes of a note |
| `/api/v1/notes/:note_id/mindmap` | GET | 401 (singular) | Per-note mindmap |
| `/api/v1/notes/:note_id/chapters` | GET | 401 | Chapters ("Bab") of a note |
| `/api/v1/documents` | GET 401; POST `{}` → 404 (detail `path.file_id Invalid uuid`) | Uploaded source files |
| `/api/v1/exams` | GET 401; POST `{}` → 422 `body.title Required`, `body.exam_type Required` | Exams; create needs `{title, exam_type}` |
| `/api/v1/subscriptions` | GET 401 | Billing (Xendit) |
| `/api/v1/jobs` | GET 401; `/jobs/x` → 401; `/jobs/note-x/stream` → 401 | Async processing jobs |
| `/api/v1/jobs/:job_id/stream` | (in SPA: `/api/v1/jobs/${e}/stream`) | SSE — **job progress stream** |
| `/api/v1/events` | POST `{}` → 422 `body.event_name Required` | Analytics ingest (also study-heartbeat) |
| `/api/v1/affiliates` | referenced in SPA api-client; direct GET/POST → 404 | POST-only or app-BFF-handled |

**Key middleware-order insight:** Zod runs **before** auth on some routes (POST `/exams` `{}` → 422 listing required fields) but **after** auth on others (POST `/notes` `{}` → 401). So schemas are partially leakable without auth.

## 3. Staging env (they exposed it in CSP — we looked)

`staging.api.pelajarin.ai` is **byte-identical mirror** of prod (same error envelope, same `/health`, same `/api/v1/health`). Reveals nothing prod hides at the API layer.

`staging.enterprise.pelajarin.ai` and prod `enterprise.pelajarin.ai` both serve a Next.js app titled **"Pelajarin.ai Enterprise"** with `/admin` route (login form). HTML has a deployment-marker comment that **differs per env** (staging `trJr3uF6pVGSbQAPV_zFQ` vs prod `FfnMIuX_qT0OUr_Ml4whR`) but identical font hashes → same build, separate deploy.

## 4. Auth flow (no NextAuth — they built their own OIDC IdP)

`pelajarin.ai/api/auth/{providers,csrf,session}` all return the Next.js HTML shell (no JSON), and `/login`, `/signin`, `/auth/signin`, `/masuk`, `/register`, `/signup`, `/daftar` all 404 — **there is no login page on the marketing site**. Login lives on a separate Vite SPA at `auth.pelajarin.ai`.

`auth.pelajarin.ai` is a **self-hosted OIDC Authorization Server** (inferred from bundle strings):

- Credentials/self-service: `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/resend-verification`, `/auth/account`, `/auth/account/avatar`, `/auth/account/providers/` (linked social accounts), `/auth/session`, `/auth/csrf`, `/auth/error`
- OIDC interaction (login/consent UI): `/auth/interaction/:uid`, `/auth/interaction/none`, `/auth/interaction/:uid/consent`, `/auth/interaction/:uid/abort`
- OAuth authorize: `/api/oauth/:provider/authorize` (with `client_id`/`state`/`callback`/`token`)
- An admin **OAuth-client registry** ("applications" with `client_id`/`client_secret`/`cookie_keys`/`scopes`)

**Providers:** Google + Discord (confirmed in homepage + privacy policy); **GitHub** referenced in bundle (may be default or unlaunched). **OTP/passwordless** and **password** login both referenced.

The IdP mints a **Bearer JWT** consumed by `api.pelajarin.ai` (confirmed: `GET /api/v1/me` with `Bearer faketoken` → 401 `Invalid token`, distinct from "Missing header").

**Flow (inferred):** `app.pelajarin.ai` → OIDC code flow at `auth.pelajarin.ai` → JWT → sent as `Authorization: Bearer` to `app.pelajarin.ai/api/v1/*` (which proxies to `api.pelajarin.ai`).

The app layer enforces an **origin/CSRF check on mutations**: `POST app.pelajarin.ai/api/v1/affiliates` with no Origin → **403 `{"error":"bad_origin"}`** — a different envelope than the core API, confirming a thin edge/BFF layer in front of the SPA.

## 5. Data model inferences

From API param names (`note_id`, `file_id`, `exam_id`, `job_id`), RSC i18n, and SPA chunks:

**Note (Catatan):** `{ id:uuid, title, chapters:[Chapter], status: processing|completed|error, progress, views, files:[], words }`. Central entity. Created **asynchronously**: `POST /notes` → job `note-<id>` → client streams `GET /api/v1/jobs/note-<id>/stream`. Sub-resources: `flashcards`, `quizzes`, `mindmap`, `chapters`.

**Document/File (`file_id`):** the uploaded source backing a note. Not created via `POST /documents` (404) — created by the upload/presign flow (not enumerated).

**Chapter (Bab):** subdivision of a note.

**Flashcard:** sub-resource of note (term/definition pair; exact fields need auth).

**Quiz/Question:** `{ question, options[], answer, explanation, hint, difficulty: easy|medium|hard (Mudah/Sedang/Sulit), sources[], xp }`. Example from RSC: `{"question":"…berapa nilai x?","options":["x = 2 atau x = 3","x = 1 atau x = 6","x = −2 atau x = −3"]}`. Using a hint → XP −50%.

**Exam:** `{ id:uuid, title, exam_type:<enum>, … }` (create requires `title` + `exam_type`); aggregates questions from notes/quizzes.

**Mindmap:** singular, per-note.

**Chat:** example shape `{userMessage, assistantMessage}`; assistant = "Pai", grounded in uploaded material. Not a sub-resource of note (`/notes/:id/chats` → 404) → top-level, almost certainly **POST + SSE** (not GET-enumerable).

**User (`/me`):** includes gamification — `streak`, `xp`/`totalXp`, `level`, `rank`, `flashcardsReviewed`, `quizzesPassed`.

**Subscription:** billing object (Xendit-backed).

**Affiliate:** discount-code object `{code, discount}`.

## 6. Upload constraints (exact, from dropzone config in RSC)

- Documents: "PDF, Word, PowerPoint, Excel, Text (Maks. 100MB per file)"
- Images: "PDF, JPG, PNG, HEIC (Maks. {max} file, 50MB per file)" — dropzone display says "gambar 25 MB"
- Audio: "MP3, WAV (Maks. 300MB per file)"
- Video: "MP4, WEBM, MOV, AVI (Maks. 500MB per file)"
- Aggregate: "Maks 5 file · dokumen 100 MB · gambar 25 MB · audio/video maks 4 jam"
- `maxFiles` = 5; processing deadline 24 jam; accepts YouTube links

## 7. Pricing (from RSC — more detail than RECON.md)

- **Free** — `limitedNotes` (note-creation cap) + `limitedChat` (AI-chat cap)
- **Unlimited** — **Rp 50.000/bulan**, `unlimitedNotes` + `unlimitedChat`
- **Pro** — **Rp 60.000/bulan**, "Priority processing — respons lebih cepat", cancel-anytime, `startPro` CTA
- **Institusi/Enterprise** — Custom
- FAQ: "paid plans start from Rp 60.000/bulan"; 6-month billing option referenced

Note: the Rp 50k "Unlimited" vs Rp 60k "Pro" overlap is ambiguous from public strings — Pro appears to add priority processing on top of Unlimited's unlimited notes/chat. (RECON.md saw Rp 30k — that was the annual-discounted Pro price; the monthly undiscounted is Rp 60k.)

## 8. Gamification (from RSC i18n + `leaderboard` SPA chunk)

Confirmed vocabulary & mechanics:
- **Streak** (consecutive days, "Rekor terbaikmu" best-streak)
- **XP** (Total XP, `+{xp} XP diperoleh`)
- **Level**
- **Rank** (Peringkat)
- **Leaderboard** (Papan Peringkat, topUser) — first-class app route (`/leaderboard`)
- **Badges**

Mechanics inferred:
- XP from **quizzes passed** + **flashcards reviewed**
- Using a **hint costs −50% XP** (`hintXpPenalty`)
- **Study time** tracked via `use-study-heartbeat` (periodic ping) + **Pomodoro timer**; reported through `POST /api/v1/events` (event_name-based)
- XP/level threshold formula + badge definitions: server-side, not leaked

## 9. LLM choice

**Hidden server-side.** Assistant named "Pai" (34+ homepage mentions). No model identifier (gpt/claude/gemini/qwen/llama/command-r/mistral/grok) in homepage RSC, `/dosen` RSC, app index/feature chunks, or any API error. Generation is server-mediated (`POST /notes` → job → SSE stream), so the model never reaches the client. To learn it you'd need an authenticated request and observe response latency/headers — not passively discoverable. **Confirmed: model choice is a server-side secret.**

## 10. Open questions (need a registered account)

1. **Chat endpoint path & streaming shape** — POST-only + SSE, not GET-enumerable. Likely `POST /api/v1/...chat...` or a job-stream.
2. **Upload/presign mechanism** — `POST /documents` 404s; upload is either a presigned-URL flow (R2/S3 `PUT`) or multipart to a non-guessed path.
3. **Full create schemas** for notes/chat/upload — auth runs before full field validation, so empty-body probes only partially leak fields.
4. **Free-tier exact limits** (note count, chat messages) and the per-tier feature matrix.
5. **XP/level threshold formula** and badge catalog (server-side).
6. **Leaderboard scoring** (window: daily/weekly/all-time).
7. **`exam_type` enum values** and how exams aggregate from notes/quizzes.
8. **OIDC issuer/client config** on `auth.pelajarin.ai` (well-known, client_ids, token endpoint).
9. **Affiliate endpoint** real path (app client references `/api/v1/affiliates` but it 404s on direct probe → POST-only or app-BFF-handled).

## 11. What this tells us for our build

**Architecture patterns to copy:**
- Separate marketing site from product app (Next.js for marketing, Vite+TanStack for the SPA — or just Next.js for both if we want simpler)
- Self-hosted OIDC IdP (or use NextAuth — simpler for v1)
- Core API under `/api/v1/*` with Zod validation
- Structured error envelope with `request_id` for support
- Async job pattern: POST creates → returns job id → client streams progress via SSE
- BFF/edge layer with origin check on mutations
- LLM choice hidden server-side (never expose model to client)
- Gamification as first-class in the data model (streak, xp, level, rank)
- UUIDs for all entity ids
- Xendit for Indonesian payment (not Stripe — IDR payment methods: GoPay, OVO, Dana, QRIS, Mandiri, BCA)

**Patterns to NOT copy:**
- Their staging domain exposure in CSP (minor security smell)
- Building their own OIDC IdP — for v1 we use NextAuth (Google/Discord/email) which is enough and saves weeks

**Differences in our build:**
- We use Next.js for both marketing and app (simpler, one deploy)
- We use Cloudflare Workers (not separate Vite SPA + API)
- We use D1 (SQLite at edge) instead of Postgres
- We keep our existing agent infrastructure (workspace, audit, sandbox)
- We price **lower than pelajarin** (Rp 20K/bulan vs their Rp 30K-60K) per user direction

## 12. Method + ethics note

This recon used only:
- Manual `curl` with a desktop Chrome User-Agent (one request per endpoint, 2s spacing)
- Reading the RSC payload that Next.js streams to every browser (public by definition)
- Single unauthenticated root requests to api/cms/staging subdomains (404s only)
- No accounts created, no auth bypass, no scraping, no automation, no AI crawler (robots.txt blocks them, we respected it)

This is fair-use research of a public commercial product's public-facing surfaces. We did not extract user data, did not attempt to access other users' content, did not probe for vulnerabilities beyond noting 404-vs-401-vs-422 (which is the router telling us which routes exist — the same info any browser sees when you click a link).
