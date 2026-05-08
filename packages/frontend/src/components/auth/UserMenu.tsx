'use client';

import { useAuth0 } from '@auth0/auth0-react';
import { useState } from 'react';
import { isAuth0Enabled } from './Auth0ProviderWrapper';

/**
 * Compact user widget for the top-right of the workflow header. Shows the
 * signed-in user's email with a dropdown for logout. Renders nothing when
 * Auth0 is not configured (so the existing layout stays clean in dev).
 */
export default function UserMenu() {
  if (!isAuth0Enabled()) return null;
  return <Inner />;
}

function Inner() {
  const { user, logout, isAuthenticated } = useAuth0();
  const [open, setOpen] = useState(false);

  if (!isAuthenticated || !user) return null;

  const initials = (user.name || user.email || 'U')
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-teal-50 border border-transparent hover:border-teal-200 transition-colors"
        title={user.email || ''}
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
          {/* Click-away catcher */}
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-56 bg-white border border-teal-200 rounded-xl shadow-lg z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-teal-100">
              <p className="text-xs text-teal-500">Signed in as</p>
              <p className="text-sm text-teal-800 truncate">{user.email}</p>
            </div>
            <button
              onClick={() => {
                try {
                  localStorage.removeItem('auth_token');
                } catch {
                  // ignore
                }
                logout({ logoutParams: { returnTo: window.location.origin } });
              }}
              className="w-full text-left px-3 py-2 text-sm text-teal-700 hover:bg-teal-50"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
