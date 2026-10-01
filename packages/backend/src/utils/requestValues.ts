/**
 * Request values used in database queries: a filter is a string, a page size a bounded number.
 * An object or array from the query string (?status[x]=y) is never a filter value. Operator
 * keys are refused app-wide (middleware/security rejectOperatorKeys); this keeps each query's
 * shape what the route expects. Pure, no imports, so it can be tested.
 */

/** The value when it is a non-empty string (cut to `max` characters), else undefined. */
export function stringParam(value: unknown, max = 200): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;
}

/** A whole number within [min, max], or the fallback. */
export function intParam(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN;
  return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** Text to find, made safe to use inside a regular expression. */
export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
