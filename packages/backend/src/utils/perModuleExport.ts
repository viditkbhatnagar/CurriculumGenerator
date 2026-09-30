/**
 * Which module a per-module download names: `GET .../export/word/step/:n?module=<i>` for
 * steps 10-12.
 *
 * `<i>` indexes the step's own per-module array, which is stored in generation order, not in
 * Step 4's. The route used to take any value: `parseInt` turned "abc" into NaN, and an index
 * outside the array made the Word export fall back to the WHOLE step. For the BBA's Step 10
 * that is every lesson in one Word file, which needs about 1.9GB against the container's 2GB,
 * so one GET with a wrong index could restart the backend for everyone.
 *
 * Pure, no imports, so it can be tested.
 */

/** Where steps 10-12 keep one entry per module. */
export const PER_MODULE_ARRAYS: Readonly<Record<number, string>> = Object.freeze({
  10: 'moduleLessonPlans',
  11: 'modulePPTDecks',
  12: 'moduleAssignmentPacks',
});

/**
 * The `?module=` value as an index: `undefined` when none was given, `null` when it is not a
 * non-negative whole number ("abc", "-1", "1.5", "2x", or a repeated parameter).
 */
export function parseModuleIndex(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string' || !/^\d{1,6}$/.test(raw)) return null;
  return Number(raw);
}

/** The stored entry that `?module=<index>` names in that step, or `undefined` when there is none. */
export function moduleEntryAt(
  workflow: unknown,
  stepNumber: number,
  index: number
): Record<string, unknown> | undefined {
  const key = PER_MODULE_ARRAYS[stepNumber];
  if (!key || !Number.isInteger(index) || index < 0) return undefined;
  const step = (workflow as Record<string, unknown> | null | undefined)?.[`step${stepNumber}`];
  const entries = (step as Record<string, unknown> | null | undefined)?.[key];
  if (!Array.isArray(entries) || index >= entries.length) return undefined;
  const entry = entries[index];
  return entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : undefined;
}
