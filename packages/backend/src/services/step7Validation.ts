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
import { markConsistency } from './assessmentMarks';
import { normaliseQuestionType } from './bloomTaxonomy';

interface AssessmentLike {
  moduleId?: string;
  questions?: unknown[];
  graded?: boolean;
  purpose?: string;
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
  /**
   * Every graded module assessment's marking guide, rubric and question points add up to its
   * mark total and split it the same way. Asked of the model; checked here. Null when there are
   * no graded assessments.
   */
  marksConsistent: boolean | null;
  /**
   * The share (0 to 1) of the formative activities' questions that are well-formed multiple
   * choice, and whether it reaches MIN_AUTO_GRADABLE_SHARE. Step 7 is sold as auto-gradable;
   * on 2 November 2026 Logan Pacey's 60-credit Business Analytics run held 50 formative
   * questions and none was multiple choice, and every flag above was green. Null when there
   * are no formative questions to count.
   */
  autoGradableShare: number | null;
  autoGradableMet: boolean | null;
}

export const MIN_SAMPLE_QUESTIONS = 20;
/** Step 7 is the auto-gradable step: at least this share of formative questions must be MCQ. */
export const MIN_AUTO_GRADABLE_SHARE = 0.75;
/** A usable multiple-choice item offers at least this many distinct options. */
const MIN_MCQ_OPTIONS = 3;

const normText = (v: unknown) =>
  String(v ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

/**
 * Whether a question can be marked by a machine: it is a multiple-choice question, it has at
 * least three distinct non-empty options, and its correctAnswer is the text of exactly one of
 * them. A question that says "mcq" but carries no options, or whose key matches nothing (or
 * two identical options), cannot be auto-graded and does not count.
 */
export function isWellFormedMcq(question: any): boolean {
  if (!question || normaliseQuestionType(question.questionType) !== 'mcq') return false;
  if (!Array.isArray(question.options)) return false;
  const options = question.options.map(normText).filter(Boolean);
  if (new Set(options).size < MIN_MCQ_OPTIONS) return false;
  const key = typeof question.correctAnswer === 'string' ? normText(question.correctAnswer) : '';
  if (!key) return false;
  return options.filter((o: string) => o === key).length === 1;
}

/**
 * The share of formative questions that are well-formed MCQ, with the counts. Module
 * summatives (graded, and carrying the artefact deliverables) are left out: the target is for
 * the formative activities. Null share when there are no questions.
 */
export function autoGradableShare(assessments: AssessmentLike[]): {
  share: number | null;
  gradable: number;
  total: number;
} {
  const questions = (assessments || [])
    .filter((a) => a?.purpose !== 'module_summative')
    .flatMap((a) => (Array.isArray(a?.questions) ? a.questions : []));
  const gradable = questions.filter(isWellFormedMcq).length;
  return {
    share: questions.length ? gradable / questions.length : null,
    gradable,
    total: questions.length,
  };
}

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
  /** How many of the sample questions are multiple choice. */
  mcqSampleCount: number;
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
  const gradableShare = autoGradableShare(formatives);

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
    // The total alone passed a bank with no multiple-choice sample in it (2 Nov 2026).
    sufficientSampleQuestions:
      input.sampleQuestionCount >= MIN_SAMPLE_QUESTIONS && input.mcqSampleCount > 0,
    plosCovered: ploIds.length ? ploIds.every((id) => covered.has(id)) : null,
    // Each Step 4 module has at least one assessment. Counting distinct module ids instead let
    // an assessment filed under a stray id stand in for a module that had none.
    allModulesCovered: moduleIds.length ? moduleIds.every((id) => assessedModules.has(id)) : null,
    bloomFloorMet: input.bloomFloorMet,
    formativeCountMet: input.formativeGapCount === null ? null : input.formativeGapCount === 0,
    marksConsistent: (() => {
      const graded = formatives.filter(
        (f) => f?.graded === true || f?.purpose === 'module_summative'
      );
      return graded.length ? graded.every((f) => markConsistency(f).consistent) : null;
    })(),
    autoGradableShare: gradableShare.share,
    autoGradableMet:
      gradableShare.share === null ? null : gradableShare.share >= MIN_AUTO_GRADABLE_SHARE,
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
    mcqSampleCount: sampleQuestions.mcq?.length || 0,
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
  return Object.values(validation).every((v) => v === true || v === null || typeof v === 'number');
}
