'use client';

/**
 * Theme toggle for LibreChat-style dark/light/system switching.
 * Mounted in the icon rail at the bottom, and in mobile overflow menus.
 */

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';

export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    // Render a placeholder to avoid hydration mismatch
    return <div className="h-9 w-9" />;
  }

  const cycle = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const Icon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;
  const label = theme === 'system' ? 'System' : theme === 'dark' ? 'Dark' : 'Light';

  if (compact) {
    return (
      <button
        onClick={cycle}
        title={`Theme: ${label}`}
        className="text-text-secondary hover:bg-surface-nav-hover hover:text-text-primary flex h-9 w-9 items-center justify-center rounded-lg transition"
      >
        <Icon size={18} />
      </button>
    );
  }

  return (
    <button
      onClick={cycle}
      className="text-text-secondary hover:bg-surface-nav-hover hover:text-text-primary flex h-9 w-9 items-center justify-center rounded-lg transition"
      title={`Theme: ${label}`}
    >
      <Icon size={18} />
    </button>
  );
}
