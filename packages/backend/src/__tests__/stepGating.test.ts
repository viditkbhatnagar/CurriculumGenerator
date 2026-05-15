import { isStepDone } from '../services/stepGating';

describe('isStepDone', () => {
  const baseWorkflow = {
    currentStep: 1,
    status: 'draft',
    stepProgress: [],
  };

  it('returns false for null / undefined workflow', () => {
    expect(isStepDone(null, 9)).toBe(false);
    expect(isStepDone(undefined, 9)).toBe(false);
  });

  it('returns true for any step < 1', () => {
    expect(isStepDone(baseWorkflow, 0)).toBe(true);
    expect(isStepDone(baseWorkflow, -1)).toBe(true);
  });

  it('returns true when stepProgress[N].status is completed', () => {
    const w = {
      ...baseWorkflow,
      stepProgress: [{ step: 9, status: 'completed' }],
    };
    expect(isStepDone(w, 9)).toBe(true);
  });

  it('returns true when stepProgress[N].status is approved', () => {
    const w = {
      ...baseWorkflow,
      stepProgress: [{ step: 9, status: 'approved' }],
    };
    expect(isStepDone(w, 9)).toBe(true);
  });

  it('returns true when step{N}.approvedAt is set even if stepProgress drifted', () => {
    // The exact drift Logan/Athira hit — stepProgress says in_progress,
    // but step9.approvedAt is set and currentStep has advanced.
    const w = {
      currentStep: 14,
      status: 'step14_pending',
      stepProgress: [{ step: 9, status: 'in_progress' }],
      step9: { approvedAt: new Date('2026-03-26') },
    };
    expect(isStepDone(w, 9)).toBe(true);
  });

  it('returns true when currentStep has advanced past N', () => {
    // No stepProgress entry, no approvedAt — but workflow has advanced.
    const w = { currentStep: 12, status: 'step12_pending', stepProgress: [] };
    expect(isStepDone(w, 9)).toBe(true);
    expect(isStepDone(w, 11)).toBe(true);
    expect(isStepDone(w, 12)).toBe(false); // strictly greater
  });

  it('returns false when nothing signals completion', () => {
    const w = {
      currentStep: 5,
      status: 'step5_pending',
      stepProgress: [{ step: 9, status: 'in_progress' }],
    };
    expect(isStepDone(w, 9)).toBe(false);
  });

  it('matches the real Fashion Design / Athira state (regression)', () => {
    // currentStep=14, status=step14_pending, step9.approvedAt is null,
    // but stepProgress[9].status is 'completed' — the workflow that
    // 400'd the Step 10 generation route before the fix.
    const w = {
      currentStep: 14,
      status: 'step14_pending',
      stepProgress: [{ step: 9, status: 'completed' }],
      step9: { approvedAt: null },
    };
    expect(isStepDone(w, 9)).toBe(true);
  });
});
