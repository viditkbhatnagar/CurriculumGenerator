/**
 * Step 10 Background Job Queue
 * Handles long-running Step 10 module generation in the background
 *
 * Features:
 * - Processes one module at a time
 * - Survives server restarts
 * - Automatic retries on failure
 * - Progress tracking via WebSocket
 * - No HTTP timeout issues
 */

import Bull, { Queue, Job } from 'bull';
import { loggingService } from '../services/loggingService';
import { workflowService } from '../services/workflowService';
import { CurriculumWorkflow } from '../models/CurriculumWorkflow';
import config from '../config';
import { completedModuleIds, nextIncompleteModuleIndex } from '../services/step10Completion';

// Job data interface
export interface Step10JobData {
  workflowId: string;
  moduleIndex: number; // Which module to generate (0-based)
  userId?: string;
}

// Job result interface
export interface Step10JobResult {
  workflowId: string;
  moduleIndex: number;
  modulesGenerated: number;
  totalModules: number;
  allComplete: boolean;
  totalLessons: number;
  totalContactHours: number;
}

// Create the queue only if Redis is configured
let step10Queue: Queue<Step10JobData> | null = null;

/**
 * Redis is configured by URL, as it is for every other queue.
 *
 * This file asked for `config.redis.host` and `config.redis.port`, which have never existed
 * on the config object — it carries `url`, `tls`, `maxRetries` and `retryDelay`. Both read
 * `undefined`, the guard was always false, and so this queue has never once been created.
 * Everything below it — the retries, the auto-chaining from one module to the next, the
 * survival of a restart — has been dead code, and Step 10 has instead been running
 * fire-and-forget inside the API web process from the route's fallback branch.
 *
 * That is why the reviewer had to click "Generate" for each module in turn and wait forty
 * minutes in front of it, and why any deploy in that window silently lost the work.
 */
const redisUrl = config.redis?.url;

if (redisUrl && redisUrl.length > 0) {
  try {
    step10Queue = new Bull('step10-generation', redisUrl, {
      defaultJobOptions: {
        attempts: 3, // Retry up to 3 times on failure
        /**
         * A 45-hour module is 30 lessons at roughly a minute and a half each, so a module
         * runs for about 40 minutes and the old 20-minute timeout could not have completed
         * one. Generation resumes from the lessons already stored, so a job that does hit
         * this ceiling picks up where it stopped instead of starting again.
         */
        timeout: 5400000, // 90 min per module
        backoff: {
          type: 'exponential',
          delay: 60000, // Start with 1 minute delay
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 200, // Keep last 200 failed jobs
      },
      settings: {
        // Longer than the job can run, so a module in progress is never declared stalled and
        // handed to a second worker that would generate the same lessons again.
        lockDuration: 5400000,
        stalledInterval: 5400000,
        lockRenewTime: 300000,
      },
    });

    loggingService.info('Step 10 queue initialized with Redis');
  } catch (error) {
    loggingService.warn('Failed to initialize Step 10 queue, background jobs disabled', {
      error: error instanceof Error ? error.message : String(error),
    });
    step10Queue = null;
  }
} else {
  loggingService.warn('Redis not configured, Step 10 background jobs disabled');
}

export { step10Queue };

// Process jobs only if queue is available
/**
 * How many modules generate at once.
 *
 * A 45-hour module is 30 lessons generated in sequence — each one is shown the lessons before
 * it so it does not repeat them — so a module takes around 40 minutes and cannot be made
 * faster from inside. Modules are independent of each other, though, and 46 of them one after
 * another is over a day of waiting.
 *
 * Tunable without a deploy because the ceiling is the OpenAI account's rate limit rather than
 * anything here: too high and calls come back 429 and get retried, which makes the step
 * slower rather than faster.
 */
const STEP10_MODULE_CONCURRENCY = Number(process.env.STEP10_MODULE_CONCURRENCY) || 5;

if (step10Queue) {
  step10Queue.process(STEP10_MODULE_CONCURRENCY, async (job: Job<Step10JobData>) => {
    const { workflowId, moduleIndex } = job.data;

    loggingService.info('Processing Step 10 job', {
      jobId: job.id,
      workflowId,
      moduleIndex,
      attempt: job.attemptsMade + 1,
    });

    try {
      // Update job progress
      await job.progress(0);

      // Get workflow
      const workflow = await CurriculumWorkflow.findById(workflowId);
      if (!workflow) {
        throw new Error('Workflow not found');
      }

      const modules = workflow.step4?.modules || [];
      const totalModules = new Set(modules.map((m: any) => m.id)).size;

      // Complete means holding every planned lesson, not merely having an entry — see
      // step10Completion. A partially generated module comes back here to be finished.
      const done = completedModuleIds(modules, workflow.step10 as any);
      const existingModules = done.size;

      // This job's own module, so several can run at once without two of them picking the
      // same one. Falls back to the next incomplete module when this job's is already done.
      const claimIsOpen =
        moduleIndex >= 0 && moduleIndex < modules.length && !done.has(modules[moduleIndex]?.id);
      const nextModuleIndex = claimIsOpen
        ? moduleIndex
        : nextIncompleteModuleIndex(modules, workflow.step10 as any);

      // Check if all modules are already generated
      if (nextModuleIndex === -1) {
        loggingService.info('All module lesson plans already generated, skipping', {
          workflowId,
          moduleIndex,
          existingModules,
        });

        return {
          workflowId,
          moduleIndex,
          modulesGenerated: existingModules,
          totalModules,
          allComplete: true,
          totalLessons: workflow.step10?.summary?.totalLessons || 0,
          totalContactHours: workflow.step10?.summary?.totalContactHours || 0,
        };
      }

      await job.progress(10);

      // Generate the next module
      loggingService.info('Generating lesson plans for module', {
        workflowId,
        moduleNumber: nextModuleIndex + 1,
        moduleId: modules[nextModuleIndex]?.id,
        totalModules,
      });

      const updatedWorkflow = await workflowService.processStep10NextModule(
        workflowId,
        nextModuleIndex
      );

      await job.progress(90);

      const newCompletedIds = completedModuleIds(modules, updatedWorkflow.step10 as any);
      const newModulesCount = newCompletedIds.size;
      const allComplete = newModulesCount >= totalModules;

      loggingService.info('Module generation complete', {
        jobId: job.id,
        workflowId,
        moduleIndex,
        modulesGenerated: newModulesCount,
        totalModules,
        allComplete,
      });

      await job.progress(100);

      // Every remaining module is queued up front, so this is a safety net rather than the
      // mechanism: it picks up a module whose job was lost, and adding a job whose id is
      // already waiting is a no-op.
      if (!allComplete) {
        const nextUngenIndex = nextIncompleteModuleIndex(modules, updatedWorkflow.step10 as any);
        if (nextUngenIndex !== -1) {
          await addStep10Job(workflowId, nextUngenIndex, job.data.userId);
          loggingService.info('Queued next module for lesson plans', {
            workflowId,
            nextModuleIndex: nextUngenIndex,
            nextModuleId: modules[nextUngenIndex]?.id,
          });
        }
      }

      return {
        workflowId,
        moduleIndex,
        modulesGenerated: newModulesCount,
        totalModules,
        allComplete,
        totalLessons: updatedWorkflow.step10?.summary?.totalLessons || 0,
        totalContactHours: updatedWorkflow.step10?.summary?.totalContactHours || 0,
      };
    } catch (error) {
      loggingService.error('Step 10 job failed', {
        jobId: job.id,
        workflowId,
        moduleIndex,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  });

  // Event handlers
  step10Queue.on('completed', (job: Job<Step10JobData>, result: Step10JobResult) => {
    loggingService.info('Step 10 job completed', {
      jobId: job.id,
      workflowId: job.data.workflowId,
      moduleIndex: job.data.moduleIndex,
      modulesGenerated: result.modulesGenerated,
      totalModules: result.totalModules,
      allComplete: result.allComplete,
    });
  });

  step10Queue.on('failed', (job: Job<Step10JobData>, error: Error) => {
    loggingService.error('Step 10 job failed', {
      jobId: job.id,
      workflowId: job.data.workflowId,
      moduleIndex: job.data.moduleIndex,
      error: error.message,
      attempts: job.attemptsMade,
      maxAttempts: job.opts.attempts,
    });
  });

  step10Queue.on('stalled', (job: Job<Step10JobData>) => {
    loggingService.warn('Step 10 job stalled', {
      jobId: job.id,
      workflowId: job.data.workflowId,
      moduleIndex: job.data.moduleIndex,
    });
  });

  step10Queue.on('progress', (job: Job<Step10JobData>, progress: number) => {
    loggingService.debug('Step 10 job progress', {
      jobId: job.id,
      workflowId: job.data.workflowId,
      moduleIndex: job.data.moduleIndex,
      progress,
    });
  });
}

// Helper function to add a job
export async function addStep10Job(
  workflowId: string,
  moduleIndex: number,
  userId?: string
): Promise<Job<Step10JobData> | null> {
  if (!step10Queue) {
    loggingService.warn('Step 10 queue not available, cannot add job', {
      workflowId,
      moduleIndex,
    });
    return null;
  }

  // Remove any stale job with the same ID (completed/failed from previous attempts)
  const jobId = `step10-${workflowId}-module-${moduleIndex}`;
  try {
    const existingJob = await step10Queue.getJob(jobId);
    if (existingJob) {
      const state = await existingJob.getState();
      if (['completed', 'failed'].includes(state)) {
        await existingJob.remove();
        loggingService.info('Removed stale Step 10 job before re-queue', {
          jobId,
          previousState: state,
        });
      }
    }
  } catch (_e) {
    // Ignore
  }

  const job = await step10Queue.add(
    {
      workflowId,
      moduleIndex,
      userId,
    },
    {
      jobId,
      priority: 1,
    }
  );

  loggingService.info('Step 10 job queued', {
    jobId: job.id,
    workflowId,
    moduleIndex,
  });

  return job;
}

// Helper function to queue all remaining modules
export async function queueAllRemainingModules(
  workflowId: string,
  userId?: string
): Promise<Job<Step10JobData>[]> {
  if (!step10Queue) {
    loggingService.warn('Step 10 queue not available, cannot queue modules', {
      workflowId,
    });
    return [];
  }

  // Check if there are already active or waiting jobs for this workflow
  // Prevents double-queueing when user clicks generate while auto-chaining is active
  const existingJobs = await step10Queue.getJobs(['active', 'waiting', 'delayed']);
  const hasActiveJob = existingJobs.some((j) => j.data.workflowId === workflowId);
  if (hasActiveJob) {
    loggingService.info('Step 10 job already active/waiting for this workflow, skipping', {
      workflowId,
    });
    return [];
  }

  const workflow = await CurriculumWorkflow.findById(workflowId);
  if (!workflow) {
    throw new Error('Workflow not found');
  }

  // Find the first ungenerated module by scanning step4 modules
  const modules = workflow.step4?.modules || [];
  const done = completedModuleIds(modules, workflow.step10 as any);

  const jobs: Job<Step10JobData>[] = [];

  // Every module that still needs work, each as its own job carrying its own module index.
  // Queueing only the next one and chaining from it meant the programme could never generate
  // more than one module at a time, however much capacity there was.
  for (let i = 0; i < modules.length; i++) {
    const module = modules[i];
    if (!module?.id || done.has(module.id)) continue;
    const job = await addStep10Job(workflowId, i, userId);
    if (job) jobs.push(job);
  }

  return jobs;
}

// Helper function to get job status
export async function getStep10JobStatus(workflowId: string, moduleIndex: number) {
  if (!step10Queue) {
    return null;
  }

  const jobId = `step10-${workflowId}-module-${moduleIndex}`;
  const job = await step10Queue.getJob(jobId);

  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress = job.progress();

  return {
    jobId: job.id,
    state,
    progress,
    attemptsMade: job.attemptsMade,
    data: job.data,
    finishedOn: job.finishedOn,
    processedOn: job.processedOn,
    failedReason: job.failedReason,
  };
}

// Helper function to get all jobs for a workflow
export async function getAllStep10Jobs(workflowId: string) {
  if (!step10Queue) {
    return [];
  }

  const jobs = await step10Queue.getJobs(['waiting', 'active', 'completed', 'failed', 'delayed']);
  return jobs.filter((job) => job.data.workflowId === workflowId);
}

// Graceful shutdown
export async function closeStep10Queue() {
  if (step10Queue) {
    await step10Queue.close();
    loggingService.info('Step 10 queue closed');
  }
}
