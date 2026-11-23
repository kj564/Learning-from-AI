'use client';

/**
 * GamificationHubModal — 1:1 rebuild of pelajarin's gamification hub.
 *
 * RE source: RECON-DEEP-v4 §2.6 — pelajarin has 12 gamification endpoints.
 * The hub is a composite view (GET /gamification/hub) showing:
 *   - Today's quests with progress
 *   - Leaderboard preview (top 5)
 *   - Achievements snapshot (unlocked count)
 *
 * Bimo's hub modal has 3 tabs:
 *   1. Quests — daily challenges with progress bars + XP rewards
 *   2. Leaderboard — top users by XP (period toggle: daily/weekly/all)
 *   3. Achievements — badge grid (unlocked + locked)
 *
 * Triggered by clicking the Streak or Level badge in the header.
 */

import { useState, useEffect, useCallback } from 'react';
import { Flame, Trophy, Star, Brain, BookOpen, MessageSquare, Crown, ChevronRight, Loader2, Check } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

interface HubData {
  level: number; total_xp: number; streak: number;
  today_quests: { id: string; title: string; metric: string; target: number; progress: number; completed: boolean; xp_reward: number }[];
  achievements_unlocked: number;
  leaderboard_preview: { rank: number; user_id: string; name: string; avatar: string | null; total_xp: number }[];
}

interface Achievement {
  id: string; category: string; tier: string; title: string; description: string;
  icon_key: string; metric: string; threshold: number; xp_reward: number;
  unlocked: boolean; unlocked_at: string | null;
}

interface LeaderboardEntry {
  rank: number; user_id: string; name: string; avatar: string | null;
  total_xp: number; is_current_user: boolean;
}

const ICON_MAP: Record<string, any> = {
  flame: Flame, trophy: Trophy, star: Star, brain: Brain, book: BookOpen, chat: MessageSquare, crown: Crown,
};

const TIER_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  bronze: { bg: '#fef3c7', border: '#d97706', text: '#92400e' },
  silver: { bg: '#f1f5f9', border: '#64748b', text: '#334155' },
  gold: { bg: '#fef9c3', border: '#ca8a04', text: '#854d0e' },
};

export function GamificationHubModal({ open, onOpenChange }: Props) {
  const [tab, setTab] = useState<'quests' | 'leaderboard' | 'achievements'>('quests');
  const [hub, setHub] = useState<HubData | null>(null);
  const [achievements, setAchievements] = useState<{ total: number; unlocked_count: number; achievements: Achievement[] } | null>(null);
  const [leaderboard, setLeaderboard] = useState<{ period: string; my_rank: number | null; leaderboard: LeaderboardEntry[] } | null>(null);
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'all'>('all');
  const [loading, setLoading] = useState(false);

  const loadHub = useCallback(async () => {
    try {
      const r = await fetch('/api/v1/gamification/hub');
      const d = await r.json();
      setHub(d.data);
    } catch {}
  }, []);

  const loadAchievements = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/v1/gamification/achievements');
      const d = await r.json();
      setAchievements(d.data);
    } catch {} finally { setLoading(false); }
  }, []);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/v1/gamification/leaderboard?period=${period}`);
      const d = await r.json();
      setLeaderboard(d.data);
    } catch {} finally { setLoading(false); }
  }, [period]);

  useEffect(() => {
    if (open) { loadHub(); loadAchievements(); loadLeaderboard(); }
  }, [open, loadHub, loadAchievements, loadLeaderboard]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden" style={{ borderRadius: 24, border: '2px solid var(--border)' }}>
        {/* Header — level + XP + streak summary */}
        <div className="flex items-center gap-4 px-6 pt-6 pb-4" style={{ background: 'var(--bg-accent)' }}>
          <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: 'var(--accent-orange)', color: '#fff' }}>
            <Trophy size={28} />
          </div>
          <div className="flex-1">
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>Level {hub?.level ?? 1}</h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{hub?.total_xp ?? 0} XP total · Streak {hub?.streak ?? 0} hari</p>
          </div>
          {/* XP progress bar */}
          <div className="flex-1 max-w-[200px]">
            <div className="h-2 w-full rounded-full" style={{ background: 'var(--bg-surface)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${((hub?.total_xp ?? 0) % 100)}%`, background: 'var(--accent-orange)' }} />
            </div>
            <p className="mt-1 text-xs text-center" style={{ color: 'var(--text-muted)' }}>{100 - ((hub?.total_xp ?? 0) % 100)} XP ke level berikutnya</p>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 px-6 pt-3" style={{ background: 'var(--bg-primary)' }}>
          {([['quests', 'Quest Harian'], ['leaderboard', 'Leaderboard'], ['achievements', 'Achievements']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className="rounded-full px-4 py-2 text-sm font-semibold transition-colors" style={{
              background: tab === id ? 'var(--accent-orange)' : 'var(--bg-surface)',
              color: tab === id ? '#fff' : 'var(--text-muted)',
              borderRadius: '9999px',
            }}>{label}</button>
          ))}
        </div>

        {/* Tab content */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto" style={{ background: 'var(--bg-primary)' }}>
          {loading && <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent-orange)' }} /></div>}

          {/* QUESTS TAB */}
          {tab === 'quests' && !loading && hub && (
            <div className="space-y-3">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Quest hari ini · reset tiap malam</p>
              {hub.today_quests.length === 0 ? (
                <p className="text-sm text-muted">Belum ada quest. Kembali besok!</p>
              ) : hub.today_quests.map(q => (
                <div key={q.id} className="flex items-center gap-3 rounded-2xl p-3" style={{ border: '2px solid var(--border)', borderRadius: '16px', background: q.completed ? 'var(--bg-accent)' : 'var(--bg-primary)' }}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: q.completed ? 'var(--accent-green)' : 'var(--bg-surface)', color: q.completed ? '#fff' : 'var(--text-muted)' }}>
                    {q.completed ? <Check size={18} /> : (ICON_MAP[q.metric]?.[0] ? <Star size={18} /> : <Star size={18} />)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{q.title}</p>
                    <div className="mt-1 h-1.5 w-full rounded-full" style={{ background: 'var(--bg-surface)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (q.progress / q.target) * 100)}%`, background: q.completed ? 'var(--accent-green)' : 'var(--accent-orange)' }} />
                    </div>
                    <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{q.progress} / {q.target} · +{q.xp_reward} XP</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* LEADERBOARD TAB */}
          {tab === 'leaderboard' && !loading && leaderboard && (
            <div>
              {/* Period toggle */}
              <div className="mb-3 flex gap-1.5">
                {([['daily', 'Harian'], ['weekly', 'Mingguan'], ['all', 'Sepanjang Waktu']] as const).map(([id, label]) => (
                  <button key={id} onClick={() => setPeriod(id)} className="rounded-full px-3 py-1.5 text-xs font-semibold transition-colors" style={{
                    background: period === id ? 'var(--accent-orange)' : 'var(--bg-surface)',
                    color: period === id ? '#fff' : 'var(--text-muted)',
                    borderRadius: '9999px',
                  }}>{label}</button>
                ))}
              </div>
              {leaderboard.leaderboard.length === 0 ? (
                <p className="text-sm text-muted text-center py-8">Belum ada yang punya XP periode ini.</p>
              ) : (
                <div className="space-y-2">
                  {leaderboard.leaderboard.map((e) => (
                    <div key={e.user_id} className="flex items-center gap-3 rounded-xl p-2.5" style={{
                      background: e.is_current_user ? 'var(--bg-accent)' : 'var(--bg-surface)',
                      borderRadius: '12px',
                      border: e.is_current_user ? '2px solid var(--accent-orange)' : 'none',
                    }}>
                      <span className="w-7 text-center text-sm font-bold" style={{ color: e.rank <= 3 ? 'var(--accent-orange)' : 'var(--text-muted)' }}>#{e.rank}</span>
                      <div className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold" style={{ background: e.rank === 1 ? '#fef9c3' : e.rank === 2 ? '#f1f5f9' : e.rank === 3 ? '#fef3c7' : 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                        {e.name?.[0] || 'B'}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{e.is_current_user ? 'Kamu' : e.name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{e.total_xp} XP</p>
                      </div>
                      {e.rank <= 3 && <Crown size={16} style={{ color: e.rank === 1 ? '#ca8a04' : 'var(--text-muted)' }} />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ACHIEVEMENTS TAB */}
          {tab === 'achievements' && !loading && achievements && (
            <div>
              <p className="mb-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{achievements.unlocked_count} / {achievements.total} badge terbuka</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {achievements.achievements.map(a => {
                  const Icon = ICON_MAP[a.icon_key] || Star;
                  const tier = TIER_COLORS[a.tier] || TIER_COLORS.bronze;
                  return (
                    <div key={a.id} className="flex flex-col items-center gap-2 rounded-2xl p-3 text-center" style={{
                      border: `2px solid ${a.unlocked ? tier.border : 'var(--border)'}`,
                      borderRadius: '16px',
                      background: a.unlocked ? tier.bg : 'var(--bg-surface)',
                      opacity: a.unlocked ? 1 : 0.5,
                    }}>
                      <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{
                        background: a.unlocked ? tier.border : 'var(--bg-primary)',
                        color: a.unlocked ? '#fff' : 'var(--text-muted)',
                      }}>
                        {a.unlocked ? <Icon size={22} /> : <Icon size={22} />}
                      </div>
                      <p className="text-xs font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>{a.title}</p>
                      <p className="text-[10px] leading-tight" style={{ color: 'var(--text-muted)' }}>{a.description}</p>
                      {a.xp_reward > 0 && <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'var(--bg-primary)', color: 'var(--accent-orange)' }}>+{a.xp_reward} XP</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
