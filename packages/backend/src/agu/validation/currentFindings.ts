/**
 * An outline's findings as they stand now, not as they were when it was drafted.
 *
 * GET /api/agu/drafts/:id and the course package served the findings stored when the outline
 * was drafted, so a validator fixed since went on showing old warnings: CR08 still reported
 * "clean" and "quantify" as unmeasurable verbs on 2026-10-01, a day after they were accepted.
 * Artefact findings were already recomputed on read; outline findings now are too.
 */
import { CatalogueEdition } from '../catalogue/types';
import { CourseDraft, Finding } from '../draft/types';
import { reviewStatus, validateDraft } from './validateDraft';

/** Findings made while parsing the model's answer: the stored draft cannot reproduce them. */
export const OUTLINE_PARSE_CODES = new Set(['READING_NOT_OFFERED', 'NO_VERIFIED_SOURCES']);

interface StoredOutline {
  draft?: CourseDraft | null;
  findings?: Finding[];
  status: string;
}

export interface CurrentOutline {
  findings: Finding[];
  status: string;
  /** For an accepted draft: today's re-check, beside the findings it was accepted with. */
  recheck?: Finding[];
}

export function currentOutline(doc: StoredOutline, catalogue: CatalogueEdition): CurrentOutline {
  const stored = doc.findings || [];
  if (!doc.draft) return { findings: stored, status: doc.status };
  const now = [
    ...stored.filter((f) => OUTLINE_PARSE_CODES.has(f.code)),
    ...validateDraft(doc.draft, catalogue),
  ];
  // An accepted draft keeps the record it was accepted on.
  if (doc.status === 'faculty_accepted')
    return { findings: stored, status: doc.status, recheck: now };
  const isVerdict = doc.status === 'ready_for_review' || doc.status === 'needs_faculty';
  return { findings: now, status: isVerdict ? reviewStatus(now) : doc.status };
}
