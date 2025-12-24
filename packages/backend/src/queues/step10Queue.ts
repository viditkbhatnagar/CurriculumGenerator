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

if (config.redis.host && config.redis.port) {
  try {
    step10Queue = new Bull('step10-generation', {
      redis: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        maxRetriesPerRequest: 3, // Reduce retries to fail faster
        enableReadyCheck: false,
        connectTimeout: 10000,
      },
      defaultJobOptions: {
        attempts: 3, // Retry up to 3 times on failure
        backoff: {
          type: 'exponential',
          delay: 60000, // Start with 1 minute delay
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 200, // Keep last 200 failed jobs
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
if (step10Queue) {
  step10Queue.process(async (job: Job<Step10JobData>) => {
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

      const totalModules = workflow.step4?.modules?.length || 0;
      const existingModules = workflow.step10?.moduleLessonPlans?.length || 0;

      // Check if this module is already generated
      if (existingModules > moduleIndex) {
        loggingService.info('Module already generated, skipping', {
          workflowId,
          moduleIndex,
          existingModules,
        });

        return {
          workflowId,
          moduleIndex,
          modulesGenerated: existingModules,
          totalModules,
          allComplete: existingModules >= totalModules,
          totalLessons: workflow.step10?.summary?.totalLessons || 0,
          totalContactHours: workflow.step10?.summary?.totalContactHours || 0,
        };
      }

      // Check if we should generate this module
      if (moduleIndex !== existingModules) {
        throw new Error(
          `Cannot generate module ${moduleIndex + 1}. Expected module ${existingModules + 1}`
        );
      }

      await job.progress(10);

      // Generate the next module
      loggingService.info('Generating module', {
        workflowId,
        moduleNumber: moduleIndex + 1,
        totalModules,
      });

      const updatedWorkflow = await workflowService.processStep10NextModule(workflowId);

      await job.progress(90);

      const newModulesCount = updatedWorkflow.step10?.moduleLessonPlans?.length || 0;
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

      // If not all complete, queue the next module
      if (!allComplete) {
        await addStep10Job(workflowId, moduleIndex + 1, job.data.userId);
        loggingService.info('Queued next module', {
          workflowId,
          nextModuleIndex: moduleIndex + 1,
        });
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

  const job = await step10Queue.add(
    {
      workflowId,
      moduleIndex,
      userId,
    },
    {
      jobId: `step10-${workflowId}-module-${moduleIndex}`, // Unique job ID prevents duplicates
      priority: 1, // Higher priority for earlier modules
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

  const workflow = await CurriculumWorkflow.findById(workflowId);
  if (!workflow) {
    throw new Error('Workflow not found');
  }

  const totalModules = workflow.step4?.modules?.length || 0;
  const existingModules = workflow.step10?.moduleLessonPlans?.length || 0;

  const jobs: Job<Step10JobData>[] = [];

  // Queue only the next module (not all remaining)
  // The job processor will automatically queue the next one after completion
  if (existingModules < totalModules) {
    const job = await addStep10Job(workflowId, existingModules, userId);
    if (job) {
      jobs.push(job);
    }
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
