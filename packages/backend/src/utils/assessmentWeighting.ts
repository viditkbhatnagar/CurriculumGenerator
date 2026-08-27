/**
 * Percentage weightings for a module's assessments.
 *
 * Computed here rather than asked of the model. A language model given "make the weights
 * sum to 100" produces numbers that nearly do, inconsistently, and the one thing an
 * awarding body will check is that they sum exactly. The inputs are already present and
 * unambiguous: the author's chosen formative/summative split (30/70 on the Business
 * Administration programme) and each assessment's mark total.
 *
 * Marks were being generated all along; only the percentages were missing, so this needs
 * no regeneration to apply to work already produced.
 */

export interface WeightableAssessment {
  moduleId?: string;
  maxMarks?: number;
  weighting?: number;
  /** False for formative activity, which carries no marks and no weighting. */
  graded?: boolean;
  purpose?: string;
}

export interface WeightageSplit {
  /**
   * Share of the programme mark carried by the module assessments, collectively.
   *
   * Named `formative` because that is the key the author's stored preferences already use;
   * it never meant "the weight of ungraded activity", which by definition is nil.
   */
  formative?: number;
  /** Share of the programme mark carried by the final, course-level summative. */
  summative?: number;
}

/** An assessment that carries no marks: ungraded formative activity. */
export function isUngraded(a: WeightableAssessment): boolean {
  return a.graded === false || a.purpose === 'formative';
}

/** Percentages are stored to one decimal place; more precision than an awarding body uses. */
const DECIMALS = 1;
const round = (n: number): number => Number(n.toFixed(DECIMALS));

/**
 * Share a pool of percentage points across assessments in proportion to their marks.
 *
 * Rounding is corrected on the last entry so the group sums to the pool exactly — three
 * assessments sharing 30% would otherwise give 9.9% or 30.1% depending on the marks.
 * Assessments with no marks share the pool equally, which is the only defensible reading
 * of "no mark total given".
 */
function distribute(assessments: WeightableAssessment[], pool: number): void {
  if (assessments.length === 0 || pool <= 0) return;

  const totalMarks = assessments.reduce((sum, a) => sum + (a.maxMarks || 0), 0);
  let assigned = 0;

  assessments.forEach((assessment, index) => {
    const isLast = index === assessments.length - 1;
    if (isLast) {
      assessment.weighting = round(pool - assigned);
      return;
    }
    const share = totalMarks > 0 ? (assessment.maxMarks || 0) / totalMarks : 1 / assessments.length;
    const weighting = round(pool * share);
    assessment.weighting = weighting;
    assigned = round(assigned + weighting);
  });
}

/**
 * Assign a `weighting` to every assessment.
 *
 * Two rules, both of which the previous version got wrong in ways the author caught by
 * reading the document.
 *
 * Ungraded formative activity is weighted nil. Previously nothing recorded that an
 * assessment was ungraded, so a module's two "formatives" were handed the whole 100% of it
 * — the export printed "Weighting: 50%" on each of 92 dialogue-based activities while the
 * strategy table above them said formatives were worth 30%. Two numbers from two sources,
 * never reconciled.
 *
 * The configured split is between the MODULE assessments and the FINAL summative, not
 * between graded and ungraded work. The old code applied it only when a module held both a
 * formative and a summative, which no module ever did — `module_level` summatives are
 * declared in the types and generated nowhere — so the branch carrying the author's 30/70
 * had never executed for any programme the system can produce.
 *
 * Mutates the assessments and returns a per-group total for verification.
 */
export function applyAssessmentWeightings(
  moduleAssessments: WeightableAssessment[],
  courseSummatives: WeightableAssessment[],
  weightages: WeightageSplit | undefined
): { moduleId: string; total: number }[] {
  const totals: { moduleId: string; total: number }[] = [];

  // Ungraded activity carries no weight. Stated explicitly rather than left undefined, so
  // the export prints "ungraded" instead of "not set" and cannot be mistaken for an
  // oversight.
  for (const assessment of moduleAssessments) {
    if (isUngraded(assessment)) assessment.weighting = 0;
  }

  const graded = moduleAssessments.filter((a) => !isUngraded(a));
  // Every module that has any assessment at all gets an entry, not only those with graded
  // work. Deriving the id set from the graded list alone made a module that had lost its
  // summative simply vanish from the totals, and `weightingsAreComplete` then reported
  // completeness across the modules that happened to survive.
  const moduleIds = new Set<string>(moduleAssessments.map((a) => a.moduleId || 'unassigned'));

  // Within a module, its graded assessments share that module's own mark in proportion to
  // their marks. What share the module holds of the whole programme is a separate statement,
  // made once at programme level rather than smeared across 46 modules as fractions of a
  // percent.
  for (const moduleId of moduleIds) {
    const inModule = graded.filter((a) => (a.moduleId || 'unassigned') === moduleId);
    distribute(inModule, 100);
    // A module holding only ungraded activity totals nil, and the flag fails honestly. It
    // has no assessment that counts towards anything, which is a defect worth surfacing —
    // not a module to leave out of the arithmetic so the sum still looks right.
    totals.push({
      moduleId,
      total: round(inModule.reduce((sum, a) => sum + (a.weighting || 0), 0)),
    });
  }

  // The final summative is one instrument at course level, not a module, and was previously
  // bucketed under a fabricated module id — leaving a 46-module programme with 47 entries in
  // the totals array, one of which was not a module.
  if (courseSummatives.length > 0) {
    distribute(courseSummatives, 100);
    totals.push({
      moduleId: 'course-level',
      total: round(courseSummatives.reduce((sum, a) => sum + (a.weighting || 0), 0)),
    });
  }

  return totals;
}

export function weightingsAreComplete(totals: { total: number }[]): boolean {
  return totals.length > 0 && totals.every((t) => Math.abs(t.total - 100) < 0.05);
}
