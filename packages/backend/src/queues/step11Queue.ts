/**
 * Step 11 Background Job Queue
 * Handles long-running Step 11 PPT generation in the background
 *
 * Features:
 * - Processes one module at a time
 * - Survives server restarts
 * - Automatic retries on failure
 * - Progress tracking via WebSocket
 * - No HTTP timeout issues
 *
 * Note: Step 11 was separated from Step 10 to prevent timeouts
 * when generating both lesson plans and PPTs together.
 */

import Bull, { Queue, Job } from 'bull';
import { loggingService } from '../services/loggingService';
import { workflowService } from '../services/workflowService';
import { CurriculumWorkflow } from '../models/CurriculumWorkflow';
import config from '../config';

// Job data interface
export interface Step11JobData {
  workflowId: string;
  moduleIndex: number; // Which module to generate PPT for (0-based)
  userId?: string;
}

// Job result interface
export interface Step11JobResult {
  workflowId: string;
  moduleIndex: number;
  modulesGenerated: number;
  totalModules: number;
  allComplete: boolean;
  totalPPTDecks: number;
  totalSlides: number;
}

// Create the queue only if Redis is configured
let step11Queue: Queue<Step11JobData> | null = null;

// Check for Redis URL (the actual config format)
const redisUrl = config.redis?.url;

if (redisUrl && redisUrl.length > 0) {
  try {
    step11Queue = new Bull('step11-ppt-generation', redisUrl, {
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

    loggingService.info('Step 11 queue initialized with Redis URL');
  } catch (error) {
    loggingService.warn('Failed to initialize Step 11 queue, background jobs disabled', {
      error: error instanceof Error ? error.message : String(error),
    });
    step11Queue = null;
  }
} else {
  loggingService.info(
    'Redis not configured (no REDIS_URL), Step 11 will use synchronous generation'
  );
}

export { step11Queue };

// Process jobs only if queue is available
if (step11Queue) {
  step11Queue.process(async (job: Job<Step11JobData>) => {
    const { workflowId, moduleIndex } = job.data;

    loggingService.info('Processing Step 11 job', {
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

      // Get lesson plans from Step 10
      const lessonPlans = workflow.step10?.moduleLessonPlans || [];
      const totalModules = new Set(lessonPlans.map((m: any) => m.moduleId)).size;
      if (totalModules === 0) {
        throw new Error('No lesson plans found in Step 10. Complete Step 10 first.');
      }

      // Use unique moduleId set — completedModuleIds.size is the true count
      const completedModuleIds = new Set(
        (workflow.step11?.modulePPTDecks || []).map((m: any) => m.moduleId)
      );
      const existingModules = completedModuleIds.size;

      // Find the actual next ungenerated module
      const nextModuleIndex = lessonPlans.findIndex(
        (m: any) => !completedModuleIds.has(m.moduleId)
      );

      // Check if all modules are already generated
      if (nextModuleIndex === -1) {
        loggingService.info('All module PPTs already generated, skipping', {
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
          totalPPTDecks: workflow.step11?.summary?.totalPPTDecks || 0,
          totalSlides: workflow.step11?.summary?.totalSlides || 0,
        };
      }

      await job.progress(10);

      // Generate PPT for the next ungenerated module
      loggingService.info('Generating PPT for module', {
        workflowId,
        moduleNumber: nextModuleIndex + 1,
        moduleId: lessonPlans[nextModuleIndex]?.moduleId,
        totalModules,
      });

      const updatedWorkflow = await workflowService.processStep11NextModule(workflowId);

      await job.progress(90);

      const newCompletedIds = new Set(
        (updatedWorkflow.step11?.modulePPTDecks || []).map((m: any) => m.moduleId)
      );
      const newModulesCount = newCompletedIds.size;
      const allComplete = newModulesCount >= totalModules;

      loggingService.info('Module PPT generation complete', {
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
        const nextUngenIndex = lessonPlans.findIndex(
          (m: any) => !newCompletedIds.has(m.moduleId)
        );
        if (nextUngenIndex !== -1) {
          await addStep11Job(workflowId, nextUngenIndex, job.data.userId);
          loggingService.info('Queued next module for PPT', {
            workflowId,
            nextModuleIndex: nextUngenIndex,
            nextModuleId: lessonPlans[nextUngenIndex]?.moduleId,
          });
        }
      }

      return {
        workflowId,
        moduleIndex,
        modulesGenerated: newModulesCount,
        totalModules,
        allComplete,
        totalPPTDecks: updatedWorkflow.step11?.summary?.totalPPTDecks || 0,
        totalSlides: updatedWorkflow.step11?.summary?.totalSlides || 0,
      };
    } catch (error) {
      loggingService.error('Step 11 job failed', {
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
  step11Queue.on('completed', (job: Job<Step11JobData>, result: Step11JobResult) => {
    loggingService.info('Step 11 job completed', {
      jobId: job.id,
      workflowId: job.data.workflowId,
      moduleIndex: job.data.moduleIndex,
      modulesGenerated: result.modulesGenerated,
      totalModules: result.totalModules,
      allComplete: result.allComplete,
    });
  });

  step11Queue.on('failed', async (job: Job<Step11JobData>, error: Error) => {
    loggingService.error('Step 11 job failed', {
      jobId: job.id,
      workflowId: job.data.workflowId,
      moduleIndex: job.data.moduleIndex,
      error: error.message,
      attempts: job.attemptsMade,
      maxAttempts: job.opts.attempts,
    });
    // Persist error to workflow document so frontend can detect it
    try {
      const workflow = await CurriculumWorkflow.findById(job.data.workflowId);
      if (workflow) {
        if (!workflow.step11) {
          workflow.step11 = {
            modulePPTDecks: [],
            validation: {
              allLessonsHavePPTs: false,
              allSlideCountsValid: false,
              allMLOsCovered: false,
              allCitationsValid: false,
            },
            summary: { totalPPTDecks: 0, totalSlides: 0, averageSlidesPerLesson: 0 },
            generatedAt: new Date(),
          };
        }
        workflow.step11.lastError = {
          message: error.message,
          moduleIndex: job.data.moduleIndex,
          timestamp: new Date(),
        };
        workflow.markModified('step11');
        await workflow.save();
      }
    } catch (dbErr) {
      loggingService.error('Failed to persist Step 11 job error', {
        error: dbErr instanceof Error ? dbErr.message : String(dbErr),
      });
    }
  });

  step11Queue.on('stalled', (job: Job<Step11JobData>) => {
    loggingService.warn('Step 11 job stalled', {
      jobId: job.id,
      workflowId: job.data.workflowId,
      moduleIndex: job.data.moduleIndex,
    });
  });

  step11Queue.on('progress', (job: Job<Step11JobData>, progress: number) => {
    loggingService.debug('Step 11 job progress', {
      jobId: job.id,
      workflowId: job.data.workflowId,
      moduleIndex: job.data.moduleIndex,
      progress,
    });
  });
}

// Helper function to add a job
export async function addStep11Job(
  workflowId: string,
  moduleIndex: number,
  userId?: string
): Promise<Job<Step11JobData> | null> {
  if (!step11Queue) {
    loggingService.warn('Step 11 queue not available, cannot add job', {
      workflowId,
      moduleIndex,
    });
    return null;
  }

  const job = await step11Queue.add(
    {
      workflowId,
      moduleIndex,
      userId,
    },
    {
      jobId: `step11-${workflowId}-module-${moduleIndex}`, // Unique job ID prevents duplicates
      priority: 1, // Higher priority for earlier modules
    }
  );

  loggingService.info('Step 11 job queued', {
    jobId: job.id,
    workflowId,
    moduleIndex,
  });

  return job;
}

// Helper function to queue all remaining modules
export async function queueAllRemainingStep11Modules(
  workflowId: string,
  userId?: string
): Promise<Job<Step11JobData>[]> {
  if (!step11Queue) {
    loggingService.warn('Step 11 queue not available, cannot queue modules', {
      workflowId,
    });
    return [];
  }

  const workflow = await CurriculumWorkflow.findById(workflowId);
  if (!workflow) {
    throw new Error('Workflow not found');
  }

  // Find the first ungenerated module by scanning lesson plans
  const lessonPlans = workflow.step10?.moduleLessonPlans || [];
  const completedModuleIds = new Set(
    (workflow.step11?.modulePPTDecks || []).map((m: any) => m.moduleId)
  );
  const nextModuleIndex = lessonPlans.findIndex(
    (m: any) => !completedModuleIds.has(m.moduleId)
  );

  const jobs: Job<Step11JobData>[] = [];

  // Queue only the next ungenerated module
  // The job processor will automatically queue the next one after completion
  if (nextModuleIndex !== -1) {
    const job = await addStep11Job(workflowId, nextModuleIndex, userId);
    if (job) {
      jobs.push(job);
    }
  }

  return jobs;
}

// Helper function to get job status
export async function getStep11JobStatus(workflowId: string, moduleIndex: number) {
  if (!step11Queue) {
    return null;
  }

  const jobId = `step11-${workflowId}-module-${moduleIndex}`;
  const job = await step11Queue.getJob(jobId);

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
export async function getAllStep11Jobs(workflowId: string) {
  if (!step11Queue) {
    return [];
  }

  const jobs = await step11Queue.getJobs(['waiting', 'active', 'completed', 'failed', 'delayed']);
  return jobs.filter((job) => job.data.workflowId === workflowId);
}

// Graceful shutdown
export async function closeStep11Queue() {
  if (step11Queue) {
    await step11Queue.close();
    loggingService.info('Step 11 queue closed');
  }
}
