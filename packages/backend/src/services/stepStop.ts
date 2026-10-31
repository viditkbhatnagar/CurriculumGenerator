/**
 * Stopping a long-running step: when the author asks, or when it has run far longer than a
 * programme of its size should take.
 *
 * Logan's test run (28 October 2026) watched Step 7 for 50 minutes at 0% with "no timeout,
 * error or cancel option". A Bull job cannot be interrupted from outside, so the run stops
 * itself: between model calls it checks whether a stop was requested or its time is up, and
 * if so ends with a StepStopped error that says why. Nothing from a stopped run is saved, and
 * the queue does not retry it.
 */

export class StepStopped extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StepStopped';
  }
}

/** Matched by name, so it survives being re-wrapped or passed across module boundaries. */
export const isStepStopped = (error: unknown): boolean =>
  error instanceof Error && error.name === 'StepStopped';

/** Logan's run averaged 2.8 minutes a model call. */
const MINUTES_PER_CALL = 3;
/** Summatives, sample questions and LMS packages, after the module formatives. */
const MINUTES_AFTER_MODULES = 15;
/** How many times the expected duration a run may take before it is stopped. */
const HEADROOM = 2;

/**
 * Minutes Step 7 may run. Each module's assessments are one call each, in turn; modules are
 * written `concurrency` at a time. So 6 modules with 3 assessments each, six at a time, is
 * 3 rounds of calls: 2 x (3 x 3 + 15) = 48 minutes. 46 modules is 8 x 3 = 24 rounds: 174.
 */
export function step7TimeLimitMinutes(
  modules: number,
  assessmentsPerModule: number,
  concurrency: number
): number {
  const rounds =
    Math.ceil(Math.max(1, modules) / Math.max(1, concurrency)) * Math.max(1, assessmentsPerModule);
  return HEADROOM * (rounds * MINUTES_PER_CALL + MINUTES_AFTER_MODULES);
}

const time = (d?: Date | string): number => (d ? new Date(d).getTime() || 0 : 0);

/**
 * Why the run must stop now, or null to carry on. A stop request counts when it was made
 * after this run was queued (or, without a queue, after it began); an older one belongs to
 * an earlier run.
 */
export function stopReason(input: {
  step: number;
  now: number;
  processingStartedAt: number;
  limitMinutes: number;
  runQueuedAt?: Date | string;
  stopRequestedAt?: Date | string;
}): string | null {
  const { step, now, processingStartedAt, limitMinutes } = input;
  const runBegan = time(input.runQueuedAt) || processingStartedAt;
  if (time(input.stopRequestedAt) > runBegan) {
    return `Step ${step} was stopped on request. Nothing from this run was saved.`;
  }
  if (now - processingStartedAt > limitMinutes * 60 * 1000) {
    return `Step ${step} was stopped after ${limitMinutes} minutes, about twice as long as a programme of this size should take. Nothing from this run was saved. Generate it again; if it stops again, report it.`;
  }
  return null;
}
