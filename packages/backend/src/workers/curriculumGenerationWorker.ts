/**
 * Curriculum Generation Worker
 * Processes curriculum generation jobs from the Bull queue
 * Implements Requirements 5.4, 12.1
 */

import { Job } from 'bull';
import { jobQueueService } from '../services/jobQueueService';
import { websocketService } from '../services/websocketService';
import { GenerationJobData, JobProgressUpdate } from '../types/curriculum';

/**
 * Initialize curriculum generation worker
 * Sets up job processor for the curriculum_generation queue
 */
export function initializeCurriculumGenerationWorker() {
  const queue = jobQueueService.getQueue('curriculum_generation');

  // Process jobs with concurrency of 5
  queue.process(5, async (job: Job<GenerationJobData>) => {
    console.log(`Processing curriculum generation job ${job.id} for program ${job.data.programId}`);

    try {
      // Import the curriculum generator service dynamically to avoid circular dependencies
      const { curriculumGeneratorService } = await import('../services/curriculumGeneratorService');

      // Execute the curriculum generation pipeline
      const result = await curriculumGeneratorService.generateCurriculum(
        job.data.programId,
        job.data.parsedData,
        job
      );

      console.log(`Curriculum generation job ${job.id} completed successfully`);
      
      // Send completion notification via WebSocket
      websocketService.sendJobCompleted(job.id as string, result);

      return result;
    } catch (error) {
      console.error(`Curriculum generation job ${job.id} failed:`, error);
      
      // Send failure notification via WebSocket
      websocketService.sendJobFailed(
        job.id as string,
        error instanceof Error ? error.message : 'Unknown error'
      );

      throw error;
    }
  });

  // Job event handlers
  queue.on('completed', (job: Job, result: any) => {
    console.log(`Job ${job.id} completed with result:`, result);
  });

  queue.on('failed', (job: Job, error: Error) => {
    console.error(`Job ${job.id} failed with error:`, error.message);
  });

  queue.on('progress', (job: Job, progress: number) => {
    console.log(`Job ${job.id} progress: ${progress}%`);
  });

  queue.on('stalled', (job: Job) => {
    console.warn(`Job ${job.id} has stalled`);
  });

  console.log('Curriculum generation worker initialized');
}

/**
 * Shutdown worker gracefully
 */
export async function shutdownWorker() {
  console.log('Shutting down curriculum generation worker...');
  await jobQueueService.closeAll();
  websocketService.close();
  console.log('Worker shutdown complete');
}
