'use client';

/**
 * ImageLightbox — full-size image viewer (uses shadcn Dialog).
 */

import * as React from 'react';
import { X } from 'lucide-react';
import { useStore } from '@/lib/store';

export default function ImageLightbox() {
  const lightbox = useStore((s) => s.imageLightbox);
  const close = useStore((s) => s.closeImageLightbox);

  if (!lightbox) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4"
      onClick={close}
      role="dialog"
      aria-modal="true"
    >
      <button
        onClick={close}
        aria-label="Close"
        className="text-white/80 hover:text-white absolute end-4 top-4 flex size-10 items-center justify-center rounded-full bg-black/40 hover:bg-black/60"
      >
        <X size={20} />
      </button>
      <div className="flex max-h-full max-w-full flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={lightbox.url}
          alt={lightbox.prompt || ''}
          className="max-h-[85vh] max-w-full rounded-lg object-contain"
        />
        {lightbox.prompt && (
          <div className="text-white/70 text-center text-sm">{lightbox.prompt}</div>
        )}
      </div>
    </div>
  );
}
