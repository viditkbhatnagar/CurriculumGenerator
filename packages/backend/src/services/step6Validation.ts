/**
 * Step 6's reading-list checks, computed from the readings and the Step 5 sources they cite.
 *
 * A reading is a pointer to a Step 5 source (`sourceId`) plus how much of it to read. It holds
 * no `type` and no `accessStatus` of its own, yet the checks read both from the reading: the
 * academic/applied mix therefore failed on every programme and "all accessible" passed without
 * looking at anything. Compliance was the model's own `agiCompliant: true`, which the prompt
 * told it to write. And every check was `.every()`, which passes on an empty list, while a
 * module with no independent hours was given ten (found 2026-10-01).
 *
 * Each check is now computed from the source a reading cites, fails on an empty list, and is
 * null when it cannot be run. Pure, so it can be tested.
 */
import { sourceCompliant, Step5SourceLike } from './step5Validation';

export interface ReadingLike {
  sourceId?: string;
  moduleId?: string;
  category?: string;
  linkedMLOs?: unknown[];
  estimatedReadingMinutes?: number;
}

export interface Step6SourceLike extends Step5SourceLike {
  id?: string;
}

interface ModuleLike {
  id?: string;
  title?: string;
  selfStudyHours?: number;
  independentHours?: number;
}

export interface Step6ModuleSummary {
  moduleId?: string;
  moduleTitle?: string;
  coreCount: number;
  supplementaryCount: number;
  totalReadings: number;
  coreReadingMinutes: number;
  supplementaryReadingMinutes: number;
  totalReadingMinutes: number;
  /** 0 when the module's independent hours are not set. */
  independentStudyMinutes: number;
  /** null when the module's independent hours are not set. */
  readingTimePercent: number | null;
  allCoreMapToMLO: boolean;
  academicAppliedBalance: boolean;
  agiCompliant: boolean;
}

export interface Step6ValidationReport {
  coreCountValid: boolean;
  supplementaryCountValid: boolean;
  allCoreMapToMLO: boolean;
  allAGICompliant: boolean;
  academicAppliedMix: boolean;
  readingTimeWithinBudget: boolean | null;
  allAccessible: boolean;
}

export const CORE_RANGE = [3, 6] as const;
export const SUPPLEMENTARY_RANGE = [4, 8] as const;

const minutesOf = (list: ReadingLike[]) =>
  list.reduce((sum, r) => sum + (Number(r.estimatedReadingMinutes) || 0), 0);
const inRange = (n: number, [lo, hi]: readonly [number, number]) => n >= lo && n <= hi;

export function step6Checks(input: {
  readings: ReadingLike[];
  modules: ModuleLike[];
  sources: Step6SourceLike[];
  currentYear: number;
}): { moduleSummaries: Step6ModuleSummary[]; validationReport: Step6ValidationReport } {
  const readings = input.readings || [];
  const modules = input.modules || [];
  const sourceById = new Map(
    (input.sources || []).filter((s) => s?.id).map((s) => [String(s.id), s] as const)
  );
  const sourceOf = (r: ReadingLike) => sourceById.get(String(r.sourceId));
  // A reading whose source cannot be found cannot be shown to be anything.
  const compliant = (r: ReadingLike) => {
    const source = sourceOf(r);
    return !!source && sourceCompliant(source, input.currentYear);
  };
  const accessible = (r: ReadingLike) => {
    const source = sourceOf(r);
    return !!source && source.accessStatus !== 'rejected';
  };
  const typeOf = (r: ReadingLike) => sourceOf(r)?.type;

  const moduleSummaries = modules.map((mod): Step6ModuleSummary => {
    const own = readings.filter((r) => r.moduleId === mod.id);
    const core = own.filter((r) => r.category === 'core');
    const supplementary = own.filter((r) => r.category === 'supplementary');
    const total = minutesOf(core) + minutesOf(supplementary);
    const hours = Number(mod.selfStudyHours || mod.independentHours) || 0;
    return {
      moduleId: mod.id,
      moduleTitle: mod.title,
      coreCount: core.length,
      supplementaryCount: supplementary.length,
      totalReadings: own.length,
      coreReadingMinutes: minutesOf(core),
      supplementaryReadingMinutes: minutesOf(supplementary),
      totalReadingMinutes: total,
      independentStudyMinutes: hours * 60,
      readingTimePercent: hours > 0 ? Math.round((total / (hours * 60)) * 100) : null,
      allCoreMapToMLO: core.length > 0 && core.every((r) => (r.linkedMLOs || []).length > 0),
      academicAppliedBalance:
        own.some((r) => typeOf(r) === 'academic') &&
        own.some((r) => typeOf(r) === 'applied' || typeOf(r) === 'industry'),
      agiCompliant: own.length > 0 && own.every(compliant),
    };
  });

  const everyModule = (test: (m: Step6ModuleSummary) => boolean) =>
    moduleSummaries.length > 0 && moduleSummaries.every(test);
  const percents = moduleSummaries.map((m) => m.readingTimePercent);

  return {
    moduleSummaries,
    validationReport: {
      coreCountValid: everyModule((m) => inRange(m.coreCount, CORE_RANGE)),
      supplementaryCountValid: everyModule((m) =>
        inRange(m.supplementaryCount, SUPPLEMENTARY_RANGE)
      ),
      allCoreMapToMLO: everyModule((m) => m.allCoreMapToMLO),
      allAGICompliant: readings.length > 0 && readings.every(compliant),
      academicAppliedMix: everyModule((m) => m.academicAppliedBalance),
      // Over budget anywhere fails; otherwise a module with no hours set leaves it unchecked.
      readingTimeWithinBudget: !moduleSummaries.length
        ? false
        : percents.some((p) => p !== null && p > 100)
          ? false
          : percents.some((p) => p === null)
            ? null
            : true,
      allAccessible: readings.length > 0 && readings.every(accessible),
    },
  };
}

/** Passed when every check that ran passed. */
export function step6Passed(report: Step6ValidationReport): boolean {
  return Object.values(report).every((v) => v === true || v === null);
}

/** What an author is told for each check that did not pass. */
export function step6Issues(report: Step6ValidationReport): string[] {
  const issues: string[] = [];
  if (!report.coreCountValid)
    issues.push(`Some modules have a Core reading count outside ${CORE_RANGE.join('-')}`);
  if (!report.supplementaryCountValid)
    issues.push(
      `Some modules have a Supplementary reading count outside ${SUPPLEMENTARY_RANGE.join('-')}`
    );
  if (!report.allCoreMapToMLO)
    issues.push('Some modules have no Core reading, or a Core reading mapped to no outcome');
  if (report.readingTimeWithinBudget === false)
    issues.push('Some modules exceed independent study hours with reading time');
  if (report.readingTimeWithinBudget === null)
    issues.push('Reading time not checked: some modules have no independent hours set');
  if (!report.allAGICompliant)
    issues.push(
      'Some readings cite a source that fails the source rules, was added by hand and not yet reviewed, or cannot be found'
    );
  if (!report.academicAppliedMix)
    issues.push('Some modules lack either an academic or an applied reading');
  if (!report.allAccessible)
    issues.push('Some readings cite a source that is not accessible or cannot be found');
  return issues;
}

/**
 * Step 6's checks for a stored reading list, for showing it. Reports saved before 2026-10-01
 * passed on empty lists and read fields readings do not have; this recomputes them without
 * writing anything.
 */
export function step6ReportOf(
  workflow: {
    step4?: { modules?: ModuleLike[] };
    step5?: { sources?: Step6SourceLike[] };
    step6?: { readings?: ReadingLike[] };
  },
  currentYear: number
): {
  moduleSummaries: Step6ModuleSummary[];
  validationReport: Step6ValidationReport;
  validationIssues: string[];
  isValid: boolean;
} | null {
  if (!workflow.step6) return null;
  const { moduleSummaries, validationReport } = step6Checks({
    readings: workflow.step6.readings || [],
    modules: workflow.step4?.modules || [],
    sources: workflow.step5?.sources || [],
    currentYear,
  });
  return {
    moduleSummaries,
    validationReport,
    validationIssues: step6Issues(validationReport),
    isValid: step6Passed(validationReport),
  };
}
