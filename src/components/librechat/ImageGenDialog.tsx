'use client';

/**
 * ImageGenDialog — modal dialog for manual image generation.
 * Also used for the "Edit image" flow (with a source image).
 *
 * Uses shadcn Dialog + select primitives.
 */

import { useState, useEffect } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store';
import { generateImage, type GeneratedImage } from '@/lib/api';
import { toast } from 'sonner';

const SIZES = [
  { label: 'Square (1024×1024)', value: '1024x1024' },
  { label: 'Portrait (768×1344)', value: '768x1344' },
  { label: 'Portrait (864×1152)', value: '864x1152' },
  { label: 'Landscape (1344×768)', value: '1344x768' },
  { label: 'Landscape (1152×864)', value: '1152x864' },
  { label: 'Wide (1440×720)', value: '1440x720' },
  { label: 'Tall (720×1440)', value: '720x1440' },
];

interface ImageGenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPrompt?: string;
  /** Called when the image is generated. Appends a new assistant message with the image. */
  onImageGenerated: (image: GeneratedImage) => void;
}

export default function ImageGenDialog({ open, onOpenChange, initialPrompt, onImageGenerated }: ImageGenDialogProps) {
  const [prompt, setPrompt] = useState(initialPrompt || '');
  const [size, setSize] = useState('1024x1024');
  const [busy, setBusy] = useState(false);
  const activeConversationId = useStore((s) => s.activeConversationId);

  useEffect(() => {
    if (open) setPrompt(initialPrompt || '');
  }, [open, initialPrompt]);

  const handleGenerate = async () => {
    const p = prompt.trim();
    if (!p) return;
    setBusy(true);
    try {
      const img = await generateImage({
        prompt: p,
        size,
        conversationId: activeConversationId || undefined,
      });
      if (img) {
        onImageGenerated(img);
        onOpenChange(false);
        toast.success('Image generated');
      } else {
        toast.error('Image generation failed');
      }
    } catch (e) {
      toast.error('Image generation failed', { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface-popover border-border-light text-text-primary sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={16} className="text-accent-primary" /> Generate image
          </DialogTitle>
          <DialogDescription className="text-text-tertiary">
            Describe what you want to see. The image will be added to the conversation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A serene mountain landscape at sunset, watercolor style…"
            rows={4}
            autoFocus
            className="bg-surface-search border-border-light text-text-primary placeholder:text-text-tertiary w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none"
          />
          <div>
            <label className="text-text-tertiary mb-1 block text-xs font-medium uppercase tracking-wide">
              Size
            </label>
            <select
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className="bg-surface-search border-border-light text-text-primary w-full rounded-lg border px-3 py-2 text-sm outline-none"
            >
              {SIZES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy} className="text-text-secondary">
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={busy || !prompt.trim()}
            className="bg-accent-primary text-text-inverted hover:bg-accent-primary-hover"
          >
            {busy ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Sparkles size={14} className="mr-1" />}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
