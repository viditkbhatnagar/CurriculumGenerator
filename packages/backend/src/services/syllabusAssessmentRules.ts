/**
 * Two rules for the graded work a student syllabus describes.
 *
 * Logan Pacey, 21 November 2026, re-testing the Diploma in Logistics pilot (workflow
 * 6af5a0a3b706bd9a5b7af54a): all four marking tables used Fail / Pass / Merit / Distinction
 * while the same syllabus said the programme handbook sets the grading scale; and in M01 the
 * graded piece was still an 8-question multiple-choice quiz (a Step 12 pack from 12 November),
 * titled as before and labelled "Mini-case exercises" (the Step 7 summative of 19 November).
 *
 * 1. Band names. The Fail/Pass/Merit/Distinction slots are storage for four bands, lowest to
 *    highest (the rule of 17 November: nothing invents a grade scale). The syllabus shows those
 *    names only when the institution's grading scale, as entered, names them; otherwise the
 *    descriptive levels Step 12 and Step 7 use.
 * 2. Which description of the graded work to trust. Step 7 is the approved assessment; a Step
 *    12 pack is built from it. When the pack no longer matches (a different type or weighting,
 *    or an older pack under a different title) the syllabus follows Step 7 and reports that
 *    the packs need regenerating, rather than printing one record's title over another's type.
 *
 * Pure, so it can be tested.
 */
import { DESCRIPTIVE_BANDS } from './assignmentPackRules';

const LEGACY_BANDS = ['fail', 'pass', 'merit', 'distinction'];

const norm = (v: unknown): string =>
  String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

/**
 * The four band names for a marking table, lowest to highest. `statedScale` is the grading
 * scale as the institution entered it (empty when it has entered none); `packLabels` are the
 * names stored on the Step 12 pack.
 */
export function syllabusBandLabels(statedScale: unknown, packLabels: unknown): string[] {
  const scale = norm(statedScale);
  if (!scale) return [...DESCRIPTIVE_BANDS];
  const labels = Array.isArray(packLabels)
    ? packLabels.map((l) => String(l ?? '').trim()).filter(Boolean)
    : [];
  if (labels.length !== 4 || new Set(labels.map(norm)).size !== 4) return [...DESCRIPTIVE_BANDS];
  // The pack's default names are not the institution's unless its own scale uses them.
  const isLegacy = labels.every((l, i) => norm(l) === LEGACY_BANDS[i]);
  if (isLegacy && !LEGACY_BANDS.every((w) => scale.includes(w))) return [...DESCRIPTIVE_BANDS];
  return labels;
}

export interface GradedWorkSources {
  /** The Step 7 module summative, when there is one. */
  step7: { title?: string; assessmentType?: string; weighting?: number; generatedAt?: unknown };
  /** The first delivery variant of the module's Step 12 pack. */
  variant: { overview?: { title?: string; assignmentType?: string; weighting?: number } };
  /** When the pack was written, and when Step 7 was. */
  packAt?: unknown;
  step7At?: unknown;
}

const time = (v: unknown): number => {
  const t = v ? new Date(v as any).getTime() : NaN;
  return Number.isNaN(t) ? NaN : t;
};

/**
 * Why the Step 12 pack does not describe Step 7's summative, or null when it does (or when
 * there is nothing to compare). A title that differs counts only when the pack is older than
 * Step 7: a newer pack may legitimately retitle the work for the student.
 */
export function packMismatch(src: GradedWorkSources): string | null {
  const { step7, variant } = src;
  const ov = variant?.overview || {};
  const reasons: string[] = [];
  if (
    norm(ov.assignmentType) &&
    norm(step7.assessmentType) &&
    norm(ov.assignmentType) !== norm(step7.assessmentType)
  ) {
    reasons.push(`type "${ov.assignmentType}" against Step 7's "${step7.assessmentType}"`);
  }
  const pw = Number(ov.weighting);
  const sw = Number(step7.weighting);
  if (Number.isFinite(pw) && Number.isFinite(sw) && sw > 0 && pw !== sw) {
    reasons.push(`weighting ${pw}% against Step 7's ${sw}%`);
  }
  const older = time(src.packAt) < time(src.step7At);
  if (older && norm(ov.title) && norm(step7.title) && norm(ov.title) !== norm(step7.title)) {
    reasons.push(`title "${ov.title}" against Step 7's "${step7.title}"`);
  }
  if (!reasons.length) return null;
  return `The Step 12 pack${older ? ' predates the current Step 7 and' : ''} differs from Step 7's summative (${reasons.join('; ')}). Regenerate the Step 12 packs for this module`;
}
