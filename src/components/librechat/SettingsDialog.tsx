'use client';

/**
 * SettingsDialog — chat.z.ai-style settings dialog.
 *
 * Tabs:
 *   - Appearance: theme (light/dark/system), UI density
 *   - Models: default model picker
 *   - Behavior: web search default, thinking default, enter-to-send
 *
 * Uses shadcn Dialog + Tabs primitives.
 */

import { useState } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon, Monitor, Sparkles, Zap, Brain, Settings as SettingsIcon, Globe, Star } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { useStore } from '@/lib/store';
import { toast } from 'sonner';

const MODELS = [
  { id: 'glm-5.3', name: 'GLM-5.3', desc: 'Most advanced — flagship model', icon: Star },
  { id: 'glm-5.3-flash', name: 'GLM-5.3-Flash', desc: 'Fast & free — no daily limit', icon: Zap },
  { id: 'glm-4.7', name: 'GLM-4.7', desc: 'Previous flagship — solid all-rounder', icon: Sparkles },
  { id: 'glm-4.6', name: 'GLM-4.6', desc: 'Coding & agentic specialist', icon: Brain },
  { id: 'glm-4.5v', name: 'GLM-4.5V', desc: 'Vision model — image understanding', icon: Sparkles },
  { id: 'glm-4-plus', name: 'GLM-4-Plus', desc: 'Balanced quality and speed', icon: Sparkles },
  { id: 'glm-4-flash', name: 'GLM-4-Flash', desc: 'Fast responses, lighter model', icon: Zap },
] as const;

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { theme, setTheme } = useTheme();
  const [tab, setTab] = useState<'appearance' | 'models' | 'behavior'>('appearance');
  const selectedModel = useStore((s) => s.selectedModel) as string;
  const setSelectedModel = useStore((s) => s.setSelectedModel);
  const webSearchEnabled = useStore((s) => s.webSearchEnabled);
  const toggleWebSearch = useStore((s) => s.toggleWebSearch);
  const thinkEnabled = useStore((s) => s.thinkEnabled);
  const toggleThink = useStore((s) => s.toggleThink);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface-popover border-border-light text-text-primary sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SettingsIcon size={16} /> Settings
          </DialogTitle>
          <DialogDescription className="text-text-tertiary">
            Customize your chat experience.
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="border-border-light flex gap-1 border-b pb-2">
          {(['appearance', 'models', 'behavior'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition ${
                tab === t ? 'bg-surface-active-alt text-text-primary' : 'text-text-secondary hover:bg-surface-hover'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="min-h-[200px] py-2">
          {tab === 'appearance' && (
            <div className="space-y-3">
              <div>
                <label className="text-text-tertiary mb-1.5 block text-xs font-medium uppercase tracking-wide">Theme</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'light', label: 'Light', icon: Sun },
                    { id: 'dark', label: 'Dark', icon: Moon },
                    { id: 'system', label: 'System', icon: Monitor },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => { setTheme(t.id); toast.success(`Theme: ${t.label}`); }}
                      className={`flex flex-col items-center gap-1.5 rounded-lg border p-3 transition ${
                        theme === t.id
                          ? 'border-accent-primary bg-accent-primary/10 text-accent-primary'
                          : 'border-border-light text-text-secondary hover:bg-surface-hover'
                      }`}
                    >
                      <t.icon size={18} />
                      <span className="text-xs font-medium">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === 'models' && (
            <div className="space-y-2">
              <label className="text-text-tertiary mb-1.5 block text-xs font-medium uppercase tracking-wide">Default model</label>
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { setSelectedModel(m.id as any); toast.success(`Default model: ${m.name}`); }}
                  className={`flex w-full items-start gap-3 rounded-lg border p-3 text-start transition ${
                    selectedModel === m.id
                      ? 'border-accent-primary bg-accent-primary/10'
                      : 'border-border-light hover:bg-surface-hover'
                  }`}
                >
                  <m.icon size={16} className="text-accent-primary mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-text-primary text-sm font-medium">{m.name}</div>
                    <div className="text-text-tertiary text-xs">{m.desc}</div>
                  </div>
                  {selectedModel === m.id && <span className="text-accent-primary text-xs font-semibold">Default</span>}
                </button>
              ))}
            </div>
          )}

          {tab === 'behavior' && (
            <div className="space-y-3">
              <Toggle
                label="Web search by default"
                desc="Auto-enable web search when starting a new chat"
                checked={webSearchEnabled}
                onChange={toggleWebSearch}
                icon={Globe}
              />
              <Toggle
                label="Thinking mode by default"
                desc="Enable reasoning mode for thoughtful answers (slower)"
                checked={thinkEnabled}
                onChange={toggleThink}
                icon={Brain}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Toggle({ label, desc, checked, onChange, icon: Icon }: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: () => void;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="border-border-light flex items-center justify-between rounded-lg border p-3">
      <div className="flex items-start gap-2.5">
        <Icon size={16} className="text-accent-primary mt-0.5 shrink-0" />
        <div>
          <div className="text-text-primary text-sm font-medium">{label}</div>
          <div className="text-text-tertiary text-xs">{desc}</div>
        </div>
      </div>
      <button
        onClick={onChange}
        role="switch"
        aria-checked={checked}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? 'bg-accent-primary' : 'bg-surface-active'
        }`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white transition ${
            checked ? 'left-5' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}
