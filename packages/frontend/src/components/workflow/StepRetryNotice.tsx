'use client';

import type { StepRetryNotice as Notice } from '@/hooks/useStepStatus';

/**
 * Shown inside a step's "Generating…" banner when an earlier attempt of the run stopped and the
 * queue is trying again. Logan Pacey, 23 November 2026: Step 5's first attempt stopped and the
 * page "just kept saying 'Regenerating…'" until the retry finished.
 */
export function StepRetryNotice({ retry }: { retry?: Notice | null }) {
  if (!retry) return null;
  const at = retry.nextAttemptAt
    ? new Date(retry.nextAttemptAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;
  const next = retry.failedAttempt + 1;
  return (
    <div
      role="status"
      className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
    >
      <p className="font-medium text-amber-700">
        Attempt {retry.failedAttempt} of {retry.maxAttempts} stopped.{' '}
        {retry.phase === 'waiting'
          ? `Attempt ${next} starts automatically${at ? ` at about ${at}` : ' shortly'}.`
          : `Attempt ${next} is running now.`}
      </p>
      <p className="mt-1 text-amber-800/80">Reason: {retry.reason}</p>
      <p className="mt-1 text-xs text-teal-600">
        Nothing is saved until an attempt finishes, so the current version stays as it is.
      </p>
    </div>
  );
}
