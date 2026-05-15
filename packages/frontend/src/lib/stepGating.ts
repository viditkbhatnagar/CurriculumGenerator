import type { CurriculumWorkflow } from '@/types/workflow';

/**
 * Single source of truth for "is step N done?" — used by every Step{N}View
 * to gate its generate/approve buttons, and mirrored on the backend in
 * workflowRoutes.ts.
 *
 * History: each Step{N}View used to inline a `validStatuses` array of
 * snapshot status strings (e.g. ['step9_complete', 'step10_pending', ...])
 * and check `workflow.status` against it. Real workflows drift past those
 * statuses (e.g. status becomes 'step14_pending' once Step 14 generation
 * starts), and the gate then 400s / disables Generate even though the
 * underlying step is clearly done. Athira hit this 2026-05-13 trying to
 * generate more Step 10 lesson plans on the Fashion Design workflow.
 *
 * A step is considered done if ANY of these are true:
 *   - stepProgress[N].status is 'approved' or 'completed'
 *   - step{N}.approvedAt is set on the step document
 *   - workflow.currentStep has advanced past N
 *
 * Any one of those is sufficient because they're independent signals — if
 * one drifts, the others stay correct.
 */
export function isStepDone(
  workflow: CurriculumWorkflow | undefined | null,
  stepNumber: number
): boolean {
  if (!workflow) return false;
  if (stepNumber < 1) return true;

  const sp = workflow.stepProgress?.find((p) => p.step === stepNumber);
  if (sp?.status === 'approved' || sp?.status === 'completed') return true;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stepDoc = (workflow as any)[`step${stepNumber}`];
  if (stepDoc?.approvedAt) return true;

  if ((workflow.currentStep ?? 0) > stepNumber) return true;

  return false;
}
