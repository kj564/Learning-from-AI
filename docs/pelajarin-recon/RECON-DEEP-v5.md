# RECON-DEEP-v5 — Marketing site 1:1 capture + pricing RE

**Date**: 2025-11-23
**Method**: Headless Chrome CDP (port 9222) navigated to
`pelajarin.ai`, `pelajarin.ai/pricing`, `app.pelajarin.ai/auth/signin`.
Full HTML + computed styles + asset download via `Runtime.evaluate`.

**Evidence files**:
- `capture/marketing/home.html` (287 KB) — full marketing home HTML
- `capture/marketing/pricing.html` (161 KB) — full pricing page HTML
- `capture/marketing/app-signin.html` (25 KB) — app signin HTML
- `public/pelajarin-assets/` (2.6 MB) — all fonts, CSS, images, favicons

---

## 1. Marketing home page structure (`pelajarin.ai`)

`<title>`: "Pelajarin.ai - Platform Belajar AI untuk Siswa Indonesia"
`<body>` font: `Poppins, "Poppins Fallback"` (16px) on `rgb(255,255,255)`.

### Page sections (in order, with captured Y position + height):

| # | Section | Class | Y | H | Heading |
|---|---|---|---|---|---|
| 1 | Nav shell | `_8UxHxW_navShell` | 40 | 78 | (sticky nav: logo + Fitur/Harga/FAQ/Karier/Blog + Masuk) |
| 2 | Hero | `_8UxHxW_hero` | 118 | 1300 | "Ubah 6 Jam Belajar Jadi **1 Jam**" |
| 3 | Breadcrumb (app demo) | `hdr` | 623 | 68 | pelajarin.ai › Beranda › Fotosintesis |
| 4 | J-head | `j-head` | 707 | 139 | Fotosintesis (the embedded app demo) |
| 5 | J-next | `j-next` | 876 | 55 | Mulai / Lanjut / Selanjutnya / Gambaran umum |
| 6 | Prompt section | `prompt` | 954 | 425 | "Rangkum bab tentang Perang Dunia II" |
| 7 | Universities | `_8UxHxW_universities` | 1418 | 224 | "Dipercaya oleh" |
| 8 | Normalisation | `_8UxHxW_normalisation` | 1642 | 800 | "Kamu nggak sendirian" |
| 9 | Features | `_8UxHxW_features` | 2442 | 1136 | "Semua yang Kamu Butuhkan" |
| 10 | Upload formats | `_8UxHxW_upload` | 3578 | 800 | "Support Berbagai Format" |
| 11 | Comparison | `_8UxHxW_comparison` | 4378 | 869 | "Kenapa pelajarin.ai?" |
| 12 | Social proof | `_8UxHxW_social` | 5246 | 1016 | "Mereka Sudah Membuktikannya" |
| 13 | Mobile app | `_8UxHxW_mobileApp` | 6262 | 804 | "Belajar di mana saja, kapan saja" |
| 14 | CTA section | `_8UxHxW_ctaSection` | 7066 | 620 | "Siap Revolusi Cara Belajarmu?" |
| 15 | FAQ | `_8UxHxW_faq` | 7686 | 961 | "Pertanyaan Umum" |
| 16 | Footer | (relative z-10) | 8896 | 390 | "Produk" (with link columns) |

### Hero section (exact copy):

```
Ubah 6 Jam Belajar Jadi 1 Jam
Transformasi cara belajarmu dengan AI. Upload materi apapun,
dapatkan ringkasan, flashcard, dan kuis dalam sekejap.

[ Mulai Gratis Sekarang → ]
  tanpa kartu kredit, gratis selamanya!
```

The "1 Jam" is highlighted with a hand-drawn underline SVG (`_8UxHxW_underline`).

### Nav links (captured):
- Fitur (`#fitur`)
- Harga (`/pricing`)
- FAQ (`#faq`)
- Karier (`/career`)
- Blog (`/blog`)
- Masuk (→ `app.pelajarin.ai`)
- Theme toggle (dark mode)
- Language selector (🇮🇩 ID)

---

## 2. Pricing page (`pelajarin.ai/pricing`) — 1:1 RE

`<title>`: "Harga & Paket Berlangganan | Pelajarin.ai"

### Page structure:
| # | Section | Y | H | Heading |
|---|---|---|---|---|
| 1 | Header | 78 | 368 | "Pilih Plan yang Tepat" |
| 2 | Plan cards | 446 | 677 | Free / Pro |
| 3 | Testimonials | 1123 | 528 | "Kata mereka:" |
| 4 | Contact CTA | 1651 | 166 | "Butuh bantuan memilih plan? Kontak kami" |

### Pricing plans (exact, 1:1):

#### Free — "Cocok untuk belajar dasar"
- Price: **Gratis selamanya** (48px Quicksand bold + 22px Caveat cursive)
- CTA: "Mulai Gratis" (→ `app.pelajarin.ai`)
- Features:
  1. Catatan terbatas
  2. Flashcards & Quiz unlimited
  3. Chat AI terbatas
  4. Video & audio processing terbatas
  5. Basic support

#### Pro — (no tagline captured)
- Price: **Rp30.000/ bulan** (with annual: Rp360.000 per tahun, "Hemat 50%")
- CTA: (not captured — likely "Mulai Pro" / "Upgrade")
- Features:
  1. Unlimited catatan
  2. Flashcards & Quiz unlimited
  3. Unlimited chat AI
  4. Unlimited video & audio processing
  5. Priority support tertinggi

### Plan card styling (captured classes):
- Card: `flex flex-col gap-[6px]` container
- Plan name: `text-[26px]! leading-[32px]! tracking-[0]! text-inherit` (Quicksand)
- Tagline: `text-[15px] leading-[18px] text-[color:var(--color-ink-soft)]`
- Price: `font-[Quicksand] text-[48px] leading-[56px] font-bold tracking-[-.02em]` (mobile: 42px/50px)
- "selamanya" accent: `font-[Caveat,cursive] text-[22px] leading-[28px] font-semibold`
- CTA button: `py-[14px] px-[20px] rounded-[14px] bg-[var(--color-card)] border-2 border-[color:var(--color-ink)] shadow-[0_4px_0_var(--color-ink)]` (neo-brutalist shadow)
- Feature list: `flex flex-col gap-[12px] pt-[8px] border-t-[1.5px] border-dashed border-t-[color:var(--color-rule)]`
- Each feature: `flex items-center gap-[12px] text-[15px] leading-[22px]` with checkmark SVG icon

---

## 3. Bimo pricing strategy (from RE)

Bimo undercuts pelajarin by 60% per the original product brief:
- **Pelajarin Pro**: Rp30.000/bulan (Rp360.000/year)
- **Bimo Pro**: **Rp20.000/bulan** (Rp240.000/year — save 33% vs monthly)

Bimo free tier is more generous:
- **Pelajarin Free**: 1 catatan, 0 chat (chat_blocked)
- **Bimo Free**: **15 catatan**, **50 chat** (per PRODUCT.md)

---

## 4. Assets downloaded (1:1, all from pelajarin.ai)

### Fonts (29 files, 1.4 MB):
- Poppins 400/500/600/700 (TTF from fonts.gstatic.com)
- Quicksand 500/600/700 (TTF from fonts.gstatic.com)
- Quicksand Variable (22 woff2 from pelajarin Next.js build, with
  unicode-range splits for Latin/Vietnamese/Latin-ext)

### CSS (7 files, 380 KB):
- 5 marketing CSS (`0-ldi91b2rdgx.css` 167KB, `015l8-e6ffu4c.css`, `1bkv2sxiflx4e.css`, `2dfg-xg5fri3n.css`, `3lm711nuhvztz.css`)
- 1 app CSS (`app-index-D3DBKnI4.css` 89KB from auth.pelajarin.ai)
- 1 Google Fonts CSS (app-css2?family=Poppins+Quicksand)

### Images (30+ files, 1.2 MB):
- Logo: `logo.png` (64x64), `logo-white.svg`
- Favicons: `favicon.ico`, `favicon.svg`, `favicon-16/32/48/96.png`, `apple-touch-icon.png`
- Pai mascot: `pai-pointing.png` (212x212), `pai-thinking.png`, `pai-thumbsup.png`, `pai-dancing.png`, `pai-confused.png`, `pai-books.png`, `pai-head.png`
- Illustrations: `read.webp`, `nap.webp`, `idle.webp`, `thumbsup.webp` (all ~384x384)
- University logos: `itb.png`, `ugm.png`, `unair.png`, `its.png`, `binus.png`, `telkom.png`, `brawijaya.png`, `penabur.png`
- Social proof: `dewaweb-chp-horizontal-logo-rgb.webp`, `dewaweb-chp-horizontal-logo-monochrome-white.png`
- Other: `goto.svg`, `google.svg`, `ui.png`

---

## 5. Bimo 1:1 status (VLM comparison)

**Score: 72/100** (up from untested baseline).

### What matches:
- Body font: `Poppins, Poppins Fallback` 16px on white — exact
- H1 font: `Quicksand, Quicksand Fallback` 42px/700 — exact
- Body color: `#1a1a2e` — exact
- Logo: real pelajarin logo.png renders
- Hero: real Pai-pointing.png mascot renders
- Topbar: Streak (yellow), Level (blue), Upgrade (orange) pills with icons
- Notes section: "All folders" dropdown + Grid/List pill toggle
- Accent orange `#f76703` — exact

### Remaining gaps (for next iteration):
1. Logo wordmark: Bimo says "bimo.ai", pelajarin says "pelajarin.ai" —
   intentional rebrand, but the wordmark style should match (Quicksand
   20px/700 — already applied).
2. Note cards: pelajarin shows a preview area with small mascot + "Created
   Nov 22" date; Bimo cards are minimal.
3. Onboarding modal: pelajarin shows "Welcome to the new look" on first
   visit; Bimo doesn't.
4. Sidebar: pelajarin hides the left sidebar on the dashboard view (shows
   only on note detail); Bimo shows it always.
5. Input box placeholder: pelajarin "Explain photosyn...", Bimo "What would
   you like to learn?"

---

## 6. Next steps (prioritized)

1. Add a Bimo pricing section to the dashboard (using the captured pelajarin
   pricing structure, with Bimo's Rp20.000/bulan price). Make it a modal or
   dashboard section (single-route constraint).
2. Rebuild note cards with preview + mascot + "Created Nov ..." date.
3. Hide the left sidebar on dashboard view (show only on note detail).
4. Add a first-visit onboarding modal ("Welcome to Bimo!").
5. Capture the authenticated app.pelajarin.ai dashboard (needs login) for
   the exact note-card preview layout.
