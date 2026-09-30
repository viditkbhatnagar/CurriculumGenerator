import { step8ApprovalBlocker } from '../services/step8Approval';

describe('step8ApprovalBlocker', () => {
  it('blocks approval when Step 8 was never generated', () => {
    expect(step8ApprovalBlocker(undefined, false)?.code).toBe('STEP8_NOT_GENERATED');
  });

  it('blocks approval when no case studies exist', () => {
    // The 21 Sep 2026 Logistics run approved Step 8 with zero case studies, and the final
    // validation then reported case studies as integrated.
    expect(step8ApprovalBlocker({ caseStudies: [] }, false)?.code).toBe('NO_CASE_STUDIES');
  });

  it('allows approval without case studies only when they are marked not required', () => {
    expect(step8ApprovalBlocker({ caseStudies: [] }, true)).toBeNull();
  });

  it('lets the author record no case studies without generating first', () => {
    // A programme that uses no case studies should not have to spend a model run producing
    // nothing before it can say so.
    expect(step8ApprovalBlocker(undefined, true)).toBeNull();
  });

  it('allows approval when case studies exist', () => {
    expect(step8ApprovalBlocker({ caseStudies: [{ id: 'c1' }] }, false)).toBeNull();
  });
});
