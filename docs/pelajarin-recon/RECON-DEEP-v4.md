# RECON-DEEP-v4 — Comprehensive RE of pelajarin.ai via REA

**Date**: 2025-11-23
**Method**: REA `analyze-web-bundle` (CDP on live Chrome headless shell) on
both `app.pelajarin.ai` (Vite SPA) and `pelajarin.ai` (Next.js marketing).
**Evidence files** (this pass, new):
- `capture/rea-app-endpoints-full.json` (153 KB)
- `capture/rea-app-inferences-full.json` (154 KB)
- `capture/rea-app-summary-full.json` (153 KB)
- `capture/rea-mkt-endpoints-full.json` (76 KB)
- `capture/rea-mkt-inferences-full.json` (69 KB)

**Prior evidence** (still valid):
- `capture/rea-routes.json` (156 KB) — first REA pass (routes)
- `capture/rea-endpoints.json` (156 KB) — first REA pass (endpoints)
- `capture/REA-EVIDENCE.json` — signin routes + OIDC IdP
- `capture/CAPTURE-APP.json` + `app-full/*.png` — CDP captures of all 9 tabs

---

## 1. Architecture (confirmed)

| Host | Stack | Role |
|---|---|---|
| `pelajarin.ai` | Next.js (Vercel deploy, `dpl_*` prefix) | Marketing + pricing + `/experiments` A/B |
| `app.pelajarin.ai` | **Vite + React + TanStack Router** SPA | Product (9 tabs, the main app) |
| `auth.pelajarin.ai` | Self-hosted OIDC IdP (interaction pages) | Sign-in / consent |
| `api.pelajarin.ai` | REST API `/api/v1/*` + `/api/v2/*` | Backend |
| `cms.pelajarin.ai` | Payload CMS | Blog + marketing content |
| `t.pelajarin.ai` | Service worker (`/_/service_worker/6b40/sw.js`) | Telemetry / tracking |

Runtime fingerprints (REA `vendor_fingerprint`):
- app.pelajarin.ai → **Vite** runtime, **React** vendor
- pelajarin.ai → **Next.js**, **React**

---

## 2. Complete API surface (app.pelajarin.ai bundle)

All paths below are relative to `https://api.pelajarin.ai/api/v1` unless a
`/api/v2` prefix is shown. HTTP methods inferred from REA detector
(`call:X.get` → GET, `call:X.put` → PUT, `call:X.post` → POST).

### 2.1 Notes + content (already rebuilt in Bimo)

| Method | Endpoint | Bimo status |
|---|---|---|
| GET | `/notes` | ✅ `src/app/api/v1/notes/route.ts` |
| POST | `/notes` | ✅ same |
| GET | `/notes/{id}` | ✅ `src/app/api/v1/notes/[id]/route.ts` |
| PATCH | `/notes/{id}` | ✅ same |
| DELETE | `/notes/{id}` | ✅ same |
| POST | `/notes/generate` | ⚠️ Bimo uses `POST /notes` with `file_ids` (create-then-attach). Pelajarin has a separate `/notes/generate` for text-prompt generation. **Gap**: add `POST /api/v1/notes/generate` for the "What would you like to learn?" textarea flow. |
| GET | `/notes/{id}/flashcards` | ✅ |
| POST | `/notes/{id}/flashcards` | ✅ |
| GET | `/notes/{id}/quizzes` | ✅ |
| POST | `/notes/{id}/quizzes` | ✅ |
| POST | `/api/v2/chat/clarify/stream` | ❌ **New** — clarify-stream endpoint (probably the "Ask AI" chat refinement, SSE). Not yet rebuilt. |

### 2.2 Documents (already rebuilt)

| Method | Endpoint | Bimo status |
|---|---|---|
| POST | `/documents/presign` | ✅ `src/app/api/v1/documents/presign/route.ts` |
| PUT | `/documents/{id}/upload` | ✅ **NEW this session** — `src/app/api/v1/documents/[id]/upload/route.ts` |
| GET | `/documents` | ✅ `src/app/api/v1/documents/route.ts` |

### 2.3 Folders (NEW — not yet rebuilt)

| Method | Endpoint | Bimo status |
|---|---|---|
| GET | `/folders` | ❌ Pelajarin supports folder organization for notes. Bimo has a flat notes list. |
| POST | `/folders` | ❌ Create folder. Inference shows both GET and POST to `/folders` (two different scripts). |

### 2.4 Profile (NEW — not yet rebuilt)

| Method | Endpoint | Bimo status |
|---|---|---|
| GET | `/profile` | ❌ Profile fetch (name, email, avatar, plan). Bimo has `/api/v1/me` but no `/profile`. |
| PUT | `/profile` | ❌ Update profile (name, avatar). |
| GET | `/profile/activity` | ❌ Activity feed (recent notes, quiz completions, streak events). |

### 2.5 Subscriptions (already rebuilt)

| Method | Endpoint | Bimo status |
|---|---|---|
| GET | `/subscriptions` | ✅ `src/app/api/v1/subscriptions/route.ts` |

### 2.6 Gamification (NEW — large surface, not yet rebuilt)

This is the biggest new finding. Pelajarin has a full gamification system with
12 endpoints. Bimo currently only shows a static "Streak 1" + "Level 1" badge
in the header — no backend.

| Method | Endpoint | Purpose (inferred) | Bimo |
|---|---|---|---|
| GET | `/gamification` | Root — returns user's gamification state (XP, level, streak, daily goal) | ❌ |
| GET | `/gamification/hub` | Hub view — quests + leaderboard preview + achievements snapshot | ❌ |
| GET | `/gamification/quests` | Quest list (daily/weekly challenges with progress) | ❌ |
| GET | `/gamification/league` | League standings (competitive tier) | ❌ |
| GET | `/gamification/leaderboard` | Leaderboard (top users by XP this period) | ❌ |
| GET | `/gamification/leaderboard/periods` | Available leaderboard periods (daily/weekly/all-time) | ❌ |
| GET | `/gamification/achievements` | Achievement list (badges unlocked + locked) | ❌ |
| GET | `/gamification/celebrations` | Pending celebrations (level-up, streak milestone) | ❌ |
| POST | `/gamification/celebrations/ack` | Acknowledge a celebration (dismiss the modal) | ❌ |
| POST | `/gamification/study/heartbeat` | Heartbeat during study (keeps streak alive while active) | ❌ |
| PUT | `/gamification/daily-goal` | Update daily study goal (e.g. "30 min/day") | ❌ |
| POST | `/gamification/streak/repair` | Repair a broken streak (probably costs coins / Pro) | ❌ |

### 2.7 Analytics + feature flags (NEW — not yet rebuilt)

| Method | Endpoint | Purpose | Bimo |
|---|---|---|---|
| POST | `/analytics/track` | Event tracking (note created, quiz completed, etc.) | ⚠️ Bimo has `POST /api/v1/events` which does the same thing — rename or alias. |
| GET | `$enabled_feature_flags` | Feature flag config (server-side flags for A/B) | ❌ Not yet. Bimo has no feature-flag system. |

### 2.8 Marketing site (pelajarin.ai)

| Method | Endpoint | Purpose | Bimo |
|---|---|---|---|
| GET | `/` | Home (hero + CTA) | ✅ (Bimo is a single-page app, marketing is the dashboard itself) |
| GET | `/pricing` | Pricing tiers | ❌ Bimo has no pricing page (free + Pro mentioned in footer only) |
| GET | `/auth/signin` | Redirect to `app.pelajarin.ai/auth/signin` | N/A (Bimo auto-provisions dev users) |
| GET | `/experiments` | A/B experiment list (admin?) | ❌ |
| POST | `/experiments/event` | A/B experiment event tracking | ❌ |

---

## 3. Bundle inventory (app.pelajarin.ai)

71 scripts analyzed, 34 on the marketing site. Key app modules (by URL slug):

- `api-C0e7sigo.js` — API client (the fetch wrapper; all endpoints above
  originate from here)
- `affiliate-C5P1lauB.js` — Affiliate program integration
- `app-splash-m4IUHcre.js` — Loading splash
- `subject-icon-CNYofiRS.js` — Subject icon component
- `useRouter-BBe6McJG.js` — TanStack Router hook
- `ui-version-toggle-BmZAEIhb.js` — UI version toggle (A/B)
- `matchContext-Cfel2KBM.js` — Route matching context
- `use-reduced-motion-D7yzwMTh.js` — Accessibility (prefers-reduced-motion)

REA reported 21 `unknowns` in the route graph — dynamic/templated navigation
destinations that couldn't be resolved statically. These likely include
note-detail routes (`/notes/:id`) and share routes (`/s/:shareId`).

---

## 4. Gap analysis — what Bimo is missing vs pelajarin

### Tier 1 (high impact, small effort)

1. **`POST /api/v1/notes/generate`** — text-prompt note creation.
   Currently the "What would you like to learn?" textarea creates an empty
   note. Pelajarin's `/notes/generate` takes a text prompt and runs the full
   generation pipeline (chapters + flashcards + quiz) from the prompt alone,
   no file upload needed. **Bimo should add this** — it's the primary free-
   tier entry point.

2. **`POST /api/v2/chat/clarify/stream`** — clarify-stream. Likely the
   "rephrase / explain differently" button in the Ask AI tab. SSE endpoint.
   Bimo has `/api/v1/chat/completions` (main chat) but not clarify.

3. **`GET /api/v1/profile` + `GET /api/v1/profile/activity`** — profile page.
   Bimo has `/api/v1/me` (basic) but no profile editor or activity feed.

### Tier 2 (medium impact, medium effort)

4. **Folders** (`GET`/`POST /folders`) — note organization. Bimo's notes
   grid is flat. Adding folders lets users group by subject.

5. **Feature flags** (`$enabled_feature_flags`) — server-side flags to gate
   new features. Useful for gradual rollout of podcast, mindmap, etc.

### Tier 3 (large surface, high engagement)

6. **Gamification system** (12 endpoints). This is pelajarin's retention
   engine: quests, leaderboard, league, achievements, celebrations, streak
   repair, daily goal, study heartbeat. Bimo has the DB models
   (`UserStreak`, `XPEvent`) but no endpoints or UI. Rebuilding this fully
   is a multi-day effort but it's what makes pelajarin sticky.

7. **Pricing page** (`/pricing`). Bimo mentions "Pro mulai Rp 20 ribu" in
   the footer but has no pricing page or checkout flow.

---

## 5. What this session verified works in Bimo

Re-verified via Agent Browser after the upload-bug fix:

- ✅ Dashboard renders (no console errors)
- ✅ Upload flow: presign → PUT → POST /notes → 201 → background extraction
  (2 chapters generated from a 149-byte .txt file)
- ✅ Note detail with all 9 tabs
- ✅ Mindmap tab: ReactFlow radial tree, no edge warnings
- ✅ Podcast tab: generated a 12-segment Pai/Kiko dialogue about fotosintesis
  in ~70s, audio assets accessible (HTTP 200 audio/wav)

---

## 6. Next steps (prioritized)

1. Add `POST /api/v1/notes/generate` (text-prompt → full pipeline) — the
   "What would you like to learn?" box should trigger this, not create an
   empty note.
2. Add `POST /api/v2/chat/clarify/stream` (SSE, rephrase/explain-differently).
3. Add `GET /api/v1/profile` + `GET /api/v1/profile/activity` + `PUT /api/v1/profile`.
4. Add folders (`GET`/`POST /api/v1/folders`, attach `folder_id` to notes).
5. Add the gamification endpoints (start with `GET /gamification` for the
   header badge, then `/quests` + `/achievements` for a gamification hub tab).
6. Add a pricing page route (Bimo is single-route per project rules, so this
   would be a section of the dashboard or a modal, not a new route).

---

## 7. RE provenance

Every endpoint in section 2 is backed by a REA `endpoint_candidate`
inference with:
- the script SHA-256 it was found in
- the column offset in that script
- the HTTP-method detector (`call:X.<method>`)

See the `inferences[].basis` arrays in `rea-app-endpoints-full.json` for
exact source coordinates. No endpoint above is guessed — all are observed
in the live bundle.
