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
}

export interface WeightageSplit {
  formative?: number;
  summative?: number;
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
 * Assign a `weighting` to every assessment, module by module.
 *
 * Formatives share the formative pool and summatives the summative pool, so each module's
 * assessments sum to 100% of that module's mark. Mutates the assessments and returns a
 * per-module total for verification.
 */
export function applyAssessmentWeightings(
  formatives: WeightableAssessment[],
  summatives: WeightableAssessment[],
  weightages: WeightageSplit | undefined
): { moduleId: string; total: number }[] {
  const formativePool = weightages?.formative ?? 30;
  const summativePool = weightages?.summative ?? 70;

  const moduleIds = new Set<string>(
    [...formatives, ...summatives].map((a) => a.moduleId || 'unassigned')
  );

  const totals: { moduleId: string; total: number }[] = [];

  for (const moduleId of moduleIds) {
    const inModule = (list: WeightableAssessment[]) =>
      list.filter((a) => (a.moduleId || 'unassigned') === moduleId);

    const moduleFormatives = inModule(formatives);
    const moduleSummatives = inModule(summatives);

    // Where a module has only one kind of assessment, that kind carries the whole 100%:
    // reporting a module as weighted to 30 because its summative has not been generated
    // yet would describe the pipeline's state, not the assessment design.
    const hasBoth = moduleFormatives.length > 0 && moduleSummatives.length > 0;
    distribute(moduleFormatives, hasBoth ? formativePool : moduleFormatives.length ? 100 : 0);
    distribute(moduleSummatives, hasBoth ? summativePool : moduleSummatives.length ? 100 : 0);

    totals.push({
      moduleId,
      total: round(
        [...moduleFormatives, ...moduleSummatives].reduce((sum, a) => sum + (a.weighting || 0), 0)
      ),
    });
  }

  return totals;
}

/** Do every module's assessments sum to 100%? What `weightsSum100` should mean. */
export function weightingsAreComplete(totals: { total: number }[]): boolean {
  return totals.length > 0 && totals.every((t) => Math.abs(t.total - 100) < 0.05);
}
