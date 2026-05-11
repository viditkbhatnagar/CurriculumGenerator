'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useAuth } from './AuthContext';
import { WordsPullUp } from '@/components/ui/prisma-hero';

/**
 * Faculty sign-in. Cinematic Prisma-style hero with a "Welcome" pull-up
 * word filling the canvas, and a parchment sign-in card floating over the
 * top-right of the gradient. Matches the marketing brand world.
 *
 * Test contracts preserved (used by e2e/tests/auth-admin.spec.ts):
 *   - text "Sign in to access your programmes." is present
 *   - inputs labelled "Email" and "Password"
 *   - submit button text matches /^Sign in$/
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
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any;
      const status = e?.response?.status;
      if (status === 401) {
        setError('Invalid email or password.');
      } else {
        setError(e?.response?.data?.error?.message || e?.message || 'Sign-in failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const submitDisabled = submitting || !email.trim() || !password.trim();

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Jewel-tone gradient mesh — same recipe as the marketing hero */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(at 22% 28%, rgb(76 29 99) 0%, transparent 55%), ' +
            'radial-gradient(at 82% 18%, rgb(11 78 79) 0%, transparent 50%), ' +
            'radial-gradient(at 78% 82%, rgb(120 38 78) 0%, transparent 55%), ' +
            'radial-gradient(at 14% 88%, rgb(8 38 62) 0%, transparent 50%), ' +
            'linear-gradient(135deg, rgb(7 8 24) 0%, rgb(11 13 32) 50%, rgb(6 7 20) 100%)',
        }}
      />
      <motion.div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 60%, rgba(168, 85, 247, 0.18) 0%, transparent 45%)',
        }}
        animate={{ opacity: [0.55, 0.85, 0.55] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="noise-overlay pointer-events-none absolute inset-0 opacity-[0.5] mix-blend-overlay" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/60" />

      {/* Brand mark — top-left, matches hero */}
      <header className="absolute z-20 top-5 left-5 sm:top-8 sm:left-10 flex items-center gap-2">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-md"
          style={{
            background: 'linear-gradient(135deg, #E1E0CC 0%, rgba(225,224,204,0.7) 100%)',
          }}
        >
          <span className="text-[11px] font-bold tracking-tight text-black">A</span>
        </div>
        <span
          className="text-xs font-semibold tracking-[0.25em]"
          style={{ color: 'rgba(225, 224, 204, 0.85)' }}
        >
          AGCQ · CURRICULUM
        </span>
      </header>

      {/* Big pull-up word — bottom-left, Prisma signature */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 px-4 sm:px-6 md:px-10 pb-2">
        <h2
          className="font-display font-medium leading-[0.85] tracking-[-0.07em] text-[24vw] sm:text-[22vw] md:text-[18vw] lg:text-[14vw] xl:text-[13vw]"
          style={{ color: '#E1E0CC', opacity: 0.96 }}
        >
          <WordsPullUp text="Welcome." />
        </h2>
      </div>

      {/* Sign-in card — floats over the gradient */}
      <main className="relative z-10 min-h-screen w-full flex items-center justify-center lg:justify-end px-4 sm:px-8 lg:px-16 py-20">
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="relative w-full max-w-[440px] rounded-3xl p-8 sm:p-9 space-y-6 shadow-[0_30px_60px_rgba(0,0,0,0.45),0_10px_24px_rgba(0,0,0,0.25)]"
          style={{
            background: 'rgba(245, 244, 232, 0.97)',
            border: '1px solid rgba(225, 224, 204, 0.6)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* Iridescent top edge */}
          <div
            aria-hidden
            className="absolute inset-x-6 top-0 h-px"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(124,58,237,0.5), rgba(15,118,110,0.5), rgba(244,114,182,0.5), transparent)',
            }}
          />

          <div className="space-y-2">
            <p
              className="text-[10px] font-semibold tracking-[0.22em] uppercase"
              style={{ color: 'rgba(10,10,24,0.5)' }}
            >
              Sign in
            </p>
            <h1
              className="font-display text-[30px] leading-[1.0] font-medium tracking-[-0.025em]"
              style={{ color: '#0a0a18' }}
            >
              Welcome back.
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(10,10,24,0.65)' }}>
              Sign in to access your programmes.
            </p>
          </div>

          <div className="space-y-4 pt-2">
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
              className="text-sm rounded-lg px-3 py-2.5"
              style={{
                color: 'rgb(159 18 57)',
                background: 'rgba(254, 226, 226, 0.6)',
                border: '1px solid rgba(252, 165, 165, 0.5)',
              }}
              role="alert"
            >
              {error}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={submitDisabled}
            className="group relative w-full inline-flex items-center justify-center h-12 rounded-full text-sm font-medium tracking-tight transition-all duration-200 disabled:cursor-not-allowed"
            style={{
              background: submitDisabled ? 'rgba(10,10,24,0.18)' : '#0a0a18',
              color: submitDisabled ? 'rgba(10,10,24,0.5)' : '#E1E0CC',
            }}
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <span
                  className="w-3.5 h-3.5 rounded-full border-2 animate-spin"
                  style={{
                    borderColor: 'rgba(225,224,204,0.3)',
                    borderTopColor: '#E1E0CC',
                  }}
                />
                Signing in
              </span>
            ) : (
              <>
                Sign in
                <ArrowRight
                  className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-0.5"
                  style={{ color: submitDisabled ? 'rgba(10,10,24,0.4)' : '#E1E0CC' }}
                />
              </>
            )}
          </button>

          <p
            className="text-xs leading-relaxed pt-5"
            style={{
              color: 'rgba(10,10,24,0.55)',
              borderTop: '1px solid rgba(10,10,24,0.08)',
            }}
          >
            Faculty: your administrator will share a temporary password with you. If you don't have
            one, please ask them to add you on the Faculty Management page.
          </p>
        </motion.form>
      </main>
    </div>
  );
}

/**
 * Form field with label-above layout. Inputs sit on white surface for
 * clarity against the parchment card.
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
      <label
        htmlFor={id}
        className="block text-[11px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: 'rgba(10,10,24,0.6)' }}
      >
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
        className="block w-full h-11 px-3.5 rounded-xl text-sm transition-[border-color,box-shadow] duration-150 focus:outline-none"
        style={{
          background: 'rgba(255, 255, 255, 0.9)',
          border: '1px solid rgba(10,10,24,0.12)',
          color: '#0a0a18',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'rgba(124,58,237,0.55)';
          e.currentTarget.style.boxShadow = '0 0 0 4px rgba(124,58,237,0.10)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'rgba(10,10,24,0.12)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      />
    </div>
  );
}
