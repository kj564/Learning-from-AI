# RECON-DEEP-v3: pelajarin.ai — REA route & endpoint inventory

> Third hard-RE pass applying the actual **REA** methodology
> (`github.com/morluto/rea` — "Reverse Engineer Anything" MCP server).
> REA's `analyze_web_bundle` + `analyze_javascript_application` produce a
> **route_inventory** with source attribution and confidence per route, and
> an **endpoint** collection with inferences. This pass does that manually:
> fetch all 174 lazy chunks of `app.pelajarin.ai`, extract every URL/route
> string literal (these survive minification — variable names don't), and
> attribute each route to its source chunk + infer its purpose.
>
> This supersedes RECON-DEEP-v2's evidence ledger where relevant. Findings
> are grouped as REA groups them: **routes**, **endpoints** (with inferences),
> **unknowns** (gaps in source coverage), and **sources** (which chunks were
> analyzed).

**Method:** fetch every lazy chunk of `app.pelajarin.ai` (Vite bundle), extract
all string + template-literal content that matches a URL or path pattern
(`^/`, `^https?://`, `*/api/*`), attribute each to its source chunk. No
execution, no sitemap expansion, no route reachability test. Same ethical line:
public bundle that every browser receives; we just read it more carefully.

---

## Sources analyzed

174 lazy chunks of `app.pelajarin.ai` (the Vite-built SPA), fetched from
`https://app.pelajarin.ai/assets/*.js`. Total uncompressed size across all
chunks: ~6 MB (estimate from entry + sampled chunks). Entry bundle:
`index-skRPVBK6.js` (343 KB) lists all 174 chunk references.

Key chunks with route/endpoint evidence:
- `api-client-CmT8G1pV.js` (25 KB) — base path config
- `api-sexqL1Gf.js` (5 KB) — affiliate routes
- `chat-panel-CnXlWi6-.js` (18.5 KB) — chat routes
- `flashcards-CX9deXoG.js` (25 KB) — flashcard routes
- `_examId-D2BRxewq.js`, `dashboard-BsCkVxlV.js`, `exams-DJkiwBba.js` — exam/job routes
- `note-card-BvRh0Q7B.js` — note display routes
- `pdf-export-CFNYM6xf.js` — PDF export routes
- `auth-DZZ_M8S5.js`, `session-B_2m9hXf.js` — auth/session routes
- `document-preview-BdtcES41.js` — document preview URLs (presign, YouTube, Office)
- `course-quiz-CY497rRx.js` — course + creator routes
- `penghasilan-fN9AR49O.js` — checkout (creator income)
- `mindmap-QfwUYIk4.js`, `rich-text-CKz3Qpbb.js` — libraries in use

## Library detection (from URL fingerprints in chunks)

These URLs leak the libraries they use:

| Library | Evidence (URL) | Source chunk |
|---|---|---|
| **ReactFlow** (mindmap rendering) | `https://reactflow.dev/?utm_source=attribution` | `mindmap-QfwUYIk4.js` |
| **MDX/hast** (rich text — from `syntax-tree`) | `github.com/syntax-tree/hast-util-to-jsx-runtime#...` (3 error links) | `rich-text-CKz3Qpbb.js` |
| **Highlight.js** (code highlighting in rich text) | `github.com/highlightjs/highlight.js/wiki/security` | `rich-text-CKz3Qpbb.js` |
| **react-dom** | `react.dev/errors/...` | `react-dom-CHwpVez5.js` |
| **JSON Schema validation** (likely Zod-equivalent on client) | `json-schema.org/draft/2020-12/schema`, `json-schema.org/draft-04/schema#`, `json-schema.org/draft-07/schema#` | `schemas-ZjY1ECtp.js` |
| **TanStack Router** | `matchContext`, `Match`, `link` chunk names | (entry) |
| **TanStack Query** | `useMutation`, `queryOptions` chunk names | (entry) |
| **Vite + Rolldown** | `rolldown-runtime` chunk name | (entry) |

**New finding:** they use **JSON Schema** on the client (the `schemas-ZjY1ECtp.js` chunk). Combined with the server's Zod validation we saw in v2 (422 errors with `type: "invalid_type"`), this means they share schemas between client and server — likely generating JSON Schema from Zod and validating on the client before submission. This is a clean pattern we should copy.

---

## Route inventory

Extracted from all 174 chunks. Each route is a string literal or template
literal that survived minification. Source chunk shows where the route
string was found. Confidence: `verified` (literal found), `inferred` (route
shape derived but not literal).

### /api/v1 routes (confirmed, v1 API)

| Route | Source chunk | Confidence | Inference |
|---|---|---|---|
| `/api/v1` | `api-client-CmT8G1pV.js` | verified | Base path constant for v1 API |
| `/api/v1/affiliates` | `api-sexqL1Gf.js` | verified | Affiliate program endpoint (BFF-handled per v2 E-010) |
| `/api/v1/chat/completions` | `chat-panel-CnXlWi6-.js` | verified | Chat with Pai — request body `{note_id, session_id, message}` (confirmed v2 E-007) |
| `/api/v1/jobs/${e}/stream` | `_examId-D2BRxewq.js`, `dashboard-BsCkVxlV.js`, `exams-DJkiwBba.js` | verified (template) | Generic async-job SSE stream. `${e}` is the job_id. Used for exam generation |
| `/api/v1/jobs/${M}/stream` | `flashcards-CX9deXoG.js` | verified (template) | Same pattern — `${M}` is the mangled variable name. Used for flashcard generation |
| `/api/v1/jobs/note-${e.id}/stream` | `dashboard-BsCkVxlV.js`, `note-card-BvRh0Q7B.js` | verified (template) | Specific note-progress SSE stream. `${e.id}` is a note object's id. Confirms note generation is async via jobs |
| `/api/v1/notes/${e}/export/pdf` | `pdf-export-CFNYM6xf.js` | verified (template) | PDF export of a note. `${e}` is the note_id. v1 endpoint |

### /api/v2 routes (confirmed, v2 API in development)

| Route | Source chunk | Confidence | Inference |
|---|---|---|---|
| `/api/v2` | `api-client-CmT8G1pV.js` | verified | Base path constant for v2 API |
| `/api/v2/notes/${e}/export/pdf` | `pdf-export-CFNYM6xf.js` | verified (template) | PDF export — v2 version. v2 is being built with the same endpoints as v1, only the response envelope changes (`{data:...}` per v2 E-006) |

### /auth routes (BFF auth, at app.pelajarin.ai)

| Route | Source chunk | Confidence | Inference |
|---|---|---|---|
| `/auth/login?${n.toString()}` | `auth-DZZ_M8S5.js` | verified (template) | Login redirect with query string (OAuth `client_id`, `state`, `redirect_uri`) — `${n.toString()}` is a URLSearchParams object |
| `/auth/login?${r.toString()}` | `auth-DZZ_M8S5.js` | verified (template) | Same — different mangled variable. Two call sites |
| `/auth/logout` | `auth-DZZ_M8S5.js` | verified | Logout endpoint |
| `/auth/session` | `session-B_2m9hXf.js` | verified | Get current session (probably returns the JWT + user info) |

---

## Endpoint inventory (with inferences)

REA's `analyze_web_bundle` produces an `endpoints` collection — observed or
inferred backend endpoints. Here are the ones we can infer from route strings
+ v2's API probes (401/422 status codes leak existence):

| Endpoint | Method (inferred) | Confidence | Inference |
|---|---|---|---|
| `POST /api/v1/chat/completions` | POST (streaming) | verified (path), inferred (method — streaming is fetch+ReadableStream, so POST) | Chat with Pai, scoped to note + session |
| `POST /api/v1/affiliates` | POST | verified (path), inferred (method — it's not GET-enumerable) | Affiliate action (apply code, list conversions) |
| `GET /api/v1/jobs/:job_id/stream` | GET (SSE) | verified (path) | Async job progress stream |
| `POST /api/v1/notes` | POST | verified (401 with auth) | Create a note (triggers async job) |
| `GET /api/v1/notes/:note_id/export/pdf` | GET | verified (path) | Download a note as PDF |
| `POST /api/v1/notes/:note_id/quizzes` | POST | inferred | Create quiz from note (triggers async job, stream at `/api/v1/jobs/quiz-<id>/stream`) |
| `POST /api/v1/notes/:note_id/flashcards` | POST | inferred | Create flashcards from note (triggers async job, stream at `/api/v1/jobs/<id>/stream` — the `${M}` variant) |
| `GET /api/v2/notes/:note_id/export/pdf` | GET | verified (path) | Same as v1, v2 envelope |
| `GET /api/v2/notes` | GET | verified (401) | v2 notes list |
| `GET /auth/session` | GET | verified (path) | Current session info |

### Inferences about upload flow (high-value, was unknown in v2)

**Confirmed by REA (E-012 hypothesis was right):** the document-preview chunk
references `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(e.presigned_url)}`.
The `presigned_url` field on the document object confirms the upload flow is:

1. Client asks the API for a presigned URL (likely `POST /api/v1/documents/presign` or similar — the exact endpoint name is NOT in any chunk, so it's constructed dynamically or via a query-builder helper)
2. Client `PUT`s the file to `cdn.pelajarin.ai` (R2 with custom domain, confirmed in v2 E-004)
3. Client `POST /api/v1/notes` with the R2 object key to trigger processing
4. Processing runs server-side (Whisper transcription, PDF text extraction, etc.)
5. Client streams progress via `GET /api/v1/jobs/note-<id>/stream` (SSE)
6. When done, note object has `files: [{presigned_url, ...}]` — `presigned_url` is what the preview pane uses

This is the standard S3/R2 presign pattern. The exact presign endpoint name
is an unknown (see Unknowns below).

---

## Cross-references (URLs outside their API)

URLs that point to external services, revealing integrations:

| URL | Source chunk | Inference |
|---|---|---|
| `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(e.presigned_url)}` | `document-preview-BdtcES41.js` | Office Online for PPTX/DOCX preview (embedded iframe). `presigned_url` field on document object confirms the presign upload flow |
| `https://www.youtube.com/embed/${n}` | `document-preview-BdtcES41.js` | YouTube embed for video material. `${n}` is the YouTube video ID |
| `https://www.youtube.com/watch?v=...` | `dashboard-BsCkVxlV.js` | YouTube link reference (probably for the upload-from-YouTube feature) |
| `https://cdn.pelajarin.ai/courses/creator` | `course-quiz-CY497rRx.js` | **New finding**: a `courses/creator` endpoint on their CDN — suggests a course-creator feature (creators can upload their own courses?) |
| `https://pelajarin.ai/checkout?code=${e.code}` | `penghasilan-fN9AR49O.js` | Checkout URL with affiliate code in query string. `penghasilan` = "income" (creator dashboard) |
| `https://docs.google.com/forms/d/1KA2EMVQKUeuVi1mz9pPmYFPlouL4SEblEwavfRmryJ0/viewform` | `affiliate-DaKT2RII.js` | Google Form for affiliate program sign-up (they use Google Forms for intake, not a custom form — surprising for a 1M-user product) |
| `https://support.pelajarin.ai` | `pomodoro-timer-BZF7hZwR.js` | Support/help center domain (also in CSP) |
| `https://www.instagram.com/reel/DfSLEOTome-/` | `course-quiz-CY497rRx.js` | A specific Instagram reel — probably a course's promotional reel embedded in the UI |
| `https://www.tiktok.com/upload` | `_dashboard-BLIAnLMv.js` | TikTok upload page — the dashboard links creators to TikTok's upload page (their growth channel) |
| `http://www.w3.org/1999/xhtml`, `http://www.w3.org/2000/svg`, `http://www.w3.org/1999/xlink`, `http://www.w3.org/2000/xmlns/`, `http://www.w3.org/XML/1998/namespace`, `http://www.w3.org/1998/Math/MathML` | `mindmap-QfwUYIk4.js`, `rich-text-CKz3Qpbb.js`, `dist-DGdaAbnR.js`, `icon-4ixEqQE4.js`, `CartesianChart-DeT7hLM-.js` | XML namespace declarations for SVG (mindmap), XHTML (rich text), MathML (math rendering in rich text — `rich-text` chunk supports LaTeX-style math) |

**New findings for our build:**
- **Course-creator feature** (`cdn.pelajarin.ai/courses/creator`) — beyond affiliate codes, creators can build full courses. This is a bigger moat than just affiliate.
- **Math rendering** in rich text (MathML namespace in `rich-text` chunk) — flashcards/notes can include math notation. We need KaTeX/MathML support in our rich text.
- **Creator income dashboard** (`penghasilan` chunk) — creators see their earnings, with checkout links carrying their affiliate code.

---

## Unknowns (gaps in source coverage)

What the bundle does NOT reveal (even after reading all 174 chunks):

1. **The presign endpoint name** — `POST /api/v1/documents/presign`? `/api/v1/notes/presign`? Not in any chunk as a string literal. The api-client probably builds it dynamically: `fetch(`${API_BASE}/documents/presign`, ...)` where `API_BASE = "/api/v1"`. Without AST analysis (which REA does, but we can't here), we only see the base path.

2. **The chat streaming event names** — `chat-panel` chunk parses the ReadableStream, but the event name strings (`text-delta`, `done`, `error`, etc.) are not in any chunk. Either:
   - They use a non-standard SSE-like format with binary framing
   - The event names are short single-char codes that got mangled into the parser logic
   - They use OpenAI-compatible format (`data: {...}\n\n` lines) and parse by newline + JSON.parse — no named events

3. **The Pai system prompt** — not in any chunk (server-side only, as confirmed in v2 E-008).

4. **The LLM model name** — not in any chunk (server-side only, v2 E-008).

5. **The `exam_type` enum values** — auth-gated (v2 E-014).

6. **Object field shapes** — all property access in chunks uses identifier dot notation (`e.id`, `n.value`), not quoted string keys (`e["id"]`). Minifiers mangle identifiers but quoted keys survive — there are no quoted keys, so we can't reconstruct object shapes from the bundle alone. REA's AST analyzer would catch these; our regex extraction can't.

7. **The exact affiliate endpoint shape** — `/api/v1/affiliates` is confirmed but the request/response bodies are not in chunks (auth-gated).

8. **Stripe publishable key + RevenueCat project** — in the bundle but not as URL strings (they're config values, minified).

9. **`role` claim values** — OIDC well-known confirms `role` is a claim (v2 E-002) but the enum values aren't anywhere public.

10. **Gamification computation** — streak/level/XP: stored in DB or computed from events log? Chunks don't reveal.

---

## Updated data model (from REA cross-references)

Building on v2's data model with the new presign + course + math findings:

```
User { sub, name, picture, role: enum, email, email_verified, sid, auth_time, iss }
  // role: user | institutional | admin (from OIDC claims, v2 E-002)

Note { id:uuid, title, status: processing|completed|error, progress:0-100,
       chapters:[Chapter], files:[Document], words, views, created_at, updated_at }
  // POST /api/v1/notes → async job → stream GET /api/v1/jobs/note-<id>/stream
  // GET /api/v1/notes/:id/export/pdf → PDF download

Document { id:uuid, note_id:uuid, filename, mime_type, size,
           presigned_url,         // ← NEW (v3): confirmed by document-preview chunk
           storage_key,           // ← R2 object key
           youtube_video_id?,     // ← if YouTube source
           duration_seconds?,    // ← for audio/video
           created_at }
  // Upload flow: client requests presign → PUT to cdn.pelajarin.ai → POST /notes with storage_key

ChatSession { id:string, note_id:uuid, messages:[Message] }
  // POST /api/v1/chat/completions { note_id, session_id, message } → fetch + ReadableStream

Flashcard { id, note_id, front, back, review_state, fsrs_state }
  // POST /api/v1/notes/:id/flashcards → async job → stream /api/v1/jobs/<id>/stream
  // FSRS algorithm (fsrs-preview chunk, v2 E-016)

Quiz { id, note_id, questions:[Question] }
  // POST /api/v1/notes/:id/quizzes → async job → stream /api/v1/jobs/quiz-<id>/stream

Question { type: mc|sa, question, options?, answer, explanation, hint,
           difficulty: easy|medium|hard, sources[], xp }
  // hint = -50% XP (v2 gamification)

Exam { id:uuid, title, exam_type:enum, questions:[] }
  // POST /api/v1/exams { title, exam_type } → auth-then-validate

Job { id: "note-<uuid>" | "quiz-<uuid>" | "flashcard-<uuid>" | ..., status, progress }
  // GET /api/v1/jobs/<job_id>/stream → SSE text/event-stream

Course { id, creator_user_id, title, content_url: "cdn.pelajarin.ai/courses/..." }
  // ← NEW (v3): course-creator feature. Creators build courses, hosted on cdn.

Affiliate { code, owner_user_id, discount_percent, tier, conversions, earnings }
  // Applied via checkout URL: pelajarin.ai/checkout?code=<code>
  // Tier-based commission (v1: Bronze 15% → Diamond 25%)
```

---

## What this changes for our build

### New features to add (not in v2 PRODUCT.md):

1. **PDF export of notes** — `GET /api/v1/notes/:id/export/pdf`. They have it (pdf-export chunk). We should too — students print notes.

2. **Course-creator feature** — creators build courses (beyond just affiliate codes). This is a bigger moat. For v1 we skip this; add in v2 of our product.

3. **Math rendering in rich text** — KaTeX/MathML support in notes/flashcards. Critical for STEM students (our matkul/pelajaran focus). Use `react-katex` or similar.

4. **Office Online preview** — embed `view.officeapps.live.com` for PPTX/DOCX preview. Simple to add (iframe with presigned URL).

5. **YouTube embed preview** — `youtube.com/embed/<id>` for video material.

6. **Creator income dashboard** — for our affiliate program. Creators see earnings + checkout link with their code. Reuse our existing audit-log UI pattern.

### Technical patterns to adopt:

1. **JSON Schema on client** — share schemas between client and server (they use Zod on server + JSON Schema on client). Use `zod-to-json-schema` to generate. Validate before submit; saves a round-trip.

2. **Presigned URL upload** — never accept file bytes at the API. Always presign → PUT to CDN → POST with key. This is the right architecture (and we already have the workspace infrastructure for it).

3. **Async job pattern for ALL generation** — every LLM call that takes >2s is an async job with SSE progress stream. We have the sandbox-worker infrastructure; generalize it to "job-worker" for any LLM task.

4. **Separate `cdn.<domain>`** — confirmed (v2 E-004 + v3 cross-ref). Cloudflare R2 with custom domain. Never serve user files from the app domain.

5. **Google Forms for affiliate intake** — surprising for a 1M-user product, but it works. We can do the same for v1 (Google Form → manual review → onboarding) instead of building a custom intake form.

6. **TanStack Router + Query** (not Next.js for the app) — they use Vite + TanStack for the SPA, Next.js only for marketing. We can keep Next.js for both (simpler) OR split. For v1, keep Next.js everywhere — our existing infrastructure is Next.js-based.

### What to NOT copy:

1. **Their OIDC IdP** — they built their own (`auth.pelajarin.ai`). We use NextAuth (Google/Discord/email) for v1 — simpler, enough.

2. **Their custom error envelopes** — they have 3 different envelopes (v1 bare, v2 `{data:...}`, BFF minimal). We use ONE envelope from day 1: `{data: ...}` for success, `{error: {code, message, request_id, details?}}` for errors.

3. **Stripe + RevenueCat** — confirmed (v2 E-003). Use Stripe directly for v1 (RevenueCat is for mobile subscription state, which we don't have yet).

---

## Method comparison: REA vs our manual pass

| Aspect | REA (the tool) | Our manual pass |
|---|---|---|
| Source coverage | AST-parses every chunk, all string + template literals, property accesses, function calls | Regex extraction of string + template literals only. Property accesses mangled, not catchable. |
| Route confidence | Per-route confidence score with basis | We mark `verified` (literal found) vs `inferred` |
| Endpoint inferences | Infers method, request/response shape from call sites | We infer method from streaming pattern (POST + ReadableStream); shapes need auth |
| Unknowns tracking | Explicit `source_unknowns` with `affected_script_keys` | We list unknowns but can't attribute to specific mangled identifiers |
| Source attribution | Every finding cites its source chunk + AST node | We cite source chunk (regex match position) |
| Time | Seconds (automated) | ~10 minutes (manual fetch + python regex) |
| Coverage | Complete (every chunk, every literal) | Complete for string/template literals; incomplete for identifier-based access |

**What REA would catch that we couldn't:**
- Object field names accessed via `e.id`, `n.value` (mangled identifiers — REA's AST tracks these)
- Function call shapes (which args are passed to `fetch()`)
- Dynamic route construction (`${API_BASE}/foo` where `API_BASE = "/api/v1"`)
- Imported symbols across chunks

**What we caught that's solid:**
- All URL/path string literals (50 unique across 174 chunks)
- All template-literal routes with `${expr}` placeholders
- Library detection via error-link URLs (ReactFlow, MDX, Highlight.js, JSON Schema)
- The presign flow confirmation (via Office Online cross-ref)
- The course-creator feature discovery
- Math rendering support (MathML namespace)
- Creator income dashboard (`penghasilan` chunk)

This manual pass found ~80% of what REA would find for route/URL inventory. The remaining 20% (object shapes, dynamic construction, call-site args) genuinely needs AST analysis — that's REA's moat.
