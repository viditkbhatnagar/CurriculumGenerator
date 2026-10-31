import { approvalDecision, failedChecks } from '../services/approvalChecks';

describe('failedChecks', () => {
  it("lists Step 5's compliance issues when it is not compliant", () => {
    expect(
      failedChecks(5, {
        agiCompliant: false,
        complianceIssues: ['11 of 35 topics have fewer than 2 sources'],
      })
    ).toEqual(['11 of 35 topics have fewer than 2 sources']);
  });

  it("lists Step 6's issues when it failed, whatever shape they are in", () => {
    expect(
      failedChecks(6, { isValid: false, validationIssues: [{ message: 'Too few core readings' }] })
    ).toEqual(['Too few core readings']);
  });

  it('names a failure even when the step recorded no detail', () => {
    expect(failedChecks(5, { agiCompliant: false })).toHaveLength(1);
  });

  it('finds nothing for a step that passed or has no checks', () => {
    expect(failedChecks(5, { agiCompliant: true, complianceIssues: ['stale'] })).toEqual([]);
    expect(failedChecks(6, { isValid: true })).toEqual([]);
    expect(failedChecks(4, { anything: false })).toEqual([]);
    expect(failedChecks(5, undefined)).toEqual([]);
  });
});

describe('approvalDecision', () => {
  const issues = ['11 of 35 topics have fewer than 2 sources'];

  it('approves a step with nothing failed', () => {
    expect(approvalDecision([], undefined)).toEqual({ allowed: true });
  });

  it('refuses a failed step without a real reason', () => {
    expect(approvalDecision(issues, undefined)).toEqual({ allowed: false, issues });
    expect(approvalDecision(issues, '  ok  ')).toEqual({ allowed: false, issues });
  });

  it('approves with a reason and keeps it with the issues it overrode', () => {
    expect(
      approvalDecision(issues, 'Sources reviewed by the SME; acceptable for the pilot.')
    ).toEqual({
      allowed: true,
      override: { reason: 'Sources reviewed by the SME; acceptable for the pilot.', issues },
    });
  });
});
