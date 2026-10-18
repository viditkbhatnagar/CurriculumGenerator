/** Bloom's levels in taxonomy order, in the spelling the app keys on. */
export const BLOOM_LEVEL_ORDER = [
  'remember',
  'understand',
  'apply',
  'analyze',
  'evaluate',
  'create',
] as const;

/**
 * Fold a Bloom level onto the canonical spelling.
 *
 * Generated content comes back in either spelling — "analyse" or "analyze" —
 * and the two never meet: a distribution keyed on one is invisible to a lookup
 * using the other. Returns null for anything that is not a Bloom level.
 */
export function normaliseBloomLevel(level?: string): string | null {
  const key = String(level || '')
    .trim()
    .toLowerCase()
    .replace('analyse', 'analyze');
  return (BLOOM_LEVEL_ORDER as readonly string[]).includes(key) ? key : null;
}
