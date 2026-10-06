'use client';

/**
 * Approval before publication. A faculty member submits a finished curriculum; the super admin
 * reviews what the automated checks could not pass, then publishes it or returns it with a
 * note (AGU, 3 October 2026: "Super admin must approve"). See services/publication.
 */
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/components/auth/AuthContext';
import { CurriculumWorkflow } from '@/types/workflow';

interface Issue {
  step: number;
  stepName: string;
  kind: 'fail' | 'not_checked' | 'missing' | 'proposal' | 'review';
  issue: string;
}

const KIND_LABEL: Record<Issue['kind'], string> = {
  fail: 'Fails',
  missing: 'Missing',
  not_checked: 'Not checked',
  proposal: 'Needs approval',
  review: 'Needs review',
};
const BLOCKING = new Set(['fail', 'missing']);

const when = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

export default function PublicationPanel({
  workflow,
  onChanged,
}: {
  workflow: CurriculumWorkflow;
  onChanged: () => void;
}) {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'administrator';
  const publication = workflow.publication || {};
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (workflow.status !== 'review_pending' || !isSuperAdmin) return;
    api
      .get(`/api/v3/workflow/${workflow._id}/unresolved-issues`)
      .then((r) => setIssues(r.data?.data || []))
      .catch(() => setIssues([]));
  }, [workflow._id, workflow.status, isSuperAdmin]);

  const blocking = (issues || []).filter((i) => BLOCKING.has(i.kind));

  const act = async (path: 'publish' | 'return', body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/v3/workflow/${workflow._id}/${path}`, body);
      onChanged();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'The request failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (workflow.status === 'published') {
    return (
      <section className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 mb-6">
        <h2 className="font-semibold text-emerald-800">Published</h2>
        <p className="text-sm text-emerald-700">
          Approved and published on {when(publication.publishedAt)}
          {publication.acknowledgedIssues
            ? `, with ${publication.acknowledgedIssues} unresolved issue(s) acknowledged by the approver.`
            : '.'}
        </p>
      </section>
    );
  }

  if (workflow.status !== 'review_pending') {
    return publication.returnedAt ? (
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-5 mb-6">
        <h2 className="font-semibold text-amber-800">
          Returned for changes on {when(publication.returnedAt)}
        </h2>
        <p className="text-sm text-amber-800 whitespace-pre-wrap">{publication.returnNote}</p>
      </section>
    ) : null;
  }

  return (
    <section className="rounded-xl border border-teal-300 bg-white p-5 mb-6">
      <h2 className="font-semibold text-teal-800">Awaiting approval</h2>
      <p className="text-sm text-teal-700">
        Submitted on {when(publication.submittedAt)}. The super admin reviews it before it is
        published to students.
      </p>

      {isSuperAdmin && (
        <div className="mt-4 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-teal-800">
              Unresolved issues {issues ? `(${issues.length})` : ''}
            </h3>
            {issues === null ? (
              <p className="text-sm text-teal-600">Loading…</p>
            ) : issues.length === 0 ? (
              <p className="text-sm text-emerald-700">No automated check failed.</p>
            ) : (
              <ul className="mt-2 max-h-64 overflow-y-auto text-sm divide-y divide-teal-100 border border-teal-100 rounded-lg">
                {issues.map((i, n) => (
                  <li key={n} className="flex gap-3 px-3 py-2">
                    <span
                      className={`shrink-0 w-28 font-medium ${BLOCKING.has(i.kind) ? 'text-red-600' : 'text-slate-500'}`}
                    >
                      {KIND_LABEL[i.kind]}
                    </span>
                    <span className="text-teal-800">
                      <span className="text-teal-500">Step {i.step}: </span>
                      {i.issue}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {blocking.length > 0 && (
            <label className="flex items-start gap-2 text-sm text-teal-800">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-1"
              />
              I have reviewed the {blocking.length} failing or missing item(s) and approve
              publication anyway.
            </label>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              disabled={busy || issues === null || (blocking.length > 0 && !acknowledged)}
              onClick={() => act('publish', { acknowledgeIssues: acknowledged })}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium disabled:opacity-50"
            >
              Approve and publish
            </button>
          </div>

          <div>
            <label className="text-sm font-medium text-teal-800" htmlFor="return-note">
              Or return it for changes
            </label>
            <textarea
              id="return-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="What needs changing"
              className="mt-1 w-full rounded-lg border border-teal-200 p-2 text-sm"
            />
            <button
              disabled={busy || !note.trim()}
              onClick={() => act('return', { note })}
              className="mt-2 px-4 py-2 rounded-lg bg-amber-500 text-white font-medium disabled:opacity-50"
            >
              Return for changes
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      )}
    </section>
  );
}
