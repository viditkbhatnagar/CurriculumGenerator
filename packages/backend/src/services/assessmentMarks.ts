/**
 * Whether a graded assessment's marks agree with themselves.
 *
 * The prompt asks the model to make the marking guide and the rubric two views of one mark
 * split: same components, same order, same marks, each summing to maxMarks. On an earlier bank
 * both summed correctly while splitting marks differently in 35 of 92 assessments. Rejin's audit
 * (17 October 2026) asked whether code checked this; nothing did. This does.
 *
 * Pure, so it can be tested.
 */

export interface MarkCheck {
  maxMarks: number | null;
  guideTotal: number;
  rubricTotal: number;
  questionTotal: number | null;
  /** Every total equals maxMarks and the guide and rubric split the marks the same way. */
  consistent: boolean;
  problems: string[];
}

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function markConsistency(assessment: any): MarkCheck {
  const maxMarks = Number.isFinite(Number(assessment?.maxMarks))
    ? Number(assessment.maxMarks)
    : null;
  const guide: any[] = Array.isArray(assessment?.markingGuide?.markAllocation)
    ? assessment.markingGuide.markAllocation
    : [];
  const rubric: any[] = Array.isArray(assessment?.rubric) ? assessment.rubric : [];
  const questions: any[] = Array.isArray(assessment?.questions) ? assessment.questions : [];
  const guideTotal = guide.reduce((n, g) => n + num(g?.marks), 0);
  const rubricTotal = rubric.reduce((n, r) => n + num(r?.maxMarks), 0);
  const pointed = questions.filter((q) => q?.points !== undefined);
  const questionTotal = pointed.length ? pointed.reduce((n, q) => n + num(q?.points), 0) : null;

  const problems: string[] = [];
  if (maxMarks === null || maxMarks <= 0) problems.push('no mark total');
  if (maxMarks !== null && guideTotal !== maxMarks)
    problems.push(`marking guide totals ${guideTotal}, not ${maxMarks}`);
  if (maxMarks !== null && rubricTotal !== maxMarks)
    problems.push(`rubric totals ${rubricTotal}, not ${maxMarks}`);
  if (maxMarks !== null && questionTotal !== null && questionTotal !== maxMarks)
    problems.push(`question points total ${questionTotal}, not ${maxMarks}`);
  const guideSplit = guide.map((g) => num(g?.marks)).join(',');
  const rubricSplit = rubric.map((r) => num(r?.maxMarks)).join(',');
  if (guide.length && rubric.length && guideSplit !== rubricSplit)
    problems.push(`guide splits marks ${guideSplit || '-'}, rubric ${rubricSplit || '-'}`);

  return {
    maxMarks,
    guideTotal,
    rubricTotal,
    questionTotal,
    consistent: !problems.length,
    problems,
  };
}
