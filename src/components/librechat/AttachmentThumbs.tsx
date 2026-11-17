'use client';

/**
 * AttachmentThumbs — small thumbnail strip shown above a message bubble.
 * Used for user messages with image/file/audio attachments.
 */

import { FileText, X } from 'lucide-react';
import type { Attachment } from '@/lib/store';

interface AttachmentThumbsProps {
  attachments: Attachment[];
  onRemove?: (id: string) => void;
}

export default function AttachmentThumbs({ attachments, onRemove }: AttachmentThumbsProps) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {attachments.map((a) => (
        <div
          key={a.id}
          className="border-border-light bg-surface-search group relative overflow-hidden rounded-lg border"
        >
          {a.kind === 'image' && a.dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.dataUrl} alt={a.name} className="size-16 object-cover" />
          ) : (
            <div className="bg-surface-tertiary text-text-secondary flex size-16 flex-col items-center justify-center gap-1 p-1">
              <FileText size={16} />
              <span className="truncate text-[10px]">{a.name}</span>
            </div>
          )}
          {onRemove && (
            <button
              onClick={() => onRemove(a.id)}
              aria-label={`Remove ${a.name}`}
              className="bg-surface-overlay/80 text-text-inverted absolute end-0.5 top-0.5 rounded-full p-0.5 opacity-0 transition group-hover:opacity-100"
            >
              <X size={10} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
