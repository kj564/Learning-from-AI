'use client';

/**
 * PlusMenu — popover menu for the composer's "+" button.
 *
 * Items:
 *   - Upload file (file picker → /api/files/upload → text/image attachment)
 *   - Generate image… (opens ImageGenDialog)
 *   - Search the web (toggle)
 */

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, FileUp, Sparkles, Globe } from 'lucide-react';
import { useStore } from '@/lib/store';
import { toast } from 'sonner';

interface PlusMenuProps {
  onGenerateImage?: () => void;
}

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB for direct image attachments

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function PlusMenu({ onGenerateImage }: PlusMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [uploading, setUploading] = useState(false);
  const addAttachment = useStore((s) => s.addAttachment);
  const toggleWebSearch = useStore((s) => s.toggleWebSearch);
  const webSearchEnabled = useStore((s) => s.webSearchEnabled);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPosition({ top: rect.top - 8, left: rect.left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-plus-menu]') || target.closest('[data-plus-trigger]')) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        // Images < 4MB → data URL attachment directly (for vision).
        if (file.type.startsWith('image/') && file.size < MAX_IMAGE_BYTES) {
          const dataUrl = await readFileAsDataURL(file);
          addAttachment({
            id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            kind: 'image',
            name: file.name,
            mime: file.type,
            size: file.size,
            dataUrl,
          });
        } else {
          // Other files (or large images) → upload to /api/files/upload →
          // returns extracted text or asset URL.
          const formData = new FormData();
          formData.append('file', file);
          const res = await fetch('/api/files/upload', { method: 'POST', body: formData });
          const data = await res.json();
          if (!data.success) {
            toast.error(`Upload failed: ${file.name}`);
            continue;
          }
          const f = data.file;
          if (f.text) {
            // Text/code/PDF → add as text attachment (content will be in context)
            addAttachment({
              id: f.id,
              kind: 'file',
              name: file.name,
              mime: f.mime,
              size: f.size,
              url: undefined,
              dataUrl: undefined,
            });
            // Store extracted text via a side-channel: append to composer text.
            const current = useStore.getState().composerText;
            const truncated = f.text.slice(0, 8000);
            useStore.getState().setComposerText(
              (current ? current + '\n\n' : '') + `[Attached file: ${file.name}]\n\`\`\`\n${truncated}\n\`\`\`\n`
            );
          } else if (f.image && f.assetUrl) {
            // Image saved as asset → add as image attachment with URL.
            addAttachment({
              id: f.id,
              kind: 'image',
              name: file.name,
              mime: f.mime,
              size: f.size,
              url: f.assetUrl,
            });
          } else if (f.assetUrl) {
            addAttachment({
              id: f.id,
              kind: 'file',
              name: file.name,
              mime: f.mime,
              size: f.size,
              url: f.assetUrl,
            });
          }
        }
      } catch (e) {
        toast.error(`Upload failed: ${file.name}`, { description: e instanceof Error ? e.message : String(e) });
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    setUploading(false);
    setOpen(false);
  };

  const menu = open ? (
    <div
      data-plus-menu
      className="bg-surface-popover border-border-light text-text-primary fixed z-[100] w-56 overflow-hidden rounded-xl border shadow-2xl"
      style={{ top: position.top, left: position.left, transform: 'translateY(-100%)' }}
    >
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="hover:bg-surface-hover flex w-full items-center gap-2 px-3 py-2 text-start text-sm disabled:opacity-50"
      >
        <FileUp size={14} className="text-status-info" /> {uploading ? 'Uploading…' : 'Upload file'}
      </button>
      <button
        onClick={() => { onGenerateImage?.(); setOpen(false); }}
        className="hover:bg-surface-hover flex w-full items-center gap-2 px-3 py-2 text-start text-sm"
      >
        <Sparkles size={14} className="text-accent-primary" /> Generate image…
      </button>
      <button
        onClick={() => toggleWebSearch()}
        className="hover:bg-surface-hover flex w-full items-center gap-2 px-3 py-2 text-start text-sm"
      >
        <Globe size={14} className={webSearchEnabled ? 'text-accent-primary' : 'text-text-secondary'} />
        <span className="flex-1">Search web</span>
        <span className={`size-2 rounded-full ${webSearchEnabled ? 'bg-accent-primary' : 'bg-surface-active'}`} />
      </button>
    </div>
  ) : null;

  return (
    <div className="relative shrink-0">
      <button
        ref={btnRef}
        data-plus-trigger
        onClick={() => setOpen((v) => !v)}
        aria-label="Add attachment or tool"
        title="Add attachment or tool"
        className="text-text-secondary hover:bg-surface-active hover:text-text-primary flex h-8 w-8 items-center justify-center rounded-lg transition"
      >
        <Plus size={18} className={`transition ${open ? 'rotate-45' : ''}`} />
      </button>

      {typeof document !== 'undefined' && createPortal(menu, document.body)}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileUpload}
      />
    </div>
  );
}
