'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { toast } from '@/stores/toastStore';
import { useAuth } from '@/components/auth/AuthContext';
import UserMenu from '@/components/auth/UserMenu';

interface FacultyUser {
  id: string;
  email: string;
  role: string;
}

interface NewCredential {
  email: string;
  password: string;
  copied?: boolean;
}

export default function FacultyAdminPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [faculty, setFaculty] = useState<FacultyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [inviting, setInviting] = useState(false);
  const [newCredential, setNewCredential] = useState<NewCredential | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await api.get('/api/users?role=faculty&limit=200');
      setFaculty(resp.data?.users || []);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err.message || 'Failed to load faculty');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user?.role === 'administrator') {
      void refresh();
    }
  }, [authLoading, user?.role]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-9 h-9 rounded-full border-2 border-stone-300 border-t-teal-600 animate-spin" />
      </div>
    );
  }

  if (user?.role !== 'administrator') {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center px-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-stone-200 p-8 text-center space-y-2">
          <h1 className="text-lg font-semibold text-stone-900">Administrator only</h1>
          <p className="text-sm text-stone-600 leading-relaxed">
            You need an administrator role to manage faculty. If this is wrong, ask Logan to update
            your role.
          </p>
        </div>
      </div>
    );
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setError(null);
    try {
      const resp = await api.post('/api/users/invite-faculty', {
        email: inviteEmail.trim(),
        profile: {
          firstName: inviteFirstName.trim() || undefined,
          lastName: inviteLastName.trim() || undefined,
        },
      });
      const status = resp.data?.status as string;
      const generatedPassword = resp.data?.generatedPassword as string | undefined;

      if (status === 'exists') {
        toast.info('Already on the list', `${inviteEmail} already has an account.`);
      } else if (generatedPassword) {
        setNewCredential({ email: inviteEmail.trim(), password: generatedPassword });
        toast.success('Faculty invited', `Share the temporary password with ${inviteEmail}.`);
      } else {
        toast.success('Invited', inviteEmail);
      }

      setInviteEmail('');
      setInviteFirstName('');
      setInviteLastName('');
      await refresh();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err.message || 'Invite failed');
    } finally {
      setInviting(false);
    }
  };

  const handleRevoke = async (id: string, email: string) => {
    if (!confirm(`Revoke access for ${email}?`)) return;
    try {
      await api.delete(`/api/users/${id}`);
      toast.success('Access revoked', `${email} can no longer sign in.`);
      await refresh();
    } catch (err: any) {
      toast.error('Revoke failed', err?.response?.data?.error?.message || err.message);
    }
  };

  const handleCopyPassword = async () => {
    if (!newCredential) return;
    try {
      await navigator.clipboard.writeText(newCredential.password);
      setNewCredential({ ...newCredential, copied: true });
      setTimeout(() => {
        setNewCredential((cur) => (cur ? { ...cur, copied: false } : cur));
      }, 1800);
    } catch {
      // ignore — user can select manually
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="px-6 sm:px-10 py-6 flex items-center justify-between border-b border-stone-200/70">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block w-2 h-2 rounded-full bg-teal-600 ring-4 ring-teal-100"
          />
          <span className="text-[11px] uppercase tracking-[0.16em] text-stone-500 font-medium">
            AGCQ · Admin
          </span>
        </div>
        <UserMenu />
      </header>

      <main className="max-w-4xl mx-auto px-6 sm:px-10 py-12 space-y-10">
        {/* Page heading — calm, asymmetric, no card around it */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.2, 0.65, 0.3, 1] }}
          className="space-y-1.5"
        >
          <h1 className="font-display text-[32px] sm:text-[36px] leading-[1.05] font-semibold tracking-[-0.02em] text-stone-900">
            Faculty Management
          </h1>
          <p className="text-[15px] text-stone-600 leading-relaxed max-w-[58ch]">
            Add or remove faculty who can use the curriculum generator. Each new invite produces a
            one-time password to share through your usual channel.
          </p>
        </motion.div>

        {error && (
          <div
            role="alert"
            className="text-sm text-rose-700 bg-rose-50 border border-rose-200/70 rounded-lg px-3.5 py-2.5"
          >
            {error}
          </div>
        )}

        {/* Invite — section title sits above its own row of inputs, no card */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold tracking-tight text-stone-900 uppercase tracking-[0.08em] text-[12px]">
              Invite faculty
            </h2>
          </div>

          <form
            onSubmit={handleInvite}
            className="bg-white rounded-2xl border border-stone-200/80 p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-12 gap-3"
          >
            <div className="sm:col-span-5 space-y-1.5">
              <label
                htmlFor="invite-email"
                className="block text-[12px] font-medium text-stone-700"
              >
                Email
              </label>
              <input
                id="invite-email"
                type="email"
                required
                placeholder="email@university.edu"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="block w-full h-10 px-3 rounded-lg bg-white border border-stone-300 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 transition-[border-color,box-shadow] duration-150"
              />
            </div>
            <div className="sm:col-span-3 space-y-1.5">
              <label
                htmlFor="invite-first"
                className="block text-[12px] font-medium text-stone-700"
              >
                First name <span className="text-stone-400 font-normal">(optional)</span>
              </label>
              <input
                id="invite-first"
                type="text"
                placeholder="First name"
                value={inviteFirstName}
                onChange={(e) => setInviteFirstName(e.target.value)}
                className="block w-full h-10 px-3 rounded-lg bg-white border border-stone-300 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 transition-[border-color,box-shadow] duration-150"
              />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <label htmlFor="invite-last" className="block text-[12px] font-medium text-stone-700">
                Last name <span className="text-stone-400 font-normal">(opt.)</span>
              </label>
              <input
                id="invite-last"
                type="text"
                placeholder="Last name"
                value={inviteLastName}
                onChange={(e) => setInviteLastName(e.target.value)}
                className="block w-full h-10 px-3 rounded-lg bg-white border border-stone-300 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10 transition-[border-color,box-shadow] duration-150"
              />
            </div>
            <div className="sm:col-span-2 flex items-end">
              <button
                type="submit"
                disabled={inviting || !inviteEmail.trim()}
                className="w-full inline-flex items-center justify-center h-10 rounded-lg bg-teal-700 hover:bg-teal-800 active:bg-teal-900 disabled:bg-stone-300 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors duration-150"
              >
                {inviting ? 'Inviting…' : 'Invite'}
              </button>
            </div>
          </form>
        </section>

        {/* Faculty list — table, calm, no zebra; refresh quietly tucked into header */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold tracking-tight text-stone-900 uppercase tracking-[0.08em] text-[12px]">
              Faculty{' '}
              <span className="text-stone-400 font-normal normal-case">({faculty.length})</span>
            </h2>
            <button
              onClick={refresh}
              className="text-[12px] font-medium text-teal-700 hover:text-teal-900 transition-colors"
            >
              Refresh
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden">
            {loading ? (
              <div className="px-6 py-10 text-sm text-stone-500 text-center">Loading…</div>
            ) : faculty.length === 0 ? (
              <div className="px-6 py-12 text-center space-y-1.5">
                <p className="text-sm text-stone-700">No faculty yet.</p>
                <p className="text-[13px] text-stone-500">
                  Use the form above to send your first invite.
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="px-5 py-3 text-[11px] uppercase tracking-[0.08em] font-medium text-stone-500 border-b border-stone-100">
                      Email
                    </th>
                    <th className="px-5 py-3 text-[11px] uppercase tracking-[0.08em] font-medium text-stone-500 border-b border-stone-100 w-32">
                      Role
                    </th>
                    <th className="px-5 py-3 text-[11px] uppercase tracking-[0.08em] font-medium text-stone-500 border-b border-stone-100 w-28 text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {faculty.map((u, idx) => (
                    <tr
                      key={u.id}
                      className={`group hover:bg-stone-50/80 transition-colors ${
                        idx !== faculty.length - 1 ? 'border-b border-stone-100' : ''
                      }`}
                    >
                      <td className="px-5 py-3.5 text-stone-800">{u.email}</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 text-[11px] font-medium tracking-tight">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => handleRevoke(u.id, u.email)}
                          className="text-[12px] font-medium text-stone-400 hover:text-rose-700 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                        >
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </main>

      {/* One-time password reveal modal */}
      <AnimatePresence>
        {newCredential && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-stone-950/30 backdrop-blur-[1px] flex items-center justify-center p-4 z-50"
            onClick={() => setNewCredential(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.22, ease: [0.2, 0.65, 0.3, 1] }}
              className="bg-white rounded-2xl shadow-[0_8px_40px_-12px_rgba(15,23,42,0.18)] max-w-md w-full p-7 space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-1.5">
                <p className="text-[11px] uppercase tracking-[0.16em] text-teal-700 font-medium">
                  One-time
                </p>
                <h3 className="text-xl font-semibold tracking-tight text-stone-900">
                  Share these credentials
                </h3>
                <p className="text-sm text-stone-600 leading-relaxed">
                  This password is shown only once. Copy it now and pass it to the faculty member
                  through your usual channel.
                </p>
              </div>

              <div className="space-y-3 pt-1">
                <CredentialRow label="Email" value={newCredential.email} mono={false} />
                <div className="space-y-1.5">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-stone-500 font-medium">
                    Temporary password
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-[13px] text-stone-900 font-mono tracking-[-0.01em] select-all break-all">
                      {newCredential.password}
                    </code>
                    <button
                      onClick={handleCopyPassword}
                      className={`shrink-0 inline-flex items-center justify-center h-[42px] px-3.5 rounded-lg text-xs font-medium transition-colors duration-150 ${
                        newCredential.copied
                          ? 'bg-teal-50 text-teal-800 border border-teal-200'
                          : 'bg-stone-900 hover:bg-stone-800 text-white'
                      }`}
                    >
                      {newCredential.copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-[12px] text-stone-500 leading-relaxed">
                Faculty should change this password from their own account once signed in.
              </p>

              <div className="flex justify-end pt-1">
                <button
                  onClick={() => setNewCredential(null)}
                  className="inline-flex items-center justify-center h-10 px-5 rounded-lg bg-teal-700 hover:bg-teal-800 active:bg-teal-900 text-white text-sm font-medium transition-colors duration-150"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CredentialRow({ label, value, mono }: { label: string; value: string; mono: boolean }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] uppercase tracking-[0.08em] text-stone-500 font-medium">{label}</p>
      <code
        className={`block w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-lg text-[13px] text-stone-900 select-all break-all ${
          mono ? 'font-mono' : ''
        }`}
      >
        {value}
      </code>
    </div>
  );
}
