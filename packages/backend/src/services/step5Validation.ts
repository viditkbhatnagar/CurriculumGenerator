/**
 * The Step 5 source validation report.
 *
 * This used to be built inline in workflowService, where three of its checks were constants:
 * `minimumSourcesPerTopic: true // Simplified check`, `apaAccuracy: true // Assume validated`
 * and `traceabilityComplete: true`. Most of the others were `.every()` over the source list,
 * which is true when the list is empty, so a module with no sources at all passed them. Each
 * check below is computed from the stored sources, fails on an empty list, and a check that
 * does not exist yet reports `null` (not run) instead of passing.
 *
 * Pure functions only, and no imports: workflowService cannot be imported by a test (it
 * carries pre-existing type errors that fail the suite), so logic that needs testing has to
 * live outside it.
 */

export interface Step5SourceLike {
  moduleId?: string;
  linkedMLOs?: string[];
  category?: string;
  type?: string;
  year?: number;
  isSeminal?: boolean;
  seminalJustification?: string;
  pairedRecentSourceId?: string;
  citation?: string;
  authors?: string[];
  title?: string;
  accessStatus?: string;
  userAdded?: boolean;
  /** The module's weekly topics this source covers, by meaning (sourceRelevanceService). */
  linkedTopics?: string[];
  topicScores?: Record<string, number>;
  complianceBadges?: { peerReviewed?: boolean; freeAccess?: boolean; fullTextAvailable?: boolean };
}

export interface Step5ModuleLike {
  id?: string;
  mlos?: { id?: string }[];
  /** Weekly topics, stored as strings or as { title }. */
  topics?: unknown[];
}

/** `true` passed, `false` failed, `null` not checked. */
export type CheckResult = boolean | null;

export interface Step5ValidationReport {
  allSourcesApproved: CheckResult;
  recencyCompliance: CheckResult;
  minimumSourcesPerTopic: CheckResult;
  academicAppliedBalance: CheckResult;
  peerReviewRatio: CheckResult;
  completeCitations: CheckResult;
  apaAccuracy: CheckResult;
  verifiedAccess: CheckResult;
  noPaywalled: CheckResult;
  everyMLOSupported: CheckResult;
  traceabilityComplete: CheckResult;
  freeAccessRatio: CheckResult;
}

export const APPROVED_SOURCE_CATEGORIES = [
  'peer_reviewed_journal',
  'academic_textbook',
  'professional_body',
  'open_access',
  'institutional',
  'industry_report',
  'government_research',
];

/**
 * Each weekly topic needs at least this many of its module's sources. Dr. Sherin Thomas,
 * 2 October 2026: "at least 2 sources for each week's topic". The rule had been read as two
 * per learning outcome, which she did not mean.
 */
export const MIN_SOURCES_PER_TOPIC = 2;
const RECENT_YEARS = 5;
const MIN_PEER_REVIEWED_SHARE = 0.3;
const MIN_FREE_ACCESS_SHARE = 0.7;

export function isPeerReviewed(s: Step5SourceLike): boolean {
  return s.category === 'peer_reviewed_journal' || !!s.complianceBadges?.peerReviewed;
}

/**
 * Whether a source is legally free to read. 'free_full_text' is what a looked-up source is
 * stored as when OpenAlex gives a direct link to a free PDF.
 */
export function isFreeAccess(s: Step5SourceLike): boolean {
  return (
    s.accessStatus === 'free_access' ||
    s.accessStatus === 'open_access' ||
    s.accessStatus === 'free_full_text' ||
    s.complianceBadges?.freeAccess === true ||
    s.complianceBadges?.fullTextAvailable === true
  );
}

const isRecentOrJustified = (s: Step5SourceLike, currentYear: number) =>
  currentYear - (s.year || 0) <= RECENT_YEARS ||
  (!!s.isSeminal && !!s.seminalJustification && !!s.pairedRecentSourceId);

const hasCompleteCitation = (s: Step5SourceLike) =>
  !!s.citation && (s.authors || []).length > 0 && !!s.year && !!s.title;

/**
 * Whether one source meets the source rules the programme-level checks apply: an approved
 * category, recent or a justified seminal work, a complete citation, and not rejected for
 * access. Looked-up sources were stored as compliant with no test at all, and the model's
 * sources as compliant unless the model said otherwise. A source an author added by hand is
 * not compliant until someone reviews it, as before.
 */
export function sourceCompliant(s: Step5SourceLike, currentYear: number): boolean {
  return (
    !s.userAdded &&
    APPROVED_SOURCE_CATEGORIES.includes(s.category || '') &&
    isRecentOrJustified(s, currentYear) &&
    hasCompleteCitation(s) &&
    s.accessStatus !== 'rejected'
  );
}

/** How many of a module's own sources are linked to each of its outcomes. */
function sourcesPerOutcome(
  sources: Step5SourceLike[],
  modules: Step5ModuleLike[]
): { mloId: string; count: number }[] {
  return modules.flatMap((mod) => {
    const own = sources.filter((s) => s.moduleId === mod.id);
    return (mod.mlos || [])
      .map((m) => m?.id)
      .filter((id): id is string => !!id)
      .map((mloId) => ({
        mloId,
        count: own.filter((s) => (s.linkedMLOs || []).includes(mloId)).length,
      }));
  });
}

const topicTitleOf = (t: unknown): string =>
  typeof t === 'string'
    ? t.trim()
    : t && typeof t === 'object' && typeof (t as { title?: unknown }).title === 'string'
      ? ((t as { title: string }).title || '').trim()
      : '';

/** How many of a module's own sources cover each of its weekly topics. */
export function sourcesPerTopic(
  sources: Step5SourceLike[],
  modules: Step5ModuleLike[]
): { moduleId: string; topic: string; count: number }[] {
  return (modules || []).flatMap((mod) => {
    const own = (sources || []).filter((s) => s.moduleId === mod.id);
    return (mod.topics || [])
      .map(topicTitleOf)
      .filter(Boolean)
      .map((topic) => ({
        moduleId: String(mod.id),
        topic,
        count: own.filter((s) => (s.linkedTopics || []).includes(topic)).length,
      }));
  });
}

/** Whether any source carries topic scores: until then the topic rule cannot be checked. */
export const topicsScored = (sources: Step5SourceLike[]) =>
  (sources || []).some((s) => s.topicScores && Object.keys(s.topicScores).length > 0);

/**
 * The weekly topics below the floor, with how many sources each has. For the issue message,
 * so an author is told which topics to find sources for.
 */
export function topicsBelowSourceFloor(
  sources: Step5SourceLike[],
  modules: Step5ModuleLike[]
): { moduleId: string; topic: string; count: number }[] {
  return sourcesPerTopic(sources, modules).filter((t) => t.count < MIN_SOURCES_PER_TOPIC);
}

export function step5ValidationReport(
  sources: Step5SourceLike[],
  modules: Step5ModuleLike[],
  currentYear: number
): Step5ValidationReport {
  const list = sources || [];
  const mods = modules || [];
  const any = list.length > 0;
  const all = (test: (s: Step5SourceLike) => boolean) => any && list.every(test);
  const share = (test: (s: Step5SourceLike) => boolean) =>
    any ? list.filter(test).length / list.length : 0;

  const outcomes = sourcesPerOutcome(list, mods);
  const everyModuleHasOutcomes = mods.length > 0 && mods.every((m) => (m.mlos || []).length > 0);
  const everyMLOSupported = any && everyModuleHasOutcomes && outcomes.every((o) => o.count > 0);

  return {
    allSourcesApproved: all((s) => APPROVED_SOURCE_CATEGORIES.includes(s.category || '')),
    recencyCompliance: all((s) => isRecentOrJustified(s, currentYear)),
    // Two sources per weekly topic, once topics are scored; until then not checked.
    minimumSourcesPerTopic: !topicsScored(list)
      ? null
      : (() => {
          const topics = sourcesPerTopic(list, mods);
          return topics.length > 0 && topics.every((t) => t.count >= MIN_SOURCES_PER_TOPIC);
        })(),
    academicAppliedBalance:
      list.some((s) => s.type === 'academic') &&
      list.some((s) => s.type === 'applied' || s.type === 'industry'),
    peerReviewRatio: any && share(isPeerReviewed) >= MIN_PEER_REVIEWED_SHARE,
    completeCitations: all(hasCompleteCitation),
    // No check compares citations with APA rules yet. It was reported as passed regardless.
    apaAccuracy: null,
    verifiedAccess: all((s) => s.accessStatus !== 'rejected'),
    noPaywalled: all((s) => s.accessStatus !== 'rejected'),
    everyMLOSupported,
    // Traceable both ways: every source serves an outcome and every outcome has a source.
    traceabilityComplete: everyMLOSupported && all((s) => (s.linkedMLOs || []).length > 0),
    freeAccessRatio: any && share(isFreeAccess) >= MIN_FREE_ACCESS_SHARE,
  };
}

/** Compliant when every check that was run passed. A check that was not run proves nothing. */
export function step5Compliant(report: Step5ValidationReport): boolean {
  return Object.values(report).every((v) => v === null || v === true);
}
