'use client';

import { useEffect, useState } from 'react';
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-teal-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user?.role !== 'administrator') {
    return (
      <div className="max-w-2xl mx-auto p-6 mt-12">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-5 text-center">
          <h1 className="text-lg font-semibold text-red-700 mb-1">Administrator only</h1>
          <p className="text-sm text-red-600">
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
        // Show the one-time password modal — admin must hand this to the
        // faculty member; the plaintext is gone after they close the modal.
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
      }, 2000);
    } catch {
      // Fallback if clipboard API blocked — user can select manually
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-teal-800 mb-1">Faculty Management</h1>
          <p className="text-sm text-teal-600">
            Invite faculty members. Each invite generates a temporary password that you share with
            them; they sign in directly. Revoking removes their access.
          </p>
        </div>
        <UserMenu />
      </header>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-600 text-sm">
          {error}
        </div>
      )}

      <section className="bg-white border border-teal-200 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-teal-800 mb-3">Invite Faculty</h2>
        <form onSubmit={handleInvite} className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <input
            type="email"
            required
            placeholder="email@university.edu"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="md:col-span-5 px-3 py-2 bg-teal-50/50 border border-teal-300 rounded text-sm"
          />
          <input
            type="text"
            placeholder="First name (optional)"
            value={inviteFirstName}
            onChange={(e) => setInviteFirstName(e.target.value)}
            className="md:col-span-3 px-3 py-2 bg-teal-50/50 border border-teal-300 rounded text-sm"
          />
          <input
            type="text"
            placeholder="Last name (optional)"
            value={inviteLastName}
            onChange={(e) => setInviteLastName(e.target.value)}
            className="md:col-span-2 px-3 py-2 bg-teal-50/50 border border-teal-300 rounded text-sm"
          />
          <button
            type="submit"
            disabled={inviting || !inviteEmail.trim()}
            className="md:col-span-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded text-sm font-semibold"
          >
            {inviting ? 'Inviting…' : 'Invite'}
          </button>
        </form>
      </section>

      <section className="bg-white border border-teal-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-teal-800">
            Current Faculty ({faculty.length})
          </h2>
          <button
            onClick={refresh}
            className="px-3 py-1.5 bg-teal-100 hover:bg-teal-200 text-teal-700 rounded text-sm border border-teal-300"
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <p className="text-sm text-teal-600">Loading…</p>
        ) : faculty.length === 0 ? (
          <p className="text-sm text-teal-600">
            No faculty invited yet. Use the form above to invite the first one.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left bg-teal-50 border-b border-teal-200">
                <th className="p-2">Email</th>
                <th className="p-2">Role</th>
                <th className="p-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {faculty.map((u) => (
                <tr key={u.id} className="border-b border-teal-100">
                  <td className="p-2 text-teal-800">{u.email}</td>
                  <td className="p-2 text-teal-600">{u.role}</td>
                  <td className="p-2 text-right">
                    <button
                      onClick={() => handleRevoke(u.id, u.email)}
                      className="px-2 py-1 text-red-600 hover:text-red-800 text-xs"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* One-time password reveal modal */}
      {newCredential && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-teal-800">Share these credentials</h3>
            <p className="text-sm text-teal-600">
              This password will <strong>never be shown again</strong>. Copy it now and share it
              with the faculty member through your normal channel (email, Slack, in person).
            </p>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-teal-700 font-medium mb-1">Email</p>
                <code className="block w-full px-3 py-2 bg-teal-50 border border-teal-300 rounded text-sm text-teal-800 select-all">
                  {newCredential.email}
                </code>
              </div>
              <div>
                <p className="text-xs text-teal-700 font-medium mb-1">Temporary password</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-teal-50 border border-teal-300 rounded text-sm text-teal-800 font-mono select-all">
                    {newCredential.password}
                  </code>
                  <button
                    onClick={handleCopyPassword}
                    className={`px-3 py-2 rounded text-xs font-semibold ${
                      newCredential.copied
                        ? 'bg-emerald-200 text-emerald-700'
                        : 'bg-teal-500 hover:bg-teal-600 text-white'
                    }`}
                  >
                    {newCredential.copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            <p className="text-xs text-teal-500">
              Faculty should change this password from their own account once they sign in.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setNewCredential(null)}
                className="px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
