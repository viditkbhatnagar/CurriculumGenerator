'use client';

import { useState } from 'react';

const MIN_REASON = 10;

/**
 * Shown when a step's own checks failed and approval was refused: what failed, and a way to
 * approve anyway with a reason that is kept on the step (backend services/approvalChecks).
 */
export default function ApprovalOverridePanel({
  stepNumber,
  issues,
  busy,
  onApprove,
  onCancel,
}: {
  stepNumber: number;
  issues: string[];
  busy: boolean;
  onApprove: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const ready = reason.trim().length >= MIN_REASON;

  return (
    <section
      role="alert"
      aria-labelledby={`override-${stepNumber}`}
      className="rounded-xl border border-amber-300 bg-amber-50 p-5"
    >
      <h4 id={`override-${stepNumber}`} className="font-semibold text-amber-950">
        Step {stepNumber} did not pass its checks
      </h4>
      <p className="mt-1 text-sm text-amber-900">
        Fix these and regenerate, or approve anyway with a reason. The reason is kept with the step,
        alongside what it overrode.
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-950">
        {issues.map((issue, i) => (
          <li key={i}>{issue}</li>
        ))}
      </ul>
      <label className="mt-4 grid gap-1 text-sm">
        <span className="font-medium text-slate-800">Reason for approving anyway</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="e.g. Sources reviewed by the subject expert; the two thin topics are covered in class."
          className="rounded-lg border border-amber-300 bg-white px-3 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
        />
      </label>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          disabled={!ready || busy}
          onClick={() => onApprove(reason.trim())}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:opacity-50"
        >
          {busy ? 'Approving…' : 'Approve anyway'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-amber-900 underline hover:text-amber-950"
        >
          Cancel
        </button>
        {!ready && (
          <span className="text-xs text-amber-800">
            Give a reason of at least {MIN_REASON} characters.
          </span>
        )}
      </div>
    </section>
  );
}
