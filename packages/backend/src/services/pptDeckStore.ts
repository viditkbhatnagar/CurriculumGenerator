/**
 * Off-document storage for Step 11 PowerPoint slide content.
 *
 * The whole curriculum lives in a single MongoDB document, which is capped at
 * 16MB. A large programme generates hundreds of PPT decks (thousands of slides
 * of titles, bullets and speaker notes) and that bulk pushed the document past
 * the limit, so every save failed — the module never marked complete and
 * generation looped (and Step 12 saves failed too).
 *
 * The actual .pptx download regenerates from the Step 10 lesson plans, so the
 * stored slide content is never read back for output. We therefore keep only
 * lightweight slide STUBS (slideNumber + slideType, for the UI preview) plus the
 * deck metadata in Mongo, and archive the full deck content to S3 (one object
 * per module). `hydrateModuleDecks` restores the full content from S3 if a
 * future reader needs it.
 */
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client, isS3Configured } from './s3Service';
import config from '../config';
import { loggingService } from './loggingService';

/** Deterministic S3 key for a module's full PPT decks. */
function deckKey(workflowId: string, moduleId: string): string {
  return `ppt-decks/${workflowId}/${encodeURIComponent(String(moduleId))}.json`;
}

/** A slide carries heavy content fields; a stub keeps only what the UI needs. */
function isHeavySlide(s: any): boolean {
  return !!s && (s.content !== undefined || s.speakerNotes !== undefined || s.visualSuggestion);
}

function stubSlide(s: any): any {
  return { slideNumber: s?.slideNumber, slideType: s?.slideType };
}

async function bodyToString(body: any): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

/**
 * Archive a module's full deck content to S3 and return a copy with each deck's
 * slides reduced to stubs and a `slidesS3Key` marker set. If S3 is not
 * configured the module is returned unchanged (the caller still saves — the doc
 * may be large, but we never silently drop data). Returns the input unchanged if
 * there is no heavy content to offload.
 */
export async function offloadModuleDecks(workflowId: string, mod: any): Promise<any> {
  if (!mod || !Array.isArray(mod.pptDecks) || mod.pptDecks.length === 0) return mod;

  const hasHeavy = mod.pptDecks.some((d: any) => (d?.slides || []).some(isHeavySlide));
  if (!hasHeavy) return mod; // already stubbed / nothing to do

  if (!isS3Configured()) {
    loggingService.warn('S3 not configured — Step 11 decks kept inline (document may be large)', {
      workflowId,
      moduleId: mod.moduleId,
    });
    return mod;
  }

  const fullDecks = mod.pptDecks.map((d: any) => ({ deckId: d.deckId, slides: d.slides || [] }));
  const key = deckKey(workflowId, mod.moduleId);
  try {
    await getS3Client().send(
      new PutObjectCommand({
        Bucket: config.s3.bucket,
        Key: key,
        Body: JSON.stringify(fullDecks),
        ContentType: 'application/json',
      })
    );
  } catch (err: any) {
    // Never lose data: if the archive write fails, keep the decks inline.
    loggingService.error('Failed to archive Step 11 decks to S3 — keeping inline', {
      workflowId,
      moduleId: mod.moduleId,
      error: err?.message || String(err),
    });
    return mod;
  }

  return {
    ...mod,
    slidesS3Key: key,
    pptDecks: mod.pptDecks.map((d: any) => ({
      ...d,
      slides: (d.slides || []).map(stubSlide),
    })),
  };
}

/**
 * Restore a module's full slide content from S3. No-op when the module was never
 * offloaded (legacy inline decks) or S3 is unavailable. Falls back to whatever is
 * inline on any S3 error so a reader degrades rather than crashes.
 */
export async function hydrateModuleDecks(mod: any): Promise<any> {
  if (!mod?.slidesS3Key || !isS3Configured()) return mod;
  try {
    const out = await getS3Client().send(
      new GetObjectCommand({ Bucket: config.s3.bucket, Key: mod.slidesS3Key })
    );
    const full: Array<{ deckId: string; slides: any[] }> = JSON.parse(await bodyToString(out.Body));
    const byDeck = new Map(full.map((x) => [x.deckId, x.slides]));
    return {
      ...mod,
      pptDecks: (mod.pptDecks || []).map((d: any) => ({
        ...d,
        slides: byDeck.get(d.deckId) || d.slides || [],
      })),
    };
  } catch (err: any) {
    loggingService.error('Failed to hydrate Step 11 decks from S3', {
      key: mod.slidesS3Key,
      error: err?.message || String(err),
    });
    return mod;
  }
}
