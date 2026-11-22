'use client';

/**
 * Bimo — Teman belajar AI untuk siswa Indonesia.
 *
 * Main page: the learning-AI product, built from RE of pelajarin.ai.
 * UI patterns from REA route inventory + authenticated RE findings:
 *   - Hero: "6 Jam Belajar Jadi 1 Jam" + upload CTA (RECON.md)
 *   - Upload dropzone with file type badges (RECON.md)
 *   - Note cards grid with flashcard/quiz counts (E-AUTH-006)
 *   - Note detail tabs: Catatan / Flashcard / Kuis / Tanya AI (E-AUTH-006)
 *   - Chat with Bimo: streaming via fetch+ReadableStream (E-008)
 *   - Streak/level gamification badges (E-AUTH-003)
 *   - Free tier: 15 notes, 50 chats (vs pelajarin 1 note, 0 chat)
 *   - Dark mode, Indonesian language, casual tone
 *
 * Data flows through /api/v1/* endpoints (matching pelajarin's API surface).
 */

import { BimoApp } from '@/components/librechat/BimoApp';

export default function Page() {
  return <BimoApp />;
}
