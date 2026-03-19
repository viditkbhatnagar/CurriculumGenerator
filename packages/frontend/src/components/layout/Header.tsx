'use client';

import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Menu, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Header() {
  const { toggleSidebar, sidebarOpen } = useUIStore();
  const { user } = useAuthStore();

  return (
    <header className={cn('sticky top-0 z-30 h-16', 'border-b border-border/50', 'glass')}>
      <div className="flex items-center justify-between h-full px-4 lg:px-6">
        {/* Left side */}
        <div className="flex items-center gap-3">
          {!sidebarOpen && (
            <button
              onClick={toggleSidebar}
              className="btn-ghost p-2 rounded-lg"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          {/* Search bar - decorative for now */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background-secondary border border-border/50 text-foreground-muted w-[280px]">
            <Search className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">Search...</span>
            <kbd className="ml-auto text-[10px] font-mono bg-background px-1.5 py-0.5 rounded border border-border">
              /
            </kbd>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <ThemeToggle />

          {user && (
            <div className="flex items-center gap-3 pl-3 border-l border-border/50">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-foreground leading-tight">{user.email}</p>
                <p className="text-xs text-foreground-muted capitalize">{user.role}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-sm font-semibold shadow-glow-sm">
                {user.email.charAt(0).toUpperCase()}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
