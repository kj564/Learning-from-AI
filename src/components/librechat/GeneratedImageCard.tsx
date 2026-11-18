'use client';

/**
 * GeneratedImageCard — inline image card for AI-generated images.
 *
 *   - Renders the image with hover overlay showing download/regenerate/open
 *   - While `image.pending`, shows an animated gradient placeholder
 *   - Click opens the ImageLightbox
 */

import { Download, RefreshCw, Maximize2, Image as ImageIcon } from 'lucide-react';
import { useStore } from '@/lib/store';
import type { GeneratedImageRef } from '@/lib/store';

interface GeneratedImageCardProps {
  image: GeneratedImageRef;
  onRegenerate?: (image: GeneratedImageRef) => void;
}

export default function GeneratedImageCard({ image, onRegenerate }: GeneratedImageCardProps) {
  const openLightbox = useStore((s) => s.openImageLightbox);

  const download = async () => {
    try {
      const res = await fetch(image.url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${image.prompt.slice(0, 40).replace(/[^a-z0-9]+/gi, '_') || 'image'}_${image.size}.png`;
      a.click();
      // Defer revoke — some browsers fetch the blob async after click().
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      // ignore
    }
  };

  if (image.pending) {
    return (
      <div className="border-border-light bg-surface-code relative aspect-square w-full max-w-sm overflow-hidden rounded-xl border">
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-surface-active via-surface-tertiary to-surface-active" />
        <div className="text-text-tertiary absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs">
          <ImageIcon size={20} />
          <span>Generating…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="group border-border-light relative w-full max-w-sm overflow-hidden rounded-xl border">
      <button
        onClick={() => openLightbox(image.url, image.prompt)}
        className="block w-full"
        title={image.prompt}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt={image.prompt}
          className="w-full cursor-zoom-in object-cover"
          loading="lazy"
        />
      </button>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
        <div className="flex items-center justify-between gap-1 text-white">
          <span className="truncate text-xs" title={image.prompt}>
            {image.prompt}
          </span>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              onClick={download}
              title="Download"
              className="rounded p-1 hover:bg-white/20"
            >
              <Download size={14} />
            </button>
            {onRegenerate && (
              <button
                onClick={() => onRegenerate(image)}
                title="Regenerate"
                className="rounded p-1 hover:bg-white/20"
              >
                <RefreshCw size={14} />
              </button>
            )}
            <button
              onClick={() => openLightbox(image.url, image.prompt)}
              title="Open full size"
              className="rounded p-1 hover:bg-white/20"
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
