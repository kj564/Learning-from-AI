'use client';

/**
 * ComposerAttachmentsBar — row of attachment thumbnails shown above the
 * composer's textarea when there are pending attachments.
 */

import { X, FileText, Music } from 'lucide-react';
import { useStore } from '@/lib/store';

export default function ComposerAttachmentsBar() {
  const attachments = useStore((s) => s.composerAttachments);
  const removeAttachment = useStore((s) => s.removeAttachment);

  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-3 pt-3">
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
              {a.kind === 'audio' ? <Music size={16} /> : <FileText size={16} />}
              <span className="truncate text-[10px]">{a.name}</span>
            </div>
          )}
          <button
            onClick={() => removeAttachment(a.id)}
            aria-label={`Remove ${a.name}`}
            className="bg-surface-overlay/80 text-text-inverted absolute end-0.5 top-0.5 rounded-full p-0.5 opacity-0 transition group-hover:opacity-100"
          >
            <X size={10} />
          </button>
        </div>
      ))}
    </div>
  );
}
