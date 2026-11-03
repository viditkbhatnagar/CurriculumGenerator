/**
 * What a step's own checks found wrong, and whether it may be approved anyway.
 *
 * Steps 5, 6 and 7 ran their checks and approved regardless: in Logan's test run (28 October
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
  if (stepNumber === 7) return step7FailedChecks(data);
  return [];
}

/**
 * Step 7 is the auto-gradable step. Its approval is held when the stored checks say the
 * questions are not mostly machine-markable or that no multiple-choice sample exists (Logan
 * Pacey, 2 November 2026: 0 of 50 formative questions were MCQ and the step was all green).
 * Only checks that ran and failed count; a report that predates them (undefined) does not.
 */
function step7FailedChecks(data: any): string[] {
  const v = data.validation;
  if (!v) return [];
  const issues: string[] = [];
  if (v.autoGradableMet === false) {
    const pct = typeof v.autoGradableShare === 'number' ? Math.round(v.autoGradableShare * 100) : 0;
    issues.push(
      `Only ${pct}% of formative questions are auto-gradable multiple choice (at least 75% required)`
    );
  }
  if (v.sufficientSampleQuestions === false) {
    issues.push('The sample question bank is short or has no multiple-choice samples');
  }
  const failures = Array.isArray(data.sampleFailures) ? data.sampleFailures : [];
  for (const f of failures) {
    issues.push(`Sample questions of type "${f?.type}" failed to generate: ${f?.message}`);
  }
  return issues;
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
