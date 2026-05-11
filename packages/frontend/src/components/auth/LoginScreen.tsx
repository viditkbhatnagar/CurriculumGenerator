'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, X } from 'lucide-react';
import { useAuth } from './AuthContext';
import { PrismaHero } from '@/components/ui/prisma-hero';

/**
 * Faculty sign-in. Uses the exact Prisma hero (video bg + "Curricula"
 * pulled-up word + top-centered nav + cream pill CTA). The CTA opens
 * a parchment modal with the actual email/password form so the
 * cinematic design stays pure.
 *
 * Test contracts preserved (used by e2e/tests/auth-admin.spec.ts):
 *   - text "Sign in to access your programmes." is present
 *   - inputs labelled "Email" and "Password"
 *   - submit button text matches /^Sign in$/
 *
 * Note: the modal opens automatically on mount so e2e tests (which
 * expect the form to be visible immediately) keep working without
 * having to click the hero CTA first.
 */
export default function LoginScreen() {
  const { login } = useAuth();
  const [modalOpen, setModalOpen] = useState(true);
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
    <div className="relative min-h-screen w-full bg-black">
      <PrismaHero
        word="Curricula"
        showAsterisk
        description="AGCQ is the curriculum atelier for serious institutions — a 13-step AI workflow with SME checkpoints, AGI-compliant source validation, and complete programme specifications drafted in hours, not months."
        ctaLabel="Sign in"
        onCtaClick={() => setModalOpen(true)}
      />

      <AnimatePresence>
        {modalOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0"
              style={{
                background: 'rgba(0,0,0,0.55)',
                backdropFilter: 'blur(8px)',
              }}
              onClick={() => !submitting && setModalOpen(false)}
            />

            {/* Parchment card */}
            <motion.form
              onSubmit={handleSubmit}
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-[460px] rounded-3xl p-8 sm:p-9 space-y-6 shadow-[0_30px_60px_rgba(0,0,0,0.45),0_10px_24px_rgba(0,0,0,0.25)]"
              style={{
                background: 'rgba(245, 244, 232, 0.98)',
                border: '1px solid rgba(225, 224, 204, 0.7)',
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

              {/* Close button */}
              <button
                type="button"
                aria-label="Close"
                onClick={() => !submitting && setModalOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full transition-colors"
                style={{ color: 'rgba(10,10,24,0.45)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#0a0a18')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(10,10,24,0.45)')}
              >
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-2">
                <p
                  className="text-[10px] font-semibold tracking-[0.22em] uppercase"
                  style={{ color: 'rgba(10,10,24,0.5)' }}
                >
                  AGCQ · Curriculum Generator
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
                Faculty: your administrator will share a temporary password with you. If you don't
                have one, please ask them to add you on the Faculty Management page.
              </p>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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
          background: 'rgba(255, 255, 255, 0.92)',
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
