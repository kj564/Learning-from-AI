'use client';

/**
 * PlusMenu — popover menu for the composer's "+" button.
 *
 * Uses a React portal to render the menu outside the composer's stacking
 * context, so it always appears above the messages area.
 */

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, ImagePlus, FileUp, Sparkles, Globe } from 'lucide-react';
import { useStore } from '@/lib/store';
import { toast } from 'sonner';

interface PlusMenuProps {
  onGenerateImage?: () => void;
}

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB

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
  const addAttachment = useStore((s) => s.addAttachment);
  const toggleWebSearch = useStore((s) => s.toggleWebSearch);
  const webSearchEnabled = useStore((s) => s.webSearchEnabled);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Compute popover position when opening
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPosition({
      top: rect.top - 8, // 8px gap above the button
      left: rect.left,
    });
  }, [open]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      // Don't close if clicking the menu items (they're portaled, check by data attribute)
      const target = e.target as HTMLElement;
      if (target.closest('[data-plus-menu]') || target.closest('[data-plus-trigger]')) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image`);
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(`${file.name} is too large (max 4MB)`);
        continue;
      }
      const dataUrl = await readFileAsDataURL(file);
      addAttachment({
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        kind: 'image',
        name: file.name,
        mime: file.type,
        size: file.size,
        dataUrl,
      });
    }
    if (imageInputRef.current) imageInputRef.current.value = '';
    setOpen(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      addAttachment({
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        kind: 'file',
        name: file.name,
        mime: file.type,
        size: file.size,
      });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    setOpen(false);
  };

  const menu = open ? (
    <div
      data-plus-menu
      className="bg-surface-popover border-border-light text-text-primary fixed z-[100] w-56 overflow-hidden rounded-xl border shadow-2xl"
      style={{ top: position.top, left: position.left, transform: 'translateY(-100%)' }}
    >
      <button
        onClick={() => imageInputRef.current?.click()}
        className="hover:bg-surface-hover flex w-full items-center gap-2 px-3 py-2 text-start text-sm"
      >
        <ImagePlus size={14} className="text-status-info" /> Upload image
      </button>
      <button
        onClick={() => fileInputRef.current?.click()}
        className="hover:bg-surface-hover flex w-full items-center gap-2 px-3 py-2 text-start text-sm"
      >
        <FileUp size={14} className="text-text-secondary" /> Upload file
      </button>
      <button
        onClick={() => {
          onGenerateImage?.();
          setOpen(false);
        }}
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
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleImageUpload}
      />
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
