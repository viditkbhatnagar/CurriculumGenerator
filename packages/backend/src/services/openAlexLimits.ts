/**
 * What an OpenAlex 429 means, and what to do about it.
 *
 * OpenAlex answers 429 for two different things (developers.openalex.org, Errors and Rate
 * limits): the day's budget is spent ("error": "not_enough_credits", nothing more until
 * midnight UTC), or requests came too fast (a short throttle that clears in seconds). The
 * first version treated every 429 as the daily budget, so a momentary throttle failed a
 * 15-minute Step 5 run; Bull then retried it a minute later and it completed, which is what
 * Logan Pacey saw on 23 November 2026 (the logistics pilot, attempt 1 stopped at 16:08 and
 * attempt 2 finished at 16:19, five journal searches in all). A throttle is now waited out
 * here; only a spent budget stops the run, and that is not retried.
 *
 * Pure, so it can be tested.
 */

export type LimitKind = 'budget' | 'throttle';

/** Waits for a throttled request: 2, 4, 8 and 16 seconds. */
export const THROTTLE_RETRIES = 4;
const THROTTLE_BASE_MS = 2000;
const MAX_WAIT_MS = 60_000;

/** A spent daily budget, from the response body or the remaining-budget header. */
export function classifyLimit(body: unknown, remainingHeader: string | null): LimitKind {
  const b = (body || {}) as Record<string, unknown>;
  const text = `${b.error ?? ''} ${b.message ?? ''}`.toLowerCase();
  if (/not_enough_credits|credit|budget|daily/.test(text)) return 'budget';
  if (remainingHeader !== null && remainingHeader.trim() !== '' && Number(remainingHeader) <= 0) {
    return 'budget';
  }
  return 'throttle';
}

/** How long to wait before asking again: Retry-After when given, otherwise doubling. */
export function throttleDelayMs(attempt: number, retryAfter: string | null): number {
  const stated = Number(retryAfter);
  if (retryAfter && Number.isFinite(stated) && stated > 0) {
    return Math.min(stated * 1000, MAX_WAIT_MS);
  }
  return Math.min(THROTTLE_BASE_MS * 2 ** attempt, MAX_WAIT_MS);
}

/** "resets at midnight UTC, in about 8 hours". */
export function budgetMessage(resetSeconds: number): string {
  const hours = resetSeconds > 0 ? Math.ceil(resetSeconds / 3600) : null;
  return (
    "The academic source database (OpenAlex) has used up today's free request allowance. " +
    `It resets at midnight UTC${hours ? `, in about ${hours} hour${hours === 1 ? '' : 's'}` : ''}.`
  );
}

export const THROTTLE_MESSAGE =
  'The academic source database (OpenAlex) kept asking us to slow down and did not answer after ' +
  'several tries.';
