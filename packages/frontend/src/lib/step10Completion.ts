/**
 * Whether a module's lesson plans are finished, on the screen's side.
 *
 * Mirrors the server rule in `packages/backend/src/services/step10Completion.ts`. Presence of
 * a lesson plan is not completeness: a module gets its entry after its FIRST lesson, because
 * generation saves incrementally so an interruption does not cost the whole module.
 *
 * Treating presence as completeness is what put a green tick over six modules holding 19, 19,
 * 8, 7, 5 and 1 lessons of the 30 each was meant to have. The reviewer had no way to see
 * that, and reported only the module that failed outright.
 */

const MIN_LESSON_MINUTES = 60;
const MAX_LESSON_MINUTES = 180;
const PREFERRED_LESSON_MINUTES = 90;

interface ModuleLike {
  id?: string;
  contactHours?: number;
}

interface PlanLike {
  moduleId?: string;
  moduleCode?: string;
  totalLessons?: number;
  plannedLessonCount?: number;
  lessons?: unknown[];
}

/** How many lessons a module of this size is generated to hold. */
export function plannedLessonCountFor(contactHours: number, agreed?: number): number {
  if (agreed && agreed > 0) return agreed;

  const totalMinutes = (contactHours || 0) * 60;
  if (totalMinutes <= 0) return 0;

  let numLessons = Math.max(1, Math.round(totalMinutes / PREFERRED_LESSON_MINUTES));
  const avg = totalMinutes / numLessons;
  if (avg > MAX_LESSON_MINUTES) numLessons = Math.ceil(totalMinutes / MAX_LESSON_MINUTES);
  else if (avg < MIN_LESSON_MINUTES)
    numLessons = Math.max(1, Math.floor(totalMinutes / MIN_LESSON_MINUTES));
  return numLessons;
}

/** How many lessons a plan holds, whether or not its lesson bodies have been loaded. */
export function lessonsHeld(plan?: PlanLike | null): number {
  if (!plan) return 0;
  if (Array.isArray(plan.lessons) && plan.lessons.length > 0) return plan.lessons.length;
  return plan.totalLessons || 0;
}

/** Whether this module holds every lesson it was planned to hold. */
export function isModuleComplete(
  module: ModuleLike | undefined,
  plan: PlanLike | undefined | null,
  plannedLessonCounts?: Record<string, number>
): boolean {
  if (!plan) return false;
  const held = lessonsHeld(plan);
  if (held === 0) return false;

  const agreed = module?.id ? plannedLessonCounts?.[module.id] : undefined;
  const target =
    plan.plannedLessonCount || plannedLessonCountFor(module?.contactHours || 0, agreed);
  if (!target || target <= 0) return held > 0;
  return held >= target;
}
