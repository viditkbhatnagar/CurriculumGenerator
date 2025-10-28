/**
 * Job Queue Service
 * Manages async job queue using Bull and Redis
 * Implements Requirements 5.4, 12.1
 */

import Bull, { Queue, Job, JobOptions } from 'bull';
import config from '../config';
import { GenerationJobData, JobProgressUpdate, GenerationStage } from '../types/curriculum';

export type JobType = 'curriculum_generation';

interface QueueConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    tls?: any;
  };
  defaultJobOptions: JobOptions;
}

class JobQueueService {
  private queues: Map<JobType, Queue> = new Map();
  private config: QueueConfig;

  constructor() {
    // Check if Redis is configured
    if (!config.redis.url) {
      throw new Error('Redis URL not configured - Job queue requires Redis');
    }

    // Parse Redis URL
    const redisUrl = new URL(config.redis.url);
    
    const redisConfig: any = {
      host: redisUrl.hostname,
      port: parseInt(redisUrl.port || '6379'),
      password: redisUrl.password || undefined,
      maxRetriesPerRequest: config.redis.maxRetries,
      enableReadyCheck: true,
      retryStrategy: (times: number) => {
        if (times > config.redis.maxRetries) {
          console.error(`Bull Redis reconnection failed after ${config.redis.maxRetries} attempts`);
          return null; // Stop retrying
        }
        return Math.min(times * config.redis.retryDelay, 5000);
      },
    };

    // Enable TLS for Render Redis in production
    if (config.redis.tls) {
      redisConfig.tls = {
        rejectUnauthorized: false, // Render Redis uses self-signed certs
      };
      console.log('Bull queue Redis TLS enabled for Render deployment');
    }
    
    this.config = {
      redis: redisConfig,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: false,
        removeOnFail: false,
      },
    };

    this.initializeQueues();
  }

  /**
   * Initialize all job queues
   */
  private initializeQueues(): void {
    // Create curriculum generation queue
    const curriculumQueue = new Bull('curriculum_generation', {
      redis: this.config.redis,
      defaultJobOptions: this.config.defaultJobOptions,
    });

    // Set up event handlers for monitoring
    curriculumQueue.on('error', (error) => {
      console.error('Bull queue error:', error);
    });

    curriculumQueue.on('waiting', (jobId) => {
      console.log(`Job ${jobId} is waiting`);
    });

    curriculumQueue.on('active', (job) => {
      console.log(`Job ${job.id} has started`);
    });

    curriculumQueue.on('completed', (job, result) => {
      console.log(`Job ${job.id} completed successfully`);
    });

    curriculumQueue.on('failed', (job, err) => {
      console.error(`Job ${job?.id} failed:`, err);
    });

    curriculumQueue.on('stalled', (job) => {
      console.warn(`Job ${job.id} has stalled`);
    });

    this.queues.set('curriculum_generation', curriculumQueue);

    console.log('Job queues initialized with Render Redis');
  }

  /**
   * Get queue by type
   */
  getQueue(type: JobType): Queue {
    const queue = this.queues.get(type);
    if (!queue) {
      throw new Error(`Queue not found: ${type}`);
    }
    return queue;
  }

  /**
   * Add job to queue
   */
  async addJob(
    type: JobType,
    data: GenerationJobData,
    options?: JobOptions
  ): Promise<Job> {
    const queue = this.getQueue(type);
    
    const job = await queue.add(data, {
      ...this.config.defaultJobOptions,
      ...options,
    });

    console.log(`Job ${job.id} added to ${type} queue`);
    
    return job;
  }

  /**
   * Get job by ID
   */
  async getJob(type: JobType, jobId: string): Promise<Job | null> {
    const queue = this.getQueue(type);
    return queue.getJob(jobId);
  }

  /**
   * Get job status
   */
  async getJobStatus(type: JobType, jobId: string): Promise<{
    status: string;
    progress: number;
    data?: any;
    result?: any;
    error?: string;
  } | null> {
    const job = await this.getJob(type, jobId);
    
    if (!job) {
      return null;
    }

    const state = await job.getState();
    const progress = job.progress() as number;

    return {
      status: state,
      progress,
      data: job.data,
      result: job.returnvalue,
      error: job.failedReason,
    };
  }

  /**
   * Update job progress
   */
  async updateJobProgress(
    job: Job,
    progress: number,
    stage: GenerationStage,
    message: string
  ): Promise<void> {
    await job.progress(progress);
    
    // Store progress update in job data
    const update: JobProgressUpdate = {
      jobId: job.id as string,
      progress,
      stage,
      message,
      timestamp: new Date(),
    };

    // Update job data with latest progress
    await job.update({
      ...job.data,
      lastUpdate: update,
    });

    console.log(`Job ${job.id} progress: ${progress}% - ${stage} - ${message}`);
  }

  /**
   * Remove job from queue
   */
  async removeJob(type: JobType, jobId: string): Promise<void> {
    const job = await this.getJob(type, jobId);
    
    if (job) {
      await job.remove();
      console.log(`Job ${jobId} removed from ${type} queue`);
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(type: JobType): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const queue = this.getQueue(type);
    
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  /**
   * Clean old jobs from queue
   */
  async cleanQueue(
    type: JobType,
    grace: number = 86400000 // 24 hours in ms
  ): Promise<void> {
    const queue = this.getQueue(type);
    
    await queue.clean(grace, 'completed');
    await queue.clean(grace, 'failed');
    
    console.log(`Cleaned old jobs from ${type} queue`);
  }

  /**
   * Pause queue
   */
  async pauseQueue(type: JobType): Promise<void> {
    const queue = this.getQueue(type);
    await queue.pause();
    console.log(`Queue ${type} paused`);
  }

  /**
   * Resume queue
   */
  async resumeQueue(type: JobType): Promise<void> {
    const queue = this.getQueue(type);
    await queue.resume();
    console.log(`Queue ${type} resumed`);
  }

  /**
   * Close all queues
   */
  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.queues.values()).map(queue => queue.close());
    await Promise.all(closePromises);
    console.log('All queues closed');
  }

  /**
   * Health check for job queue service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const queue = this.getQueue('curriculum_generation');
      // Try to get queue stats as a health check
      await queue.getJobCounts();
      return true;
    } catch (error) {
      console.error('Job queue health check failed:', error);
      return false;
    }
  }

  /**
   * Check if Redis connection is active
   */
  isConnected(): boolean {
    try {
      const queue = this.getQueue('curriculum_generation');
      // Check if the queue client is ready
      return queue.client?.status === 'ready';
    } catch (error) {
      return false;
    }
  }
}

// Export singleton instance
export const jobQueueService = new JobQueueService();
