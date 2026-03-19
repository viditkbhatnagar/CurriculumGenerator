'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useThemeStore } from '@/stores/themeStore';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useThemeStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className={cn('w-9 h-9 rounded-lg skeleton', className)} />;
  }

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        'relative w-9 h-9 rounded-lg',
        'flex items-center justify-center',
        'transition-all duration-200',
        'bg-background-secondary hover:bg-border/50',
        'border border-border/50 hover:border-border',
        'text-foreground-muted hover:text-foreground',
        'active:scale-95',
        className
      )}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 transition-transform duration-300 rotate-0" />
      ) : (
        <Moon className="w-4 h-4 transition-transform duration-300 rotate-0" />
      )}
    </button>
  );
}
