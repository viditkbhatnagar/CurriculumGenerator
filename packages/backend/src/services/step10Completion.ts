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
  /** The agreed syllabus: strings, or { title } objects after a Step 4 re-upload. */
  topics?: unknown[];
}

/** How many named topics a module's syllabus holds, whichever shape they are stored in. */
export function namedTopicCount(topics: unknown[] | undefined): number {
  return (topics || []).filter((t) => {
    if (typeof t === 'string') return t.trim().length > 0;
    const o = t as { title?: unknown; name?: unknown } | null;
    return !!o && [o.title, o.name].some((v) => typeof v === 'string' && v.trim().length > 0);
  }).length;
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
export function plannedLessonCountFor(
  contactHours: number,
  plannedLessonCount?: number,
  topicCount = 0
): number {
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

  // A syllabus caps the count: no more lessons than it has topics, unless that would make a
  // lesson longer than three hours. The 90-minute quota alone asked for 12 lessons of a module
  // whose syllabus named 8 topics, and the generator filled the other 4 with re-worded copies
  // ("<topic>: Practical Evidence Build"), which is how the 21 Sep Logistics run produced
  // 120 filler lessons. Fewer, longer lessons carry the same contact hours.
  if (topicCount > 0) {
    const fewestWithinLimit = Math.ceil(totalMinutes / MAX_LESSON_MINUTES);
    numLessons = Math.min(numLessons, Math.max(topicCount, fewestWithinLimit));
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
  return plannedLessonCountFor(module?.contactHours || 0, agreed, namedTopicCount(module?.topics));
}

/** How many lessons a stored plan actually holds, whether or not bodies are loaded. */
export function lessonsHeld(plan: LessonPlanLike | undefined): number {
  if (!plan) return 0;
  if (Array.isArray(plan.lessons) && plan.lessons.length > 0) return plan.lessons.length;
  return plan.totalLessons || 0;
}

/**
 * The lesson count a plan is measured against: the count recorded on the plan itself, else the
 * module's expected count.
 *
 * Kept apart from `isPlanComplete` so anything that reports "7 of 30 planned" prints the same
 * 30 that decided the module was unfinished. The faculty guide does, and two copies of this
 * `||` are two chances for the figure and the verdict to disagree.
 */
export function plannedLessonTarget(plan: LessonPlanLike | undefined, expected: number): number {
  return plan?.plannedLessonCount || expected || 0;
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
  const target = plannedLessonTarget(plan, expected);
  if (target <= 0) return held > 0;
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
    const expected = expectedLessonCount(module, step10?.plannedLessonCounts);
    // A module with no contact hours has no lessons to generate, so it is finished by
    // definition. Without this it can never satisfy `isPlanComplete` — generation produces no
    // lessons for it, an empty plan is never complete, and the module is chosen as "next
    // incomplete" for ever, stalling the whole programme on a module with nothing to teach.
    if (expected <= 0) {
      done.add(module.id);
      continue;
    }
    if (isPlanComplete(byId.get(module.id), expected)) {
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
  // The MODULE's declared contact hours, not the plan's own figure.
  //
  // A stored plan's `totalContactHours` is the sum of the lessons it holds, so checking the
  // lessons against it compares them with themselves and `hoursMatch` is true however few
  // lessons there are — a module with 22 of its 30 lessons reported that its hours added up.
  // The module's declared hours are the standard the lessons are supposed to meet.
  const contactHours = module?.contactHours ?? plan?.totalContactHours ?? 0;
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
    // A module that declares no MLOs has nothing to cover, which is not the same as having
    // covered it. Reporting true there passed modules whose outcomes were never loaded.
    mlosCovered: mlos.length > 0 && mlos.every((m) => !!m?.id && covered.has(m.id)),
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

/** The six Step 10 validation flags shown in the step view and the export. */
export interface Step10ValidationFlags {
  allModulesHaveLessonPlans: boolean;
  allLessonDurationsValid: boolean;
  totalHoursMatch: boolean;
  allMLOsCovered: boolean;
  caseStudiesIntegrated: boolean;
  assessmentsIntegrated: boolean;
}

/**
 * Every flag is true only when every module earns it.
 *
 * The flags used to start true and be switched off by a failing module, so a module with no
 * recorded figures, or a programme with no modules at all, passed everything. And "integrated"
 * meant a count above zero across the whole programme, so one case study in one module stood
 * for all of them. The 21 Sep 2026 Logistics export went further still: the approve route
 * overwrote the flags with constants, and the document printed "case studies integrated"
 * above a summary of zero case studies and zero formative checks.
 */
function combineModuleStats(
  modules: CountableModule[],
  statsFor: (moduleId: string | undefined) => ModuleStats | undefined,
  completedIds: Set<string>,
  plannedLessonCounts?: Record<string, number>
): Step10ValidationFlags {
  const list = modules || [];
  // A module with no contact hours has no lessons, so it has no durations, hours, outcomes or
  // cases to check. `completedModuleIds` already counts it as finished; leaving it in the
  // per-module checks made every one of them fail for the whole programme because of a
  // module that was never meant to be taught.
  const taught = list.filter((m) => expectedLessonCount(m, plannedLessonCounts) > 0);
  const stats = taught.map((m) => statsFor(m?.id));
  const every = (test: (s: ModuleStats) => boolean) =>
    stats.length > 0 && stats.every((s) => !!s && test(s));

  return {
    allModulesHaveLessonPlans:
      list.length > 0 && list.every((m) => !!m?.id && completedIds.has(m.id)),
    allLessonDurationsValid: every((s) => s.durationsValid),
    totalHoursMatch: every((s) => s.hoursMatch),
    allMLOsCovered: every((s) => s.mlosCovered),
    caseStudiesIntegrated: every((s) => s.caseStudiesIncluded > 0),
    assessmentsIntegrated: every((s) => s.formativeChecksIncluded > 0),
  };
}

/**
 * The Step 10 validation flags, combined from the stubs.
 *
 * `allModulesHaveLessonPlans` means every module holds a FULL set of lessons, not merely some.
 * Under the old reading a programme of half-written modules reported that flag true, which is
 * how twelve truncated modules passed as generated.
 */
export function validationFromStubs(
  modules: CountableModule[],
  step10:
    | { moduleLessonPlans?: LessonPlanLike[]; plannedLessonCounts?: Record<string, number> }
    | undefined
): Step10ValidationFlags {
  const byId = new Map((step10?.moduleLessonPlans || []).map((s) => [s.moduleId, s]));
  const moduleById = new Map((modules || []).map((m) => [m?.id, m]));
  return combineModuleStats(
    modules,
    (id) => {
      const stub = id ? byId.get(id) : undefined;
      if (stub?.stats) return stub.stats;
      // Workflows generated before lesson bodies moved out of the workflow document keep the
      // lessons on the stub and never recorded stats; compute them from those lessons.
      return stub?.lessons?.length ? moduleStats(stub, moduleById.get(id)) : undefined;
    },
    completedModuleIds(modules, step10),
    step10?.plannedLessonCounts
  );
}

/**
 * The same flags, computed from lesson plans whose lesson bodies are loaded.
 *
 * For the generation path, which holds full plans in memory before the stubs exist.
 */
export function validationFromPlans(
  modules: CountableModule[],
  plans: LessonPlanLike[],
  plannedLessonCounts?: Record<string, number>
): Step10ValidationFlags {
  const byId = new Map((plans || []).map((p) => [p.moduleId, p]));
  const moduleById = new Map((modules || []).map((m) => [m?.id, m]));
  return combineModuleStats(
    modules,
    (id) => {
      const plan = id ? byId.get(id) : undefined;
      return plan ? moduleStats(plan, moduleById.get(id)) : undefined;
    },
    completedModuleIds(modules, { moduleLessonPlans: plans, plannedLessonCounts }),
    plannedLessonCounts
  );
}

/**
 * The modules a document actually holds plans for, in Step 4's order.
 *
 * A per-module document carries one module's plan beside the programme's full module list.
 * Judging that one plan against every module reported the other modules' missing stats as
 * failures, so each of the 46 files in the Step 10 archive printed six "Fail" rows above a
 * complete, correct module. A module-scoped document is checked against its own modules.
 */
export function modulesInDocument(
  modules: CountableModule[],
  plans: LessonPlanLike[]
): CountableModule[] {
  const held = new Set((plans || []).map((p) => p?.moduleId).filter(Boolean));
  return (modules || []).filter((m) => !!m?.id && held.has(m.id));
}

/**
 * Whether a stored module looks like it lost lessons rather than having fewer by design.
 *
 * A finished module's lessons always add up to its contact hours: the generator distributes
 * the module's minutes across however many lessons it was asked for, so a module curated to
 * eight lessons has eight longer ones, not a shortfall. A module whose lessons fall well
 * short of its contact hours therefore stopped early.
 *
 * This distinguishes the two cases that look identical from a lesson count alone — the
 * modules truncated by failed writes, and the modules an SME deliberately gave fewer lessons
 * — so healing existing data does not regenerate work that was never damaged.
 */
export function looksTruncated(plan: LessonPlanLike, module?: CountableModule): boolean {
  const lessons = (plan?.lessons || []) as { duration?: number }[];
  if (lessons.length === 0) return true;

  const contactHours = module?.contactHours ?? plan?.totalContactHours ?? 0;
  if (contactHours <= 0) return false;

  const lessonMinutes = lessons.reduce((sum, l) => sum + (l?.duration || 0), 0);
  return lessonMinutes < contactHours * 60 - MIN_TOLERANCE_MINUTES;
}
