'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUIStore } from '@/stores/uiStore';
import {
  LayoutDashboard,
  Workflow,
  FolderOpen,
  BookOpen,
  BarChart3,
  ChevronLeft,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Workflows', href: '/workflow', icon: Workflow, highlight: true },
  { name: 'Programs', href: '/admin/programs', icon: FolderOpen },
  { name: 'Knowledge Base', href: '/admin/knowledge-base', icon: BookOpen },
  { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar } = useUIStore();

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen flex flex-col',
        'bg-sidebar-bg border-r border-sidebar-border',
        'transition-all duration-300 ease-in-out',
        sidebarOpen ? 'w-[260px]' : 'w-[68px]'
      )}
    >
      {/* Logo Section */}
      <div
        className={cn(
          'flex items-center h-16 border-b border-sidebar-border px-4',
          sidebarOpen ? 'justify-between' : 'justify-center'
        )}
      >
        {sidebarOpen ? (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-teal-400 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-sidebar-text-active truncate tracking-tight">
                AGCQ
              </h1>
              <p className="text-[10px] text-sidebar-text truncate">Curriculum Generator</p>
            </div>
          </div>
        ) : (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-teal-400 flex items-center justify-center">
            <Sparkles className="w-4.5 h-4.5 text-white" />
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className={cn(
            'p-1.5 rounded-md text-sidebar-text hover:text-sidebar-text-active',
            'hover:bg-sidebar-hover transition-colors',
            !sidebarOpen && 'hidden'
          )}
          aria-label="Collapse sidebar"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto scrollbar-thin">
        {sidebarOpen && (
          <p className="px-3 py-2 text-[10px] font-medium text-sidebar-text/50 uppercase tracking-widest">
            Navigation
          </p>
        )}
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          const Icon = item.icon;
          const isHighlight = (item as any).highlight;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'group flex items-center gap-3 rounded-lg transition-all duration-150 relative',
                sidebarOpen ? 'px-3 py-2.5' : 'px-0 py-2.5 justify-center',
                isActive
                  ? 'bg-sidebar-active text-sidebar-text-active'
                  : 'text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-active'
              )}
              title={!sidebarOpen ? item.name : undefined}
            >
              {/* Active indicator */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-primary rounded-r-full" />
              )}

              <Icon
                className={cn(
                  'flex-shrink-0 transition-colors',
                  sidebarOpen ? 'w-[18px] h-[18px]' : 'w-5 h-5',
                  isActive
                    ? 'text-primary'
                    : 'text-sidebar-text group-hover:text-sidebar-text-active'
                )}
              />

              {sidebarOpen && <span className="text-sm font-medium truncate">{item.name}</span>}

              {sidebarOpen && isHighlight && !isActive && (
                <span className="ml-auto text-[10px] font-medium bg-primary/15 text-primary px-1.5 py-0.5 rounded-md">
                  NEW
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-sidebar-border p-3">
        {sidebarOpen ? (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-sidebar-hover/50">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs text-sidebar-text">System Online</span>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          </div>
        )}
      </div>
    </aside>
  );
}
