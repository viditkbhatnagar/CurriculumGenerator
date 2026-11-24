import { generationBlocker, hasBeenGenerated, isStepApproved } from '../services/stepGating';

const wf = (progress: Record<number, string>, docs: Record<string, unknown> = {}) => ({
  stepProgress: Object.entries(progress).map(([step, status]) => ({ step: Number(step), status })),
  ...docs,
});

describe('generationBlocker', () => {
  it('blocks a first generation while the previous step is only generated', () => {
    // Logan's pilot: every step 'completed', only Step 11 approved.
    const w = wf({ 13: 'completed', 14: 'pending' });
    expect(generationBlocker(w, 14)).toMatch(/Step 13 has not been approved yet/);
  });

  it('allows it once the previous step is approved, by status or by approvedAt', () => {
    expect(generationBlocker(wf({ 4: 'approved' }), 5)).toBeNull();
    expect(
      generationBlocker(wf({ 4: 'completed' }, { step4: { approvedAt: new Date() } }), 5)
    ).toBeNull();
  });

  it('allows regenerating a step that already has content, so programmes in progress are not locked', () => {
    expect(generationBlocker(wf({ 6: 'completed', 7: 'completed' }), 7)).toBeNull();
    expect(
      generationBlocker(wf({ 6: 'completed' }, { step7: { formativeAssessments: [] } }), 7)
    ).toBeNull();
  });

  it('does not count bookkeeping alone as content', () => {
    expect(hasBeenGenerated(wf({}, { step8: { lastError: { message: 'x' } } }), 8)).toBe(false);
    expect(
      generationBlocker(wf({ 7: 'completed' }, { step8: { lastError: {} } }), 8)
    ).not.toBeNull();
  });

  it('never blocks Step 1', () => {
    expect(generationBlocker(wf({}), 1)).toBeNull();
  });

  it('reads approval from either signal', () => {
    expect(isStepApproved(wf({ 3: 'approved' }), 3)).toBe(true);
    expect(isStepApproved(wf({ 3: 'completed' }), 3)).toBe(false);
  });
});
