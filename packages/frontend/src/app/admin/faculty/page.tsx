'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { toast } from '@/stores/toastStore';

interface FacultyUser {
  id: string;
  email: string;
  role: string;
}

export default function FacultyAdminPage() {
  const [faculty, setFaculty] = useState<FacultyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [inviting, setInviting] = useState(false);

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
    refresh();
  }, []);

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
      const status = resp.data?.status;
      toast.success(
        status === 'invited' ? 'Faculty invited' : 'Already on the list',
        status === 'invited'
          ? `${inviteEmail} can now sign in once Auth0 is enabled.`
          : `${inviteEmail} is already invited.`
      );
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

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-teal-800 mb-1">Faculty Management</h1>
        <p className="text-sm text-teal-600">
          Invite authorized faculty to access the curriculum workflow. To enforce that only invited
          faculty can sign in, set{' '}
          <code className="text-xs bg-teal-100 px-1 rounded">FACULTY_ALLOWLIST_ENFORCED=true</code>{' '}
          on the backend (and configure Auth0).
        </p>
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
    </div>
  );
}
