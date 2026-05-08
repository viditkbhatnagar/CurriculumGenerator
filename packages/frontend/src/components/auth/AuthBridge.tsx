'use client';

import { useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { isAuth0Enabled } from './Auth0ProviderWrapper';

/**
 * Bridges the Auth0 SDK to the existing `auth_token` localStorage key that
 * src/lib/api.ts already reads. As soon as the user is authenticated we
 * fetch a fresh access token and store it; on logout we clear it.
 *
 * Mounted once at the app shell level. No-ops when Auth0 isn't configured.
 */
export default function AuthBridge() {
  if (!isAuth0Enabled()) return null;
  return <Inner />;
}

function Inner() {
  const { isAuthenticated, getAccessTokenSilently, isLoading } = useAuth0();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      try {
        localStorage.removeItem('auth_token');
      } catch {
        // ignore
      }
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessTokenSilently();
        if (cancelled) return;
        if (token) localStorage.setItem('auth_token', token);
      } catch (err) {
        console.error('[AuthBridge] failed to fetch access token', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLoading, getAccessTokenSilently]);

  return null;
}
