/**
 * Worker Process Entry Point
 * Runs background job processing for curriculum generation
 * Implements Requirements 3.3, 6.1, 6.2
 */

import dotenv from 'dotenv';
import { db } from './db';
import { cacheService } from './services/cacheService';
import { loggingService } from './services/loggingService';
import { errorTrackingService } from './services/errorTrackingService';
import { alertingService } from './services/alertingService';
import { initializeCurriculumGenerationWorker, shutdownWorker } from './workers/curriculumGenerationWorker';

dotenv.config();

async function startWorker() {
  try {
    loggingService.info('Starting curriculum generation worker...', {
      environment: process.env.NODE_ENV,
      version: process.env.APP_VERSION || '1.0.0',
    });

    // Connect to MongoDB with retry logic
    let mongoConnected = false;
    let mongoRetries = 0;
    const maxMongoRetries = 5;
    
    while (!mongoConnected && mongoRetries < maxMongoRetries) {
      try {
        await db.connect();
        mongoConnected = true;
        loggingService.info('MongoDB connected successfully', {
          host: db.getStats()?.host,
          database: db.getStats()?.name,
        });
      } catch (error) {
        mongoRetries++;
        loggingService.error(`MongoDB connection attempt ${mongoRetries} failed`, error, {
          retries: mongoRetries,
          maxRetries: maxMongoRetries,
        });
        
        if (mongoRetries >= maxMongoRetries) {
          loggingService.error('MongoDB connection failed after maximum retries', error);
          errorTrackingService.captureException(error as Error, {
            component: 'worker-mongodb-connection',
            retries: mongoRetries,
          });
          alertingService.triggerAlert(
            'critical',
            'Worker MongoDB Connection Failed',
            'Worker failed to connect to MongoDB after multiple retries',
            { error: String(error), retries: mongoRetries }
          );
          throw new Error('Failed to connect to MongoDB - worker cannot start');
        }
        
        // Wait before retrying (exponential backoff)
        const waitTime = Math.min(1000 * Math.pow(2, mongoRetries - 1), 10000);
        loggingService.info(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    // Connect to Redis with retry logic
    let redisConnected = false;
    let redisRetries = 0;
    const maxRedisRetries = 5;
    
    while (!redisConnected && redisRetries < maxRedisRetries) {
      try {
        await cacheService.connect();
        redisConnected = true;
        loggingService.info('Redis connected successfully for job queue');
      } catch (error) {
        redisRetries++;
        loggingService.error(`Redis connection attempt ${redisRetries} failed`, error, {
          retries: redisRetries,
          maxRetries: maxRedisRetries,
        });
        
        if (redisRetries >= maxRedisRetries) {
          loggingService.error('Redis connection failed after maximum retries', error);
          errorTrackingService.captureException(error as Error, {
            component: 'worker-redis-connection',
            retries: redisRetries,
          });
          alertingService.triggerAlert(
            'critical',
            'Worker Redis Connection Failed',
            'Worker failed to connect to Redis after multiple retries',
            { error: String(error), retries: redisRetries }
          );
          throw new Error('Failed to connect to Redis - worker cannot start');
        }
        
        // Wait before retrying (exponential backoff)
        const waitTime = Math.min(1000 * Math.pow(2, redisRetries - 1), 10000);
        loggingService.info(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    // Initialize Bull queue and job processors
    try {
      initializeCurriculumGenerationWorker();
      loggingService.info('Curriculum generation worker initialized', {
        concurrency: 5,
        queueName: 'curriculum_generation',
      });
    } catch (error) {
      loggingService.error('Failed to initialize worker', error);
      errorTrackingService.captureException(error as Error, {
        component: 'worker-initialization',
      });
      alertingService.triggerAlert(
        'critical',
        'Worker Initialization Failed',
        'Failed to initialize curriculum generation worker',
        { error: String(error) }
      );
      throw new Error('Failed to initialize worker');
    }

    loggingService.info('Worker is ready to process jobs', {
      mongoConnected: true,
      redisConnected: true,
    });

  } catch (error) {
    loggingService.error('Failed to start worker', error);
    errorTrackingService.captureException(error as Error, {
      component: 'worker-startup',
    });
    process.exit(1);
  }
}

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  loggingService.info(`${signal} received, shutting down worker gracefully...`);
  
  let exitCode = 0;
  
  try {
    // Shutdown worker and close job queue
    try {
      await shutdownWorker();
      loggingService.info('Worker shutdown completed - job queue closed');
    } catch (error) {
      loggingService.error('Error shutting down worker', error);
      exitCode = 1;
    }

    // Disconnect from MongoDB
    try {
      await db.disconnect();
      loggingService.info('MongoDB disconnected');
    } catch (error) {
      loggingService.error('Error disconnecting from MongoDB', error);
      exitCode = 1;
    }

    // Disconnect from Redis
    try {
      await cacheService.disconnect();
      loggingService.info('Redis disconnected');
    } catch (error) {
      loggingService.error('Error disconnecting from Redis', error);
      exitCode = 1;
    }

    loggingService.info('Worker graceful shutdown completed', { exitCode });
    
    // Give time for final logs to flush
    setTimeout(() => {
      process.exit(exitCode);
    }, 1000);
    
  } catch (error) {
    loggingService.error('Error during worker graceful shutdown', error);
    errorTrackingService.captureException(error as Error, {
      component: 'worker-graceful-shutdown',
    });
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  loggingService.error('Worker uncaught exception', error);
  errorTrackingService.captureException(error, {
    component: 'worker-uncaught-exception',
  });
  alertingService.triggerAlert(
    'critical',
    'Worker Uncaught Exception',
    error.message,
    { stack: error.stack }
  );
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  loggingService.error('Worker unhandled promise rejection', reason);
  errorTrackingService.captureException(
    reason instanceof Error ? reason : new Error(String(reason)),
    {
      component: 'worker-unhandled-rejection',
    }
  );
  alertingService.triggerAlert(
    'critical',
    'Worker Unhandled Promise Rejection',
    String(reason),
    { promise: String(promise) }
  );
});

// Graceful shutdown on SIGTERM (e.g., from Render or Kubernetes)
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Graceful shutdown on SIGINT (e.g., Ctrl+C)
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start the worker
startWorker();
