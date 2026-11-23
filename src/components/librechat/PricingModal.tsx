'use client';

/**
 * PricingModal — 1:1 rebuild of pelajarin.ai/pricing, adapted for Bimo.
 *
 * RE source: docs/pelajarin-recon/capture/marketing/pricing.html +
 * RECON-DEEP-v5 §2. Pelajarin's pricing page has two plans (Free, Pro)
 * with neo-brutalist cards (border-2 + 4px shadow), Quicksand 48px prices,
 * Caveat cursive "selamanya" accent, dashed border feature list.
 *
 * Bimo differences (per PRODUCT.md):
 *   - Pro = Rp20.000/bulan (vs pelajarin Rp30.000) — 33% cheaper
 *   - Free = 15 catatan + 50 chat (vs pelajarin 1 catatan + 0 chat)
 *
 * Triggered from the "Upgrade" pill in the header.
 */

import { useState } from 'react';
import { Check, X, Sparkles, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const FREE_FEATURES = [
  '15 catatan per bulan',
  'Flashcards & Quiz unlimited',
  '50 chat AI per bulan',
  'Video & audio processing terbatas',
  'Basic support',
];

const PRO_FEATURES = [
  'Unlimited catatan',
  'Flashcards & Quiz unlimited',
  'Unlimited chat AI',
  'Unlimited video & audio processing',
  'Priority support tertinggi',
  'Mindmap + Podcast generation',
  'Streak repair + daily goal',
  'Affiliate program (20%)',
];

export function PricingModal({ open, onOpenChange }: Props) {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly');

  function handleChoosePlan(plan: 'free' | 'pro') {
    if (plan === 'free') {
      toast.success('Kamu sudah di plan Free. Upgrade ke Pro untuk fitur unlimited.');
      onOpenChange(false);
    } else {
      toast.info('Checkout Pro coming soon. Hubungi kami di hello@bimo.ai untuk early-bird.');
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden" style={{ borderRadius: 24, border: '2px solid var(--border)' }}>
        <DialogHeader className="sr-only">
          <DialogTitle>Harga & Paket Berlangganan Bimo</DialogTitle>
          <DialogDescription>Pilih plan yang tepat untukmu</DialogDescription>
        </DialogHeader>

        {/* Header — captured: "Pilih Plan yang Tepat" */}
        <div className="flex flex-col items-center gap-5 pt-12 px-8" style={{ background: 'var(--bg-primary)' }}>
          <h2 className="text-center" style={{ fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 700, color: 'var(--text-primary)' }}>Pilih Plan yang Tepat</h2>
          {/* Billing toggle — monthly / yearly (save 33%) */}
          <div className="inline-flex items-center gap-1 rounded-full p-1" style={{ background: 'var(--bg-surface)', borderRadius: '9999px' }}>
            <button onClick={() => setBilling('monthly')} className="font-semibold transition-colors" style={{ padding: '8px 20px', borderRadius: '9999px', fontSize: 14, fontWeight: 600, background: billing === 'monthly' ? 'var(--bg-primary)' : 'transparent', color: billing === 'monthly' ? 'var(--accent-orange)' : 'var(--text-muted)', boxShadow: billing === 'monthly' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>Bulanan</button>
            <button onClick={() => setBilling('yearly')} className="font-semibold transition-colors" style={{ padding: '8px 20px', borderRadius: '9999px', fontSize: 14, fontWeight: 600, background: billing === 'yearly' ? 'var(--bg-primary)' : 'transparent', color: billing === 'yearly' ? 'var(--accent-orange)' : 'var(--text-muted)', boxShadow: billing === 'yearly' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none' }}>Tahunan <span style={{ color: 'var(--accent-green)' }}>−33%</span></button>
          </div>
        </div>

        {/* Plan cards — captured: flex justify-center gap-[32px] */}
        <div className="flex flex-col md:flex-row justify-center gap-8 px-8 pb-12" style={{ background: 'var(--bg-primary)' }}>
          {/* FREE plan */}
          <div className="flex flex-col gap-3 flex-1 max-w-sm">
            <div className="flex flex-col gap-1.5">
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 700, color: 'var(--text-primary)' }}>Free</h3>
              <p style={{ fontSize: 15, color: 'var(--text-muted)' }}>Cocok untuk belajar dasar</p>
            </div>
            <div className="flex items-baseline gap-2">
              <strong style={{ fontFamily: 'var(--font-heading)', fontSize: 48, lineHeight: '56px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>Gratis</strong>
              <span style={{ fontFamily: 'var(--font-accent)', fontSize: 22, fontWeight: 600, color: 'var(--text-muted)' }}>selamanya</span>
            </div>
            <button onClick={() => handleChoosePlan('free')} className="flex justify-center items-center gap-2 font-medium transition-transform hover:-translate-y-0.5 active:translate-y-0.5" style={{ padding: '14px 20px', borderRadius: 14, background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 16, border: '2px solid var(--text-primary)', boxShadow: '0 4px 0 var(--text-primary)' }}>
              Mulai Gratis <ArrowRight size={18} />
            </button>
            <ul className="flex flex-col gap-3 pt-2" style={{ borderTop: '1.5px dashed var(--border)' }}>
              {FREE_FEATURES.map((f, i) => (
                <li key={i} className="flex items-center gap-3" style={{ fontSize: 15, lineHeight: '22px', color: 'var(--text-primary)' }}>
                  <Check size={18} className="shrink-0" style={{ color: 'var(--accent-green)' }} /> {f}
                </li>
              ))}
            </ul>
          </div>

          {/* PRO plan — highlighted */}
          <div className="flex flex-col gap-3 flex-1 max-w-sm relative" style={{ background: 'var(--bg-accent)', borderRadius: 24, padding: 24, border: '2px solid var(--accent-orange)' }}>
            {/* Popular badge */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full px-3 py-1" style={{ background: 'var(--accent-orange)', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: '9999px' }}>
              <Sparkles size={12} /> POPULAR
            </div>
            <div className="flex flex-col gap-1.5">
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 700, color: 'var(--accent-orange)' }}>Pro</h3>
              <p style={{ fontSize: 15, color: 'var(--text-muted)' }}>Untuk siswa yang serius</p>
            </div>
            <div className="flex items-baseline gap-2">
              <strong style={{ fontFamily: 'var(--font-heading)', fontSize: 48, lineHeight: '56px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>Rp{billing === 'monthly' ? '20.000' : '240.000'}</strong>
              <span style={{ fontSize: 15, color: 'var(--text-muted)' }}>/ {billing === 'monthly' ? 'bulan' : 'tahun'}</span>
            </div>
            {billing === 'yearly' && <p style={{ fontSize: 13, color: 'var(--accent-green)', fontWeight: 600 }}>Hemat 33% vs bulanan</p>}
            {billing === 'monthly' && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>atau Rp240.000 per tahun (hemat 33%)</p>}
            <button onClick={() => handleChoosePlan('pro')} className="flex justify-center items-center gap-2 font-medium transition-transform hover:-translate-y-0.5 active:translate-y-0.5" style={{ padding: '14px 20px', borderRadius: 14, background: 'var(--accent-orange)', color: '#fff', fontSize: 16, border: '2px solid var(--text-primary)', boxShadow: '0 4px 0 var(--text-primary)' }}>
              Upgrade ke Pro <ArrowRight size={18} />
            </button>
            <ul className="flex flex-col gap-3 pt-2" style={{ borderTop: '1.5px dashed var(--accent-orange)' }}>
              {PRO_FEATURES.map((f, i) => (
                <li key={i} className="flex items-center gap-3" style={{ fontSize: 15, lineHeight: '22px', color: 'var(--text-primary)' }}>
                  <Check size={18} className="shrink-0" style={{ color: 'var(--accent-orange)' }} /> {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer — captured: "Butuh bantuan memilih plan?" */}
        <div className="flex flex-col items-center gap-2 py-6 px-8 text-center" style={{ background: 'var(--bg-surface)' }}>
          <p style={{ fontSize: 15, color: 'var(--text-primary)' }}>Butuh bantuan memilih plan? <a href="mailto:hello@bimo.ai" style={{ color: 'var(--accent-orange)', fontWeight: 600 }}>Kontak kami</a></p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Bimo Pro: Rp20.000/bulan — 33% lebih murah dari pelajarin (Rp30.000).</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
