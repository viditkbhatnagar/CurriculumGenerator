/**
 * The reading-list ranges: 3-6 core and 4-8 supplementary readings a module.
 *
 * Provenance: the institution's workflow specification v2.2 (committed 2 December 2025, Step 6:
 * "Core (Indicative) Reading: 3-6 per module", "Supplementary (Additional) Reading: 4-8 per
 * module", "Each module has 3-6 Core + 4-8 Supplementary"). They are a stated rule, and the
 * validator has always held lists to them.
 *
 * The generation prompt, however, said "there is no fixed number" (Rejin's audit, 17 October
 * 2026, to stop sources being split into fragments to make a count), and the model chose the
 * split alone. In Logan Pacey's re-test of 2 November 2026 that gave core/supplementary of 7/3,
 * 4/5, 7/2 and 6/3, so three of four modules failed a range their own validator applies. The
 * number of readings is still bounded by the sources (one reading each); what is free is which
 * are core. That is now set in code, within the ranges where a module's readings allow it, and a
 * module with too few sources is reported as a Step 5 supply shortfall (see step6Validation).
 *
 * Pure, so it can be tested.
 */

export const CORE_RANGE = [3, 6] as const;
export const SUPPLEMENTARY_RANGE = [4, 8] as const;

/** Readings a module needs to be inside both ranges. */
export const MIN_READINGS = CORE_RANGE[0] + SUPPLEMENTARY_RANGE[0];

const RELEVANCE_RANK: Record<string, number> = { high: 2, medium: 1, low: 0 };

/** Higher is a better core reading: more relevant, more outcomes, compliant, read first. */
function coreWorthiness(r: any): number {
  return (
    (RELEVANCE_RANK[r.mloRelevance] ?? 1) * 100 +
    Math.min((r.linkedMLOs || []).length, 9) * 10 +
    (r.agiCompliant === true ? 5 : 0) +
    (r.sequence === 'foundation' ? 2 : r.sequence === 'extension' ? 0 : 1)
  );
}

/** The core count nearest `current` that lands both categories in range where the total allows. */
export function targetCoreCount(total: number, current: number): number {
  const [coreMin, coreMax] = CORE_RANGE;
  const [suppMin, suppMax] = SUPPLEMENTARY_RANGE;
  const floor = Math.min(coreMin, total);
  const hi = Math.min(coreMax, Math.max(total - suppMin, floor));
  const lo = Math.min(Math.max(floor, total - suppMax), hi);
  return Math.min(Math.max(current, lo), hi);
}

/**
 * One module's readings with core and supplementary set to the ranges where the readings allow
 * it. A reading is promoted to core only if it is linked to an outcome; the weakest core readings
 * are demoted first. Returned in the original order, changed readings marked.
 */
export function balanceCoreSupplementary<T extends Record<string, any>>(readings: T[]): T[] {
  const core = readings.filter((r) => r.category === 'core');
  const target = targetCoreCount(readings.length, core.length);
  const change = new Set<T>();
  if (core.length > target) {
    [...core]
      .sort((a, b) => coreWorthiness(a) - coreWorthiness(b))
      .slice(0, core.length - target)
      .forEach((r) => change.add(r));
  } else if (core.length < target) {
    readings
      .filter((r) => r.category !== 'core' && (r.linkedMLOs || []).length > 0)
      .sort((a, b) => coreWorthiness(b) - coreWorthiness(a))
      .slice(0, target - core.length)
      .forEach((r) => change.add(r));
  }
  return readings.map((r) =>
    change.has(r)
      ? {
          ...r,
          category: r.category === 'core' ? 'supplementary' : 'core',
          categoryBasis: 'set in code to meet the reading-list range (3-6 core, 4-8 supplementary)',
        }
      : r
  );
}
