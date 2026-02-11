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
async function processStepJob(stepNumber: number, workflowId: string, input?: Record<string, any>) {
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
      return workflowService.processStep8(workflowId);
    case 9:
      return workflowService.processStep9(workflowId);
    case 13:
      return workflowService.processStep13(workflowId);
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
      await job.progress(10);

      const updatedWorkflow = await processStepJob(stepNumber, workflowId, input);

      await job.progress(100);

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

  stepQueue.on('failed', (job: Job<StepJobData>, error: Error) => {
    loggingService.error('Step job failed', {
      jobId: String(job.id),
      stepNumber: job.data.stepNumber,
      workflowId: job.data.workflowId,
      error: error.message,
      attempts: job.attemptsMade,
      maxAttempts: job.opts.attempts,
    });
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

  const job = await stepQueue.add(
    { stepNumber, workflowId, userId, input },
    { jobId, priority: 1 }
  );

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
