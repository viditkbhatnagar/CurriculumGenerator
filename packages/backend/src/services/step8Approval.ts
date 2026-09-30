/**
 * Whether Step 8 (case studies) may be approved as complete.
 *
 * The approve route used to accept any Step 8 that existed. In the 21 Sep 2026 Logistics test
 * generation produced no case studies, approval returned "Workflow or Step 8 not found" while
 * the screen showed progress, and the final validation reported case studies as integrated.
 * A step with no case studies is only complete when the author has said none are required.
 *
 * Pure, no imports, so it can be tested.
 */

export interface Step8Like {
  caseStudies?: unknown[];
}

export interface ApprovalBlocker {
  code: 'STEP8_NOT_GENERATED' | 'NO_CASE_STUDIES';
  message: string;
}

export function step8ApprovalBlocker(
  step8: Step8Like | undefined | null,
  markedNotRequired: boolean
): ApprovalBlocker | null {
  // An author may record that the programme needs no case studies without running a
  // generation first; spending a model run to produce nothing is not a precondition.
  if (!step8 && !markedNotRequired) {
    return {
      code: 'STEP8_NOT_GENERATED',
      message:
        'Case studies have not been generated yet. Generate them first; if generation failed, run it again.',
    };
  }
  if ((step8?.caseStudies || []).length === 0 && !markedNotRequired) {
    return {
      code: 'NO_CASE_STUDIES',
      message:
        'No case studies were generated, so Step 8 cannot be approved as complete. Generate them again, or mark case studies as not required for this programme.',
    };
  }
  return null;
}
