/**
 * How recent a source has to be, by kind of source and kind of module.
 *
 * Logan Pacey, email of 12 November 2026. The flat five-year rule failed the free library
 * textbooks, which are mostly 2017-2020 editions: in the end-to-end test the only failing check
 * in Steps 5 and 6 was one OpenStax chapter from 2020. His rules:
 *
 * 1. A core textbook counts as current if it is the latest edition available, even when that
 *    edition is more than five years old. The check says "latest edition (2019)" so a reviewer
 *    can see why. Ten years is the outer limit: anything older still needs a reason.
 * 2. Supplementary and applied sources keep the strict five-year rule.
 * 3. Every module needs at least one source from the last five years (any kind may count).
 * 4. On a fast-moving topic (AI, data tools, regulation, digital) the latest-edition exception
 *    does not apply to the textbook. If no textbook from the last five years exists for such a
 *    module, approval needs a reason.
 *
 * A "reason" is what the rule has always accepted: a justified seminal work paired with a recent
 * source, or an administrator's override at approval (approvalChecks). Pure functions, no imports.
 */

export const RECENT_YEARS = 5;
/** A latest edition older than this is not current whatever the library holds. */
export const LATEST_EDITION_LIMIT_YEARS = 10;

export interface RecencySource {
  id?: string;
  moduleId?: string;
  category?: string;
  year?: number;
  isSeminal?: boolean;
  seminalJustification?: string;
  pairedRecentSourceId?: string;
  /**
   * Whether the textbook is the newest edition the library holds. Stamped from the library
   * (knowledge/latestEdition). `false` means a newer edition is held. Unset on a library chapter
   * means no newer edition is known, which counts as the latest.
   */
  isLatestEdition?: boolean;
}

export interface RecencyModule {
  id?: string;
  title?: string;
  description?: string;
  topics?: unknown[];
}

export interface CurrencyVerdict {
  current: boolean;
  /** Why a source older than five years still counts, e.g. "latest edition (2019)". */
  note?: string;
}

/**
 * Fast-moving subjects. Each pattern is word-bounded and deliberately narrow: "data" alone does
 * not count (a general business module may say "data"), but data science, data tools, analytics,
 * big data and data protection do. Regulation covers regulation, regulatory and compliance law.
 * Digital, AI, cyber, cloud, automation and blockchain count on their own.
 */
const FAST_MOVING_PATTERNS: readonly RegExp[] = [
  /\bAI\b/,
  /\bgenerative\b/i,
  /\bartificial intelligence\b/i,
  /\bmachine learning\b/i,
  /\bdeep learning\b/i,
  /\bdata (?:science|scientist|tools?|analytics|engineering|visuali[sz]ation|protection|privacy|governance)\b/i,
  /\bbig data\b/i,
  /\b(?:business|predictive|people|marketing|web|digital) analytics\b/i,
  /\banalytics (?:platforms?|tools?)\b/i,
  /\bregulat(?:ion|ions|ory)\b/i,
  /\bcompliance law\b/i,
  /\bGDPR\b/,
  /\bdigital\b/i,
  /\bcyber\w*/i,
  /\bcloud\b/i,
  /\bblockchain\b/i,
  /\bautomation\b/i,
];

const topicText = (t: unknown): string =>
  typeof t === 'string'
    ? t
    : t && typeof t === 'object' && typeof (t as { title?: unknown }).title === 'string'
      ? (t as { title: string }).title
      : '';

/** Whether a module's title, description or weekly topics are on a fast-moving subject. */
export function isFastMovingModule(module: RecencyModule | null | undefined): boolean {
  if (!module) return false;
  const text = [module.title, module.description, ...(module.topics || []).map(topicText)]
    .filter((t): t is string => typeof t === 'string' && t.length > 0)
    .join(' . ');
  return FAST_MOVING_PATTERNS.some((p) => p.test(text));
}

export const isLibrarySource = (s: { id?: unknown } | null | undefined): boolean =>
  String(s?.id || '').startsWith('lib-');

export const isTextbook = (s: RecencySource): boolean =>
  s.category === 'academic_textbook' || isLibrarySource(s);

const isJustifiedSeminal = (s: RecencySource): boolean =>
  !!s.isSeminal && !!s.seminalJustification && !!s.pairedRecentSourceId;

/**
 * Latest edition available. For a library chapter that is the library's copy unless a newer
 * edition is held. A model-written textbook has no edition record, so it is never established.
 */
const isLatestEdition = (s: RecencySource): boolean =>
  isLibrarySource(s) ? s.isLatestEdition !== false : s.isLatestEdition === true;

/** Whether one source is current, and if only by an exception, the note saying so. */
export function sourceCurrency(
  s: RecencySource,
  currentYear: number,
  opts: { fastMoving?: boolean } = {}
): CurrencyVerdict {
  const age = currentYear - (s.year || 0);
  if (s.year && age <= RECENT_YEARS) return { current: true };
  if (isJustifiedSeminal(s)) return { current: true };
  if (
    s.year &&
    isTextbook(s) &&
    age <= LATEST_EDITION_LIMIT_YEARS &&
    isLatestEdition(s) &&
    !opts.fastMoving
  ) {
    return { current: true, note: `latest edition (${s.year})` };
  }
  return { current: false };
}

export interface ModuleRecencyProblem {
  moduleId: string;
  moduleTitle: string;
  kind: 'no_recent_source' | 'fast_moving_no_recent_textbook';
  message: string;
}

const isWithinFive = (s: RecencySource, currentYear: number) =>
  !!s.year && currentYear - s.year <= RECENT_YEARS;

/**
 * Modules that break rule 3 (no source from the last five years) or rule 4 (a fast-moving module
 * with no textbook from the last five years). A module with no sources at all is reported by the
 * other Step 5 checks and not here.
 */
export function moduleRecencyProblems(
  sources: RecencySource[],
  modules: RecencyModule[],
  currentYear: number
): ModuleRecencyProblem[] {
  return (modules || []).flatMap((mod): ModuleRecencyProblem[] => {
    const own = (sources || []).filter((s) => s.moduleId === mod.id);
    if (own.length === 0) return [];
    const base = { moduleId: String(mod.id), moduleTitle: mod.title || String(mod.id) };
    const problems: ModuleRecencyProblem[] = [];
    if (!own.some((s) => isWithinFive(s, currentYear))) {
      problems.push({
        ...base,
        kind: 'no_recent_source',
        message: `${base.moduleTitle} has no source from the last ${RECENT_YEARS} years`,
      });
    }
    if (
      isFastMovingModule(mod) &&
      !own.some((s) => isTextbook(s) && isWithinFive(s, currentYear))
    ) {
      problems.push({
        ...base,
        kind: 'fast_moving_no_recent_textbook',
        message: `${base.moduleTitle} is a fast-moving subject and has no textbook from the last ${RECENT_YEARS} years; approving it needs a reason`,
      });
    }
    return problems;
  });
}

/**
 * The sources with `recencyNote` set where an older source counts as current by an exception,
 * and cleared where it does not. A new array; the inputs are not changed.
 */
export function withRecencyNotes<T extends RecencySource>(
  sources: T[],
  modules: RecencyModule[],
  currentYear: number
): (T & { recencyNote?: string })[] {
  const fastById = new Map((modules || []).map((m) => [String(m.id), isFastMovingModule(m)]));
  return (sources || []).map((s) => {
    const { recencyNote: _previous, ...rest } = s as T & { recencyNote?: string };
    const verdict = sourceCurrency(s, currentYear, {
      fastMoving: fastById.get(String(s.moduleId)) === true,
    });
    return (verdict.note ? { ...rest, recencyNote: verdict.note } : rest) as T & {
      recencyNote?: string;
    };
  });
}
