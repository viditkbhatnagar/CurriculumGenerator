/**
 * Background ingestion for the textbook library: one book at a time, so the 2GB container is
 * never parsing two large PDFs at once. Ingestion is resumable (knowledge/ingestBook), so a job
 * interrupted by a deploy or a stall continues from its last finished section when retried.
 */
import Bull, { Queue, Job } from 'bull';
import config from '../config';
import { loggingService } from '../services/loggingService';
import { ingestBook } from './ingestBook';
import { invalidateConceptIndex } from './retrieval';
import { KbBook } from './models';
import { consolidateLibrary } from './consolidate';

interface LibraryJob {
  bookId?: string;
  /** A consolidation pass over the library (knowledge/consolidate) instead of an ingest. */
  consolidate?: boolean;
  domainKeys?: string[];
}

let libraryQueue: Queue<LibraryJob> | null = null;
const redisUrl = config.redis?.url;

if (redisUrl && redisUrl.length > 0) {
  try {
    libraryQueue = new Bull('knowledge-library', redisUrl, {
      defaultJobOptions: {
        attempts: 3,
        timeout: 4 * 3600000, // a 1,000-page book is a few hundred extraction calls
        backoff: { type: 'fixed', delay: 30000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
      settings: {
        lockDuration: 600000,
        stalledInterval: 600000,
        lockRenewTime: 300000,
        // Every deploy restarts the process and stalls the running ingest. Ingestion resumes
        // from its last saved section, so a stall costs nothing; at 2 a book read across a
        // day of deploys was moved to failed and never resumed.
        maxStalledCount: 10,
      },
    });
    libraryQueue.process(1, async (job: Job<LibraryJob>) => {
      if (job.data.consolidate) {
        const result = await consolidateLibrary(job.data.domainKeys);
        invalidateConceptIndex();
        return result;
      }
      await ingestBook(job.data.bookId!);
      invalidateConceptIndex();
      return { bookId: job.data.bookId };
    });
    libraryQueue.on('failed', async (job, error) => {
      loggingService.error('Library ingest job failed', {
        bookId: job.data.bookId,
        attempt: job.attemptsMade,
        error: error.message,
      });
      // A job the queue gave up on (stalled too often, or out of attempts) never reaches
      // ingestBook's own error handling, which left the book reading "extracting" for good.
      const final = job.attemptsMade >= (job.opts.attempts || 1) || /stall/i.test(error.message);
      if (final && job.data.bookId) {
        await KbBook.updateOne(
          { _id: job.data.bookId, status: { $in: ['queued', 'reading', 'extracting'] } },
          {
            $set: { status: 'failed', error: `Interrupted (${error.message}); resume to continue` },
          }
        ).catch(() => undefined);
      }
    });
    loggingService.info('Knowledge library queue initialised');
  } catch (error) {
    loggingService.warn('Knowledge library queue unavailable; ingests run in the request process', {
      error: error instanceof Error ? error.message : String(error),
    });
    libraryQueue = null;
  }
}

/**
 * Queue a book's ingest, or run it in this process when there is no Redis. `fresh` uses a new
 * job id, for a book whose earlier job was orphaned by a restart and still holds the old one.
 */
export async function enqueueIngest(bookId: string, fresh = false): Promise<'queued' | 'running'> {
  if (libraryQueue) {
    const jobId = fresh ? `library-${bookId}-${Date.now()}` : `library-${bookId}`;
    const existing = await libraryQueue.getJob(jobId);
    if (existing && ['completed', 'failed'].includes(await existing.getState())) {
      await existing.remove();
    }
    await libraryQueue.add({ bookId }, { jobId });
    return 'queued';
  }
  ingestBook(bookId)
    .then(invalidateConceptIndex)
    .catch((error) =>
      loggingService.error('Library ingest failed', {
        bookId,
        error: String(error?.message || error),
      })
    );
  return 'running';
}

/** Queue a consolidation pass behind any ingests already waiting. */
export async function enqueueConsolidation(domainKeys?: string[]): Promise<'queued' | 'running'> {
  if (libraryQueue) {
    // One pass at a time: a pass already waiting or running covers this request.
    const existing = await libraryQueue.getJob('consolidate');
    if (existing) {
      const state = await existing.getState();
      if (['waiting', 'active', 'delayed'].includes(state)) return 'queued';
      await existing.remove();
    }
    await libraryQueue.add(
      { consolidate: true, domainKeys },
      { jobId: 'consolidate', attempts: 1 }
    );
    return 'queued';
  }
  consolidateLibrary(domainKeys)
    .then(invalidateConceptIndex)
    .catch((error) =>
      loggingService.error('Library consolidation failed', {
        error: String(error?.message || error),
      })
    );
  return 'running';
}

export async function closeLibraryQueue(): Promise<void> {
  if (libraryQueue) await libraryQueue.close();
}
