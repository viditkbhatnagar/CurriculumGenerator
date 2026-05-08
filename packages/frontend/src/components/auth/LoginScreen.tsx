'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from './AuthContext';

/**
 * Faculty sign-in. Calm, professional, single-card layout — designed for
 * academic users in daytime contexts, not consumer-app urgency.
 *
 * Posts to /api/auth/login via AuthContext. Test contracts kept:
 *   - text "Sign in to access your programmes." is present
 *   - inputs labelled "Email" and "Password"
 *   - submit button labelled "Sign in"
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
    <div className="min-h-screen w-full bg-stone-50 text-stone-900 flex flex-col">
      {/* Quiet, asymmetric top mark — not centered, not loud */}
      <header className="px-6 sm:px-10 py-6 flex items-center gap-2">
        <span
          aria-hidden
          className="inline-block w-2 h-2 rounded-full bg-teal-600 ring-4 ring-teal-100"
        />
        <span className="text-[11px] uppercase tracking-[0.16em] text-stone-500 font-medium">
          AGCQ · Curriculum Generator
        </span>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 pb-16">
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.2, 0.65, 0.3, 1] }}
          className="w-full max-w-[420px] bg-white rounded-2xl border border-stone-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] p-8 sm:p-10 space-y-7"
        >
          <div className="space-y-2">
            <h1 className="font-display text-[28px] leading-[1.1] font-semibold tracking-[-0.02em] text-stone-900">
              Welcome back.
            </h1>
            <p className="text-sm text-stone-600 leading-relaxed">
              Sign in to access your programmes.
            </p>
          </div>

          <div className="space-y-4">
            <Field
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={setEmail}
              placeholder="you@university.edu"
            />
            <Field
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="text-sm text-rose-700 bg-rose-50 border border-rose-200/70 rounded-lg px-3 py-2"
              role="alert"
            >
              {error}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={submitting || !email.trim() || !password.trim()}
            className="w-full inline-flex items-center justify-center h-11 rounded-xl bg-teal-700 hover:bg-teal-800 active:bg-teal-900 disabled:bg-stone-300 disabled:cursor-not-allowed text-white text-sm font-medium tracking-tight transition-colors duration-150"
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                Signing in
              </span>
            ) : (
              'Sign in'
            )}
          </button>

          <p className="text-xs text-stone-500 leading-relaxed pt-1 border-t border-stone-100 -mx-2 sm:-mx-4 px-2 sm:px-4 pt-5">
            Faculty: your administrator will share a temporary password with you. If you don't have
            one, please ask them to add you on the Faculty Management page.
          </p>
        </motion.form>
      </main>
    </div>
  );
}

/**
 * Form field with label-above layout. Generous touch target, subtle focus ring
 * tinted with the brand teal — the only place we use that colour on this screen
 * besides the submit button.
 */
function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  const id = `field-${label.toLowerCase()}`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[12px] font-medium text-stone-700 tracking-tight">
        {label}
      </label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="block w-full h-11 px-3.5 rounded-lg bg-white border border-stone-300 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 transition-[border-color,box-shadow] duration-150"
      />
    </div>
  );
}
