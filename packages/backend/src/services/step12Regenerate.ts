/**
 * Regenerating Step 12 in full.
 *
 * Once every module had packs, POST /step12 found nothing left to generate and returned the
 * existing packs, and the page offered only View Packs and Approve. Logan Pacey (AGU, 21
 * November 2026) could not regenerate the Logistics pilot's 12 November packs, so none of the
 * later Step 12 fixes could be checked, and Step 14 kept taking graded work from those packs.
 *
 * A regeneration snapshots the packs (the route calls snapshotStep first, which includes the
 * offloaded rows), removes them, marks Step 12 in progress and queues the first module; the
 * queue chains through the rest. It is refused while a Step 12 job is already running, so two
 * runs never write the same programme's packs at once.
 */
import mongoose from 'mongoose';
import { CurriculumWorkflow } from '../models/CurriculumWorkflow';
import { deleteWorkflowPacks } from './step12Store';
import { loggingService } from './loggingService';

export interface QueueJobState {
  state: string;
  moduleIndex?: number;
}

const BUSY = new Set(['active', 'waiting', 'delayed']);

/** Why a regeneration cannot start now, or null when it can. */
export function regenerationBlocker(jobs: QueueJobState[]): string | null {
  const busy = jobs.filter((j) => BUSY.has(j.state));
  if (!busy.length) return null;
  const modules = busy
    .map((j) => (typeof j.moduleIndex === 'number' ? j.moduleIndex + 1 : null))
    .filter((n): n is number => n !== null);
  return `Step 12 is already generating${
    modules.length ? ` (module ${modules.join(', ')})` : ''
  }. Wait for it to finish, then regenerate.`;
}

/** The update that empties Step 12 and marks it in progress, as of `now`. */
export function step12ResetUpdate(now: Date) {
  return {
    update: {
      $set: {
        step12: { moduleAssignmentPacks: [], regenerationStartedAt: now },
        'stepProgress.$[p].status': 'in_progress',
        'stepProgress.$[p].startedAt': now,
      },
      $unset: {
        'stepProgress.$[p].completedAt': '',
        'stepProgress.$[p].error': '',
        'stepProgress.$[p].failedAt': '',
      },
    },
    options: { arrayFilters: [{ 'p.step': 12 }] },
  };
}

export async function resetStep12ForRegeneration(
  workflowId: string,
  jobs: QueueJobState[]
): Promise<void> {
  const blocker = regenerationBlocker(jobs);
  if (blocker) {
    const error = new Error(blocker) as Error & { status?: number };
    error.status = 409;
    throw error;
  }
  await deleteWorkflowPacks(workflowId);
  const { update, options } = step12ResetUpdate(new Date());
  await CurriculumWorkflow.updateOne(
    { _id: new mongoose.Types.ObjectId(workflowId) },
    update,
    options
  );
  loggingService.info('Step 12 cleared for a full regeneration', { workflowId });
}
