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
import { createSlots, singleFlight } from '../utils/exportSlots';

// Bump this when the export renderer (wordExportService / SCORM builder)
// changes output in a way that should invalidate every cached export.
// v2: modules now render in Step 4 order (was generation order).
// v3: Step 10 export now renders the module description.
// v4: Step 13 fixes — section breakdown recomputed, MCQ option labels de-doubled,
//     rationales sanitised, marking scheme rebuilt from questions.
// v5: Step 13 Integrity & Security / Accessibility Provisions now render their
//     bullet-formatted content (previously dropped when the formatter chose bullets,
//     leaving those sections blank in the export).
// v6: Step 3 PLO headings use the display code (PLO7) rather than the internal id
//     (plo-user-…), and the Step 2 KSC lookup no longer lets the legacy
//     attitudeItems mirror overwrite edited competencies.
// v7: Step 5 and Step 6 module headings name the module ("M35: Strategic Human
//     Resource Management — Readings") instead of printing the raw document id.
// v8: Step 7 assessments name their module and print the outcomes they were generated
//     against (alignedMLOs), which were stored but never rendered.
// v9: Step 7 assessments render percentage weighting plus the student brief, marking
//     guide and rubric as three separate artefacts.
// v10: Step 7 renders Bloom levels — per assessment and per question — which were stored
//      but shown only for PLOs, MLOs and lessons.
// v20: Steps 5, 10, 11 and 12 print validation computed from the stored data instead of the
//      constants approval wrote; per-module documents are checked against their own module;
//      Step 4 names topics stored as strings; entry requirements are labelled a proposal;
//      Step 10 lists a slide deck only when Step 11 holds one.
// v21: Step 12 outcome coverage resolves packs' positional "MLO n" labels to stored ids.
// v22: every Word and PowerPoint export strips the characters XML 1.0 forbids. Copies cached
//      before that keep them as stored: the BBA faculty-guide zip went on serving an M42 guide
//      that Word cannot open, from cache, after the fix was deployed.
// v23: text of 500 characters or less is printed as written rather than reflowed by a model,
//      model answers are cleaned of control characters, and seven sections that dropped text
//      the model returned as a list now keep it.
// v24: the Step 12 summary (packs, criteria per rubric) is counted from the packs, not stored
//      constants.
// v25: the Step 13 validation table is computed from the exam, with "Not checked" rows.
// v26: the single-step Step 13 export is given Step 3, so PLO coverage is checked. v25 copies
//      read "Not checked" for it, under the same content hash.
// v27: section headings in the curriculum Word export are real Word headings (navigable
//      outline), not bold text.
// v28: the whole-programme document opens with an Unresolved Issues list.
// v29: the Unresolved Issues list names topics that look repeated across modules, and Step 5's
//      source floor is two per weekly topic.
// v30: Unresolved Issues adds the declared subject scope and essential competencies no outcome
//      covers.
// v31: the whole-programme document has a contents page linking to each section.
// v32: Step 7 prints the institution's assessment rules, and Unresolved Issues lists those not
//      stated.
const EXPORT_FORMAT_VERSION = 'v32';

/**
 * Builds in progress, by file and content hash: a second request for the same file shares the
 * first build instead of starting another (each click used to build again).
 */
const building = new Map<string, Promise<Buffer>>();

/**
 * At most two builds run at once. The request-level limit (middleware/exportLimit) already
 * bounds this; this one also holds when a client abandons a download, since its build carries
 * on after the response has closed.
 */
const buildSlots = createSlots(2, 1000);

async function inBuildSlot(build: () => Promise<Buffer>): Promise<Buffer> {
  const slot = buildSlots.tryAcquire();
  if (slot === 'busy') throw new Error('Too many export builds are queued');
  const release = typeof slot === 'function' ? slot : await slot;
  try {
    return await build();
  } finally {
    release();
  }
}

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
}

/**
 * Serve an export through the S3 cache, writing the HTTP response
 * (headers + body) directly. On a cache hit the generator never runs;
 * on a miss the freshly rendered buffer is uploaded before responding.
 * Caching is best-effort — an S3 error never fails the download.
 */
export async function serveCachedExport(res: Response, opts: ExportCacheOptions): Promise<void> {
  const { workflowId, artifact, contentHash, contentType, filename, generate } = opts;

  const send = (buffer: Buffer, cacheState: 'hit' | 'miss' | 'bypass') => {
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('X-Export-Cache', cacheState);
    res.send(buffer);
  };

  // No S3 configured → behave exactly as before: generate every time.
  if (!config.s3.enabled) {
    send(
      await singleFlight(building, `bypass:${workflowId}:${artifact}:${contentHash}`, () =>
        inBuildSlot(generate)
      ),
      'bypass'
    );
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

  // Miss, stale, or lookup failed → render (once, however many ask), then cache (best-effort).
  const buffer = await singleFlight(building, `${key}:${contentHash}`, () => inBuildSlot(generate));
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

/**
 * Fetch a cached export buffer if one exists and is still current (its
 * stored content hash matches). Returns null on a miss, a stale entry,
 * or when S3 is not configured.
 *
 * Lets one export reuse another's render: the PDF export pulls the
 * already-cached Word `.docx` and only runs the docx→PDF conversion,
 * skipping the per-section OpenAI reflow entirely.
 */
export async function getCachedExport(
  workflowId: string,
  artifact: string,
  contentHash: string
): Promise<Buffer | null> {
  if (!config.s3.enabled) return null;
  const key = `exports/${workflowId}/${artifact}`;
  try {
    const head = await getS3Client().send(
      new HeadObjectCommand({ Bucket: config.s3.bucket, Key: key })
    );
    if (head.Metadata?.contenthash !== contentHash) return null;
    const obj = await getS3Client().send(
      new GetObjectCommand({ Bucket: config.s3.bucket, Key: key })
    );
    return await streamToBuffer(obj.Body as NodeJS.ReadableStream);
  } catch (err: any) {
    const code = err?.name || err?.Code;
    const missing =
      code === 'NotFound' || code === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404;
    if (!missing) {
      loggingService.warn('Export cache fetch failed', { workflowId, artifact, err });
    }
    return null;
  }
}

/** S3 artifact filename for a per-step Word export. */
export function stepExportArtifact(stepNumber: number, moduleIndex?: number): string {
  return moduleIndex !== undefined
    ? `step${stepNumber}-module${moduleIndex}.docx`
    : `step${stepNumber}.docx`;
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
    // Steps 5, 6 and 10 all render from step4 as well as their own data — 10 for
    // module-level independent activities, hours and MLO alignment, 5 and 6 to name each
    // module in its heading — so their caches must invalidate when step4 changes, and
    // including it here also busts copies cached before each of those was added.
    // 12 checks each module's outcomes against its pack.
    aux: [5, 6, 7, 8, 10, 12].includes(stepNumber) ? workflow.step4 : undefined,
    // Step 10 also prints outcome wording (Step 3), case titles and the not-required mark
    // (Step 8) and which decks exist (Step 11).
    step10Aux:
      stepNumber === 10
        ? {
            step3: workflow.step3,
            step8: workflow.step8,
            decks: step11DeckIds(workflow.step11),
          }
        : undefined,
    // Step 13's validation table checks the exam's PLO coverage against Step 3.
    step13Aux: stepNumber === 13 ? { outcomes: workflow.step3?.outcomes } : undefined,
    // Step 7 prints the institution's assessment rules.
    step7Aux: stepNumber === 7 ? { assessmentRules: workflow.assessmentRules } : undefined,
  });
}

/** The slide decks Step 11 holds, as ids: all a Step 10 document needs to know about them. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function step11DeckIds(step11: any): string[] {
  const ids: string[] = [];
  for (const mod of step11?.modulePPTDecks || []) {
    for (const deck of mod?.pptDecks || []) {
      ids.push(String(deck?.deckId || deck?.lessonId || ''));
    }
  }
  return ids.sort();
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
