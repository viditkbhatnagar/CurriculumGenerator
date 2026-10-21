'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FeedbackEntry,
  Satisfaction,
  VERDICTS,
  listFeedback,
  sendFeedback,
} from '@/lib/feedbackApi';

const NAME_KEY = 'stepFeedback.reviewerName';

const readName = () => {
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
};
const rememberName = (name: string) => {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // A private window or blocked storage: the name is simply asked for again.
  }
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * Under each step: the reviewer says what changed and whether the output is satisfactory
 * (Rejin, 21 October 2026). Earlier entries for the step are listed below the form.
 */
export default function StepFeedbackPanel({
  workflowId,
  step,
}: {
  workflowId: string;
  step: number;
}) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [name, setName] = useState('');
  const [satisfactory, setSatisfactory] = useState<Satisfaction | ''>('');
  const [whatChanged, setWhatChanged] = useState('');
  const [comments, setComments] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => setName(readName()), []);
  useEffect(() => {
    setSaved(false);
    setError(null);
    listFeedback({ workflowId, step })
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [workflowId, step]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError('Give your name.');
    if (!satisfactory) return setError('Say whether the output is satisfactory.');
    if (!whatChanged.trim() && !comments.trim())
      return setError('Describe what changed, or add a comment.');
    setBusy(true);
    try {
      await sendFeedback({
        workflowId,
        stepNumber: step,
        reviewerName: name.trim(),
        satisfactory,
        whatChanged,
        comments,
      });
      rememberName(name.trim());
      setSatisfactory('');
      setWhatChanged('');
      setComments('');
      setSaved(true);
      setEntries(await listFeedback({ workflowId, step }).catch(() => entries));
    } catch (err) {
      setError((err as Error)?.message || 'The feedback could not be saved. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-labelledby={`feedback-step-${step}`}
      className="mt-6 rounded-xl border border-amber-200 bg-amber-50/70 shadow-sm"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 rounded-xl px-5 py-4 text-left transition-colors hover:bg-amber-100/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500"
      >
        <span>
          <span id={`feedback-step-${step}`} className="block font-semibold text-amber-950">
            Your feedback on Step {step}
          </span>
          <span className="block text-sm text-amber-800">
            {entries.length
              ? `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} so far. Add yours after each run.`
              : 'What changed, and is the output satisfactory? Takes a minute.'}
          </span>
        </span>
        <span className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900">
          {open ? 'Close' : 'Give feedback'}
        </span>
      </button>

      {open && (
        <div className="grid gap-5 border-t border-amber-200 px-5 py-5">
          <form onSubmit={submit} className="grid gap-4">
            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-800">Your name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                placeholder="e.g. Dr Sherin Thomas"
              />
            </label>

            <fieldset className="grid gap-2 text-sm">
              <legend className="mb-1 font-medium text-slate-800">
                Is this step's output satisfactory?
              </legend>
              <div className="flex flex-wrap gap-2">
                {VERDICTS.map((v) => (
                  <label
                    key={v.value}
                    className={`cursor-pointer rounded-lg border px-4 py-2 font-medium transition ${
                      satisfactory === v.value
                        ? `${v.tone} ring-2 ring-offset-1 ring-amber-400`
                        : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`satisfactory-${step}`}
                      value={v.value}
                      checked={satisfactory === v.value}
                      onChange={() => setSatisfactory(v.value)}
                      className="sr-only"
                    />
                    {v.label}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-800">What changed?</span>
              <span className="text-slate-500">
                Compared with before or with your last run: better, worse, or different.
              </span>
              <textarea
                value={whatChanged}
                onChange={(e) => setWhatChanged(e.target.value)}
                rows={3}
                maxLength={4000}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-medium text-slate-800">Comments</span>
              <span className="text-slate-500">
                What is wrong or missing, and what it should say instead.
              </span>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={4}
                maxLength={4000}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </label>

            {error && <p className="text-sm text-rose-700">{error}</p>}
            {saved && !error && <p className="text-sm text-emerald-700">Saved. Thank you.</p>}
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:opacity-60"
              >
                {busy ? 'Saving…' : 'Save feedback'}
              </button>
              <Link
                href="/feedback"
                className="text-sm text-amber-800 underline hover:text-amber-950"
              >
                All feedback
              </Link>
            </div>
          </form>

          {entries.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-slate-800">
                Earlier feedback on this step
              </h4>
              <ul className="grid gap-2">
                {entries.map((e) => {
                  const v = VERDICTS.find((x) => x.value === e.satisfactory);
                  return (
                    <li
                      key={e.id}
                      className="rounded-lg border border-amber-100 bg-white px-4 py-3 text-sm"
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-slate-600">
                        <span className="font-medium text-slate-800">{e.reviewerName}</span>
                        <span>{when(e.createdAt)}</span>
                        {v && (
                          <span
                            className={`rounded border px-2 py-0.5 text-xs font-semibold ${v.tone}`}
                          >
                            {v.label}
                          </span>
                        )}
                      </div>
                      {e.whatChanged && (
                        <p className="whitespace-pre-wrap text-slate-800">
                          <span className="font-medium">Changed: </span>
                          {e.whatChanged}
                        </p>
                      )}
                      {e.comments && (
                        <p className="mt-1 whitespace-pre-wrap text-slate-800">
                          <span className="font-medium">Comments: </span>
                          {e.comments}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
