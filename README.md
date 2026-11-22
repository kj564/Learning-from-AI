# Learning-from-AI

AI study assistant untuk siswa & mahasiswa Indonesia. Upload materi kuliah / pelajaran (PDF, DOCX, slide, audio, video, gambar, YouTube) → AI buat catatan, flashcard, kuis, mindmap, dan chat tutor "Bimo" yang jelasin materi step by step.

**Harga:** Gratis selamanya (generous free tier) + Pro Rp 20.000/bulan (60% lebih murah dari kompetitor utama).

## Status

🚧 **In development** — repo ini berisi:
- **Agent infrastructure (production-ready):** workspace isolation per-user, file security (MIME sniffing + quarantine), audit log, approval workflow, sandbox worker terpisah
- **Riset kompetitor:** `docs/pelajarin-recon/` — recon arsitektur + produk + API surface pelajarin.ai (public pages only, fair-use)
- **Product direction:** `docs/pelajarin-recon/PRODUCT.md` — roadmap 12 minggu ke launch

Yang berikutnya: document processing pipeline (PDF/audio/video → text + chunking), LLM calls untuk generate notes/flashcard/quiz, RAG-scoped chat, gamification (streak + XP + level), billing (Midtrans), Cloudflare deploy.

## Repo structure

```
src/
  app/                    # Next.js 16 App Router (UI + API routes)
    api/                  # API endpoints: tools, chat, workspaces, approvals, sandbox, audit
  components/librechat/   # UI: chat, workspace browser, sandbox panel, audit log, approval dialog
  lib/                    # workspace isolation, file security, sandbox client, approval, agent tools, validation
mini-services/
  sandbox-worker/         # Separate process for code execution (run_code_sandbox, run_shell)
prisma/
  schema.prisma           # Workspace, WorkspaceFile, ApprovalRequest, ToolCallAudit, SandboxJob
docs/
  agent/                  # Agent system prompt, tools, subagents, safety rules, evaluation tests (T1-T30)
  pelajarin-recon/        # Competitor research + product direction
```

## Tech stack

- **Framework:** Next.js 16 (App Router, TypeScript, Turbopack)
- **Styling:** Tailwind CSS 4 + shadcn/ui (New York)
- **Database:** Prisma + SQLite (swap to Cloudflare D1 for prod)
- **LLM:** GLM via `z-ai-web-dev-sdk` (hidden server-side)
- **Sandbox:** Separate worker process (process tier in dev, Docker tier in prod)
- **Target deploy:** Cloudflare (Pages + Workers + D1 + R2 + Workers AI)

## Documentation

- [`docs/pelajarin-recon/RECON.md`](docs/pelajarin-recon/RECON.md) — public recon of pelajarin.ai (product, pricing, features, growth)
- [`docs/pelajarin-recon/RECON-DEEP.md`](docs/pelajarin-recon/RECON-DEEP.md) — hard recon (API surface, auth flow, data model, stack)
- [`docs/pelajarin-recon/PRODUCT.md`](docs/pelajarin-recon/PRODUCT.md) — our product direction, pricing, roadmap
- [`docs/agent/`](docs/agent/) — agent system prompt, tool catalog, subagents, safety rules, evaluation tests

## Development

```bash
bun install
bun run db:push          # push prisma schema to SQLite
bun run dev              # start Next.js (port 3000)
# In another terminal:
cd mini-services/sandbox-worker && bun run dev   # sandbox worker (port 3030)
```

## Ethical note

The pelajarin.ai recon in `docs/pelajarin-recon/` is based **only on public pages** — what any browser visitor sees. No accounts were created, no auth bypass, no scraping of user data, no AI crawler used (their robots.txt blocks AI scrapers, we respected it). We build our own product; we do not copy their code, content, or creator network. See the method sections in each RECON doc for the full ethical statement.
