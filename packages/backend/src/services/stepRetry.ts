/**
 * What the page says while a step's run is being retried.
 *
 * The step queue tries a failed run again (3 attempts, waiting 1 then 2 minutes), but only the
 * last failure was ever written to the step. Logan Pacey, 23 November 2026: Step 5's first
 * attempt stopped after 15 minutes, "the page never showed the reason or the reset time. It just
 * kept saying 'Regenerating…'. The job then restarted on its own and completed." The status
 * endpoint now reports the earlier attempt's reason and when the next one starts.
 *
 * Pure, so it can be tested.
 */

/** Matches the step queue's backoff: exponential from one minute. */
export const RETRY_BACKOFF_MS = 60_000;

export interface RetryJob {
  state?: string | null;
  attemptsMade?: number;
  maxAttempts?: number;
  failedReason?: string | null;
  /** When the last attempt ended (Bull's finishedOn), in ms. */
  finishedOn?: number | null;
}

export interface RetryNotice {
  /** The attempt that stopped (1-based). */
  failedAttempt: number;
  maxAttempts: number;
  reason: string;
  /** 'waiting' until the next attempt starts, then 'running'. */
  phase: 'waiting' | 'running';
  /** ISO time the next attempt is due, while waiting. */
  nextAttemptAt: string | null;
}

const LIVE_STATES = new Set(['delayed', 'waiting', 'active']);

export function retryNotice(job: RetryJob | null | undefined): RetryNotice | null {
  if (!job || !job.state || !LIVE_STATES.has(job.state)) return null;
  const attempts = job.attemptsMade || 0;
  const reason = (job.failedReason || '').trim();
  if (attempts < 1 || !reason) return null;
  const waiting = job.state !== 'active';
  const due =
    waiting && job.finishedOn
      ? new Date(job.finishedOn + RETRY_BACKOFF_MS * 2 ** (attempts - 1)).toISOString()
      : null;
  return {
    failedAttempt: attempts,
    maxAttempts: job.maxAttempts || attempts + 1,
    reason,
    phase: waiting ? 'waiting' : 'running',
    nextAttemptAt: due,
  };
}
