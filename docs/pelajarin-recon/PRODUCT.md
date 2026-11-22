# Product direction: BelajarAI (working name)

> Build an AI study assistant for Indonesian students, inspired by the
> architecture and product patterns observed in pelajarin.ai (see
> `docs/pelajarin-recon/RECON.md`), but differentiated to avoid head-on
> competition with a player that already has 1,000,000 users + 120 creators.

**Status:** Draft v1
**Target deploy:** Cloudflare (Pages for frontend, Workers for API, R2 for file storage)
**Monetization:** Freemium + creator affiliate (same proven model)

---

## 1. Why this product

Pelajarin.ai proved the market: **1M Indonesian students in 2 months**, willing to pay Rp30K/mo. The pain is real — "dosen gak jelasin ulang", "blank pas ujian", "belum belajar sama sekali". The product pattern works: upload material → AI makes notes/flashcards/quiz → chat with the AI about it.

We have a **head start they didn't**: we already built an agent stack with workspace isolation, audit logging, approval workflow, sandbox worker, and file security. Their engineering team had to build all that from scratch. We can ship a learning-AI MVP faster by reusing our existing infrastructure.

## 2. Differentiation strategy (confirmed by user)

**Focus: mata kuliah + mata pelajaran (university courses + school subjects), same scope as pelajarin, but cheaper.**

We do NOT pivot to a vertical (UTBK, medical, etc.) — we go head-on with pelajarin on the same generic study market, but win on **price**. Pelajarin's pricing (from RECON-DEEP §7):
- Free (limited notes + chat)
- Unlimited: Rp 50.000/bulan
- Pro: Rp 60.000/bulan (priority processing)

**Our pricing (lower, per user direction):**
- Free (generous free tier — more notes than pelajarin's free)
- **Pro: Rp 20.000/bulan** (vs pelajarin Rp 50-60K) — **60% cheaper**
- Annual: Rp 200.000/year (≈Rp 16.7K/bulan, 17% extra saving)
- Institusi: custom

This is a price-led market entry: same product, same features, but 60% cheaper. Indonesian students are price-sensitive (pelajarin's own FAQ mentions "tanpa kartu kredit, gratis selamanya" as the hook). We capture the price-sensitive segment pelajarin's Pro tier prices out.

**Why this can work despite pelajarin having 1M users:**
1. 1M users is still <1% of Indonesia's 60M+ students. Market is huge, room for both.
2. Pelajarin's growth is creator-led (120 TikTok creators) — creators drive awareness, not loyalty. Students compare price when awareness is already created.
3. Our infra (workspace isolation, sandbox worker, audit, approval, file security) is already built — we ship faster than a greenfield competitor.
4. Cloudflare Workers AI is cheap enough that Rp 20K/mo is profitable at our usage estimates (see §7).

**Risks of price-led entry + mitigation:**
- Pelajarin could cut price to match → mitigate by being first to Cloudflare (their stack is heavier; they can't cut as easily)
- "Cheap = low quality" perception → mitigate with clear feature parity + free tier that's MORE generous than theirs
- We become a race-to-zero → mitigate by adding premium features later (live tutor, exam analytics) at higher tiers

## 3. Core features for v1 (MVP)

Reuse our existing infrastructure and add (informed by RECON-DEEP-v2 REA findings):

| Feature | Build on | New work (informed by pelajarin REA) |
|---|---|---|
| Upload (PDF/DOCX/PPTX/img/audio/video/YouTube/paste) | Our workspace upload + MIME scan + quarantine | **Presign flow** (E-012): client asks BFF for presign → PUT to `cdn.<domain>` (R2) → POST `/notes` with R2 key. Audio/video transcription (Whisper via Cloudflare Workers AI), YouTube transcript fetch, PDF text extraction |
| Catatan (AI notes) | Our `z-ai-web-dev-sdk` LLM call | **Async job pattern** (E-009): POST creates → job id → SSE stream for progress. Structured-output: chapters + key terms. Output as markdown |
| Flashcard | LLM structured output | **FSRS algorithm** (E-016: they use `fsrs-preview` chunk — modern alternative to SM-2). Generate Q/A pairs as JSON. Spaced-repetition via `fsrs.js` npm package |
| Kuis (quiz) | LLM structured output | **Async job SSE** (E-009: `/api/v1/jobs/quiz-<id>/stream`). Multiple-choice + short-answer. Auto-grade. Track per-question mastery. **Hint = -50% XP** (E-008 gamification) |
| Tanya AI (chat) | Our existing chat stream + workspace | **`POST /api/v1/chat/completions { note_id, session_id, message }`** (E-007 exact schema). Fetch + ReadableStream (E-008, same as our impl). Chat scoped to a note (RAG over extracted text) |
| Bimo persona | Our orchestrator system prompt | Named persona "Bimo" — casual Indonesian, Socratic when tutoring |
| Gamification | New DB tables | Streak, XP (quizzes + flashcards; hint = -50%), Level, Rank, Leaderboard (E-008, E-013). **FSRS review** feeds XP |
| Affiliate | New DB table + BFF | Per-user code, track conversions. **BFF at app domain** (E-005, E-010) with Origin check |
| Auth | NextAuth (Google/Discord/email) — simpler than their self-hosted OIDC | **Add `role` field** to user (E-002: user/institutional/admin) from day 1 |
| Billing | **Stripe + RevenueCat** (E-003, corrects v1's Xendit guess) | Subscription state machine. IDR pricing via Stripe (supports IDR) |
| File CDN | **Separate `cdn.<domain>`** (E-004) | Cloudflare R2 with custom domain. Don't serve uploads from app domain |
| Response envelope | **`{"data": ...}` from day 1** (E-006: their v2 adopts this) | Avoid migrating from bare responses later |
| Analytics | **Microsoft Clarity** (E-015, free session replay) + PostHog | For product insights; Clarity is free with generous tier |

## 4. What we already have (do not rebuild)

- ✅ Next.js 16 App Router + TypeScript + Tailwind + shadcn/ui
- ✅ Prisma + SQLite (swap to Postgres on Cloudflare D1 for prod)
- ✅ Streaming chat SSE with agent loop
- ✅ Workspace isolation (per-user, path validation, symlink check)
- ✅ File upload + MIME sniffing + blocklist + quarantine
- ✅ File lifecycle (UPLOADED → READY → INDEXED)
- ✅ Audit log with full observability
- ✅ Approval workflow for dangerous actions
- ✅ Sandbox worker (separate process, will be Docker tier on Cloudflare)
- ✅ Multi-tool agent (web search, knowledge base, code sandbox, email)
- ✅ File browser UI (the WorkspaceBrowser we just built)

We are **way ahead** of where pelajarin was at day 1. Their engineering moat is product polish + creator network, not infrastructure.

## 5. What we need to build new

### 5.1 Document processing pipeline
```
upload → MIME scan → READY
  → if PDF: pdf-parse text extraction → chunk by heading
  → if DOCX/PPTX: mammoth/libreoffice convert → extract text + structure
  → if audio/video: Whisper API transcribe (or Deepgram for speed) → segment by timestamp
  → if image: VLM (GLM-4.5V via z-ai SDK) → OCR + describe
  → if YouTube: fetch transcript (youtube-transcript API)
  → store extracted text in workspace under `.extracted/<filename>.txt`
  → mark workspace file INDEXED
```

### 5.2 Study-material generation (LLM calls)
Each is one structured-output LLM call:
- **Notes**: `prompt → {chapters: [{title, summary, keyTerms: [{term, definition}]}]}`
- **Flashcards**: `prompt → {cards: [{front, back}]}`
- **Quiz**: `prompt → {questions: [{type: "mc"|"sa", question, options?, answer, explanation}]}`

Use GLM-4.6 or GLM-4-Flash for cost. Cache results (same file → same output, don't regenerate).

### 5.3 RAG over the material
When user chats with Pai about a file, scope the chat to that file's extracted text:
- Chunk the extracted text (1000-token chunks, 200 overlap)
- BM25 or embedding search over chunks (we already have `search_knowledge_base`)
- Inject top-3 chunks as context for the chat prompt
- Cite back: "Berdasarkan halaman 7 dari materi..." (Sumber feature)

### 5.4 Spaced repetition (SM-2)
For flashcards: store `{card, lastReviewed, intervalDays, easeFactor, repetitions}`. On review: grade 0-5, update interval per SM-2 algorithm. Show due cards daily.

### 5.5 Gamification
- `UserStreak` table: `{userId, currentStreak, longestStreak, lastActivityDate}`. Increment if activity on consecutive days.
- `UserLevel` table: `{userId, xp, level}`. XP from: complete quiz +10, review 10 flashcards +5, chat 5x +5. Level = floor(sqrt(xp / 50)) or similar.

### 5.6 Affiliate program
- `AffiliateCode` table: `{userId, code, createdAt, active}`. Code = sanitized username, unique.
- `Subscription` table: `{userId, plan, startedAt, referredByAffiliateCode?, status}`.
- On signup: store `referredByAffiliateCode` in session. On paid conversion: credit commission to the affiliate's wallet.
- Monthly payout: wallet → bank transfer / OVO / GoPay. Manual at first, automate later.

## 6. Pricing (in IDR, lower than pelajarin per user direction + authenticated RE confirmed)

| Tier | Our price | Pelajarin's price (confirmed via authenticated RE) | What's included (ours) |
|---|---|---|---|
| Free | Rp0 | Rp0 | **15 notes/month** (vs pelajarin 1), **50 chats/month** (vs pelajarin 0 — chat_blocked=true), **full quiz/flashcard** (vs first-only lock), 60K token/doc (vs 30K), 5h media (vs 3h), no censorship (vs censored), manual flashcards allowed (vs blocked), quiz settings unlocked (vs locked) |
| Pro | **Rp20.000/bln** (monthly) / **Rp200.000/yr** (annual, ~Rp16.7K/bln) | Rp50.000/bln (Unlimited) / Rp60.000/bln (Pro) | Unlimited semua, priority processing, dedicated support, no watermark |
| Institusi | Custom (negotiable, cheaper than pelajarin's enterprise) | Custom | Bulk seats, LMS integration, analytics, SSO |

**Price positioning:** 60% cheaper than pelajarin Pro. The hook: "Sama kayak pelajarin, tapi 60% lebih murah. Gratis selamanya, Pro mulai Rp 20 ribu."

**Killer differentiator (confirmed by authenticated RE E-AUTH-003):**
Pelajarin's free tier blocks chat entirely (`chat_blocked: true`, `chats_limit: 0`). Students who can't afford Rp 50-60K/month CANNOT chat with Pai at all. Our free tier gives 50 chats/month — students can actually use the AI tutor for free. This is the single biggest reason a price-sensitive Indonesian student would switch from pelajarin to us.

Pelajarin's free tier also locks quiz/flashcard to first-only (`quiz_first_only: true`, `flashcard_first_only: true`), meaning after the first set, students can't generate more without paying. Our free tier has NO such lock — full quiz/flashcard access within the 15-note/month limit.

Pelajarin free tier confirmed limits (from E-AUTH-003):
- 1 note total (refreshable weekly)
- 0 chats (blocked)
- 1 exam/week
- Quiz/flashcard first-only lock
- 30K token limit per document
- 3h media limit
- Content censored
- Manual flashcards blocked
- Quiz settings locked
- Exam results locked

Our free tier is 15x more notes, 50x more chats (from 0), full quiz/flashcard, 2x token limit, 67% more media time, no censorship, all features unlocked.

## 7. Deploy on Cloudflare

| Cloudflare product | What it runs |
|---|---|
| **Pages** | Next.js frontend (static + RSC). Their Next.js support is mature (use `@cloudflare/next-on-pages` adapter) |
| **Workers** | API routes (the `/api/*` handlers). Workers run in V8 isolates — fast, cheap, no cold start |
| **D1** | SQLite-compatible database (replaces our Prisma SQLite). Free tier: 5GB, 5M reads/day |
| **R2** | File storage for uploaded PDFs/audio/video. No egress fees (key advantage vs S3) |
| **Workers AI** | Run Whisper for transcription, small LLMs for cheap tasks, embedding for RAG — all at the edge |
| **KV** | Session storage, rate-limit counters, cache |
| **Queues** | Job queue for the sandbox worker (replace our in-memory queue) |
| **Images** | Image CDN for uploaded images (resize/optimize on the fly) |
| **Stream** | Video encoding/storage for uploaded video material |
| **Zero Trust** | Auth + access control (free for up to 50 users) |

**Cost estimate for 10K users:**
- D1: free tier covers it
- R2: ~$5/mo (10GB storage, no egress)
- Workers: $5/mo (10M requests)
- Workers AI: pay-per-token, ~$50-200/mo depending on usage
- **Total: ~$60-210/mo for 10K users** — gross margin 90%+ at Rp25K/mo

**Why Cloudflare over Vercel:** R2 egress-free, D1 free tier, Workers AI cheap, all in one account, global edge (low latency for SEA students), no Vercel hobby-tier limits.

## 8. Domain + brand

- **Domain:** something short, Indonesian-friendly, memorable. Options: `belajar.ai`, `ujian.ai`, `bimo.ai` (if Bimo is the AI name), `nyicil.ai` (nyicil = cicil = chip away at). Buy on Namecheap + transfer DNS to Cloudflare.
- **Brand voice:** Casual Indonesian, lower-case, pain-point first ("Dosen gak jelasin ulang? Bimo yang jelasin"), never condescending, focus on "step by step sampai paham".
- **AI name:** "Bimo" (Indonesian name, sounds friendly, easy to say) or "Cil" (from nyicil, the study-a-little-at-a-time philosophy).

## 9. Roadmap (12 weeks to launch)

| Week | Milestone |
|---|---|
| 1-2 | Document processing pipeline (PDF, DOCX, PPTX, image) — text extraction + chunking |
| 3 | Audio/video transcription (Whisper via Workers AI) + YouTube transcript |
| 4 | Notes generation (structured LLM call) + UI to view |
| 5 | Flashcard generation + SM-2 spaced repetition + UI |
| 6 | Quiz generation + auto-grading + UI |
| 7 | RAG-scoped chat with Bimo (reuse our chat stream + workspace RAG) |
| 8 | Gamification (streak + XP + level) + UI badges |
| 9 | Auth (NextAuth + Google/Discord OAuth, like pelajarin) + subscription billing (Midtrans for IDR) |
| 10 | Affiliate program + creator dashboard |
| 11 | Cloudflare deploy (Pages + Workers + D1 + R2 + Workers AI) + domain + DNS |
| 12 | Seed 3-5 UTBK creators on TikTok, launch with affiliate codes |

## 10. Risk + honest notes

**Risks:**
1. **Pelajarin moves into UTBK vertical** — they could pivot. Mitigate: build deeper UTBK content (real past papers, not just generic AI).
2. **Cloudflare Workers limits** — 10ms CPU per request on free, 50ms on paid. LLM calls take longer. Solution: use Workers for orchestration, route LLM calls through a separate worker with extended CPU.
3. **Whisper transcription latency** — 4h audio = 5-10 min to transcribe. UX: show "processing..." with progress estimate, process async via Queues.
4. **Creator network is the moat** — we can't copy pelajarin's 120 creators overnight. Start with 3-5 UTBK-focused creators, pay them well, grow organically.
5. **Cloudflare D1 limits** — 5GB free, then $0.75/GB. For 100K users × 10MB notes each = 1TB. Move to Neon Postgres or Turso if we outgrow D1.

**Honest ethical line:** We learned from pelajarin's **public** product (marketing pages, sitemap, the RSC strings every browser sees). We will not scrape their app, extract their prompts, or copy their content. We build our own product. The architecture patterns (Next.js + RSC + separate API + CSP + multi-locale) are industry-standard, not proprietary. The product features (notes/flashcard/quiz) are generic study-tool features, not pelajarin's invention. What IS pelajarin's moat — their creator network, their brand, their specific copywriting — we do not copy. We build our own.

---

## Next action

Pick the differentiation angle (A/B/C/D) — my recommendation is **B (UTBK vertical)** — then I'll scaffold the document-processing pipeline (week 1-2 of the roadmap) using our existing workspace + file-security infrastructure as the foundation.
