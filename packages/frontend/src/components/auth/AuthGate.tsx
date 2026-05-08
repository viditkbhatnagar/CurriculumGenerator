'use client';

import { useAuth } from './AuthContext';
import LoginScreen from './LoginScreen';

/**
 * Wraps protected pages. Renders children only when the user is signed in;
 * otherwise shows the LoginScreen. The auth state lives in AuthContext and
 * is hydrated from localStorage + a /api/auth/me check on mount.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

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

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <>{children}</>;
}
