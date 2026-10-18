/**
 * Step 6's reading list, held to what Step 5 actually knows about each source.
 *
 * Rejin's audit (17 October 2026) on Step 6:
 * - the model was asked for chapters and "realistic estimates" of page ranges for sources it
 *   had never seen: Step 5 holds a title, authors, an abstract at best, never a table of contents;
 * - 9-14 readings were demanded from 5-6 sources, so sources were fragmented to make the count;
 * - titles, citations and compliance badges were re-typed by the model, so they could drift from
 *   the Step 5 record ("academicText" was printed as undefined for every source);
 * - the reading budget (50% / 65% of independent study) ignored the reading hours Step 4 had
 *   already allocated;
 * - readings were scheduled into weeks of an assumed 8-10 week module and marked for
 *   "assessment relevance" before any assessment existed.
 *
 * Now the budget comes from Step 4, each source yields at most one reading, bibliographic and
 * compliance facts come from the Step 5 record, chapters and pages are kept only when the source
 * record states them, readings carry a relative sequence and their relevance to outcomes, and
 * the reading time says it is an estimate.
 *
 * Pure, so it can be tested.
 */

/** Share of independent study given to reading when Step 4 allocated none. */
export const DEFAULT_READING_SHARE = 0.5;

export interface ReadingBudget {
  minutes: number;
  basis: string;
}

/** The minutes this module may spend on reading, from Step 4's own allocation where it made one. */
export function readingBudgetFor(module: any): ReadingBudget {
  const independentHours = Number(module?.selfStudyHours || module?.independentHours) || 0;
  const readingHours = (
    Array.isArray(module?.independentActivities) ? module.independentActivities : []
  )
    .filter((a: any) => a && typeof a === 'object' && String(a.type).toLowerCase() === 'reading')
    .reduce((sum: number, a: any) => sum + (Number(a.hours) || 0), 0);
  if (readingHours > 0) {
    return {
      minutes: Math.round(readingHours * 60),
      basis: `the ${readingHours} hours of reading Step 4 allocated within this module's independent study`,
    };
  }
  return {
    minutes: Math.round(independentHours * 60 * DEFAULT_READING_SHARE),
    basis: `half of the module's ${independentHours} independent hours, as Step 4 allocated no reading time (a default the institution can change)`,
  };
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** The chapter or page detail a source record actually holds, if any. */
function knownSections(source: any): { chapters: string; pages: string } {
  const chapters = Array.isArray(source?.chapters)
    ? source.chapters
        .map((c: any) => text(typeof c === 'string' ? c : c?.title))
        .filter(Boolean)
        .join('; ')
    : '';
  return { chapters, pages: text(source?.pages) };
}

/**
 * A source's complexity, when something actually assessed it. Step 5 stamped every OpenAlex
 * source "intermediate" without looking, so that value from that path means "not assessed".
 */
export function sourceComplexity(source: any): string | undefined {
  if (source?.complianceBadges?.verifiedVia === 'OpenAlex') return undefined;
  return text(source?.complexityLevel) || undefined;
}

const SEQUENCES = ['foundation', 'development', 'extension'];
const RELEVANCE = ['high', 'medium', 'low'];

/**
 * The model's readings for one module, kept to the module's own Step 5 sources, one per source,
 * with every fact about a source taken from its Step 5 record.
 */
export function tidyModuleReadings(readings: unknown, sources: any[]): any[] {
  const byId = new Map(sources.map((s) => [String(s?.id), s]));
  const kept = new Map<string, any>();
  for (const r of Array.isArray(readings) ? readings : []) {
    const source = byId.get(String((r as any)?.sourceId));
    if (!source) continue; // a source the module was never given
    const existing = kept.get(source.id);
    const linkedMLOs = [
      ...new Set([...(existing?.linkedMLOs || []), ...((r as any)?.linkedMLOs || [])]),
    ].map(String);
    if (existing) {
      // A second reading from the same source: merged, never kept as a fragment.
      kept.set(source.id, {
        ...existing,
        linkedMLOs,
        category:
          existing.category === 'core' || (r as any).category === 'core' ? 'core' : 'supplementary',
      });
      continue;
    }
    const sections = knownSections(source);
    const reading: any = r;
    kept.set(source.id, {
      id: text(reading.id) || `r-${source.id}`,
      sourceId: source.id,
      moduleId: source.moduleId,
      category: reading.category === 'core' ? 'core' : 'supplementary',
      // From the Step 5 record, never re-typed.
      title: source.title,
      authors: source.authors,
      year: source.year,
      citation: source.citation,
      complianceBadges: source.complianceBadges,
      agiCompliant: source.agiCompliant,
      // Only what the source record states; otherwise the whole work, said plainly.
      specificChapters: sections.chapters,
      pageRange: sections.pages,
      sectionsKnown: !!(sections.chapters || sections.pages),
      focusAreas: text(reading.focusAreas) || text(reading.specificChapters),
      whyThisReading: text(reading.whyThisReading),
      complexity: sourceComplexity(source) || text(reading.complexity) || undefined,
      complexityBasis: sourceComplexity(source) ? 'Step 5 source record' : 'model judgement',
      estimatedReadingMinutes: Math.max(
        0,
        Math.round(Number(reading.estimatedReadingMinutes) || 0)
      ),
      readingTimeBasis: 'model estimate; the length of the source is not recorded',
      sequence: SEQUENCES.includes(reading.sequence) ? reading.sequence : 'development',
      linkedMLOs,
      mloRelevance: RELEVANCE.includes(reading.mloRelevance) ? reading.mloRelevance : 'medium',
    });
  }
  return [...kept.values()];
}

/** The module summary, counted from the readings kept. */
export function moduleReadingSummary(moduleId: string, readings: any[], budget: ReadingBudget) {
  const minutes = (rs: any[]) => rs.reduce((n, r) => n + (r.estimatedReadingMinutes || 0), 0);
  const core = readings.filter((r) => r.category === 'core');
  const total = minutes(readings);
  return {
    moduleId,
    coreCount: core.length,
    supplementaryCount: readings.length - core.length,
    totalReadingMinutes: total,
    coreReadingMinutes: minutes(core),
    supplementaryReadingMinutes: total - minutes(core),
    readingBudgetMinutes: budget.minutes,
    readingBudgetBasis: budget.basis,
    withinBudget: budget.minutes > 0 ? total <= budget.minutes : null,
    mlosCovered: [...new Set(core.flatMap((r) => r.linkedMLOs || []))],
    computedBy: 'code',
  };
}
