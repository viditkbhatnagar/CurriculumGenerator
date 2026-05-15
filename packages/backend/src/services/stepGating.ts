/**
 * Single source of truth for "is step N done?" on the server side. Mirrors
 * the frontend helper at packages/frontend/src/lib/stepGating.ts.
 *
 * History: route gates used to inline `validStatuses` allowlists of
 * snapshot statuses (e.g. ['step9_complete', 'step10_pending', ...]) and
 * 400 if `workflow.status` wasn't in the list. Real workflows drift past
 * those statuses — Athira hit this 2026-05-13 on Fashion Design, where the
 * Step 9→10 gate 400'd ("Step 9 must be approved before proceeding to Step
 * 10") even though stepProgress[9].status was 'completed' and currentStep
 * was 14. Status alone is not authoritative.
 *
 * A step is considered done when ANY of these holds:
 *   - stepProgress[N].status is 'approved' or 'completed'
 *   - workflow.step{N}.approvedAt is set
 *   - workflow.currentStep has advanced past N
 *
 * Independent signals — if one drifts, the others stay correct.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isStepDone(workflow: any, stepNumber: number): boolean {
  if (!workflow) return false;
  if (stepNumber < 1) return true;

  const sp = workflow.stepProgress?.find((p: any) => p.step === stepNumber);
  if (sp?.status === 'approved' || sp?.status === 'completed') return true;

  const stepDoc = workflow[`step${stepNumber}`];
  if (stepDoc?.approvedAt) return true;

  if ((workflow.currentStep ?? 0) > stepNumber) return true;

  return false;
}
