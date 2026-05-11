'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';

export interface AuthUser {
  id: string;
  email: string;
  role: 'administrator' | 'faculty' | 'sme' | 'student';
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  /** True the moment we have a token AND have validated it via /me. */
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** Force-refetch the current user (used after profile changes). */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'auth_token';

function readToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = readToken();
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const resp = await api.get('/api/auth/me');
      // /me returns { user: { id, email, role } }
      const data = resp.data?.user || resp.data?.data?.user;
      if (data?.id) {
        setUser({ id: data.id, email: data.email, role: data.role });
      } else {
        // Token present but no user — clear it
        writeToken(null);
        setUser(null);
      }
    } catch (err: any) {
      // 401 → token invalid/expired. Clear and treat as unauthenticated.
      if (err?.response?.status === 401) {
        writeToken(null);
        setUser(null);
      } else {
        // Transient — leave user as-is (don't kick them out for a network blip)
        console.warn('[AuthContext] /me failed', err?.message);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const resp = await api.post('/api/auth/login', { email, password });
    const token: string | undefined = resp.data?.token;
    const userData = resp.data?.user;
    if (!token || !userData?.id) {
      throw new Error('Login response missing token or user');
    }
    writeToken(token);
    setUser({ id: userData.id, email: userData.email, role: userData.role });
    // Don't do window.location.href here — that triggers a full reload and
    // the AuthGate briefly renders its loading state, which the user sees
    // as a flash. Setting the user state alone is enough: AuthGate
    // re-renders synchronously and swaps LoginScreen for the page.
    // The page-level redirect (e.g. on /) handles the rest via router.
  }, []);

  const logout = useCallback(() => {
    writeToken(null);
    setUser(null);
    // Hard-refresh to drop any in-flight queries / cached state
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      logout,
      refresh,
    }),
    [user, isLoading, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
