'use client';

import { useState } from 'react';
import { useAuth } from './AuthContext';

/**
 * Top-right user widget: avatar + email + sign out. Powered by AuthContext
 * (our built-in JWT auth). Renders nothing if no user is authenticated.
 */
export default function UserMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const initials = (user.email || 'U')
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');

  const roleLabel =
    user.role === 'administrator'
      ? 'Administrator'
      : user.role === 'faculty'
        ? 'Faculty'
        : user.role;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-teal-50 border border-transparent hover:border-teal-200 transition-colors"
        title={user.email}
      >
        <span className="w-7 h-7 rounded-full bg-teal-500 text-white text-xs font-semibold flex items-center justify-center">
          {initials || 'U'}
        </span>
        <span className="hidden sm:block text-sm text-teal-700 max-w-[180px] truncate">
          {user.email}
        </span>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-60 bg-white border border-teal-200 rounded-xl shadow-lg z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-teal-100">
              <p className="text-xs text-teal-500">Signed in as</p>
              <p className="text-sm text-teal-800 truncate">{user.email}</p>
              <p className="text-xs text-teal-600 mt-0.5">{roleLabel}</p>
            </div>
            {user.role === 'administrator' && (
              <a
                href="/admin/faculty"
                className="block px-3 py-2 text-sm text-teal-700 hover:bg-teal-50"
              >
                Faculty management
              </a>
            )}
            <button
              onClick={() => {
                setOpen(false);
                logout();
              }}
              className="w-full text-left px-3 py-2 text-sm text-teal-700 hover:bg-teal-50 border-t border-teal-100"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
