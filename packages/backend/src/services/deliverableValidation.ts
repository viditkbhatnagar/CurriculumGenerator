/**
 * Validation flags for Step 11 (slide decks) and Step 12 (assignment packs).
 *
 * Both steps reported checks that were never run. Step 11's summary set `allMLOsCovered` and
 * `allCitationsValid` to `true` ("Simplified validation"), and approving the step overwrote all
 * four flags with constants, although every deck carries its own computed `validation`. Step
 * 12 set `allMLOsCovered` to `true` and, on the per-module path, `allRubricsComplete` too. The
 * export printed each of them as passed.
 *
 * Every flag below is computed from the stored decks or packs and is false for an empty list.
 *
 * Pure functions only, and no imports: workflowService cannot be imported by a test (it
 * carries pre-existing type errors that fail the suite), so logic that needs testing has to
 * live outside it.
 */

export const MIN_SLIDES_PER_DECK = 8;
export const MAX_SLIDES_PER_DECK = 15;

export interface DeckLike {
  lessonId?: string;
  slideCount?: number;
  // citationsValid is null when the deck had no verified sources to check against.
  validation?: { mlosCovered?: boolean; citationsValid?: boolean | null };
}

export interface Step11ValidationFlags {
  allLessonsHavePPTs: boolean;
  allSlideCountsValid: boolean;
  allMLOsCovered: boolean;
  /** null: no deck's citations could be checked, because no verified sources were supplied. */
  allCitationsValid: boolean | null;
}

/**
 * False if any deck failed or never recorded the check; null if none failed but some were not
 * checked (no verified sources); true only when every deck was checked and passed.
 */
function citationsAcross(list: DeckLike[]): boolean | null {
  if (list.length === 0) return false;
  const results = list.map((d) => d.validation?.citationsValid);
  if (results.some((r) => r === false || r === undefined)) return false;
  return results.every((r) => r === true) ? true : null;
}

export function step11ValidationFromDecks(
  decks: DeckLike[],
  lessonCount: number
): Step11ValidationFlags {
  const list = decks || [];
  const every = (test: (d: DeckLike) => boolean) => list.length > 0 && list.every(test);
  // Distinct lessons, not deck records: a lesson regenerated twice holds two decks, and
  // counting records let that duplicate stand in for a lesson with no deck at all.
  const lessonsWithDecks = new Set(list.map((d, i) => d?.lessonId || `deck-${i}`)).size;
  return {
    allLessonsHavePPTs: lessonCount > 0 && lessonsWithDecks >= lessonCount,
    allSlideCountsValid: every(
      (d) =>
        (d.slideCount || 0) >= MIN_SLIDES_PER_DECK && (d.slideCount || 0) <= MAX_SLIDES_PER_DECK
    ),
    allMLOsCovered: every((d) => d.validation?.mlosCovered === true),
    allCitationsValid: citationsAcross(list),
  };
}

export interface PackVariantLike {
  assignmentId?: string;
  rubric?: { linkedMLOs?: string[] }[];
  assessedOutcomes?: { mloId?: string }[];
}

export interface PackLike {
  moduleId?: string;
  variants?: {
    in_person?: PackVariantLike;
    self_study?: PackVariantLike;
    hybrid?: PackVariantLike;
  };
}

export interface ModuleOutcomesLike {
  id?: string;
  mlos?: { id?: string }[];
}

export interface Step12ValidationFlags {
  allModulesHaveAssignments: boolean;
  allVariantsGenerated: boolean;
  allMLOsCovered: boolean;
  allRubricsComplete: boolean;
}

function variantsOf(pack: PackLike): (PackVariantLike | undefined)[] {
  const v = pack.variants || {};
  return [v.in_person, v.self_study, v.hybrid];
}

/**
 * A variant whose generation failed is stored as a placeholder so the other variants are not
 * lost. It lists every module outcome as assessed and has an empty rubric and the brief
 * "Generation failed - please retry", so counting it reported outcomes covered, and the
 * variant generated, for work that was never done.
 */
export function isPlaceholderVariant(variant: PackVariantLike | undefined): boolean {
  return /-placeholder$/.test(String(variant?.assignmentId || ''));
}

const generated = (variant: PackVariantLike | undefined): variant is PackVariantLike =>
  !!variant && !isPlaceholderVariant(variant);

/**
 * The stored outcome id a pack's label refers to.
 *
 * The Step 12 prompt listed a module's outcomes as "MLO 1", "MLO 2"... without their ids and
 * then asked for "exact MLO ID", so packs name outcomes by position. Every pack in a sampled
 * eight-module programme did, and its coverage check failed although each outcome was
 * assessed. A positional label resolves to the module's outcome in that position; an id
 * passes through; anything else is returned unchanged and matches nothing.
 */
export function resolveOutcomeLabel(label: string, moduleOutcomeIds: string[]): string {
  const text = String(label || '').trim();
  if (moduleOutcomeIds.includes(text)) return text;
  const positional = /^(?:MLO|LO|Outcome)\s*#?\s*(\d+)$/i.exec(text);
  if (positional) {
    const id = moduleOutcomeIds[Number(positional[1]) - 1];
    if (id) return id;
  }
  return text;
}

/** Outcome ids a pack assesses: named in a rubric criterion or listed as an assessed outcome. */
function outcomesAssessed(pack: PackLike): Set<string> {
  const ids = new Set<string>();
  for (const variant of variantsOf(pack).filter(generated)) {
    for (const criterion of variant?.rubric || []) {
      for (const id of criterion?.linkedMLOs || []) ids.add(id);
    }
    for (const outcome of variant?.assessedOutcomes || []) {
      if (outcome?.mloId) ids.add(outcome.mloId);
    }
  }
  return ids;
}

export function step12ValidationFromPacks(
  packs: PackLike[],
  modules: ModuleOutcomesLike[]
): Step12ValidationFlags {
  const list = packs || [];
  const mods = modules || [];
  const byModule = new Map(list.map((p) => [p.moduleId, p]));
  const every = (test: (p: PackLike) => boolean) => list.length > 0 && list.every(test);

  return {
    allModulesHaveAssignments: mods.length > 0 && mods.every((m) => byModule.has(m.id)),
    allVariantsGenerated: every((p) => variantsOf(p).every(generated)),
    // "All module learning outcomes covered" in the export: every outcome of every module is
    // assessed by that module's pack.
    allMLOsCovered:
      mods.length > 0 &&
      mods.every((m) => {
        const pack = byModule.get(m.id);
        const mlos = (m.mlos || []).map((o) => o?.id).filter((id): id is string => !!id);
        if (!pack || mlos.length === 0) return false;
        const assessed = new Set(
          Array.from(outcomesAssessed(pack)).map((label) => resolveOutcomeLabel(label, mlos))
        );
        return mlos.every((id) => assessed.has(id));
      }),
    allRubricsComplete: every((p) => variantsOf(p).every((v) => (v?.rubric || []).length > 0)),
  };
}
