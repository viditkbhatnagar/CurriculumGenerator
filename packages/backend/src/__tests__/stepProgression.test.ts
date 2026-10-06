import {
  isStepDone,
  reachStep,
  recordStepApproved,
  recordStepFailed,
  recordStepGenerated,
  refuseEmpty,
} from '../services/stepGating';

function workflow(currentStep: number, statuses: Record<number, string> = {}) {
  return {
    currentStep,
    status: `step${currentStep}_pending`,
    stepProgress: Array.from({ length: 14 }, (_, i) => ({
      step: i + 1,
      status: statuses[i + 1] || (i + 1 < currentStep ? 'approved' : 'pending'),
    })) as any[],
  } as any;
}

describe('step progression', () => {
  it('moves the position forward when a later step is generated', () => {
    const w = workflow(6);
    recordStepGenerated(w, 7);
    expect(w.currentStep).toBe(7);
    expect(w.status).toBe('step7_complete');
    expect(w.stepProgress[6].status).toBe('completed');
  });

  it('does not move a programme back when an earlier step is regenerated', () => {
    const w = workflow(13);
    recordStepGenerated(w, 7);
    expect(w.currentStep).toBe(13);
    expect(w.status).toBe('step13_pending');
    expect(w.stepProgress[6].status).toBe('completed');
  });

  it('opens the next step on approval', () => {
    const w = workflow(12, { 12: 'completed' });
    w.step12 = { approvedAt: new Date() };
    recordStepApproved(w, 12);
    expect(w.currentStep).toBe(13);
    expect(w.status).toBe('step13_pending');
    expect(w.stepProgress[11].status).toBe('approved');
    expect(w.stepProgress[12].status).toBe('in_progress');
  });

  it('does not reopen an approved later step when an earlier step is re-approved', () => {
    // Applied Fashion Design, 2026-10-05: Step 12 approved, then Step 11 re-approved.
    const w = workflow(13, { 11: 'approved', 12: 'approved' });
    w.step12 = { approvedAt: new Date() };
    recordStepApproved(w, 11);
    expect(w.currentStep).toBe(13);
    expect(w.stepProgress[11].status).toBe('approved');
  });

  it('moves a programme left behind by the old code forward to the step after its approval', () => {
    // The same programme as stored: position 9, Step 12 approved.
    const w = workflow(9, { 12: 'in_progress' });
    w.step12 = { approvedAt: new Date() };
    recordStepApproved(w, 12);
    expect(w.currentStep).toBe(13);
  });

  it('does not open Step 14 when the exam is approved', () => {
    const w = workflow(13, { 13: 'completed' });
    recordStepApproved(w, 13, { opensNext: false });
    expect(w.currentStep).toBe(13);
    expect(w.status).toBe('step13_complete');
    expect(w.stepProgress[13].status).toBe('pending');
  });

  it('stops at the last step', () => {
    const w = workflow(14);
    recordStepApproved(w, 14);
    expect(w.currentStep).toBe(14);
    expect(w.status).toBe('step14_complete');
  });

  it('records the position only, without touching progress, for steps approved separately', () => {
    const w = workflow(2, { 2: 'in_progress' });
    reachStep(w, 3);
    expect(w.currentStep).toBe(3);
    expect(w.stepProgress[2].status).toBe('pending');
  });
});

describe('failed generations', () => {
  it('marks the step failed with its reason, and not done', () => {
    const w = workflow(8, { 8: 'in_progress' });
    recordStepFailed(w, 8, 'The model returned nothing');
    expect(w.stepProgress[7].status).toBe('failed');
    expect(w.stepProgress[7].error).toBe('The model returned nothing');
    expect(isStepDone(w, 8)).toBe(false);
  });

  it('clears the failure when the step is generated again', () => {
    const w = workflow(8);
    recordStepFailed(w, 8, 'boom');
    recordStepGenerated(w, 8);
    expect(w.stepProgress[7].status).toBe('completed');
    expect(w.stepProgress[7].error).toBeUndefined();
  });

  it('refuses an empty result before anything is saved', () => {
    expect(() => refuseEmpty(0, 8, 'case studies')).toThrow(/Step 8 produced no case studies/);
    expect(() => refuseEmpty(3, 8, 'case studies')).not.toThrow();
  });
});
