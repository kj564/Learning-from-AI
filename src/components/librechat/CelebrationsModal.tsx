'use client';

/**
 * CelebrationsModal — auto-shows pending celebrations (level-up, streak
 * milestone, achievement unlock) as a full-screen overlay.
 *
 * RE source: RECON-DEEP-v4 §2.6 — pelajarin's /gamification/celebrations
 * returns pending celebrations. The user acknowledges via /celebrations/ack.
 *
 * Auto-checks for pending celebrations on mount + after key actions
 * (note created, quiz passed, etc.). Shows one at a time, dismissable.
 */

import { useState, useEffect, useCallback } from 'react';
import { Flame, Trophy, Star, X, Sparkles } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Bump this number to trigger a re-check (e.g. after quiz passed). */
  trigger?: number;
}

interface Celebration {
  id: string; type: string; title: string; description: string;
  icon_key: string; data: any;
}

const ICON_MAP: Record<string, any> = {
  flame: Flame, trophy: Trophy, star: Star,
};

export function CelebrationsModal({ open, onOpenChange, trigger }: Props) {
  const [pending, setPending] = useState<Celebration[]>([]);
  const [current, setCurrent] = useState<Celebration | null>(null);

  const check = useCallback(async () => {
    try {
      const r = await fetch('/api/v1/gamification/celebrations');
      const d = await r.json();
      const list: Celebration[] = d.data?.pending || [];
      if (list.length > 0) {
        setPending(list);
        setCurrent(list[0]);
        onOpenChange(true);
      }
    } catch {}
  }, [onOpenChange]);

  // Check on mount + when trigger changes
  useEffect(() => { check(); }, [check, trigger]);

  async function dismiss() {
    if (current) {
      try {
        await fetch('/api/v1/gamification/celebrations/ack', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: current.id }),
        });
      } catch {}
    }
    const rest = pending.slice(1);
    setPending(rest);
    setCurrent(rest[0] || null);
    if (rest.length === 0) onOpenChange(false);
  }

  if (!current) return null;
  const Icon = ICON_MAP[current.icon_key] || Sparkles;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); onOpenChange(o); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden" style={{ borderRadius: 24, border: '2px solid var(--accent-orange)' }}>
        {/* Confetti-ish header */}
        <div className="relative flex flex-col items-center gap-3 px-6 pt-10 pb-8 text-center" style={{ background: 'linear-gradient(180deg, var(--bg-accent) 0%, var(--bg-primary) 100%)' }}>
          <button onClick={dismiss} className="absolute right-4 top-4 rounded-full p-1.5 transition-colors hover:bg-surface" style={{ color: 'var(--text-muted)' }} aria-label="Tutup"><X size={18} /></button>

          {/* Big icon with pulse */}
          <div className="flex h-24 w-24 items-center justify-center rounded-full" style={{ background: 'var(--accent-orange)', color: '#fff', boxShadow: '0 8px 32px rgba(247,103,3,0.3)' }}>
            <Icon size={48} />
          </div>

          {/* Sparkles around */}
          <Sparkles size={16} className="absolute" style={{ top: 20, left: 40, color: 'var(--accent-yellow)' }} />
          <Sparkles size={14} className="absolute" style={{ top: 30, right: 50, color: 'var(--accent-yellow)' }} />
          <Sparkles size={12} className="absolute" style={{ bottom: 60, left: 60, color: 'var(--accent-yellow)' }} />

          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>{current.title}</h2>
          <p style={{ fontSize: 15, color: 'var(--text-muted)', maxWidth: 280 }}>{current.description}</p>

          {/* Data badges */}
          {current.type === 'level_up' && current.data && (
            <div className="flex gap-2 mt-1">
              <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>Level {current.data.prev_level}</span>
              <ChevronRightSmall />
              <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: 'var(--accent-orange)', color: '#fff' }}>Level {current.data.level}</span>
            </div>
          )}
          {current.type === 'streak_milestone' && current.data && (
            <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: '#fef9c3', color: '#a16207' }}>🔥 {current.data.streak} hari beruntun</span>
          )}
          {current.type === 'achievement_unlocked' && current.data && current.data.xp_reward > 0 && (
            <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: 'var(--bg-accent)', color: 'var(--accent-orange)' }}>+{current.data.xp_reward} XP</span>
          )}
        </div>

        {/* Footer — continue button */}
        <div className="flex justify-center px-6 py-4" style={{ background: 'var(--bg-primary)' }}>
          <button onClick={dismiss} className="inline-flex items-center gap-2 rounded-full font-semibold transition-transform hover:-translate-y-0.5 active:translate-y-0.5" style={{ background: 'var(--accent-orange)', color: '#fff', fontSize: 15, fontWeight: 600, padding: '0 32px', height: 44, borderRadius: '9999px' }}>
            Lanjut Belajar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChevronRightSmall() {
  return <span style={{ color: 'var(--text-muted)', alignSelf: 'center' }}>→</span>;
}
