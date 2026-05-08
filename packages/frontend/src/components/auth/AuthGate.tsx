'use client';

import { useAuth0 } from '@auth0/auth0-react';
import { isAuth0Enabled } from './Auth0ProviderWrapper';
import LoginScreen from './LoginScreen';

/**
 * When Auth0 is configured, this wraps protected pages and:
 *   - Shows a loading state during the initial Auth0 hydration
 *   - Shows the LoginScreen if the user isn't authenticated
 *   - Renders children only once authenticated
 *
 * When Auth0 is NOT configured (env vars unset), it renders children directly.
 * This preserves the existing dev / mock-admin path so curl + Playwright keep
 * working without Auth0 set up.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  if (!isAuth0Enabled()) {
    return <>{children}</>;
  }
  return <Inner>{children}</Inner>;
}

function Inner({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, error } = useAuth0();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 via-white to-sage-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-teal-600">Checking your session…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-teal-50 via-white to-sage-50">
        <div className="max-w-md bg-white rounded-xl border border-red-200 p-6 text-center">
          <h1 className="text-lg font-semibold text-red-700 mb-2">Sign-in error</h1>
          <p className="text-sm text-red-600 mb-4">{error.message}</p>
          <a
            href="/"
            className="inline-block px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-medium"
          >
            Try again
          </a>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <>{children}</>;
}
