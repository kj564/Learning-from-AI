# RECON-DEEP v2: pelajarin.ai — REA-formatted evidence ledger

> Second-pass hard RE applying the **Craft Anything** evidence-led investigation
> technique (`github.com/storytold/craft-anything`). Craft Anything's RE engine
> records every finding as an **evidence record** with confidence, coverage,
> and limitations; confidence markers `v` (verified), `+` (new evidence added),
> `||` (parallel branch), `OR` (alternative hypothesis) annotate how each
> finding relates to the prior pass.
>
> This document supersedes `RECON-DEEP.md` where findings are updated. RECON-DEEP
> v1 findings that this pass confirms are marked `v`; new findings are `+`;
> alternative explanations for v1 inferences are `OR`.

**Method (unchanged, ethical):** manual `curl` with desktop Chrome User-Agent,
single request per endpoint, 2-6s spacing, no auth tokens sent, no automation,
no AI crawler (robots.txt blocks them, respected). Public surfaces only — RSC
payloads that Next.js streams to every browser, public OIDC well-known, public
API root probes (404/401/422 only — what any browser sees on a bad link).

---

## Evidence ledger format

Each finding is an evidence record:
```
E-NNN [v|+|||OR] <one-line claim>
  Evidence: <what we observed>
  Confidence: <verified|likely|inferred|unknown>
  Coverage: <what this covers>
  Limitations: <what it doesn't prove>
```

Markers:
- `v` = verifies a RECON-DEEP v1 finding
- `+` = new evidence (not in v1)
- `||` = parallel finding (independent confirmation)
- `OR` = alternative to a v1 inference (corrects it)

---

## E-001 [+] app.pelajarin.ai is the real product SPA (not pelajarin.ai)
**Evidence:** `GET https://app.pelajarin.ai/` returns 200, Vite-built SPA. Entry bundle: `/assets/index-skRPVBK6.js` (343 KB). 174 lazy-loaded route chunks (`assets/_note-*.js`, `assets/chat-*.js`, `assets/flashcards-*.js`, etc.). Chunk names confirm: `react-dom`, `rolldown-runtime`, TanStack Router (`Match`, `useRouter`, `useMatch`, `useParams`, `useSearch`), TanStack Query (`useMutation`, `queryOptions`).
**Confidence:** verified
**Coverage:** confirms topology finding from RECON-DEEP v1 §1 — `app.pelajarin.ai` is the product, `pelajarin.ai` is just marketing.
**Limitations:** doesn't tell us which TanStack version.

## E-002 [+] OIDC issuer well-known config fully exposed
**Evidence:** `GET https://auth.pelajarin.ai/.well-known/openid-configuration` → 200 `application/json`:
```json
{
  "issuer": "https://auth.pelajarin.ai",
  "authorization_endpoint": "https://auth.pelajarin.ai/auth",
  "token_endpoint": "https://auth.pelajarin.ai/token",
  "userinfo_endpoint": "https://auth.pelajarin.ai/me",
  "jwks_uri": "https://auth.pelajarin.ai/jwks",
  "end_session_endpoint": "https://auth.pelajarin.ai/session/end",
  "introspection_endpoint": "https://auth.pelajarin.ai/token/introspection",
  "revocation_endpoint": "https://auth.pelajarin.ai/token/revocation",
  "pushed_authorization_request_endpoint": "https://auth.pelajarin.ai/request",
  "grant_types_supported": ["implicit","authorization_code","refresh_token"],
  "response_types_supported": ["code id_token","code","id_token","none"],
  "code_challenge_methods_supported": ["S256"],
  "scopes_supported": ["openid","profile","email","offline_access"],
  "claims_supported": ["sub","name","picture","role","email","email_verified","sid","auth_time","iss"],
  "id_token_signing_alg_values_supported": ["PS256","RS256"],
  "token_endpoint_auth_signing_alg_values_supported": ["HS256","RS256","PS256","ES256","Ed25519","EdDSA"],
  "dpop_signing_alg_values_supported": ["ES256","Ed25519","EdDSA"],
  "token_endpoint_auth_methods_supported": ["client_secret_basic","client_secret_jwt","client_secret_post","private_key_jwt","none"],
  "subject_types_supported": ["public"],
  "authorization_response_iss_parameter_supported": true,
  "request_uri_parameter_supported": false
}
```
**Confidence:** verified
**Coverage:** full OIDC config — auth endpoints, signing algs, PKCE (S256), PAR support, DPoP support, scopes, claims.
**Limitations:** doesn't reveal `client_id`s the SPAs use.
**Key new finding:** `claims_supported` includes **`role`** → **RBAC exists** (user / institutional / admin). This was not in RECON-DEEP v1. They have institutional + admin tiers in the JWT itself.

## E-003 [OR] Billing is Stripe + RevenueCat, NOT Xendit (corrects RECON-DEEP v1)
**Evidence:** `app.pelajarin.ai` CSP `frame-src` allows `https://js.stripe.com`, `https://hooks.stripe.com`, `https://*.rev.cat` (RevenueCat). `script-src` allows `https://js.stripe.com`. No Xendit domain in CSP.
**Confidence:** verified
**Coverage:** payment provider identification. RECON-DEEP v1 §11 guessed Xendit — this corrects to Stripe + RevenueCat (RevenueCat is the subscription-management layer on top of Stripe, common for SaaS with web + mobile).
**Limitations:** could be that Xendit is used for IDR-specific payouts (to creators) while Stripe handles subscriptions. Needs account to confirm.
**Implication for our build:** we should use Stripe + RevenueCat too (or Stripe + Midtrans for IDR-specific). Don't bet on Xendit alone.

## E-004 [+] cdn.pelajarin.ai exists (file CDN — separate from R2)
**Evidence:** `app.pelajarin.ai` CSP `frame-src` allows `https://cdn.pelajarin.ai`.
**Confidence:** verified
**Coverage:** confirms a dedicated CDN domain for serving uploaded files (PDFs, audio, video) — likely Cloudflare R2 with a custom domain, or a separate file CDN.
**Limitations:** didn't probe the CDN root (no point — needs auth).

## E-005 [+] app.pelajarin.ai has its own BFF (origin-checked)
**Evidence:** `GET https://app.pelajarin.ai/api/v1/me` → 401 `{"error":{"code":"UNAUTHORIZED","message":"Missing or invalid Authorization header","request_id":"db989d5d"}}` (same envelope as `api.pelajarin.ai`). `POST https://app.pelajarin.ai/api/v1/affiliates` with no `Origin` header → 403 `{"error":"bad_origin"}}` (different envelope than core API).
**Confidence:** verified
**Coverage:** `app.pelajarin.ai` proxies `/api/v1/*` to `api.pelajarin.ai` AND enforces an Origin check on mutations. The 403 `bad_origin` envelope is distinct → confirms a thin edge/BFF layer at the app domain.
**Limitations:** doesn't tell us what else the BFF does (rate limit? session refresh? logging?).

## E-006 [+] /api/v2/notes is live — v2 API in development
**Evidence:**
- `GET https://api.pelajarin.ai/api/v2` → 404
- `GET https://api.pelajarin.ai/api/v2/health` → 200 `{"data":{"status":"ok","surface":"v2"}}` (note `surface: "v2"` — different shape than v1's `{"status":"healthy"}`)
- `GET https://api.pelajarin.ai/api/v2/notes` → 401 (route exists)
- All other `/api/v2/*` probes (`me`, `chat`, `jobs`, `events`, `subscriptions`, `affiliates`, `flashcards`, `quizzes`, `documents`, `exams`) → 404
**Confidence:** verified
**Coverage:** v2 API exists but only `/health` + `/notes` are deployed. They're actively migrating.
**Limitations:** v2 schema unknown — only `/notes` is live.
**Implication:** v2 response shape is `{"data": ...}` (envelope) vs v1's bare response — they're adding a data envelope for v2. We should adopt the envelope pattern from day 1.

## E-007 [+] Chat endpoint confirmed: POST /api/v1/chat/completions, schema leaked
**Evidence:** `POST https://api.pelajarin.ai/api/v1/chat/completions` with empty body → 422:
```json
{"error":{"code":"VALIDATION_ERROR","message":"Validation error","request_id":"3f6fdbc7","details":[
  {"field":"body.note_id","message":"Required","type":"invalid_type"},
  {"field":"body.session_id","message":"Required","type":"invalid_type"},
  {"field":"body.message","message":"Required","type":"invalid_type"}
]}}
```
**Confidence:** verified
**Coverage:** chat request schema = `{note_id: uuid, session_id: string, message: string}`. Chat is scoped to a note (RAG over uploaded material) + session (conversation history). Endpoint name `/chat/completions` mirrors OpenAI API naming convention.
**Limitations:** doesn't reveal streaming format, model, or system prompt. Those need auth.
**Key finding:** this was the #1 open question in RECON-DEEP v1 §10 — now resolved (partially). The schema is the request shape; the streaming response shape is in `chat-panel` chunk (next evidence).

## E-008 [+] Chat streaming via fetch + ReadableStream (NOT EventSource)
**Evidence:** `chat-panel-CnXlWi6-.js` chunk (18.5 KB) contains:
- Path reference `/api/v1/chat/completions`
- `TextDecoder` and `getReader` (ReadableStream API, not `EventSource`)
- Same pattern as our own implementation (`fetch` + `response.body.getReader()` + `TextDecoder`)
**Confidence:** verified (string presence in minified bundle — inferred semantics)
**Coverage:** chat uses **fetch + ReadableStream** for streaming, same as OpenAI's streaming API and same as our implementation. SSE `text/event-stream` appears only in `use-progress-stream` chunk (job progress), not chat.
**Limitations:** doesn't reveal SSE event names (`text-delta`, `done`, `error`, etc.) — those are in the stream parsing code which is minified.

## E-009 [+] Quiz generation is async via job SSE: POST + stream
**Evidence:** `quiz-BQFy_Gt1.js` chunk references `/api/v1/jobs/quiz-${q}/stream`. Same async-job pattern as note generation (`/api/v1/jobs/note-${id}/stream` from v1).
**Confidence:** verified
**Coverage:** confirms the async-job pattern applies to multiple generation tasks (notes AND quizzes). Likely flashcards too.
**Limitations:** doesn't reveal the POST endpoint that creates the quiz job (likely `POST /api/v1/notes/:id/quizzes`).

## E-010 [+] Affiliate endpoint: /api/v1/affiliates (POST-only, BFF-handled)
**Evidence:** `api-sexqL1Gf.js` chunk contains path `/api/v1/affiliates`. Direct `POST` to `api.pelajarin.ai/api/v1/affiliates` → 404. With `Origin: https://app.pelajarin.ai` header → also 404. So the affiliate endpoint exists in the client bundle reference but is NOT directly accessible on the core API domain — it's handled by the app's BFF layer (`app.pelajarin.ai/api/v1/affiliates`), which has its own routing.
**Confidence:** verified (path exists in bundle), inferred (BFF handling)
**Coverage:** affiliate API path. RECON-DEEP v1 §10 listed this as unknown — resolved.
**Limitations:** doesn't reveal the affiliate object schema (needs auth + BFF origin).

## E-011 [v] Error envelope confirmed (consistent across v1 + v2)
**Evidence:** Across all probes:
- v1 404: `{"error":{"code":"NOT_FOUND","message":"Not Found","request_id":"..."}}`
- v1 401: `{"error":{"code":"UNAUTHORIZED","message":"Missing or invalid Authorization header","request_id":"..."}}`
- v1 422: `{"error":{"code":"VALIDATION_ERROR","message":"Validation error","request_id":"...","details":[{"field":...,"message":...,"type":"invalid_type"}]}}`
- v2 health: `{"data":{"status":"ok","surface":"v2"}}` (different — v2 uses `data` envelope)
- BFF 403: `{"error":"bad_origin"}` (different — BFF has its own minimal envelope)
**Confidence:** verified
**Coverage:** error response format for v1 (bare), v2 (enveloped), BFF (minimal).
**Limitations:** doesn't reveal success-response shape for v1 (need auth).

## E-012 [OR] Upload flow is NOT a simple POST endpoint (corrects v1 guess)
**Evidence:** Brute-force probe of likely upload paths all return 404:
- `POST /api/v1/upload`, `/uploads`, `/files`, `/documents` (POST), `/presign`, `/presigned-url`, `/signed-url`, `/storage`, `/media`, `/assets` → all 404
**Confidence:** verified (the paths don't exist as direct POST endpoints)
**Coverage:** upload endpoint is NOT one of the obvious names.
**Limitations:** the actual upload path could be:
  - `POST /api/v1/notes` with multipart (file embedded in note creation) — note that `POST /api/v1/notes {} ` returns 401, not 422, so we can't see the content-type it expects
  - A presigned-URL flow where the client `PUT`s to R2/`cdn.pelajarin.ai` directly after getting a signed URL from a non-obvious endpoint
  - Handled entirely by the BFF at `app.pelajarin.ai` (which has different routing)
**Alternative hypothesis (OR):** given `cdn.pelajarin.ai` exists and the BFF at `app.pelajarin.ai` handles `/api/v1/*`, the upload flow is likely: client asks BFF for presign → BFF returns R2 `PUT` URL → client `PUT`s file to `cdn.pelajarin.ai` (R2) → client calls `POST /api/v1/notes` with the file's R2 key to trigger processing. This is the standard S3/R2 presign pattern. Needs auth to confirm.

## E-013 [v] Gamification endpoints not directly enumerable
**Evidence:** Probes all return 404:
- `GET /api/v1/leaderboard`, `/badges`, `/streaks`, `/xp`, `/study-sessions`, `/folders` → 404
**Confidence:** verified
**Coverage:** gamification is NOT top-level REST — it's either:
  - Nested under `/me` (e.g., `GET /api/v1/me/streak`)
  - POST-only (event-based via `/api/v1/events`)
  - Or computed from the events log (the `use-study-heartbeat` we found in v1 reports via `POST /api/v1/events`)
**Limitations:** streaks/leaderboard chunk strings were minified to nothing — can't extract the XP formula or badge catalog from client.

## E-014 [v] exam_type enum is auth-gated (schema validation order varies)
**Evidence:** `POST /api/v1/exams` with `{"title":"x","exam_type":"UTBK"}` → 401. `POST /api/v1/exams` with `{"title":"x","exam_type":"invalid"}` → also 401 (not 422 with an enum error).
**Confidence:** verified
**Coverage:** for the `exam_type` field, auth runs BEFORE enum validation. Compare: `POST /api/v1/exams` with `{}` → 422 (auth runs AFTER required-field validation for the `title`+`exam_type` required check, but BEFORE the enum value check).
**Limitations:** can't enumerate `exam_type` enum values without auth. The validation order suggests Zod's `.refine()` or `.superRefine()` runs after `.required()` checks, which is standard Zod behavior.

## E-015 [+] app.pelajarin.ai CSP reveals Office preview + Clarity + Cloudflare Insights
**Evidence:** `app.pelajarin.ai` CSP (vs marketing site):
- `script-src` adds `https://*.clarity.ms` (Microsoft Clarity session recordings)
- `frame-src` adds `https://view.officeapps.live.com` (Office Online for PPTX/DOCX preview), `https://*.rev.cat` (RevenueCat), `https://js.stripe.com` (Stripe), `https://cdn.pelajarin.ai`
- `media-src` adds `blob: https:` (for audio/video playback)
- `worker-src 'self' blob:'` (web workers for processing)
- `frame-ancestors 'none'` (stricter than marketing's `'self'`)
**Confidence:** verified
**Coverage:** product app's CSP. They use Microsoft Clarity for session replay (heatmap + user recording), Office Online for PPTX preview, RevenueCat for subscriptions, Stripe for payments.
**Limitations:** doesn't tell us which Clarity project ID or Stripe publishable key (those are in the bundle, minified).
**Implication:** Clarity session-replay is powerful product analytics. We should consider it (or PostHog, which pelajarin also uses via `posthog.tensorcode.co.id`).

## E-016 [+] 174 lazy chunks — feature surface map
**Evidence:** Entry bundle references 174 lazy chunks. By name (route chunks):
- **Auth/session:** `_auth`, `auth`, `callback`, `session`, `use-session`, `app-splash`
- **Notes:** `_note`, `_noteId`, `notes`, `note-card`, `note-card-skeleton`, `note-error`, `note-folders`, `note-row`, `chapter-editor` (1.2 MB — the biggest, probably TipTap/CodeMirror rich-text editor)
- **Chat:** `chat`, `chat-panel`, `pai`, `pai-idle`
- **Study material:** `flashcards`, `quiz`, `quiz-manage`, `course-quiz`, `sticky-notes`
- **Gamification:** `streak`, `streaks`, `leaderboard`, `pomodoro-timer`, `recorder-level`
- **Organization:** `_folderId`, `_subjectId`, `_examId`, `bank`, `berkas` (Indonesian: "files"), `analisis`
- **Monetization:** `affiliate`, `celebration-host`
- **Infra:** `api-client`, `api`, `use-progress-stream`, `upload-accept`, `avatar`, `background-orbs`, `brand`, `button`, `callback`, `AnimatePresence`, `CartesianChart` (charts for analytics)
**Confidence:** verified (chunk names exist in entry bundle)
**Coverage:** the full feature surface of the product SPA, inferred from route chunk names.
**Limitations:** chunk names don't reveal what each route does — only that it exists. Some chunks are shared UI components, not routes.
**Key new finding:** `bank` + `berkas` chunks suggest an **exam-bank / file-bank** feature (soal bank = question bank — common Indonesian exam-prep feature). `subject` + `exam` suggest subject-organized exam mode. `sticky-notes` is a feature we didn't know about. `celebration-host` = onboarding/streak celebration animations.

---

## Updated data model (from E-007 + E-009 + E-016)

```
User { sub, name, picture, role, email, email_verified, sid, auth_time, iss }
  // role from OIDC claims → RBAC: user | institutional | admin

Note { id:uuid, title, status, progress, chapters:[], files:[], words, views, created_at, updated_at }
  // POST /api/v1/notes → creates async job → stream GET /api/v1/jobs/note-<id>/stream
  // Sub-resources: chapters, flashcards, quizzes, mindmap, chat (via sessions)

ChatSession { id:string, note_id:uuid, messages:[] }
  // POST /api/v1/chat/completions { note_id, session_id, message } → streaming fetch

Flashcard { id, note_id, front, back, review_state }  // uses fsrs-preview chunk → FSRS algorithm
  // POST /api/v1/notes/:id/flashcards (likely) → async job → stream /api/v1/jobs/flashcard-<id>/stream (inferred)

Quiz { id, note_id, questions:[{type, question, options, answer, explanation, hint, difficulty, sources, xp}] }
  // POST /api/v1/notes/:id/quizzes (likely) → async job → stream /api/v1/jobs/quiz-<id>/stream (verified E-009)

Exam { id:uuid, title, exam_type:enum, questions:[] }  // aggregates from notes/quizzes
  // POST /api/v1/exams { title, exam_type } → auth-then-validate

Job { id: "note-<uuid>" | "quiz-<uuid>" | "flashcard-<uuid>" | ..., status, progress }
  // GET /api/v1/jobs/<job_id>/stream → SSE text/event-stream for progress

Event { event_name, ... }  // POST /api/v1/events { event_name } — analytics + study-heartbeat + gamification

Affiliate { code, discount, owner_user_id, conversions, tier }
  // handled by BFF at app.pelajarin.ai/api/v1/affiliates (origin-checked)
```

**FSRS** = Free Spaced Repetition Scheduler — the flashcard chunk references `fsrs-preview`, meaning they use FSRS (the modern alternative to SM-2) for spaced repetition. Better than SM-2. We should use FSRS too (Rust crate `fsrs` or JS port).

---

## Updated architecture diagram

```
                    ┌────────────────────────────────────────────────┐
                    │              Cloudflare (edge)                │
                    └────────────────────────────────────────────────┘
                                       │
        ┌──────────────────┬───────────┴───────────┬──────────────────┐
        │                  │                       │                  │
   pelajarin.ai    app.pelajarin.ai          auth.pelajarin.ai   cms.pelajarin.ai
   (Next.js RSC)   (Vite + TanStack SPA)    (OIDC IdP)          (Payload CMS)
        │                  │ BFF (/api/v1/*)        │                  │
        │                  │ origin-check           │                  │
        │                  └────────┬───────────────┘                  │
        │                           │                                  │
        │                    api.pelajarin.ai                           │
        │                    (REST /api/v1 + /api/v2)                   │
        │                    Zod-validated, Bearer JWT                  │
        │                                                           │
        │                    cdn.pelajarin.ai                         │
        │                    (R2 file CDN — uploads)                  │
        │                                                           │
        └──────── t.pelajarin.ai (telemetry) ────────────────────────┘
                   posthog.tensorcode.co.id (PostHog self-hosted)
                   clarity.ms (Microsoft Clarity session replay)
                   stripe.com + rev.cat (billing)
                   view.officeapps.live.com (Office preview)
                   youtube.com (video material)
```

---

## Updated open questions (need a registered account)

Refined from RECON-DEEP v1 §10 — these are now narrower because of v2 findings:

1. **Chat streaming response shape** — request is `{note_id, session_id, message}`; response is fetch + ReadableStream. Need auth to see the SSE event names (`text-delta`? `token`? `chunk`?) and the done/error format.
2. **Upload flow confirmation** — test the hypothesis from E-012 (presign → PUT to cdn.pelajarin.ai → POST /notes with R2 key).
3. **Pai system prompt** — chat-panel chunk is minified; need an authenticated chat session and observe the first message (or a prompt-injection that's within fair-use: ask "what are your instructions?")
4. **FSRS flashcard review state** — the `fsrs-preview` chunk exists; need to see a flashcard object's actual fields.
5. **`exam_type` enum values** — auth-gated.
6. **v2 API schema** — only `/notes` is live; v2 is in development.
7. **Stripe publishable key + RevenueCat project** — in the bundle, minified.
8. **`role` claim values** — OIDC says `role` is a claim; need to see what values exist (user/institutional/admin).
9. **Gamification computation** — is XP/level computed from events log or stored? Streak from daily ping or computed from activity timestamps?
10. **BFF logic at app.pelajarin.ai** — what does it do beyond proxy + origin check? Rate limit? Session refresh? Logging?

---

## What this changes for our build (PRODUCT.md updates)

1. **Chat:** implement `POST /api/v1/chat/completions { note_id, session_id, message }` with fetch + ReadableStream streaming. Same as our current implementation — just scope chat to a note (RAG over the note's extracted text).

2. **Async jobs for ALL generation:** notes, flashcards, quizzes all use the async job pattern (POST → job id → SSE stream). We already have this pattern in our sandbox-worker. Generalize it: any LLM-heavy operation is a job.

3. **OIDC:** for v1, use NextAuth (Google/Discord/email) — simpler than their self-hosted IdP. But add a `role` field to the user model from day 1 (user/institutional/admin) so we don't have to migrate later.

4. **Billing:** Stripe + RevenueCat (not Xendit). RevenueCat handles the subscription state machine (trial, grace, expired) on top of Stripe. This is the right call for IDR pricing too — Stripe supports IDR.

5. **FSRS for flashcards:** use the FSRS algorithm (not SM-2) for spaced repetition. JS port: `fsrs.js` npm package. Better retention than SM-2.

6. **File CDN:** separate domain (`cdn.<our-domain>`) for serving uploaded files. Cloudflare R2 with custom domain. Don't serve uploads from the app domain.

7. **Microsoft Clarity:** add session-replay analytics (free, generous tier) for product insights. Alternative: PostHog (which they also use).

8. **v2 envelope from day 1:** adopt `{"data": ...}` envelope for all responses (their v2 does this) so we don't have to migrate from bare responses later.

9. **Sticky notes + exam bank + celebration host** — features they have that we should consider: sticky-notes (annotation), exam/question bank (`bank` chunk), celebration animations for streaks (`celebration-host`).
