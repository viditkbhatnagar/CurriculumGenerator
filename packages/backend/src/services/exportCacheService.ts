/**
 * S3-backed cache for generated curriculum exports (Word / PDF / SCORM).
 *
 * Rendering an export is expensive — the Word path calls OpenAI once per
 * step section to reflow text, and PDF additionally runs a LibreOffice
 * conversion. Caching the rendered file means the second and later
 * downloads of an unchanged curriculum are served straight from S3 with
 * no LLM calls and no re-rendering.
 *
 * Invalidation is content-addressed: every cached object carries a
 * `contenthash` of the workflow data it was rendered from. On a request
 * we HeadObject and compare — a mismatch (the curriculum was edited
 * since) or a miss regenerates and overwrites. There is therefore
 * exactly one cached object per (workflow, artifact); stale files never
 * accumulate.
 *
 * When S3 is not configured this module is transparent: callers fall
 * back to generating on every request, exactly as before.
 */
import { PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'crypto';
import { Response } from 'express';
import config from '../config';
import { getS3Client } from './s3Service';
import { loggingService } from './loggingService';

// Bump this when the export renderer (wordExportService / SCORM builder)
// changes output in a way that should invalidate every cached export.
const EXPORT_FORMAT_VERSION = 'v1';

/** Stable SHA-256 of whatever workflow data an export is rendered from. */
export function hashExportInput(data: unknown): string {
  return createHash('sha256')
    .update(EXPORT_FORMAT_VERSION)
    .update(JSON.stringify(data ?? null))
    .digest('hex');
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export interface ExportCacheOptions {
  workflowId: string;
  /** Per-artifact filename incl. extension, e.g. 'full-word.docx', 'scorm.zip'. */
  artifact: string;
  /** Hash of the source data — from hashExportInput(). */
  contentHash: string;
  contentType: string;
  /** Download filename for the Content-Disposition header. */
  filename: string;
  /** Renders the export. Only invoked on a cache miss / stale entry. */
  generate: () => Promise<Buffer>;
  /** 'attachment' (default) downloads the file; 'inline' lets the browser display it. */
  disposition?: 'attachment' | 'inline';
}

/**
 * Serve an export through the S3 cache, writing the HTTP response
 * (headers + body) directly. On a cache hit the generator never runs;
 * on a miss the freshly rendered buffer is uploaded before responding.
 * Caching is best-effort — an S3 error never fails the download.
 */
export async function serveCachedExport(res: Response, opts: ExportCacheOptions): Promise<void> {
  const { workflowId, artifact, contentHash, contentType, filename, generate } = opts;
  const disposition = opts.disposition || 'attachment';

  const send = (buffer: Buffer, cacheState: 'hit' | 'miss' | 'bypass') => {
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('X-Export-Cache', cacheState);
    res.send(buffer);
  };

  // No S3 configured → behave exactly as before: generate every time.
  if (!config.s3.enabled) {
    send(await generate(), 'bypass');
    return;
  }

  const key = `exports/${workflowId}/${artifact}`;

  // Cache lookup — HeadObject, then compare the stored content hash.
  try {
    const head = await getS3Client().send(
      new HeadObjectCommand({ Bucket: config.s3.bucket, Key: key })
    );
    if (head.Metadata?.contenthash === contentHash) {
      const obj = await getS3Client().send(
        new GetObjectCommand({ Bucket: config.s3.bucket, Key: key })
      );
      const cached = await streamToBuffer(obj.Body as NodeJS.ReadableStream);
      loggingService.info('Export served from S3 cache', { workflowId, artifact });
      send(cached, 'hit');
      return;
    }
  } catch (err: any) {
    const code = err?.name || err?.Code;
    const missing =
      code === 'NotFound' || code === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404;
    if (!missing) {
      // A real S3 error — log it, then fall through and regenerate.
      loggingService.warn('Export cache lookup failed; regenerating', {
        workflowId,
        artifact,
        err,
      });
    }
  }

  // Miss, stale, or lookup failed → render, then cache (best-effort).
  const buffer = await generate();
  try {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: config.s3.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: { contenthash: contentHash, generatedat: new Date().toISOString() },
      })
    );
    loggingService.info('Export rendered and cached to S3', { workflowId, artifact });
  } catch (err) {
    loggingService.warn('Failed to cache export to S3 (download still served)', {
      workflowId,
      artifact,
      err,
    });
  }
  send(buffer, 'miss');
}

/** S3 artifact filename for a per-step Word export. */
export function stepExportArtifact(stepNumber: number, moduleIndex?: number): string {
  return moduleIndex !== undefined
    ? `step${stepNumber}-module${moduleIndex}.docx`
    : `step${stepNumber}.docx`;
}

/** S3 artifact filename for a per-step PDF export (used for in-browser preview). */
export function stepPdfArtifact(stepNumber: number, moduleIndex?: number): string {
  return moduleIndex !== undefined
    ? `step${stepNumber}-module${moduleIndex}.pdf`
    : `step${stepNumber}.pdf`;
}

/**
 * Content hash for a per-step Word export. Covers the step's own data
 * plus step1/step2 (which generateStepDocument also renders from), so any
 * edit that would change the document invalidates the cached copy.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function stepExportContentHash(
  workflow: any,
  stepNumber: number,
  moduleIndex?: number
): string {
  return hashExportInput({
    projectName: workflow.projectName,
    step1: workflow.step1,
    step2: workflow.step2,
    stepNumber,
    moduleIndex,
    target: workflow[`step${stepNumber}`],
  });
}

export interface CachePeekResult {
  cached: boolean; // an export object exists in S3
  current: boolean; // it was rendered from the current content (not stale)
  generatedAt?: string;
  sizeBytes?: number;
}

/**
 * Check whether an export is already cached in S3 without downloading it.
 * `current` is true only when the cached object's content hash still
 * matches `contentHash` — i.e. the curriculum hasn't changed since.
 */
export async function peekCache(
  workflowId: string,
  artifact: string,
  contentHash: string
): Promise<CachePeekResult> {
  if (!config.s3.enabled) return { cached: false, current: false };
  const key = `exports/${workflowId}/${artifact}`;
  try {
    const head = await getS3Client().send(
      new HeadObjectCommand({ Bucket: config.s3.bucket, Key: key })
    );
    return {
      cached: true,
      current: head.Metadata?.contenthash === contentHash,
      generatedAt: head.Metadata?.generatedat,
      sizeBytes: head.ContentLength,
    };
  } catch (err: any) {
    const code = err?.name || err?.Code;
    const missing =
      code === 'NotFound' || code === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404;
    if (!missing) {
      loggingService.warn('Export cache peek failed', { workflowId, artifact, err });
    }
    return { cached: false, current: false };
  }
}

/**
 * Fetch a cached export's bytes, but only if it exists AND is still
 * current (content-hash match). Returns null otherwise. Lets one export
 * reuse another's render — e.g. the PDF preview converting the already
 * cached .docx instead of re-running the formatting LLM.
 */
export async function getCachedBuffer(
  workflowId: string,
  artifact: string,
  contentHash: string
): Promise<Buffer | null> {
  if (!config.s3.enabled) return null;
  const key = `exports/${workflowId}/${artifact}`;
  try {
    const obj = await getS3Client().send(
      new GetObjectCommand({ Bucket: config.s3.bucket, Key: key })
    );
    if (obj.Metadata?.contenthash !== contentHash) return null; // stale
    return await streamToBuffer(obj.Body as NodeJS.ReadableStream);
  } catch (err: any) {
    const code = err?.name || err?.Code;
    const missing =
      code === 'NotFound' || code === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404;
    if (!missing) {
      loggingService.warn('getCachedBuffer failed', { workflowId, artifact, err });
    }
    return null;
  }
}
