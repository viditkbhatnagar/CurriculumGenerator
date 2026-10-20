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

interface LibraryJob {
  bookId: string;
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
        maxStalledCount: 2,
      },
    });
    libraryQueue.process(1, async (job: Job<LibraryJob>) => {
      await ingestBook(job.data.bookId);
      invalidateConceptIndex();
      return { bookId: job.data.bookId };
    });
    libraryQueue.on('failed', (job, error) => {
      loggingService.error('Library ingest job failed', {
        bookId: job.data.bookId,
        attempt: job.attemptsMade,
        error: error.message,
      });
    });
    loggingService.info('Knowledge library queue initialised');
  } catch (error) {
    loggingService.warn('Knowledge library queue unavailable; ingests run in the request process', {
      error: error instanceof Error ? error.message : String(error),
    });
    libraryQueue = null;
  }
}

/** Queue a book's ingest, or run it in this process when there is no Redis. */
export async function enqueueIngest(bookId: string): Promise<'queued' | 'running'> {
  if (libraryQueue) {
    const jobId = `library-${bookId}`;
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

export async function closeLibraryQueue(): Promise<void> {
  if (libraryQueue) await libraryQueue.close();
}
