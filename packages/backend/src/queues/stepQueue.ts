/**
 * Generic Step Background Job Queue
 * Handles long-running Steps 1-9 AI generation in the background
 *
 * Features:
 * - Single queue for all steps 1-9
 * - Survives server restarts
 * - Automatic retries on failure (3 attempts with exponential backoff)
 * - No HTTP timeout issues - works within Render's proxy limits
 * - Graceful fallback when Redis is unavailable
 */

import Bull, { Queue, Job } from 'bull';
import { loggingService } from '../services/loggingService';
import { workflowService } from '../services/workflowService';
import { CurriculumWorkflow } from '../models/CurriculumWorkflow';
import config from '../config';

// Job data interface - generic for all steps
export interface StepJobData {
  stepNumber: number; // 1-9, 13
  workflowId: string;
  userId?: string;
  input?: Record<string, any>; // Step-specific form data (Steps 1, 2, 3, 7 need this)
}

// Job result interface
export interface StepJobResult {
  stepNumber: number;
  workflowId: string;
  success: boolean;
  currentStep?: number;
  workflowStatus?: string;
  error?: string;
}

// Create the queue only if Redis is configured
let stepQueue: Queue<StepJobData> | null = null;

const redisUrl = config.redis?.url;

if (redisUrl && redisUrl.length > 0) {
  try {
    stepQueue = new Bull('step-generation', redisUrl, {
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 60000, // Start with 1 minute delay
        },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
      settings: {
        lockDuration: 600000, // 10 min — long-running LLM calls need extended locks
        stalledInterval: 600000,
        lockRenewTime: 300000,
        // After one stall (e.g. the API process was restarted mid-generation),
        // move the job to `failed` so the failed-handler resets the stuck step
        // progress instead of the job looping active<->stalled forever.
        maxStalledCount: 1,
      },
    });

    loggingService.info('Generic step queue initialized with Redis');
  } catch (error) {
    loggingService.warn('Failed to initialize generic step queue, background jobs disabled', {
      error: error instanceof Error ? error.message : String(error),
    });
    stepQueue = null;
  }
} else {
  loggingService.warn('Redis not configured, generic step queue disabled');
}

export { stepQueue };

/**
 * Routes step number to the correct workflowService method
 */
async function processStepJob(
  stepNumber: number,
  workflowId: string,
  input?: Record<string, any>,
  onProgress?: (pct: number) => void
) {
  switch (stepNumber) {
    case 1:
      return workflowService.processStep1(workflowId, input as any);
    case 2:
      return workflowService.processStep2(workflowId, input as any);
    case 3:
      return workflowService.processStep3(workflowId, input as any);
    case 4:
      return workflowService.processStep4(workflowId);
    case 5:
      return workflowService.processStep5(workflowId);
    case 6:
      return workflowService.processStep6(workflowId);
    case 7:
      return workflowService.processStep7(workflowId, input as any);
    case 8:
      return workflowService.processStep8(workflowId, onProgress);
    case 9:
      return workflowService.processStep9(workflowId);
    case 13:
      return workflowService.processStep13(workflowId, onProgress);
    default:
      throw new Error(`Unknown step number: ${stepNumber}`);
  }
}

// Process jobs only if queue is available
if (stepQueue) {
  stepQueue.process(async (job: Job<StepJobData>) => {
    const { stepNumber, workflowId, input } = job.data;

    loggingService.info('Processing step job', {
      jobId: String(job.id),
      stepNumber,
      workflowId,
      attempt: job.attemptsMade + 1,
    });

    try {
      await job.progress(0);

      const updatedWorkflow = await processStepJob(stepNumber, workflowId, input, (pct: number) => {
        job.progress(pct);
      });

      await job.progress(100);

      // Clear any failure recorded by an earlier attempt, so a stale error is
      // not left sitting above content that has since generated successfully.
      const stepKey = `step${stepNumber}`;
      if ((updatedWorkflow as any)[stepKey]?.lastError) {
        delete (updatedWorkflow as any)[stepKey].lastError;
        updatedWorkflow.markModified(stepKey);
        await updatedWorkflow.save();
      }

      loggingService.info('Step job completed', {
        jobId: String(job.id),
        stepNumber,
        workflowId,
        currentStep: updatedWorkflow.currentStep,
      });

      return {
        stepNumber,
        workflowId,
        success: true,
        currentStep: updatedWorkflow.currentStep,
        workflowStatus: updatedWorkflow.status,
      } as StepJobResult;
    } catch (error) {
      loggingService.error('Step job failed', {
        jobId: String(job.id),
        stepNumber,
        workflowId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  });

  // Event handlers
  stepQueue.on('completed', (job: Job<StepJobData>, result: StepJobResult) => {
    loggingService.info('Step job completed', {
      jobId: String(job.id),
      stepNumber: job.data.stepNumber,
      workflowId: job.data.workflowId,
      success: result.success,
    });
  });

  stepQueue.on('failed', async (job: Job<StepJobData>, error: Error) => {
    loggingService.error('Step job failed', {
      jobId: String(job.id),
      stepNumber: job.data.stepNumber,
      workflowId: job.data.workflowId,
      error: error.message,
      attempts: job.attemptsMade,
      maxAttempts: job.opts.attempts,
    });

    // Only act once retries are exhausted, otherwise an intermediate failure
    // would prematurely reset progress mid-retry.
    const maxAttempts = job.opts.attempts || 1;
    if (job.attemptsMade < maxAttempts) return;

    // A terminally-failed job (e.g. an LLM error, or the worker being restarted
    // mid-run) otherwise leaves stepProgress stuck on "in_progress" forever, so
    // the long-running steps (10-13) hang the UI on "Generating…". Reset it to
    // "pending" so the step is re-triggerable instead of dead-locked.
    try {
      const { stepNumber, workflowId } = job.data;
      const workflow = await CurriculumWorkflow.findById(workflowId);
      const sp = workflow?.stepProgress?.find((p: any) => p.step === stepNumber);
      if (sp && sp.status === 'in_progress') {
        sp.status = 'pending';
        workflow!.markModified('stepProgress');
      }

      // Record the failure on the step itself. Without this a failed
      // regeneration is indistinguishable from nothing having happened: the
      // previous content is still on screen, no error is shown anywhere, and the
      // author is left pressing the button again.
      const stepKey = `step${stepNumber}`;
      if (workflow && (workflow as any)[stepKey]) {
        (workflow as any)[stepKey].lastError = {
          message: error.message,
          failedAt: new Date(),
          attempts: job.attemptsMade,
        };
        workflow.markModified(stepKey);
      }

      if (workflow) {
        await workflow.save();
        loggingService.info('Recorded terminal step failure on the workflow', {
          stepNumber,
          workflowId,
        });
      }
    } catch (persistError) {
      loggingService.error('Failed to reset step progress after failure', {
        workflowId: job.data.workflowId,
        error: persistError instanceof Error ? persistError.message : String(persistError),
      });
    }
  });

  stepQueue.on('stalled', (job: Job<StepJobData>) => {
    loggingService.warn('Step job stalled', {
      jobId: String(job.id),
      stepNumber: job.data.stepNumber,
      workflowId: job.data.workflowId,
    });
  });

  stepQueue.on('progress', (job: Job<StepJobData>, progress: number) => {
    loggingService.debug('Step job progress', {
      jobId: String(job.id),
      stepNumber: job.data.stepNumber,
      workflowId: job.data.workflowId,
      progress,
    });
  });
}

// Helper function to add a step job
export async function addStepJob(
  stepNumber: number,
  workflowId: string,
  userId?: string,
  input?: Record<string, any>
): Promise<Job<StepJobData> | null> {
  if (!stepQueue) {
    loggingService.warn('Step queue not available, cannot add job', {
      stepNumber,
      workflowId,
    });
    return null;
  }

  const jobId = `step${stepNumber}-${workflowId}`;

  // Step 13 (summative exam) has 5 sequential LLM calls — give it more time
  // but cap it to prevent infinite runs. Other steps are faster.
  const isStep13 = stepNumber === 13;
  const jobOptions: any = {
    jobId,
    priority: 1,
    ...(isStep13
      ? {
          timeout: 3600000, // 60 min hard cap for Step 13 (GPT-5.2 high thinking: 5-10 min per phase × 5 phases)
          attempts: 2, // Only 1 retry (2 total attempts)
          backoff: { type: 'fixed' as const, delay: 10000 }, // 10s between retries
        }
      : {}),
  };

  const job = await stepQueue.add({ stepNumber, workflowId, userId, input }, jobOptions);

  loggingService.info('Step job queued', {
    jobId: String(job.id),
    stepNumber,
    workflowId,
  });

  return job;
}

// Helper function to get job status
export async function getStepJobStatus(stepNumber: number, workflowId: string) {
  if (!stepQueue) {
    return null;
  }

  const jobId = `step${stepNumber}-${workflowId}`;
  const job = await stepQueue.getJob(jobId);

  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress = job.progress();

  return {
    jobId: String(job.id),
    state,
    progress,
    attemptsMade: job.attemptsMade,
    data: job.data,
    returnvalue: job.returnvalue,
    finishedOn: job.finishedOn,
    processedOn: job.processedOn,
    failedReason: job.failedReason,
  };
}

// Helper function to remove a completed/failed job so it can be re-submitted
/**
 * Whether an "active" job has actually been abandoned.
 *
 * Bull marks a job active while a worker holds its lock. When the process dies mid-run — a
 * deploy, a restart, an OOM — nothing releases that lock; the job stays "active" until the
 * stalled sweep notices, which runs on `stalledInterval` (ten minutes) and only after the
 * lock has expired (another ten). So for up to twenty minutes after a deploy a step reports
 * "already in progress", the Regenerate button silently does nothing, and the author is left
 * looking at a screen that will never change. That happened to this programme's reviewer
 * twice in one afternoon.
 *
 * A job whose worker started it longer ago than the lock could possibly survive, and which
 * has not finished, has no live worker behind it.
 */
export async function isStepJobAbandoned(stepNumber: number, workflowId: string): Promise<boolean> {
  if (!stepQueue) return false;
  const job = await stepQueue.getJob(`step${stepNumber}-${workflowId}`);
  if (!job) return false;

  const state = await job.getState();
  if (state !== 'active') return false;
  if (!job.processedOn || job.finishedOn) return false;

  // Twice the lock duration: a live worker renews its lock every lockDuration/2, so anything
  // older than two full periods has certainly stopped renewing.
  const LOCK_DURATION_MS = 600000;
  return Date.now() - job.processedOn > LOCK_DURATION_MS * 2;
}

export async function removeStepJob(stepNumber: number, workflowId: string): Promise<boolean> {
  if (!stepQueue) {
    return false;
  }

  const jobId = `step${stepNumber}-${workflowId}`;
  const job = await stepQueue.getJob(jobId);

  if (!job) {
    return true; // Nothing to remove
  }

  const state = await job.getState();

  // Only remove completed or failed jobs — don't remove active/waiting ones
  if (state === 'completed' || state === 'failed') {
    await job.remove();
    loggingService.info('Step job removed for re-submission', {
      jobId,
      stepNumber,
      workflowId,
      previousState: state,
    });
    return true;
  }

  return false; // Job is still active
}

// Graceful shutdown
export async function closeStepQueue() {
  if (stepQueue) {
    await stepQueue.close();
    loggingService.info('Generic step queue closed');
  }
}
