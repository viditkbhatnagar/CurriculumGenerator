/**
 * Book Ingestion Queue — background processing for "Step 5.5".
 *
 * A full-book decomposition is long (one LLM call per segment), so it runs off
 * the request. Mirrors the resilience of the generic step queue: extended lock,
 * maxStalledCount, and a failed-handler that records the error on the
 * BookIntelligence document. The ingest itself is checkpoint/resumable, so a
 * stall-recovery retry continues from the last completed segment.
 */

import Bull, { Queue, Job } from 'bull';
import { loggingService } from '../services/loggingService';
import config from '../config';
import { BookIntelligence } from '../models/BookIntelligence';
import { CurriculumWorkflow } from '../models/CurriculumWorkflow';
import { bookIntelligenceService } from '../services/bookIntelligenceService';
import * as sourceFileStore from '../services/sourceFileStore';

export interface BookIngestionJobData {
  bookId: string;
}

let bookIngestionQueue: Queue<BookIngestionJobData> | null = null;
const redisUrl = config.redis?.url;

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

/** Fetch the book file + build the decomposition context, then run the ingest. */
export async function runBookIngestion(bookId: string): Promise<void> {
  const book = await BookIntelligence.findById(bookId);
  if (!book) throw new Error('BookIntelligence record not found');
  if (!book.bookFileId) throw new Error('No uploaded book file to ingest');

  const stream = await sourceFileStore.getDownloadStream(book.bookFileId);
  const buffer = await streamToBuffer(stream);

  const workflow: any = await CurriculumWorkflow.findById(book.workflowId).select('step1');
  const step1: any = workflow?.step1 || {};

  await bookIntelligenceService.ingest(bookId, buffer, {
    programTitle: step1.programTitle || step1.programOverview?.programTitle || 'Program',
    academicLevel: step1.academicLevel || 'certificate',
    mappedMloIds: book.mappedMloIds || [],
    depth: book.depth || 'standard',
    bookTitle: book.bookTitle,
  });
}

if (redisUrl && redisUrl.length > 0) {
  try {
    bookIngestionQueue = new Bull('book-ingestion', redisUrl, {
      defaultJobOptions: {
        attempts: 2,
        timeout: 3600000, // 60 min — a book is many segments
        backoff: { type: 'fixed', delay: 15000 },
        removeOnComplete: 50,
        removeOnFail: 100,
      },
      settings: {
        lockDuration: 600000,
        stalledInterval: 600000,
        lockRenewTime: 300000,
        maxStalledCount: 1,
      },
    });
    loggingService.info('Book ingestion queue initialized with Redis');
  } catch (error) {
    loggingService.warn('Failed to initialize book ingestion queue, background disabled', {
      error: error instanceof Error ? error.message : String(error),
    });
    bookIngestionQueue = null;
  }
} else {
  loggingService.info('Redis not configured — book ingestion will run synchronously');
}

export { bookIngestionQueue };

if (bookIngestionQueue) {
  bookIngestionQueue.process(async (job: Job<BookIngestionJobData>) => {
    loggingService.info('Processing book ingestion job', {
      jobId: String(job.id),
      bookId: job.data.bookId,
      attempt: job.attemptsMade + 1,
    });
    await runBookIngestion(job.data.bookId);
    return { bookId: job.data.bookId };
  });

  bookIngestionQueue.on('failed', async (job: Job<BookIngestionJobData>, error: Error) => {
    loggingService.error('Book ingestion job failed', {
      jobId: String(job.id),
      bookId: job.data.bookId,
      error: error.message,
      attempts: job.attemptsMade,
    });
    const maxAttempts = job.opts.attempts || 1;
    if (job.attemptsMade < maxAttempts) return;
    try {
      const book = await BookIntelligence.findById(job.data.bookId);
      if (book && book.status !== 'ready') {
        book.status = 'failed';
        book.lastError = { message: error.message, timestamp: new Date() };
        await book.save();
      }
    } catch {
      /* non-critical */
    }
  });
}

/** Queue a book for ingestion (or run inline when Redis is unavailable). */
export async function enqueueBookIngestion(bookId: string): Promise<void> {
  if (!bookIngestionQueue) {
    // No Redis — run inline (don't await forever in the request; fire and forget).
    runBookIngestion(bookId).catch((e) =>
      loggingService.error('Inline book ingestion failed', {
        bookId,
        error: e instanceof Error ? e.message : String(e),
      })
    );
    return;
  }
  await bookIngestionQueue.add({ bookId }, { jobId: `book-${bookId}` });
}
