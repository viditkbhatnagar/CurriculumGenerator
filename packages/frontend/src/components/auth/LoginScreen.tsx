'use client';

import { useState } from 'react';
import { useAuth } from './AuthContext';

/**
 * Email + password login form. Posts to /api/auth/login (handled by
 * passwordAuthService on the backend), stores the JWT, and the AuthContext
 * picks up the new state.
 */
export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
      // AuthContext flips isAuthenticated → AuthGate re-renders to children
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401) {
        setError('Invalid email or password.');
      } else {
        setError(err?.response?.data?.error?.message || err?.message || 'Sign-in failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-teal-50 via-white to-sage-50">
      <form
        onSubmit={handleSubmit}
        className="max-w-md w-full bg-white rounded-2xl border border-teal-200 shadow-sm p-8 space-y-5"
      >
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold text-teal-800">Curriculum Generator</h1>
          <p className="text-sm text-teal-600">Sign in to access your programmes.</p>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-teal-700">Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-teal-50/50 border border-teal-300 rounded-lg text-sm text-teal-800 focus:outline-none focus:border-teal-500"
              placeholder="you@university.edu"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-teal-700">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-teal-50/50 border border-teal-300 rounded-lg text-sm text-teal-800 focus:outline-none focus:border-teal-500"
              placeholder="••••••••"
            />
          </label>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-600 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !email.trim() || !password.trim()}
          className="w-full px-4 py-3 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl font-semibold shadow-sm"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="text-xs text-teal-500 leading-relaxed text-center">
          Faculty: your administrator will email you a temporary password. If you don't have one
          yet, contact them.
        </p>
      </form>
    </div>
  );
}
