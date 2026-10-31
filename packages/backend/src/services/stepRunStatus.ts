/**
 * What the status endpoint reports for a step of the generic queue (Steps 1-9 and 13).
 *
 * A step marked `in_progress` was taken to be running, and with no Bull job behind it, a run
 * that had died ("stalled"). But approving a step also marks the next one `in_progress`, to
 * open it, so every step was reported failed and stalled from the moment the one before it was
 * approved until it was generated. Logan's test run (28 October 2026) showed "Generation
 * failed" on Step 2 before Step 2 had been run.
 *
 * A run is now recorded where it happens: `runStartedAt` when its job is queued and
 * `runEndedAt` when the job finishes. Only a recorded run that never ended, with no job left
 * behind it, is stalled. A step that was merely opened is pending.
 */

export type StepRunState = 'pending' | 'queued' | 'processing' | 'completed' | 'failed';

export interface RunMarks {
  runStartedAt?: Date | string;
  runEndedAt?: Date | string;
  completedAt?: Date | string;
  failedAt?: Date | string;
}

const time = (d?: Date | string): number => (d ? new Date(d).getTime() || 0 : 0);

/** A run was started for this step and nothing since says it finished or failed. */
export function isRunOutstanding(progress?: RunMarks): boolean {
  const started = time(progress?.runStartedAt);
  if (!started) return false;
  return (
    started >
    Math.max(time(progress.runEndedAt), time(progress.completedAt), time(progress.failedAt))
  );
}

const FROM_JOB: Record<string, StepRunState> = {
  completed: 'completed',
  active: 'processing',
  waiting: 'queued',
  delayed: 'queued',
  failed: 'failed',
};

/**
 * The step's state, from its job when there is one, otherwise from whether it has output.
 *
 * Bull evicts only finished jobs, so with the queue enabled an outstanding run with no job
 * has stopped: it is stalled, and has to be started again. Without the queue a step runs
 * in-process with no job to find, so an outstanding run is taken to be still going.
 */
export function stepRunStatus(input: {
  jobState?: string | null;
  hasData: boolean;
  progress?: RunMarks;
  queueEnabled: boolean;
}): { status: StepRunState; stalled: boolean } {
  const { jobState, hasData, progress, queueEnabled } = input;
  let status: StepRunState = 'pending';
  if (jobState) status = FROM_JOB[jobState] || 'pending';
  else if (hasData) status = 'completed';

  if (!isRunOutstanding(progress)) return { status, stalled: false };
  if (!queueEnabled) return { status: 'processing', stalled: false };
  if (!jobState) return { status: 'failed', stalled: true };
  return { status, stalled: false };
}
