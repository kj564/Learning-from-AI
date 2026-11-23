'use client';

/**
 * OnboardingModal — 1:1 rebuild of pelajarin's "Welcome to the new look"
 * first-visit modal.
 *
 * RE source: VLM comparison noted pelajarin shows a "Welcome to the new look"
 * popup with carousel dots, Next button, and a dark backdrop on first visit.
 * Bimo adapts this as a 3-slide welcome carousel:
 *   1. "Hai, aku Bimo!" — intro with Pai mascot
 *   2. "Upload materi, langsung dapat rangkuman" — feature highlight
 *   3. "Gratis selamanya, Pro mulai Rp 20 ribu" — pricing nudge
 *
 * Shows only once per user (localStorage flag `bimo_onboarded`).
 */

import { useState, useEffect } from 'react';
import { ArrowRight, Sparkles, Upload, Zap } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const SLIDES = [
  {
    icon: Sparkles,
    title: 'Hai, aku Bimo!',
    body: 'Aku teman belajar AI-mu. Upload materi apa aja — PDF, foto catatan, slide, bahkan video YouTube — dan aku bantu kamu paham dalam hitungan menit.',
    accent: 'var(--accent-orange)',
  },
  {
    icon: Upload,
    title: 'Upload materi, langsung dapat rangkuman',
    body: 'Dari satu file, aku bikin rangkuman bab, flashcard, kuis, mindmap, bahkan podcast 2-host. Semua dalam satu catatan.',
    accent: 'var(--accent-blue)',
  },
  {
    icon: Zap,
    title: 'Gratis selamanya, Pro mulai Rp 20 ribu',
    body: '15 catatan + 50 chat AI tiap bulan gratis. Mau unlimited? Upgrade ke Pro — 33% lebih murah dari pelajarin.',
    accent: 'var(--accent-green)',
  },
];

export function OnboardingModal({ open, onOpenChange }: Props) {
  const [slide, setSlide] = useState(0);

  // Reset to first slide when reopened
  useEffect(() => { if (open) setSlide(0); }, [open]);

  const isLast = slide === SLIDES.length - 1;
  const s = SLIDES[slide];

  function next() {
    if (isLast) {
      localStorage.setItem('bimo_onboarded', '1');
      onOpenChange(false);
    } else {
      setSlide(prev => prev + 1);
    }
  }

  function skip() {
    localStorage.setItem('bimo_onboarded', '1');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) skip(); onOpenChange(o); }}>
      <DialogContent className="max-w-md p-0 overflow-hidden" style={{ borderRadius: 24, border: '2px solid var(--border)' }}>
        {/* Slide content */}
        <div className="flex flex-col items-center gap-4 px-8 pt-10 pb-6 text-center" style={{ background: 'var(--bg-primary)' }}>
          {/* Mascot / icon circle */}
          <div className="flex items-center justify-center rounded-full" style={{ width: 96, height: 96, background: 'var(--bg-accent)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pelajarin-assets/img/pai-thumbsup.png" alt="Bimo" width={72} height={72} style={{ objectFit: 'contain' }} />
          </div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>{s.title}</h2>
          <p style={{ fontSize: 15, lineHeight: '22px', color: 'var(--text-muted)', maxWidth: 320 }}>{s.body}</p>

          {/* Carousel dots */}
          <div className="flex items-center gap-1.5 pt-2">
            {SLIDES.map((_, i) => (
              <button key={i} onClick={() => setSlide(i)} className="rounded-full transition-all" style={{ width: i === slide ? 24 : 8, height: 8, background: i === slide ? 'var(--accent-orange)' : 'var(--border)' }} aria-label={`Slide ${i + 1}`} />
            ))}
          </div>
        </div>

        {/* Footer — Next / Skip */}
        <div className="flex items-center justify-between px-8 py-4" style={{ background: 'var(--bg-surface)' }}>
          <button onClick={skip} className="text-sm font-semibold text-muted hover:text-app transition-colors" style={{ color: 'var(--text-muted)' }}>
            Lewati
          </button>
          <button onClick={next} className="inline-flex items-center gap-2 rounded-full font-semibold transition-transform hover:-translate-y-0.5 active:translate-y-0.5" style={{ background: s.accent, color: '#fff', fontSize: 15, fontWeight: 600, padding: '0 24px', height: 44, borderRadius: '9999px' }}>
            {isLast ? 'Mulai' : 'Lanjut'} <ArrowRight size={16} />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Check if the user has already seen the onboarding. */
export function shouldShowOnboarding(): boolean {
  if (typeof window === 'undefined') return false;
  return !localStorage.getItem('bimo_onboarded');
}
