/**
 * What counts as a finished module in Step 10.
 *
 * The system used to answer this with "does the module have an entry in
 * `step10.moduleLessonPlans`?". Presence is not completeness, and the difference was
 * invisible for as long as writes succeeded: a module gets its entry after its FIRST lesson,
 * because the progress callback saves incrementally so a crash does not lose an hour of
 * generation.
 *
 * So when writes started failing partway through a module, every partially written module
 * was skipped as done. The reviewer's programme finished with modules holding 30, 30, 30,
 * 30, 30, 30, 19, 19, 8, 7, 5 and 1 lessons of the 30 each was supposed to have, and all
 * twelve displayed a green tick. She reported the visible half of this — that generation
 * "shows 90% and then back again to Generate" on module 13 — and had no way to see that six
 * modules behind it were quietly incomplete.
 *
 * Completeness is measured against the lesson count the generator itself planned, kept in
 * this one place so the queue, the routes, the export and the screen cannot disagree.
 *
 * Pure functions only, and no imports: `workflowService` cannot be imported by a test
 * (it carries pre-existing type errors that fail the suite), so logic that needs testing
 * has to live outside it.
 */

/** A module's lesson plan as stored, with or without its lesson bodies loaded. */
export interface LessonPlanLike {
  moduleId?: string;
  moduleCode?: string;
  moduleTitle?: string;
  moduleDescription?: string;
  totalContactHours?: number;
  totalLessons?: number;
  plannedLessonCount?: number;
  lessons?: unknown[];
  pptDecks?: unknown[];
  /** Per-module figures, so summary and validation need no lesson bodies. See `moduleStats`. */
  stats?: ModuleStats;
}

/**
 * Everything the Step 10 summary and validation panel need from one module.
 *
 * Computed once when the module is saved and carried on the stub, because the alternative is
 * loading 26MB of lesson bodies from storage every time a single module finishes generating
 * just to re-add up the same numbers.
 */
export interface ModuleStats {
  lessonCount: number;
  contactHours: number;
  lessonMinutes: number;
  caseStudiesIncluded: number;
  formativeChecksIncluded: number;
  durationsValid: boolean;
  hoursMatch: boolean;
  mlosCovered: boolean;
}

/** A Step 4 module, as far as lesson counting is concerned. */
export interface CountableModule {
  id?: string;
  contactHours?: number;
  mlos?: { id?: string }[];
}

const MIN_LESSON_MINUTES = 60;
const MAX_LESSON_MINUTES = 180;
const PREFERRED_LESSON_MINUTES = 90;

/**
 * How many lessons a module of this size is generated to hold.
 *
 * `calculateLessonBlocks` calls this rather than repeating the arithmetic, because a second
 * copy of the rule is a second chance for "finished" and "how many to generate" to disagree —
 * and they disagree silently, by leaving a module one lesson short forever.
 */
export function plannedLessonCountFor(contactHours: number, plannedLessonCount?: number): number {
  if (plannedLessonCount && plannedLessonCount > 0) return plannedLessonCount;

  const totalMinutes = (contactHours || 0) * 60;
  if (totalMinutes <= 0) return 0;

  let numLessons = Math.max(1, Math.round(totalMinutes / PREFERRED_LESSON_MINUTES));
  const avgDuration = totalMinutes / numLessons;
  if (avgDuration > MAX_LESSON_MINUTES) {
    numLessons = Math.ceil(totalMinutes / MAX_LESSON_MINUTES);
  } else if (avgDuration < MIN_LESSON_MINUTES) {
    numLessons = Math.max(1, Math.floor(totalMinutes / MIN_LESSON_MINUTES));
  }
  return numLessons;
}

/**
 * The target for one module, preferring what was actually agreed for it.
 *
 * A module curated from an SME's own document has an agreed lesson count in
 * `step10.plannedLessonCounts`; deriving a number from contact hours instead is what
 * manufactures filler lessons to fill the quota.
 */
export function expectedLessonCount(
  module: CountableModule,
  plannedLessonCounts?: Record<string, number>
): number {
  const agreed = module?.id ? plannedLessonCounts?.[module.id] : undefined;
  return plannedLessonCountFor(module?.contactHours || 0, agreed);
}

/** How many lessons a stored plan actually holds, whether or not bodies are loaded. */
export function lessonsHeld(plan: LessonPlanLike | undefined): number {
  if (!plan) return 0;
  if (Array.isArray(plan.lessons) && plan.lessons.length > 0) return plan.lessons.length;
  return plan.totalLessons || 0;
}

/**
 * Whether a module's plan is finished.
 *
 * `>=` rather than `===`: a module that legitimately holds more lessons than the derived
 * figure (an imported plan, or a count that changed after generation) is finished, and
 * demanding an exact match would regenerate it forever.
 */
export function isPlanComplete(plan: LessonPlanLike | undefined, expected: number): boolean {
  if (!plan) return false;
  const held = lessonsHeld(plan);
  if (held === 0) return false;
  const target = plan.plannedLessonCount || expected;
  if (!target || target <= 0) return held > 0;
  return held >= target;
}

/**
 * The ids of modules that are genuinely finished.
 *
 * This is the set the generator skips over, so anything wrongly in it is a module that will
 * never be completed and never be reported as missing.
 */
export function completedModuleIds(
  modules: CountableModule[],
  step10:
    | { moduleLessonPlans?: LessonPlanLike[]; plannedLessonCounts?: Record<string, number> }
    | undefined
): Set<string> {
  const plans = step10?.moduleLessonPlans || [];
  const byId = new Map<string, LessonPlanLike>();
  for (const plan of plans) {
    if (plan?.moduleId) byId.set(plan.moduleId, plan);
  }

  const done = new Set<string>();
  for (const module of modules || []) {
    if (!module?.id) continue;
    const plan = byId.get(module.id);
    if (isPlanComplete(plan, expectedLessonCount(module, step10?.plannedLessonCounts))) {
      done.add(module.id);
    }
  }
  return done;
}

/**
 * The index of the next module needing work, or -1 when the programme is finished.
 *
 * A partially generated module comes back before any untouched one, so an interrupted module
 * is resumed rather than abandoned at whatever lesson it stopped on.
 */
export function nextIncompleteModuleIndex(
  modules: CountableModule[],
  step10:
    | { moduleLessonPlans?: LessonPlanLike[]; plannedLessonCounts?: Record<string, number> }
    | undefined
): number {
  const done = completedModuleIds(modules, step10);
  return (modules || []).findIndex((m) => !!m?.id && !done.has(m.id));
}

/**
 * The workflow-document copy of a plan: everything except the lesson bodies.
 *
 * Kept so that counting, validation, the summary and the module list all still work from the
 * workflow document alone, without loading 26MB of teaching content to answer "how many
 * lessons does module 12 have?".
 */
export function moduleStub(plan: LessonPlanLike, module?: CountableModule): LessonPlanLike {
  return {
    moduleId: plan.moduleId,
    moduleCode: plan.moduleCode,
    moduleTitle: plan.moduleTitle,
    moduleDescription: plan.moduleDescription,
    totalContactHours: plan.totalContactHours,
    totalLessons: lessonsHeld(plan),
    plannedLessonCount: plan.plannedLessonCount,
    lessons: [],
    pptDecks: plan.pptDecks || [],
    stats: (plan.lessons || []).length > 0 ? moduleStats(plan, module) : plan.stats,
  };
}

/** A lesson, as far as the summary and validation are concerned. */
interface LessonLike {
  duration?: number;
  linkedMLOs?: string[];
  caseStudyActivity?: unknown;
  formativeChecks?: unknown[];
}

const MIN_TOLERANCE_MINUTES = 5;

/**
 * Reduce a module's lessons to the handful of figures anything downstream asks for.
 *
 * The checks match what `validateLessonPlans` applied to the whole programme at once —
 * durations inside 60-180 minutes, lesson time adding up to the module's contact hours, every
 * MLO taught by some lesson — but answered per module so they survive on the stub.
 */
export function moduleStats(plan: LessonPlanLike, module?: CountableModule): ModuleStats {
  const lessons = (plan?.lessons || []) as LessonLike[];
  const contactHours = plan?.totalContactHours || module?.contactHours || 0;
  const lessonMinutes = lessons.reduce((sum, l) => sum + (l?.duration || 0), 0);

  const covered = new Set<string>();
  for (const lesson of lessons) {
    for (const mloId of lesson?.linkedMLOs || []) covered.add(mloId);
  }
  const mlos = module?.mlos || [];

  return {
    lessonCount: lessons.length,
    contactHours,
    lessonMinutes,
    caseStudiesIncluded: lessons.filter((l) => !!l?.caseStudyActivity).length,
    formativeChecksIncluded: lessons.reduce((sum, l) => sum + (l?.formativeChecks?.length || 0), 0),
    durationsValid: lessons.every(
      (l) => (l?.duration || 0) >= MIN_LESSON_MINUTES && (l?.duration || 0) <= MAX_LESSON_MINUTES
    ),
    hoursMatch: Math.abs(lessonMinutes - contactHours * 60) <= MIN_TOLERANCE_MINUTES,
    mlosCovered: mlos.length === 0 || mlos.every((m) => !!m?.id && covered.has(m.id)),
  };
}

/** The Step 10 summary, added up from the stubs rather than from lesson bodies. */
export function summariseFromStubs(stubs: LessonPlanLike[]): {
  totalLessons: number;
  totalContactHours: number;
  averageLessonDuration: number;
  caseStudiesIncluded: number;
  formativeChecksIncluded: number;
} {
  let totalLessons = 0;
  let totalContactHours = 0;
  let lessonMinutes = 0;
  let caseStudiesIncluded = 0;
  let formativeChecksIncluded = 0;

  for (const stub of stubs || []) {
    const s = stub?.stats;
    totalLessons += s?.lessonCount ?? lessonsHeld(stub);
    totalContactHours += s?.contactHours ?? stub?.totalContactHours ?? 0;
    lessonMinutes += s?.lessonMinutes ?? 0;
    caseStudiesIncluded += s?.caseStudiesIncluded ?? 0;
    formativeChecksIncluded += s?.formativeChecksIncluded ?? 0;
  }

  return {
    totalLessons,
    totalContactHours,
    averageLessonDuration: totalLessons > 0 ? lessonMinutes / totalLessons : 0,
    caseStudiesIncluded,
    formativeChecksIncluded,
  };
}

/**
 * The Step 10 validation flags, combined from the stubs.
 *
 * `allModulesHaveLessonPlans` now means every module holds a FULL set of lessons, not merely
 * some. Under the old reading a programme of half-written modules reported that flag true,
 * which is how twelve truncated modules passed as generated.
 */
export function validationFromStubs(
  modules: CountableModule[],
  step10:
    | { moduleLessonPlans?: LessonPlanLike[]; plannedLessonCounts?: Record<string, number> }
    | undefined
): {
  allModulesHaveLessonPlans: boolean;
  allLessonDurationsValid: boolean;
  totalHoursMatch: boolean;
  allMLOsCovered: boolean;
  caseStudiesIntegrated: boolean;
  assessmentsIntegrated: boolean;
} {
  const stubs = step10?.moduleLessonPlans || [];
  const byId = new Map(stubs.map((s) => [s.moduleId, s]));
  const done = completedModuleIds(modules, step10);

  let allLessonDurationsValid = true;
  let totalHoursMatch = true;
  let allMLOsCovered = true;
  let caseStudies = 0;
  let formativeChecks = 0;

  for (const module of modules || []) {
    const stub = module?.id ? byId.get(module.id) : undefined;
    if (!stub) continue;
    const s = stub.stats;
    if (!s) continue;
    if (!s.durationsValid) allLessonDurationsValid = false;
    if (!s.hoursMatch) totalHoursMatch = false;
    if (!s.mlosCovered) allMLOsCovered = false;
    caseStudies += s.caseStudiesIncluded;
    formativeChecks += s.formativeChecksIncluded;
  }

  return {
    allModulesHaveLessonPlans: (modules || []).length > 0 && done.size >= (modules || []).length,
    allLessonDurationsValid,
    totalHoursMatch,
    allMLOsCovered,
    caseStudiesIntegrated: caseStudies > 0,
    assessmentsIntegrated: formativeChecks > 0,
  };
}
