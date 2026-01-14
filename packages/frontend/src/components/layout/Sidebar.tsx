'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUIStore } from '@/stores/uiStore';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  { name: '9-Step Workflow', href: '/workflow', icon: '🚀', highlight: true },
  { name: 'Programs', href: '/admin/programs', icon: '📚' },
  { name: 'Knowledge Base', href: '/admin/knowledge-base', icon: '🔍' },
  { name: 'Analytics', href: '/admin/analytics', icon: '📈' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen } = useUIStore();

  if (!sidebarOpen) return null;

  return (
    <aside className="w-64 bg-gradient-to-b from-teal-700 to-teal-800 text-white min-h-screen fixed left-0 top-0 z-40">
      <div className="p-6">
        <h1 className="text-xl font-bold text-teal-50">AGCQ Admin</h1>
      </div>
      <nav className="mt-6">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
          const isHighlight = (item as any).highlight;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center px-6 py-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-teal-600/50 text-white border-l-4 border-teal-300'
                  : isHighlight
                    ? 'text-teal-200 hover:bg-teal-600/30 hover:text-white border-l-4 border-transparent'
                    : 'text-teal-100 hover:bg-teal-600/30 hover:text-white'
              }`}
            >
              <span className="mr-3 text-lg">{item.icon}</span>
              {item.name}
              {isHighlight && !isActive && (
                <span className="ml-auto text-xs bg-teal-400/30 text-teal-200 px-2 py-0.5 rounded">
                  NEW
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
