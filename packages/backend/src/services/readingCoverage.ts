/**
 * Whether a module's readings can actually reach its lessons.
 *
 * Lesson plans attach a reading by matching the reading's linked outcomes against the lesson's
 * outcomes. A reading with no linked outcome therefore matches nothing: it sits in the Step 6
 * reading list, looks present in every review, and never appears in a single lesson.
 *
 * That silence hid two faults at once in the reviewed programme. The OpenStax chapter the
 * subject-matter expert had approved for M06 was listed but unlinked, so the five financial
 * mathematics lessons carried no reading at all — she found it by reading the lesson plans.
 * Behind it, 240 of 451 readings were unlinked for the same reason, and M06-LO4 was the only
 * outcome in 46 modules with no reading of any kind.
 *
 * Neither is detectable from counts, which is why nothing caught them: the reading list was full
 * and every module reported complete. These functions are pure so the checks can run anywhere —
 * on save, in the status endpoint, or in a test.
 */

export interface CoverageReading {
  title?: string;
  category?: string;
  linkedMLOs?: string[];
  mloIds?: string[];
}

export interface CoverageOutcome {
  id?: string;
  statement?: string;
}

/** The outcomes a reading claims, under either of the two field names in use. */
export function outcomesOf(reading: CoverageReading): string[] {
  return reading?.mloIds?.length ? reading.mloIds : reading?.linkedMLOs || [];
}

/** True for a reading that is a core reading rather than supplementary. */
export function isCore(reading: CoverageReading): boolean {
  return String(reading?.category || '').toLowerCase() === 'core';
}

/**
 * Readings that can never reach a lesson because they claim no outcome.
 *
 * Reported for supplementary readings too: a supplementary reading is not optional to the system,
 * it is invisible to it, and an expert choosing supplementary sources should not have to discover
 * that by reading lesson plans.
 */
export function unlinkedReadings(readings: CoverageReading[]): CoverageReading[] {
  return (readings || []).filter((r) => outcomesOf(r).length === 0);
}

/** Outcomes with no core reading — a lesson teaching one of these has nothing to set. */
export function outcomesWithoutCoreReading(
  outcomes: CoverageOutcome[],
  readings: CoverageReading[]
): string[] {
  const covered = new Set<string>();
  for (const r of readings || []) {
    if (!isCore(r)) continue;
    for (const id of outcomesOf(r)) covered.add(id);
  }
  return (outcomes || []).map((o) => o?.id).filter((id): id is string => !!id && !covered.has(id));
}

export interface ModuleCoverage {
  moduleCode: string;
  totalReadings: number;
  unlinked: number;
  uncoveredOutcomes: string[];
  ok: boolean;
}

/** Per-module coverage, and whether the module is sound. */
export function moduleCoverage(
  moduleCode: string,
  outcomes: CoverageOutcome[],
  readings: CoverageReading[]
): ModuleCoverage {
  const unlinked = unlinkedReadings(readings).length;
  const uncoveredOutcomes = outcomesWithoutCoreReading(outcomes, readings);
  return {
    moduleCode,
    totalReadings: (readings || []).length,
    unlinked,
    uncoveredOutcomes,
    ok: unlinked === 0 && uncoveredOutcomes.length === 0,
  };
}

/**
 * Programme-wide summary. `problems` lists only the modules worth acting on, so a clean programme
 * reports an empty array rather than 46 rows of nothing.
 */
export function coverageReport(
  modules: Array<{ moduleCode: string; outcomes: CoverageOutcome[]; readings: CoverageReading[] }>
): {
  modulesChecked: number;
  totalReadings: number;
  totalUnlinked: number;
  outcomesWithNoReading: string[];
  problems: ModuleCoverage[];
} {
  const rows = (modules || []).map((m) => moduleCoverage(m.moduleCode, m.outcomes, m.readings));
  return {
    modulesChecked: rows.length,
    totalReadings: rows.reduce((s, r) => s + r.totalReadings, 0),
    totalUnlinked: rows.reduce((s, r) => s + r.unlinked, 0),
    outcomesWithNoReading: rows.flatMap((r) => r.uncoveredOutcomes),
    problems: rows.filter((r) => !r.ok),
  };
}
