/**
 * Step 12 Background Job Queue
 * Handles long-running Step 12 Assignment Pack generation in the background
 *
 * Features:
 * - Processes one module at a time (3 delivery variants per module)
 * - Auto-chains: completes module N, queues module N+1
 * - Survives server restarts
 * - Automatic retries on failure
 * - No HTTP timeout issues
 */

import Bull, { Queue, Job } from 'bull';
import { loggingService } from '../services/loggingService';
import { workflowService } from '../services/workflowService';
import { withUsageContext } from '../services/usageContext';
import { CurriculumWorkflow } from '../models/CurriculumWorkflow';
import {
  completePackModuleIds,
  nextIncompleteModuleIndex,
} from '../services/deliverableValidation';
import config from '../config';

// Job data interface
export interface Step12JobData {
  workflowId: string;
  moduleIndex: number; // Which module to generate assignment packs for (0-based)
  userId?: string;
}

// Job result interface
export interface Step12JobResult {
  workflowId: string;
  moduleIndex: number;
  modulesGenerated: number;
  totalModules: number;
  allComplete: boolean;
  totalAssignmentPacks: number;
}

// Create the queue only if Redis is configured
let step12Queue: Queue<Step12JobData> | null = null;

const redisUrl = config.redis?.url;

if (redisUrl && redisUrl.length > 0) {
  try {
    step12Queue = new Bull('step12-assignment-packs', redisUrl, {
      defaultJobOptions: {
        attempts: 3,
        // A module's variants run in parallel; each makes up to two attempts of up to two
        // 10-minute calls, so 40 minutes is the worst case and the job must outlast it.
        timeout: 3600000,
        backoff: {
          type: 'exponential',
          delay: 60000,
        },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
      settings: {
        lockDuration: 600000, // 10 min — long-running LLM calls need extended locks
        stalledInterval: 600000,
        lockRenewTime: 300000,
      },
    });

    loggingService.info('Step 12 queue initialized with Redis URL');
  } catch (error) {
    loggingService.warn('Failed to initialize Step 12 queue, background jobs disabled', {
      error: error instanceof Error ? error.message : String(error),
    });
    step12Queue = null;
  }
} else {
  loggingService.info(
    'Redis not configured (no REDIS_URL), Step 12 will use synchronous generation'
  );
}

export { step12Queue };

// Process jobs only if queue is available
if (step12Queue) {
  step12Queue.process(async (job: Job<Step12JobData>) => {
    const { workflowId, moduleIndex } = job.data;

    loggingService.info('Processing Step 12 job', {
      jobId: job.id,
      workflowId,
      moduleIndex,
      attempt: job.attemptsMade + 1,
    });

    try {
      await job.progress(0);

      const workflow = await CurriculumWorkflow.findById(workflowId);
      if (!workflow) {
        throw new Error('Workflow not found');
      }

      const modules = workflow.step4?.modules || [];
      const totalModules = new Set(modules.map((m: any) => m.id)).size;
      if (totalModules === 0) {
        throw new Error('No modules found in Step 4. Complete Step 4 first.');
      }

      // Modules whose three variants are all generated (placeholders do not count)
      const completedModuleIds = completePackModuleIds(
        (workflow.step12?.moduleAssignmentPacks || []) as any
      );
      const existingModules = completedModuleIds.size;

      // The module this job was queued for, if it still needs work; else the first incomplete
      const nextModuleIndex =
        modules[moduleIndex] && !completedModuleIds.has(modules[moduleIndex].id)
          ? moduleIndex
          : modules.findIndex((m: any) => !completedModuleIds.has(m.id));

      // Check if all modules are already generated
      if (nextModuleIndex === -1) {
        loggingService.info('All module assignment packs already generated, skipping', {
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
          totalAssignmentPacks: existingModules * 3,
        };
      }

      await job.progress(10);

      loggingService.info('Generating assignment packs for module', {
        workflowId,
        moduleNumber: nextModuleIndex + 1,
        moduleId: modules[nextModuleIndex]?.id,
        totalModules,
      });

      const updatedWorkflow = await withUsageContext({ workflowId, step: 12 }, () =>
        workflowService.processStep12NextModule(workflowId, nextModuleIndex)
      );

      await job.progress(90);

      const newCompletedIds = completePackModuleIds(
        (updatedWorkflow.step12?.moduleAssignmentPacks || []) as any
      );
      const newModulesCount = newCompletedIds.size;
      const allComplete = newModulesCount >= totalModules;

      loggingService.info('Module assignment pack generation complete', {
        jobId: job.id,
        workflowId,
        moduleIndex,
        modulesGenerated: newModulesCount,
        totalModules,
        allComplete,
      });

      await job.progress(100);

      // If not all complete, find and queue the next ungenerated module
      // Wrapped in try/catch so a chaining failure doesn't fail the current (already-saved) job
      if (!allComplete) {
        try {
          const nextUngenIndex = nextIncompleteModuleIndex(
            modules,
            newCompletedIds,
            nextModuleIndex,
            true
          );
          if (nextUngenIndex !== -1) {
            await addStep12Job(workflowId, nextUngenIndex, job.data.userId);
            loggingService.info('Queued next module for assignment packs', {
              workflowId,
              nextModuleIndex: nextUngenIndex,
              nextModuleId: modules[nextUngenIndex]?.id,
            });
          }
        } catch (chainError) {
          loggingService.error('Failed to chain next Step 12 module job', {
            workflowId,
            error: chainError instanceof Error ? chainError.message : String(chainError),
          });
        }
      }

      return {
        workflowId,
        moduleIndex,
        modulesGenerated: newModulesCount,
        totalModules,
        allComplete,
        totalAssignmentPacks: newModulesCount * 3,
      };
    } catch (error) {
      loggingService.error('Step 12 job failed', {
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
  step12Queue.on('completed', (job: Job<Step12JobData>, result: Step12JobResult) => {
    loggingService.info('Step 12 job completed', {
      jobId: job.id,
      workflowId: job.data.workflowId,
      moduleIndex: job.data.moduleIndex,
      modulesGenerated: result.modulesGenerated,
      totalModules: result.totalModules,
      allComplete: result.allComplete,
    });
  });

  step12Queue.on('failed', async (job: Job<Step12JobData>, error: Error) => {
    loggingService.error('Step 12 job failed', {
      jobId: job.id,
      workflowId: job.data.workflowId,
      moduleIndex: job.data.moduleIndex,
      error: error.message,
      attempts: job.attemptsMade,
      maxAttempts: job.opts.attempts,
    });

    // Only act once the job has exhausted its retries — otherwise an intermediate
    // failure would prematurely surface an error / clear progress mid-retry.
    const maxAttempts = job.opts.attempts || 1;
    if (job.attemptsMade < maxAttempts) return;

    // Persist the failure and clear the stale "generating" progress so the frontend
    // can detect the dead job and offer a retry, instead of polling generationProgress
    // forever (which is exactly what left an imported workflow stuck at "0%").
    try {
      const workflow = await CurriculumWorkflow.findById(job.data.workflowId);
      if (workflow?.step12) {
        const s12 = workflow.step12 as any;
        s12.lastError = {
          message: error.message,
          moduleIndex: job.data.moduleIndex,
          timestamp: new Date(),
        };
        s12.generationProgress = undefined;
        workflow.markModified('step12');
        await workflow.save();

        // Move on to the modules after this one. Stopping here left every later module
        // ungenerated behind one that kept failing; this one stays marked failed for a retry.
        const modules = workflow.step4?.modules || [];
        const next = nextIncompleteModuleIndex(
          modules,
          completePackModuleIds((s12.moduleAssignmentPacks || []) as any),
          job.data.moduleIndex,
          false
        );
        if (next !== -1) await addStep12Job(job.data.workflowId, next, job.data.userId);
      }
    } catch (persistError) {
      loggingService.error('Failed to persist Step 12 lastError', {
        workflowId: job.data.workflowId,
        error: persistError instanceof Error ? persistError.message : String(persistError),
      });
    }
  });

  step12Queue.on('stalled', (job: Job<Step12JobData>) => {
    loggingService.warn('Step 12 job stalled', {
      jobId: job.id,
      workflowId: job.data.workflowId,
      moduleIndex: job.data.moduleIndex,
    });
  });
}

// Helper function to add a job
export async function addStep12Job(
  workflowId: string,
  moduleIndex: number,
  userId?: string
): Promise<Job<Step12JobData> | null> {
  if (!step12Queue) {
    loggingService.warn('Step 12 queue not available, cannot add job', {
      workflowId,
      moduleIndex,
    });
    return null;
  }

  // Remove any stale job with the same ID (completed/failed from previous attempts)
  const jobId = `step12-${workflowId}-module-${moduleIndex}`;
  try {
    const existingJob = await step12Queue.getJob(jobId);
    if (existingJob) {
      const state = await existingJob.getState();
      if (['completed', 'failed'].includes(state)) {
        await existingJob.remove();
        loggingService.info('Removed stale Step 12 job before re-queue', {
          jobId,
          previousState: state,
        });
      }
    }
  } catch (_e) {
    // Ignore
  }

  const job = await step12Queue.add(
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

  loggingService.info('Step 12 job queued', {
    jobId: job.id,
    workflowId,
    moduleIndex,
  });

  return job;
}

// Helper function to queue all remaining modules
export async function queueAllRemainingStep12Modules(
  workflowId: string,
  userId?: string,
  preferredModuleIndex?: number
): Promise<Job<Step12JobData>[]> {
  if (!step12Queue) {
    loggingService.warn('Step 12 queue not available, cannot queue modules', {
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
  const completedModuleIds = completePackModuleIds(
    (workflow.step12?.moduleAssignmentPacks || []) as any
  );
  // The module a page button asked for, if it still needs work; else the first incomplete.
  const nextModuleIndex =
    typeof preferredModuleIndex === 'number' &&
    modules[preferredModuleIndex] &&
    !completedModuleIds.has(modules[preferredModuleIndex].id)
      ? preferredModuleIndex
      : modules.findIndex((m: any) => !completedModuleIds.has(m.id));

  const jobs: Job<Step12JobData>[] = [];

  // Queue only the next ungenerated module (auto-chaining handles the rest)
  if (nextModuleIndex !== -1) {
    const job = await addStep12Job(workflowId, nextModuleIndex, userId);
    if (job) {
      jobs.push(job);
    }
  }

  return jobs;
}

// Helper function to get job status
export async function getStep12JobStatus(workflowId: string, moduleIndex: number) {
  if (!step12Queue) {
    return null;
  }

  const jobId = `step12-${workflowId}-module-${moduleIndex}`;
  const job = await step12Queue.getJob(jobId);

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
export async function getAllStep12Jobs(workflowId: string) {
  if (!step12Queue) {
    return [];
  }

  const jobs = await step12Queue.getJobs(['waiting', 'active', 'completed', 'failed', 'delayed']);
  return jobs.filter((job) => job.data.workflowId === workflowId);
}

/**
 * What the queue is doing for one programme: its jobs by state, newest first, plus the
 * queue's own counts, whether it is paused and how many workers are connected. The status
 * route used to report `getJobs(...)[length - 1]`, which lists waiting jobs first and old
 * completed ones last, so a job stuck in "waiting" showed as a finished job from days before.
 */
export async function describeStep12Queue(workflowId: string) {
  if (!step12Queue) return { available: false as const };
  const [counts, paused, jobs] = await Promise.all([
    step12Queue.getJobCounts(),
    step12Queue.isPaused(),
    step12Queue.getJobs(['active', 'waiting', 'delayed', 'failed', 'completed'], 0, 500),
  ]);
  let workers: number | null = null;
  try {
    workers = (await step12Queue.getWorkers()).length;
  } catch {
    // CLIENT LIST can be disabled on managed Redis; leave unknown rather than guess.
  }
  const mine = await Promise.all(
    jobs
      .filter((job) => job?.data?.workflowId === workflowId)
      .map(async (job) => ({
        jobId: String(job.id),
        state: await job.getState(),
        moduleIndex: job.data.moduleIndex,
        attemptsMade: job.attemptsMade,
        queuedAt: job.timestamp ? new Date(job.timestamp) : null,
        startedAt: job.processedOn ? new Date(job.processedOn) : null,
        finishedAt: job.finishedOn ? new Date(job.finishedOn) : null,
        failedReason: job.failedReason || null,
      }))
  );
  mine.sort((a, b) => (b.queuedAt?.getTime() || 0) - (a.queuedAt?.getTime() || 0));
  const live = mine.find((j) => ['active', 'waiting', 'delayed'].includes(j.state));
  return {
    available: true as const,
    paused,
    workers,
    counts,
    current: live || mine[0] || null,
    jobs: mine.slice(0, 10),
  };
}

// Graceful shutdown
export async function closeStep12Queue() {
  if (step12Queue) {
    await step12Queue.close();
    loggingService.info('Step 12 queue closed');
  }
}
