'use client';

import { useAuth } from './AuthContext';
import LoginScreen from './LoginScreen';

/**
 * Wraps protected pages. Renders children only when the user is signed in;
 * otherwise shows the LoginScreen. The auth state lives in AuthContext and
 * is hydrated from localStorage + a /api/auth/me check on mount.
 *
 * Loader is intentionally near-invisible (solid black bg, no copy, tiny
 * cream pulse) — it's only on-screen for milliseconds during the /me check
 * and a colourful spinner just reads as a flash.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#E1E0CC' }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <>{children}</>;
}
