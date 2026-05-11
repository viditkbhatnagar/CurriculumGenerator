'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useAuth } from './AuthContext';
import { WordsPullUp } from '@/components/ui/prisma-hero';

/**
 * Faculty sign-in. The full Prisma hero is visible (video background,
 * nav, "Curricula*" pulled-up word) and a compact sign-in form sits
 * inline in the bottom-right column — where the description + CTA
 * lived in the reference design. No modal, no overlay covering the
 * cinematic visual.
 *
 * Test contracts preserved (used by e2e/tests/auth-admin.spec.ts):
 *   - text "Sign in to access your programmes." present
 *   - inputs labelled "Email" and "Password"
 *   - submit button text matches /^Sign in$/
 */

const navItems = ['About', 'Programmes', 'Faculty', 'Standards', 'Contact'];

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
        <div className="noise-overlay pointer-events-none absolute inset-0 opacity-[0.7] mix-blend-overlay" />

        {/* Gradient overlay */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />

        {/* Navbar */}
        <nav className="absolute left-1/2 top-0 z-20 -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-b-2xl bg-black px-4 py-2 sm:gap-6 md:gap-12 md:rounded-b-3xl md:px-8 lg:gap-14">
            {navItems.map((item) => (
              <a
                key={item}
                href="#"
                className="text-[10px] transition-colors sm:text-xs md:text-sm"
                style={{ color: 'rgba(225, 224, 204, 0.8)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#E1E0CC')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(225, 224, 204, 0.8)')}
              >
                {item}
              </a>
            ))}
          </div>
        </nav>

        {/* Hero content */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-2 sm:px-6 md:px-10">
          <div className="grid grid-cols-12 items-end gap-4">
            {/* Big pulled-up word — left column, exactly like the Prisma reference */}
            <div className="col-span-12 lg:col-span-8">
              <h1
                className="font-medium leading-[0.85] tracking-[-0.07em] text-[26vw] sm:text-[24vw] md:text-[22vw] lg:text-[20vw] xl:text-[19vw] 2xl:text-[20vw]"
                style={{ color: '#E1E0CC' }}
              >
                <WordsPullUp text="Curricula" showAsterisk />
              </h1>
            </div>

            {/* Compact sign-in form — replaces the description + CTA column */}
            <div className="col-span-12 flex flex-col gap-4 pb-6 lg:col-span-4 lg:pb-10">
              <motion.form
                onSubmit={handleSubmit}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col gap-3 max-w-[360px]"
              >
                <div className="space-y-1">
                  <p
                    className="text-[10px] font-semibold tracking-[0.22em] uppercase"
                    style={{ color: 'rgba(225, 224, 204, 0.55)' }}
                  >
                    AGCQ · Curriculum
                  </p>
                  <p
                    className="text-xs sm:text-sm md:text-base"
                    style={{ lineHeight: 1.25, color: 'rgba(225, 224, 204, 0.8)' }}
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

                <motion.button
                  type="submit"
                  disabled={submitDisabled}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  className="group inline-flex items-center gap-2 self-start rounded-full py-1 pl-5 pr-1 text-sm font-medium transition-all hover:gap-3 sm:text-base disabled:cursor-not-allowed disabled:opacity-60"
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
                </motion.button>
              </motion.form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Glass-effect input that blends with the cinematic hero — cream
 * border + cream text on a frosted dark fill. Compact (h-10) so the
 * form fits neatly into the Prisma column without overpowering the
 * big pulled-up word.
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
