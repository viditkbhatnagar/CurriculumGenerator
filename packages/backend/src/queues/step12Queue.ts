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
import { CurriculumWorkflow } from '../models/CurriculumWorkflow';
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
        backoff: {
          type: 'exponential',
          delay: 60000,
        },
        removeOnComplete: 100,
        removeOnFail: 200,
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

      // Use unique moduleId set for counting
      const completedModuleIds = new Set(
        (workflow.step12?.moduleAssignmentPacks || []).map((m: any) => m.moduleId)
      );
      const existingModules = completedModuleIds.size;

      // Find the actual next ungenerated module
      const nextModuleIndex = modules.findIndex(
        (m: any) => !completedModuleIds.has(m.id)
      );

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

      const updatedWorkflow = await workflowService.processStep12NextModule(workflowId);

      await job.progress(90);

      const newCompletedIds = new Set(
        (updatedWorkflow.step12?.moduleAssignmentPacks || []).map((m: any) => m.moduleId)
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
      if (!allComplete) {
        const nextUngenIndex = modules.findIndex(
          (m: any) => !newCompletedIds.has(m.id)
        );
        if (nextUngenIndex !== -1) {
          await addStep12Job(workflowId, nextUngenIndex, job.data.userId);
          loggingService.info('Queued next module for assignment packs', {
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

  step12Queue.on('failed', (job: Job<Step12JobData>, error: Error) => {
    loggingService.error('Step 12 job failed', {
      jobId: job.id,
      workflowId: job.data.workflowId,
      moduleIndex: job.data.moduleIndex,
      error: error.message,
      attempts: job.attemptsMade,
      maxAttempts: job.opts.attempts,
    });
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

  const job = await step12Queue.add(
    {
      workflowId,
      moduleIndex,
      userId,
    },
    {
      jobId: `step12-${workflowId}-module-${moduleIndex}`,
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
  userId?: string
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
  const completedModuleIds = new Set(
    (workflow.step12?.moduleAssignmentPacks || []).map((m: any) => m.moduleId)
  );
  const nextModuleIndex = modules.findIndex(
    (m: any) => !completedModuleIds.has(m.id)
  );

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

// Graceful shutdown
export async function closeStep12Queue() {
  if (step12Queue) {
    await step12Queue.close();
    loggingService.info('Step 12 queue closed');
  }
}
