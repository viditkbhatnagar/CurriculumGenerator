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

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={cn(
        "w-14 h-8 rounded-full bg-teal-200 animate-pulse",
        className
      )} />
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "relative inline-flex items-center justify-center",
        "w-14 h-8 rounded-full",
        "transition-all duration-300",
        theme === 'dark' 
          ? "bg-teal-700 hover:bg-teal-600" 
          : "bg-teal-100 hover:bg-teal-200",
        "border",
        theme === 'dark'
          ? "border-teal-600"
          : "border-teal-200",
        className
      )}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {/* Toggle knob */}
      <span
        className={cn(
          "absolute w-6 h-6 rounded-full",
          "flex items-center justify-center",
          "transition-all duration-300 ease-in-out",
          "shadow-md",
          theme === 'dark'
            ? "translate-x-3 bg-teal-900"
            : "-translate-x-3 bg-white"
        )}
      >
        {theme === 'dark' ? (
          <Moon className="w-3.5 h-3.5 text-teal-200" />
        ) : (
          <Sun className="w-3.5 h-3.5 text-amber-500" />
        )}
      </span>
      
      {/* Background icons */}
      <Sun className={cn(
        "absolute left-1.5 w-3 h-3 transition-opacity duration-300",
        theme === 'dark' ? "opacity-30 text-teal-400" : "opacity-0"
      )} />
      <Moon className={cn(
        "absolute right-1.5 w-3 h-3 transition-opacity duration-300",
        theme === 'dark' ? "opacity-0" : "opacity-30 text-teal-400"
      )} />
    </button>
  );
}
