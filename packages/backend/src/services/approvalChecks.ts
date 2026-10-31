/**
 * What a step's own checks found wrong, and whether it may be approved anyway.
 *
 * Steps 5 and 6 ran their checks and approved regardless: in Logan's test run (28 October
 * 2026) Step 5 was marked non-compliant, "admin override required", and Step 6 failed its own
 * reading-count rules, and both went through with one click. A step whose checks failed is now
 * approved only with a reason, which is kept on the step with the issues it overrode.
 */

/** A reason shorter than this is not a reason ("ok", "fine"). */
export const MIN_OVERRIDE_REASON = 10;

const asText = (issue: any): string =>
  typeof issue === 'string' ? issue : issue?.message || issue?.issue || JSON.stringify(issue);

/** The issues that block approval of a step, from what the step recorded about itself. */
export function failedChecks(stepNumber: number, data: any): string[] {
  if (!data) return [];
  if (stepNumber === 5 && data.agiCompliant === false) {
    const issues = (data.complianceIssues || []).map(asText).filter(Boolean);
    return issues.length ? issues : ['Step 5 did not pass its source checks'];
  }
  if (stepNumber === 6 && data.isValid === false) {
    const issues = (data.validationIssues || []).map(asText).filter(Boolean);
    return issues.length ? issues : ['Step 6 did not pass its reading-list checks'];
  }
  return [];
}

export interface ApprovalDecision {
  allowed: boolean;
  /** The failed checks, when approval is refused. */
  issues?: string[];
  /** The reason and what it overrode, when a failed step is approved anyway. */
  override?: { reason: string; issues: string[] };
}

/** Approve when nothing failed, or when a real reason is given for what did. */
export function approvalDecision(issues: string[], overrideReason: unknown): ApprovalDecision {
  if (!issues.length) return { allowed: true };
  const reason = typeof overrideReason === 'string' ? overrideReason.trim() : '';
  if (reason.length < MIN_OVERRIDE_REASON) return { allowed: false, issues };
  return { allowed: true, override: { reason: reason.slice(0, 2000), issues } };
}
