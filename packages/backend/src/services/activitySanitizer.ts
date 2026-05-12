/**
 * Sanitize + validate activity strings (Step 4 module contactActivities /
 * independentActivities). Activities are free-text — SMEs write things like
 *   "Lecture: Programme orientation and the fashion retail landscape (4h)"
 * We strip HTML, drop control characters, trim, and cap length / count.
 *
 * Kept in its own module so the rules can be unit-tested in isolation —
 * the route handler in workflowRoutes.ts is too big to drive through Jest
 * directly.
 */

export const ACTIVITY_MAX_ITEMS = 50;
export const ACTIVITY_MAX_CHARS = 500;

export function sanitizeActivityString(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const stripped = raw
    .replace(/<[^>]*>/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
  if (!stripped) return null;
  return stripped.length > ACTIVITY_MAX_CHARS ? stripped.slice(0, ACTIVITY_MAX_CHARS) : stripped;
}

export function sanitizeActivityArray(raw: unknown, fieldName: string): string[] {
  if (!Array.isArray(raw)) {
    throw new Error(`${fieldName} must be an array of strings`);
  }
  if (raw.length > ACTIVITY_MAX_ITEMS) {
    throw new Error(
      `${fieldName} accepts at most ${ACTIVITY_MAX_ITEMS} items (received ${raw.length})`
    );
  }
  const cleaned: string[] = [];
  for (const item of raw) {
    const s = sanitizeActivityString(item);
    if (s !== null) cleaned.push(s);
  }
  return cleaned;
}
