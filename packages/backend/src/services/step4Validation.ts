/**
 * Step 4's validation report, computed from the modules.
 *
 * finaliseStep4 stored contactHoursMatch, progressionValid and noCircularDeps as `true` without
 * checking anything, passed hours when Step 1 declared none, and passed outcome coverage and
 * "at least two outcomes per module" on empty lists; the Step 4 screen showed all of them as
 * green ticks on every one of the 46 live programmes (found 2026-10-01). Each check is now
 * true, false, or null when there is nothing to check against. Pure, so it can be tested.
 */

interface ModuleLike {
  id?: string;
  sequence?: number;
  sequenceOrder?: number;
  contactHours?: number;
  selfStudyHours?: number;
  independentHours?: number;
  isElective?: boolean;
  group?: string;
  linkedPLOs?: string[];
  mlos?: { linkedPLOs?: unknown[]; [field: string]: unknown }[];
  prerequisites?: unknown[];
}

export interface Step4ValidationReport {
  hoursMatch: boolean | null;
  contactHoursMatch: boolean | null;
  allPLOsCovered: boolean | null;
  progressionValid: boolean | null;
  noCircularDeps: boolean | null;
  minMLOsPerModule: boolean | null;
}

const HOURS_TOLERANCE = 0.05;

const hoursOf = (m: ModuleLike) =>
  (m.contactHours || 0) + (m.selfStudyHours ?? m.independentHours ?? 0);

/**
 * What one student studies: every core module plus the largest elective track. Step 1's hours
 * describe one student, while the modules hold every track on offer.
 */
export function studentHoursOf(
  modules: ModuleLike[],
  hoursIn: (m: ModuleLike) => number = hoursOf
): number {
  let core = 0;
  const tracks = new Map<string, number>();
  for (const m of modules) {
    if (m.isElective) tracks.set(m.group || '', (tracks.get(m.group || '') || 0) + hoursIn(m));
    else core += hoursIn(m);
  }
  return core + (tracks.size ? Math.max(...tracks.values()) : 0);
}

/** One student's contact hours, counted the same way. */
export const studentContactHoursOf = (modules: ModuleLike[]) =>
  studentHoursOf(modules, (m) => m.contactHours || 0);

const within = (actual: number, declared: number) =>
  Math.abs(actual - declared) <= declared * HOURS_TOLERANCE;

export function step4ValidationReport(input: {
  modules: ModuleLike[];
  ploIds: string[];
  declaredHours: number;
  declaredContactHours?: number;
}): Step4ValidationReport {
  const modules = input.modules || [];
  const order = new Map(
    modules.map((m, i) => [String(m.id), m.sequence ?? m.sequenceOrder ?? i + 1] as const)
  );
  const prerequisitesOf = (m: ModuleLike) =>
    (m.prerequisites || []).filter((p): p is string => typeof p === 'string' && !!p.trim());
  // A programme outcome is covered when a module links it, or any of its MLOs does: most
  // programmes link outcomes at MLO level only, and counting module links alone failed them.
  const covered = new Set(
    modules.flatMap((m) => [
      ...(m.linkedPLOs || []),
      ...(m.mlos || []).flatMap((o) => (o?.linkedPLOs || []).filter((p) => typeof p === 'string')),
    ])
  );

  return {
    hoursMatch:
      input.declaredHours > 0 ? within(studentHoursOf(modules), input.declaredHours) : null,
    contactHoursMatch:
      input.declaredContactHours && input.declaredContactHours > 0
        ? within(studentContactHoursOf(modules), input.declaredContactHours)
        : null,
    allPLOsCovered: input.ploIds.length ? input.ploIds.every((p) => covered.has(p)) : null,
    // Every prerequisite names a module, and one that comes earlier.
    progressionValid: modules.length
      ? modules.every((m) =>
          prerequisitesOf(m).every(
            (p) => order.has(p) && (order.get(p) as number) < (order.get(String(m.id)) as number)
          )
        )
      : null,
    noCircularDeps: modules.length ? !hasCycle(modules, prerequisitesOf) : null,
    minMLOsPerModule: modules.length ? modules.every((m) => (m.mlos || []).length >= 2) : null,
  };
}

/** Whether following prerequisites from some module leads back to it. */
function hasCycle(modules: ModuleLike[], prerequisitesOf: (m: ModuleLike) => string[]): boolean {
  const edges = new Map(modules.map((m) => [String(m.id), prerequisitesOf(m)]));
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (id: string): boolean => {
    if (state.get(id) === 'visiting') return true;
    if (state.get(id) === 'done' || !edges.has(id)) return false;
    state.set(id, 'visiting');
    const found = (edges.get(id) || []).some(visit);
    state.set(id, 'done');
    return found;
  };
  return [...edges.keys()].some(visit);
}

const STOP_WORDS = new Set(
  'and or of the a an in to for with on using through by from as at its their key basics introduction intro fundamentals principles'.split(
    ' '
  )
);
const topicWords = (t: string) =>
  new Set(
    (t.toLowerCase().match(/[a-z]+/g) ?? ([] as string[])).filter(
      (w: string) => w.length > 2 && !STOP_WORDS.has(w)
    )
  );

/** How alike two topic titles must be (shared words over all words) to be flagged. */
export const REPEATED_TOPIC_SIMILARITY = 0.6;

/**
 * Weekly topics that appear, in nearly the same words, in two different modules. The 21
 * September review (5.4) found duplication across the Logistics modules: M02 and M06 both
 * teach EOQ and safety stock, and both cycle counting. Repetition can also be deliberate
 * progression (an introductory and an advanced module), so these are flagged for a reviewer
 * rather than failed.
 */
export function repeatedTopics(
  modules: { code?: string; id?: string; topics?: unknown[] }[]
): { first: { module: string; topic: string }; second: { module: string; topic: string } }[] {
  const all = (modules || []).flatMap((m) =>
    (m.topics || [])
      .map((t) => (typeof t === 'string' ? t : (t as { title?: string } | null)?.title || ''))
      .filter((t) => t.trim())
      .map((topic) => ({ module: String(m.code || m.id || ''), topic, words: topicWords(topic) }))
  );
  const pairs: ReturnType<typeof repeatedTopics> = [];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      if (a.module === b.module || !a.words.size || !b.words.size) continue;
      const shared = [...a.words].filter((w) => b.words.has(w)).length;
      const similarity = shared / (a.words.size + b.words.size - shared);
      if (similarity >= REPEATED_TOPIC_SIMILARITY) {
        pairs.push({
          first: { module: a.module, topic: a.topic },
          second: { module: b.module, topic: b.topic },
        });
      }
    }
  }
  return pairs;
}
