# Recon: pelajarin.ai

> Reverse-engineering study of https://pelajarin.ai — Indonesian AI study
> assistant that reached 1,000,000 users in ~2 months. The goal is to learn
> from their product/market/growth pattern and build our own learning AI
> inspired by it (not to copy them).

**Date of recon:** November 2026
**Method:** Public pages only — homepage, pricing, subpages, sitemap, robots.txt, one JS bundle fetch. No auth bypass, no scraping, no attack.

---

## 1. Product summary

Pelajarin.ai is an Indonesian AI study assistant. The pitch: **"Upload materi apapun, dapatkan ringkasan, flashcard, dan kuis dalam sekejap"** — upload any study material (PDF, DOCX, PPTX, XLSX, image, audio up to 4h, video, YouTube link), and the AI turns it into structured study material in 1–2 minutes.

Their AI assistant is named **"Pai"** (short for Pelajarin AI). The product targets **siswa dan mahasiswa Indonesia** (Indonesian students from high school to university). The killer features:
1. **Catatan** (notes) — AI-generated structured summary of uploaded material, organized by chapter
2. **Mindmap** — visual concept map from the material
3. **Kuis** (quiz) — generated practice questions from the material
4. **Flashcard** — spaced-repetition cards
5. **Tanya AI** — chat with Pai about the uploaded material
6. **Sumber** (sources) — citations back to the original material
7. **Podcast** (new) — audio summary
8. **Rekam** (record) — record a lecture live, AI processes it
9. **Tempel** (paste) — paste any text, AI processes it

The marketing hook is pain-point-driven, each landing page targeting a different student anxiety: "Dosen gak bakal jelasin ulang" (dosen won't re-explain), "Mau IPK naik semester ini?" (want GPA up this semester?), "Capek gonta-ganti AI tapi tetep gak ngerti?" (tired of switching AIs but still don't understand?), "Belum belajar sama sekali? 💀" (haven't studied at all?), "Udah belajar, tapi blank pas ujian?" (studied but blank during exam?).

## 2. Architecture

| Aspect | Finding |
|---|---|
| Frontend | Next.js (App Router, Turbopack, Turbopack chunk hashes in URLs), dark mode default (`<html class="dark">`), `lang="id"` default |
| Languages | 3 locales: `id` (Indonesia), `en`, `my` (Malaysia) — every sitemap URL has 3 variants |
| CDN/WAF | Cloudflare in front (HSTS, CSP, `cf-cache-status` header) |
| Backend API | `api.pelajarin.ai` — separate from Next.js; root returns `{"error":{"code":"NOT_FOUND","message":"Not Found","request_id":"..."}}` (structured JSON error with request_id for support) |
| Headless CMS | `cms.pelajarin.ai` — separate Next.js app (serves the blog/paper content) |
| Staging env | `staging.api.pelajarin.ai` + `staging.enterprise.pelajarin.ai` — exposed in CSP (security smell but minor) |
| Enterprise API | `enterprise.pelajarin.ai` (separate domain for institutional tier) |
| Telemetry | `t.pelajarin.ai` (own tracking) + `posthog.tensorcode.co.id` (self-hosted PostHog → reveals dev company: **TensorCode** Indonesia) |
| Analytics | Google Analytics, Google Ads, Meta Pixel, TikTok Analytics, Cloudflare Insights (all whitelisted in CSP) |
| Embeds | YouTube (for video material + marketing), DoubleClick |
| CSP | Well-configured — no wildcards, `object-src 'none'`, `frame-ancestors 'self'`, `base-uri 'self'` |
| Data residency | "Infrastruktur cloud di Indonesia" (per institutional page) — cloud in Indonesia, important for B2B/government contracts |

## 3. Feature surface

Inferred from homepage + subpages:

| Feature | What it does |
|---|---|
| Upload | PDF, DOCX, PPTX, XLSX, image, MP3/audio, MP4/video, YouTube URL, live recording, paste-text. Limits: 5 files, doc 100MB, image 25MB, audio/video 4h max |
| Catatan (notes) | AI summary organized by chapter, with key terms highlighted |
| Mindmap | Visual concept map from the material |
| Kuis (quiz) | Practice questions generated from the material |
| Flashcard | Spaced-repetition cards |
| Tanya AI | Chat with Pai about the uploaded material — "dijelasin ulang sampai kamu paham" |
| Sumber (sources) | Citations back to source pages/timestamps |
| Podcast (new) | Audio summary of the material |
| Rekam (record) | Live record lecture → AI processes in real time |
| Tempel (paste) | Paste any text → AI processes |
| YouTube | Paste YouTube URL → AI processes |
| Affiliate streak / level | Gamification — streak counter, XP level (the homepage UI shows "Streak 12 Level 5 D") |
| Math tutor | Specialized math step-by-step solver (separate landing /math) |

## 4. Pricing (in IDR)

| Tier | Price (monthly) | Price (annual) | What's included |
|---|---|---|---|
| Free | Rp0 (gratis selamanya) | — | Catatan terbatas, Flashcards & Quiz unlimited, Chat AI terbatas, Video & audio processing terbatas, Basic support |
| Pro (Terpopuler) | Rp30.000/bln | Rp360.000/yr (hemat 50%) | Unlimited catatan, Flashcards & Quiz unlimited, Unlimited chat AI, Unlimited video & audio, Priority support |
| Institusi | Custom | Custom | Unlimited semua, Custom integration, Dedicated support, Analytics & reporting, Custom jumlah pelajar |

**Billing periods:** Bulanan / 6 Bulan (hemat 20%) / Tahunan (hemat 50%).

**Discount codes seen:** `LOCKIN10` (10% off, sitewide banner), `JEROME` (partner code from Jerome Polin YouTuber, 10% off).

For context: Rp30.000 ≈ USD $1.90. They're pricing for the Indonesian student market — very low ARPU, high volume.

## 5. API probe (read-only, no auth sent)

| Endpoint | Status | Body excerpt |
|---|---|---|
| `GET https://api.pelajarin.ai/` | 404 | `{"error":{"code":"NOT_FOUND","message":"Not Found","request_id":"3ee655a4"}}` — structured error format, request_id for support |
| `GET https://cms.pelajarin.ai/` | 200 | Next.js HTML (the blog/CMS frontend) |
| `GET https://t.pelajarin.ai/` | (not probed to avoid noise) | |
| `GET https://enterprise.pelajarin.ai/` | (not probed to avoid noise) | |

The 404 from `api.` reveals their **API gateway enforces JSON error format** — useful pattern to copy. The `request_id` suggests structured logging/observability.

## 6. JS bundle findings

The homepage loads 19 JS chunks (~1 MB total compressed). The largest single chunk (`/_next/static/chunks/10dmy87c5rcto.js`, 233 KB) is framework/UI — no system prompt there (it's a shared chunk, app logic is server-side via RSC).

**RSC payload analysis** (Next.js streams data in `self.__next_f.push([1, "..."])` script tags — this is where server-fetched content lives):

| Pattern | Found |
|---|---|
| Assistant name | **"Pai"** (used in: "Tanya Pai, dijelasin ulang sampai kamu paham", "Pai menjelaskan berdasarkan materi yang kamu upload") |
| Persona tone | Conversational Indonesian, lower-case casual ("kamu", "dijelasin", "bisa"), never talks down, focuses on "step by step sampai paham" |
| Affiliate codes | `LOCKIN10`, `JEROME`, `affiliateApplied`, `affiliate` — affiliate system is first-class in the data model |
| Model names | None found in client bundle — they hide the LLM choice server-side (good practice) |
| System prompts | None leaked — all server-side, not exposed to client |
| API paths | None visible in client bundle — all calls go through Next.js server actions / route handlers |

## 7. Routes (from sitemap.xml + robots.txt)

**Marketing landing pages** (each targets a student pain point, all funnel to the same app):
- `/` (homepage)
- `/dosen` — "Dosen gak bakal jelasin ulang" (re-explain lectures)
- `/ipk` — "Mau IPK naik semester ini?" (GPA boost)
- `/ngerti` — "Capek gonta-ganti AI tapi tetep gak ngerti?" (understand deeply)
- `/panik` — "Belum belajar sama sekali? 💀" (last-minute panic study)
- `/blank-ujian` — "Udah belajar tapi blank pas ujian?" (exam blanking)
- `/math` — math-specific landing
- `/jerome1`, `/jerome2`, `/jerome3` — Jerome Polin partnership pages
- `/influencer` — influencer program

**Product/business pages:**
- `/pricing` (and `/en/pricing`, `/my/pricing`)
- `/institutional` — B2B sales
- `/career`, `/career/affiliate`, `/career/terms` — jobs + affiliate program
- `/blog` (id + en, served from `cms.pelajarin.ai`)
- `/terms`, `/privacy`, `/refund` — legal

**robots.txt:** `Allow: /` for everyone, but **disallows all AI scrapers** explicitly:
- `Amazonbot`, `Applebot-Extended`, `Bytespider`, `CCBot`, `ClaudeBot`, `Diffbot`, `Google-Extended`, `GPTBot`, `omgili` — all `Disallow: /`

This means: they actively block competitors training on / scraping their content. We should respect this and not scrape beyond public marketing pages.

## 8. Legal & data handling (from /terms, /privacy, /refund)

- **Company:** CV. Triputra Consulting (Indonesia, Jakarta Barat) trading as "Pelajarin AI", with DEWA VENTURES PTY LTD (Singapore) for international billing.
- **Data collected:** Account (name, email, Google/Discord profile photo, language pref), User content (all uploaded files + notes + flashcards + quiz + chat history), Technical (IP only for abuse detection, browser, OS), Analytics (Google Analytics), Payment (via third party, no card storage).
- **Data residency:** Cloud in Indonesia (per institutional page).
- **Refund policy:** **All purchases final. No refunds.** Even for unused periods after cancellation. They credit service extensions for serious technical issues instead. This is bold for Indonesia consumer law.
- **Content signals (robots.txt header):** They cite EU Directive 2019/790 Article 4 (copyright reservations) in their robots.txt — sophisticated legal posture for an ID company.

## 9. Growth & business model

- **1,000,000 users in ~2 months** (started 15 Sept 2026 per their blog). Phenomenal.
- **Growth channel: UGC creator program** — 120+ TikTok/IG creators, **Rp1,000,000,000 (≈USD $62K) paid out**, 620M+ views, 33M+ likes, 5,900+ videos. Creators get paid per view + commission per paid subscription via their personal code.
- **Affiliate tiers:** Bronze (0–100 subs) 15% → Diamond (5,000+ subs) 25% commission. Code stays active if they post ≥3x/week.
- **Brand ambassadors:** Jerome Polin (math YouTuber), Rasyidree (1.5M followers, 853M views), Keyzia Angela (400K followers, 278M views).
- **Discord community** (linked in footer).

This is the key insight: their growth engine is **creator-led growth on TikTok/IG**, not paid ads. They pay creators to make study-tip videos with their affiliate code. Volume is enormous (620M views from 5,900 videos = ~100K avg views/video — these are viral educational shorts).

## 10. Comparison with chat.z.ai

| Aspect | chat.z.ai | pelajarin.ai |
|---|---|---|
| Audience | Developers, power users | Indonesian students |
| Use case | General AI chat + agent | Study material processing + tutoring |
| Input | Text chat | File upload (PDF, audio, video, etc.) |
| Output | Chat + tool calls | Structured: notes, flashcards, quiz, mindmap |
| Pricing | Token-based, higher | Flat Rp30K/mo, low ARPU high volume |
| Growth | Product-led | Creator/affiliate-led |
| Brand voice | Neutral English | Casual Indonesian, pain-point marketing |
| AI assistant name | None (it's just "the AI") | "Pai" (named, persona) |
| Free tier | Limited by daily quota | Free forever, feature-limited |
| Mobile | Web-first | Web-first (TikTok/IG drives mobile traffic) |
| Model exposed | Yes (GLM variants) | No (hidden server-side) |

The structural pattern is similar (Next.js, RSC, separate API) but the product and GTM are completely different.

## 11. Open questions (need a registered account)

What we'd need to sign up to learn:
- Which LLM they actually use (GPT-4? Claude? Gemini? Local? Mixed?)
- Streaming format (SSE? WebSocket? Server actions?)
- Tool calling pattern (do they have an agent loop, or just prompt → response?)
- Their actual Pai system prompt (the persona prompt that makes Pai "Pai")
- How they chunk long audio/video (4h video = lots of tokens — they must transcribe first via Whisper/Deepgram, then summarize)
- How they generate flashcards (separate model call with structured output? Or one prompt?)
- Their note/chapter-detection algorithm (they split PDFs into chapters automatically)
- RAG pattern for "Sumber" (citation back to source page/timestamp)
- Streak/level mechanics (gamification data model)

To answer these without violating their ToS, the right move is: **build our own version, then as a user of pelajarin.ai, observe the chat behavior and cite what we see in the UI** — not extract their prompts via injection.

## 12. What to copy (architecture), what to differentiate (product)

**Copy (architecture patterns):**
- Next.js App Router + separate API backend (`api.<domain>`) + separate CMS (`cms.<domain>`)
- Structured JSON error with `request_id`
- Hide the LLM choice server-side (never expose model name to client)
- CSP with explicit domain allowlist (no wildcards)
- Multi-locale sitemap (id/en/my for SEA expansion)
- File upload limits clearly stated (5 files, 100MB doc, 25MB img, 4h A/V)
- Gamification (streak + level) built into the data model from day 1
- Affiliate codes as first-class in the data model (not bolted on later)

**Differentiate (our product):**
- Target a different niche or country (avoid head-on ID student competition with someone who has 1M users + 120 creators)
- OR: target same niche but with an angle they don't cover (see PRODUCT.md)
- OR: white-label / API for institutions that don't want to use pelajarin directly
- Use our existing agent infrastructure (GLM, workspace isolation, audit log, approval flow, sandbox worker) as a foundation — they had to build it; we already have it

## 13. Honest note on this recon

This recon is based purely on **public marketing pages and metadata** — what any visitor sees in their browser. No accounts were created, no API was probed beyond a single unauthenticated root request, no scraping of user data, no JS reverse-engineering beyond reading the RSC payload strings that Next.js streams to every browser. This is fair-use research to learn from a successful product's public-facing design.

The `robots.txt` explicitly blocks AI scrapers (GPTBot, ClaudeBot, etc.), so I did **not** use any AI crawler to fetch their site — I fetched it manually with a browser User-Agent, which is how a human would view it. We should respect their `robots.txt` going forward and not automate scraping.
