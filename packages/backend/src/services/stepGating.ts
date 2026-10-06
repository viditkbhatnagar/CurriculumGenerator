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

/**
 * Moving a programme's position forward, never back.
 *
 * Every generation set `currentStep = N` and every approval of Steps 10-13 set `N + 1`, so
 * regenerating or re-approving an earlier step moved a finished programme back. Dr. Sherin
 * Thomas approved Step 12 of Applied Fashion Design, went back to rework Steps 7-9, and was
 * left at Step 9 with Step 12 shown in progress; the Step 13 gate (`currentStep < 12`) then
 * refused her summative exam (found 2026-10-06). The position now only moves forward, and a
 * step that is already done is never reopened.
 */
export const LAST_STEP = 14;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Workflowish = any;

function progressOf(workflow: Workflowish, step: number) {
  return (workflow.stepProgress || []).find((p: Workflowish) => p.step === step);
}

/** The programme has reached `step`: move its position there unless it is already further on. */
export function reachStep(workflow: Workflowish, step: number, status = `step${step}_complete`) {
  if (step >= (workflow.currentStep || 1)) {
    workflow.currentStep = Math.min(step, LAST_STEP);
    workflow.status = status;
  }
}

/** A step's content was generated: it is done, and the position does not move back. */
export function recordStepGenerated(workflow: Workflowish, step: number) {
  reachStep(workflow, step);
  const progress = progressOf(workflow, step);
  if (progress) {
    progress.status = 'completed';
    progress.startedAt = progress.startedAt || new Date();
    progress.completedAt = new Date();
  }
}

/**
 * A step was approved: it is done, and the next step opens. The next step is only marked in
 * progress if nothing has happened to it yet; one already generated or approved stays so.
 * `opensNext: false` for a step whose approval does not move the position on (Step 13).
 */
export function recordStepApproved(
  workflow: Workflowish,
  step: number,
  { opensNext = true }: { opensNext?: boolean } = {}
) {
  const now = new Date();
  const progress = progressOf(workflow, step);
  if (progress) {
    progress.status = 'approved';
    progress.completedAt = now;
  } else if (Array.isArray(workflow.stepProgress)) {
    workflow.stepProgress.push({ step, status: 'approved', startedAt: now, completedAt: now });
  }

  const next = step + 1;
  if (!opensNext || next > LAST_STEP) {
    reachStep(workflow, step, `step${step}_complete`);
    return;
  }
  reachStep(workflow, next, `step${next}_pending`);
  const nextProgress = progressOf(workflow, next);
  if (nextProgress && !isStepDone(workflow, next) && nextProgress.status !== 'in_progress') {
    nextProgress.status = 'in_progress';
    nextProgress.startedAt = nextProgress.startedAt || now;
  }
}
