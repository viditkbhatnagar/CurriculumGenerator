/**
 * Step 7's validation flags, computed from the stored assessments.
 *
 * Three paths built these separately and disagreed. `allFormativesMapped` and
 * `allSummativesMapped` were `.every()` over the assessment lists, so a run that produced no
 * assessments passed both; `plosCovered` passed when Step 3 held no outcomes; and the streaming
 * path started `weightsSum100` as true and only ever looked at summative components, so with
 * no summatives it passed without a single weighting having been assigned (found 2026-10-01).
 * Each flag is now true, false, or null when there is nothing to check. Pure, so it can be
 * tested.
 */
import { applyAssessmentWeightings, weightingsAreComplete } from '../utils/assessmentWeighting';

interface AssessmentLike {
  moduleId?: string;
  alignedMLOs?: unknown[];
  alignedPLOs?: unknown[];
}

interface SummativeLike {
  alignmentTable?: { ploId?: string }[];
  components?: { weight?: number }[];
}

export interface Step7Validation {
  allFormativesMapped: boolean | null;
  allSummativesMapped: boolean | null;
  weightsSum100: boolean;
  sufficientSampleQuestions: boolean;
  plosCovered: boolean | null;
  allModulesCovered: boolean | null;
  bloomFloorMet: boolean | null;
  formativeCountMet: boolean | null;
}

export const MIN_SAMPLE_QUESTIONS = 20;

const strings = (list: unknown[] | undefined) =>
  (list || []).filter((v): v is string => typeof v === 'string' && !!v.trim());

/** Whether a summative's own components add up to 100, when it has components at all. */
export function componentsSum100(summative: SummativeLike): boolean {
  const components = summative.components || [];
  if (!components.length) return true;
  const total = components.reduce((sum, c) => sum + (Number(c?.weight) || 0), 0);
  return Math.abs(total - 100) <= 0.1;
}

export function step7Validation(input: {
  formatives: AssessmentLike[];
  summatives: SummativeLike[];
  sampleQuestionCount: number;
  ploIds: string[];
  moduleIds: string[];
  /** From applyAssessmentWeightings + weightingsAreComplete, run before this. */
  weightingsComplete: boolean;
  /** null when the Bloom audit has not been run. */
  bloomFloorMet: boolean | null;
  /** null when formative counts have not been checked. */
  formativeGapCount: number | null;
}): Step7Validation {
  const formatives = input.formatives || [];
  const summatives = input.summatives || [];
  const ploIds = strings(input.ploIds);
  const moduleIds = strings(input.moduleIds);

  const covered = new Set([
    ...formatives.flatMap((f) => strings(f?.alignedPLOs)),
    ...summatives.flatMap((s) => (s?.alignmentTable || []).map((a) => a?.ploId)),
  ]);
  const assessedModules = new Set(formatives.map((f) => f?.moduleId));

  return {
    // Every module-level assessment states which outcome it assesses.
    allFormativesMapped: formatives.length
      ? formatives.every((f) => strings(f?.alignedMLOs).length > 0)
      : false,
    // Summatives are optional here: a programme whose final assessment sits in Step 13 has
    // none, and that is not a failure of mapping.
    allSummativesMapped: summatives.length
      ? summatives.every((s) => (s?.alignmentTable || []).length > 0)
      : null,
    weightsSum100: input.weightingsComplete && summatives.every(componentsSum100),
    sufficientSampleQuestions: input.sampleQuestionCount >= MIN_SAMPLE_QUESTIONS,
    plosCovered: ploIds.length ? ploIds.every((id) => covered.has(id)) : null,
    // Each Step 4 module has at least one assessment. Counting distinct module ids instead let
    // an assessment filed under a stray id stand in for a module that had none.
    allModulesCovered: moduleIds.length ? moduleIds.every((id) => assessedModules.has(id)) : null,
    bloomFloorMet: input.bloomFloorMet,
    formativeCountMet: input.formativeGapCount === null ? null : input.formativeGapCount === 0,
  };
}

const SAMPLE_KINDS = ['mcq', 'sjt', 'caseQuestions', 'essayPrompts', 'practicalTasks'];

/**
 * The flags for a stored Step 7, for showing it. Reports saved before 2026-10-01 carry the
 * vacuous passes, or the all-false placeholder a reset writes; this recomputes them from the
 * assessments without writing anything. Weightings are worked out on copies. The Bloom audit
 * and formative counts need the generator, so their stored results are used, or null when a
 * report predates them.
 */
export function step7ValidationOf(workflow: {
  step3?: { outcomes?: { id?: string; code?: string }[] };
  step4?: { modules?: { id?: string }[] };
  step7?: any;
}): Step7Validation | null {
  const step7 = workflow.step7;
  if (!step7) return null;
  const formatives = structuredClone(step7.formativeAssessments || []);
  const summatives = structuredClone(step7.summativeAssessments || []);
  const totals = applyAssessmentWeightings(formatives, summatives);
  const stored = step7.validation || {};
  const sampleQuestions = step7.sampleQuestions || {};
  return step7Validation({
    formatives,
    summatives,
    sampleQuestionCount: SAMPLE_KINDS.reduce(
      (n, kind) => n + (sampleQuestions[kind]?.length || 0),
      0
    ),
    ploIds: (workflow.step3?.outcomes || []).map((plo) => plo.id || plo.code || ''),
    moduleIds: (workflow.step4?.modules || []).map((m) => m.id || ''),
    weightingsComplete: weightingsAreComplete(totals),
    bloomFloorMet: typeof stored.bloomFloorMet === 'boolean' ? stored.bloomFloorMet : null,
    formativeGapCount: Array.isArray(step7.formativeGaps)
      ? step7.formativeGaps.length
      : typeof stored.formativeCountMet === 'boolean'
        ? Number(!stored.formativeCountMet)
        : null,
  });
}

/** Passed when every check that ran passed. A check that did not run proves nothing. */
export function step7Passed(validation: Step7Validation): boolean {
  return Object.values(validation).every((v) => v === true || v === null);
}
