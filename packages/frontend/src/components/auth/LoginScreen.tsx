'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useAuth } from './AuthContext';
import { WordsPullUp } from '@/components/ui/prisma-hero';

/**
 * Faculty sign-in. The full Prisma hero is visible (video, noise,
 * gradient) with no top nav. "Curriculum Generator" sits as a
 * tasteful display heading at the bottom-left, and a compact
 * sign-in form is anchored vertically-centered on the right.
 *
 * Test contracts preserved (used by e2e/tests/auth-admin.spec.ts):
 *   - text "Sign in to access your programmes." present
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
    <section className="h-screen w-full bg-black">
      <div className="relative h-full w-full overflow-hidden rounded-2xl md:rounded-[2rem]">
        {/* Background video — exact URL from the Prisma reference */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_170732_8a9ccda6-5cff-4628-b164-059c500a2b41.mp4"
        />

        {/* Noise overlay */}
        <div className="noise-overlay pointer-events-none absolute inset-0 opacity-[0.65] mix-blend-overlay" />

        {/* Gradient overlay — slightly heavier on the right to seat the form */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-black/45 via-transparent to-transparent" />

        {/* AGCQ brand mark — top-left, replaces the navbar */}
        <div className="absolute z-20 top-6 left-6 sm:top-8 sm:left-10 flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-md"
            style={{
              background: 'linear-gradient(135deg, #E1E0CC 0%, rgba(225,224,204,0.7) 100%)',
            }}
          >
            <span className="text-[12px] font-bold tracking-tight text-black">A</span>
          </div>
          <span
            className="text-xs font-semibold tracking-[0.25em]"
            style={{ color: 'rgba(225, 224, 204, 0.85)' }}
          >
            AGCQ
          </span>
        </div>

        {/* "Curriculum Generator" — bottom-left, smaller than the big Prisma word */}
        <div className="absolute z-10 bottom-6 left-6 sm:bottom-10 sm:left-10 right-6 sm:right-auto pointer-events-none">
          <h1
            className="font-medium leading-[0.95] tracking-[-0.04em] text-[10vw] sm:text-[8vw] md:text-[6.5vw] lg:text-[5vw] xl:text-[4.5vw] max-w-[14ch]"
            style={{ color: '#E1E0CC' }}
          >
            <WordsPullUp text="Curriculum Generator" />
          </h1>
        </div>

        {/* Sign-in form — right edge, vertically centered */}
        <div className="absolute inset-y-0 right-0 z-20 flex items-center px-4 sm:px-8 lg:px-12">
          <motion.form
            onSubmit={handleSubmit}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[360px] flex flex-col gap-3.5 rounded-2xl p-6 sm:p-7"
            style={{
              background: 'rgba(10, 10, 16, 0.55)',
              border: '1px solid rgba(225, 224, 204, 0.15)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
            }}
          >
            <div className="space-y-1">
              <p
                className="text-[10px] font-semibold tracking-[0.22em] uppercase"
                style={{ color: 'rgba(225, 224, 204, 0.55)' }}
              >
                AGCQ · Curriculum
              </p>
              <p
                className="text-sm sm:text-base"
                style={{ lineHeight: 1.3, color: 'rgba(225, 224, 204, 0.85)' }}
              >
                Welcome back. Sign in to access your programmes.
              </p>
            </div>

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

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="text-[11px] rounded-md px-2.5 py-1.5"
                style={{
                  color: 'rgb(254 202 202)',
                  background: 'rgba(127, 29, 29, 0.35)',
                  border: '1px solid rgba(248, 113, 113, 0.35)',
                }}
                role="alert"
              >
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={submitDisabled}
              className="group mt-1 inline-flex items-center gap-2 self-start rounded-full py-1 pl-5 pr-1 text-sm font-medium transition-all hover:gap-3 sm:text-base disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: '#E1E0CC', color: '#000' }}
            >
              {submitting ? (
                <>
                  Signing in
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black sm:h-10 sm:w-10">
                    <span
                      className="w-3.5 h-3.5 rounded-full border-2 animate-spin"
                      style={{
                        borderColor: 'rgba(225,224,204,0.3)',
                        borderTopColor: '#E1E0CC',
                      }}
                    />
                  </span>
                </>
              ) : (
                <>
                  Sign in
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black transition-transform group-hover:scale-110 sm:h-10 sm:w-10">
                    <ArrowRight className="h-4 w-4" style={{ color: '#E1E0CC' }} />
                  </span>
                </>
              )}
            </button>

            <p
              className="text-[11px] leading-relaxed pt-3 mt-1"
              style={{
                color: 'rgba(225, 224, 204, 0.5)',
                borderTop: '1px solid rgba(225, 224, 204, 0.1)',
              }}
            >
              Faculty: your administrator will share a temporary password with you.
            </p>
          </motion.form>
        </div>
      </div>
    </section>
  );
}

/**
 * Glass-effect input — frosted dark fill + cream border + cream text.
 * Blends with the cinematic hero without going opaque-card.
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
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="block text-[10px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: 'rgba(225, 224, 204, 0.55)' }}
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
        className="block w-full h-10 px-3 rounded-lg text-sm focus:outline-none"
        style={{
          background: 'rgba(20, 20, 24, 0.55)',
          border: '1px solid rgba(225, 224, 204, 0.25)',
          color: '#E1E0CC',
          backdropFilter: 'blur(8px)',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'rgba(225, 224, 204, 0.7)';
          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(225, 224, 204, 0.1)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'rgba(225, 224, 204, 0.25)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      />
    </div>
  );
}
