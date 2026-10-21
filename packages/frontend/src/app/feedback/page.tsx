'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FeedbackEntry, VERDICTS, downloadFeedbackCsv, listFeedback } from '@/lib/feedbackApi';

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * Every reviewer's step feedback in one place: what changed and whether each step's output is
 * satisfactory, by programme and step, with a CSV export for review meetings.
 */
export default function FeedbackPage() {
  const [entries, setEntries] = useState<FeedbackEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [programme, setProgramme] = useState('');
  const [step, setStep] = useState(0);

  useEffect(() => {
    listFeedback()
      .then(setEntries)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the feedback'));
  }, []);

  const programmes = useMemo(
    () =>
      Array.from(new Map((entries || []).map((e) => [e.workflowId, e.programme])).entries()).sort(
        (a, b) => a[1].localeCompare(b[1])
      ),
    [entries]
  );
  const shown = (entries || []).filter(
    (e) => (!programme || e.workflowId === programme) && (!step || e.stepNumber === step)
  );
  const counts = VERDICTS.map((v) => ({
    ...v,
    n: shown.filter((e) => e.satisfactory === v.value).length,
  }));

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
              Reviewer feedback
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">
              What changed at each step, and is it right?
            </h1>
            <p className="mt-2 text-slate-600">
              Reviewers log this under each step of a programme as they build it. Open a programme
              and use &ldquo;Your feedback on Step N&rdquo; at the foot of the step to add an entry.
            </p>
          </div>
          <dl className="flex gap-5 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm">
            {counts.map((c) => (
              <div key={c.value}>
                <dt className="text-xs text-slate-500">{c.label}</dt>
                <dd className="text-2xl font-semibold text-slate-900">{c.n}</dd>
              </div>
            ))}
          </dl>
        </header>

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-slate-600">Programme</span>
            <select
              value={programme}
              onChange={(e) => setProgramme(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2"
            >
              <option value="">All programmes</option>
              {programmes.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-slate-600">Step</span>
            <select
              value={step}
              onChange={(e) => setStep(Number(e.target.value))}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2"
            >
              <option value={0}>All steps</option>
              {Array.from({ length: 14 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  Step {n}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() =>
              downloadFeedbackCsv({ workflowId: programme || undefined, step: step || undefined })
            }
            className="ml-auto rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500"
          >
            Download CSV
          </button>
        </div>

        {error && <p className="text-rose-700">{error}</p>}
        {!entries && !error && <p className="text-slate-500">Loading…</p>}
        {entries && shown.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center text-slate-500">
            No feedback yet{programme || step ? ' for this selection' : ''}.
          </p>
        )}

        <ul className="grid gap-3">
          {shown.map((e) => {
            const v = VERDICTS.find((x) => x.value === e.satisfactory);
            return (
              <li key={e.id} className="rounded-xl border border-slate-200 bg-white px-5 py-4">
                <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <Link
                    href={`/workflow/${e.workflowId}`}
                    className="font-semibold text-slate-900 hover:text-amber-800 hover:underline"
                  >
                    {e.programme}
                  </Link>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                    Step {e.stepNumber}
                  </span>
                  {v && (
                    <span className={`rounded border px-2 py-0.5 text-xs font-semibold ${v.tone}`}>
                      {v.label}
                    </span>
                  )}
                  <span className="text-slate-500">
                    {e.reviewerName} · {when(e.createdAt)}
                  </span>
                </div>
                {e.whatChanged && (
                  <p className="whitespace-pre-wrap text-sm text-slate-800">
                    <span className="font-medium">What changed: </span>
                    {e.whatChanged}
                  </p>
                )}
                {e.comments && (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
                    <span className="font-medium">Comments: </span>
                    {e.comments}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}
