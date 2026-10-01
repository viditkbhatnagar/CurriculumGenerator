/**
 * Whether a background generation is queued or running for a programme.
 *
 * Deleting a programme while one runs strands it: the job reloads the workflow, finds it hidden,
 * drops its paid output and cannot record its own failure, so a restored programme shows the
 * step stuck mid-generation. The delete route refuses instead (found by review, 2026-10-01).
 * Without Redis, steps run in the request itself and nothing is queued, so this returns false.
 */
import { getStepJobStatus } from '../queues/stepQueue';
import { getAllStep10Jobs } from '../queues/step10Queue';
import { getAllStep11Jobs } from '../queues/step11Queue';
import { getAllStep12Jobs } from '../queues/step12Queue';

const BUSY = new Set(['active', 'waiting', 'delayed', 'paused']);

export async function hasActiveGeneration(workflowId: string): Promise<boolean> {
  for (let step = 1; step <= 13; step++) {
    const status = await getStepJobStatus(step, workflowId).catch(() => null);
    if (status && BUSY.has(String(status.state))) return true;
  }
  for (const jobsOf of [getAllStep10Jobs, getAllStep11Jobs, getAllStep12Jobs]) {
    const jobs = await jobsOf(workflowId).catch(() => []);
    for (const job of jobs) {
      if (BUSY.has(String(await job.getState()))) return true;
    }
  }
  return false;
}
