'use client';

/**
 * CommandPalette — chat.z.ai-style ⌘K command palette.
 *
 * Opens with cmd+k / ctrl+k. Lets the user:
 *   - New chat
 *   - Switch model (submenu)
 *   - Switch assistant (submenu)
 *   - Search conversations (fuzzy by title) → jump to it
 *   - Generate image… (opens ImageGenDialog)
 *   - Toggle theme (light/dark/system)
 *   - Toggle web search
 *   - Toggle sidebar
 *   - Show keyboard shortcuts
 *
 * Uses shadcn's <Command> primitive.
 */

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import {
  Plus, Sparkles, Sun, Moon, Monitor, Globe, PanelLeft, Image as ImageIcon,
  Search, MessageSquare, Bot, Keyboard, ArrowRight,
} from 'lucide-react';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useStore } from '@/lib/store';
import type { AiModelId } from '@/lib/api';
import { toast } from 'sonner';

interface CommandPaletteProps {
  onGenerateImage?: () => void;
  onShowShortcuts?: () => void;
}

const MODELS: { id: AiModelId; name: string; desc: string }[] = [
  { id: 'default', name: 'GLM-4.6', desc: 'Most capable' },
  { id: 'vision', name: 'GLM-4.5V', desc: 'Vision' },
  { id: 'fast', name: 'GLM-4-Flash', desc: 'Fast' },
  { id: 'smart', name: 'GLM-4-Plus', desc: 'Balanced' },
];

export default function CommandPalette({ onGenerateImage, onShowShortcuts }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const newConversation = useStore((s) => s.newConversation);
  const conversations = useStore((s) => s.conversations);
  const setActiveConversation = useStore((s) => s.setActiveConversation);
  const selectedModel = useStore((s) => s.selectedModel);
  const setSelectedModel = useStore((s) => s.setSelectedModel);
  const assistants = useStore((s) => s.assistants);
  const activeAssistantId = useStore((s) => s.activeAssistantId);
  const setActiveAssistant = useStore((s) => s.setActiveAssistant);
  const toggleWebSearch = useStore((s) => s.toggleWebSearch);
  const webSearchEnabled = useStore((s) => s.webSearchEnabled);
  const toggleSidebar = useStore((s) => s.toggleSidebar);
  const isMobile = useStore((s) => s.isMobile);
  const setDrawerOpen = useStore((s) => s.setDrawerOpen);

  // Listen for cmd+k / ctrl+k
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const run = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => run(() => newConversation())}>
            <Plus size={14} className="mr-2" /> New chat
            <kbd className="ml-auto text-xs text-text-tertiary">⌘N</kbd>
          </CommandItem>
          <CommandItem onSelect={() => run(() => onGenerateImage?.())}>
            <ImageIcon size={14} className="mr-2 text-status-info" /> Generate image…
          </CommandItem>
          <CommandItem onSelect={() => run(() => toggleWebSearch())}>
            <Globe size={14} className={`mr-2 ${webSearchEnabled ? 'text-accent-primary' : ''}`} />
            {webSearchEnabled ? 'Disable' : 'Enable'} web search
          </CommandItem>
          <CommandItem onSelect={() => run(() => { if (isMobile) setDrawerOpen(true); else toggleSidebar(); })}>
            <PanelLeft size={14} className="mr-2" /> Toggle sidebar
            <kbd className="ml-auto text-xs text-text-tertiary">⌘B</kbd>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Model">
          {MODELS.map((m) => (
            <CommandItem
              key={m.id}
              onSelect={() => run(() => { setSelectedModel(m.id); toast.success(`Model: ${m.name}`); })}
            >
              <Sparkles size={14} className="mr-2 text-accent-primary" />
              <span className="font-medium">{m.name}</span>
              <span className="text-text-tertiary ml-2 text-xs">{m.desc}</span>
              {selectedModel === m.id && <ArrowRight size={12} className="ml-auto text-accent-primary" />}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Assistant">
          <CommandItem onSelect={() => run(() => setActiveAssistant(null))}>
            <Bot size={14} className="mr-2 text-accent-primary" />
            <span className="font-medium">Default</span>
            {!activeAssistantId && <ArrowRight size={12} className="ml-auto text-accent-primary" />}
          </CommandItem>
          {assistants.map((a) => (
            <CommandItem
              key={a.id}
              onSelect={() => run(() => { setActiveAssistant(a.id); toast.success(`Assistant: ${a.name}`); })}
            >
              <Bot size={14} className="mr-2 text-accent-primary" />
              <span className="font-medium">{a.name}</span>
              <span className="text-text-tertiary ml-2 truncate text-xs">{a.description}</span>
              {activeAssistantId === a.id && <ArrowRight size={12} className="ml-auto text-accent-primary" />}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Theme">
          <CommandItem onSelect={() => run(() => setTheme('light'))}>
            <Sun size={14} className="mr-2 text-status-warning" /> Light
            {theme === 'light' && <ArrowRight size={12} className="ml-auto text-accent-primary" />}
          </CommandItem>
          <CommandItem onSelect={() => run(() => setTheme('dark'))}>
            <Moon size={14} className="mr-2 text-accent-primary" /> Dark
            {theme === 'dark' && <ArrowRight size={12} className="ml-auto text-accent-primary" />}
          </CommandItem>
          <CommandItem onSelect={() => run(() => setTheme('system'))}>
            <Monitor size={14} className="mr-2 text-text-secondary" /> System
            {theme === 'system' && <ArrowRight size={12} className="ml-auto text-accent-primary" />}
          </CommandItem>
        </CommandGroup>

        {conversations.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Conversations">
              {conversations.slice(0, 20).map((c) => (
                <CommandItem
                  key={c.id}
                  onSelect={() => run(() => setActiveConversation(c.id))}
                >
                  <MessageSquare size={14} className="mr-2 text-text-tertiary" />
                  <span className="truncate">{c.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />

        <CommandGroup heading="Help">
          <CommandItem onSelect={() => run(() => onShowShortcuts?.())}>
            <Keyboard size={14} className="mr-2" /> Show keyboard shortcuts
            <kbd className="ml-auto text-xs text-text-tertiary">⌘/</kbd>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
