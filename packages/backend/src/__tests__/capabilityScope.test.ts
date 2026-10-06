import {
  OTHER_SUBJECT,
  scopeIssue,
  scopeProblem,
  SUBJECT_AREAS,
} from '../services/capabilityScope';

describe('capability scope', () => {
  it('accepts a subject in the reviewed scope', () => {
    expect(scopeProblem(SUBJECT_AREAS[0].id, false)).toBeNull();
    expect(scopeIssue({ subjectArea: SUBJECT_AREAS[0].id })).toBeNull();
  });

  it('requires an acknowledgement outside the reviewed scope, and flags it for review', () => {
    expect(scopeProblem(OTHER_SUBJECT, false)).toMatch(/outside/);
    expect(scopeProblem(OTHER_SUBJECT, true)).toBeNull();
    expect(scopeIssue({ subjectArea: OTHER_SUBJECT })?.kind).toBe('review');
  });

  it('refuses an unknown subject id, and reports an undeclared subject as not checked', () => {
    expect(scopeProblem('astrophysics', true)).toMatch(/Unknown/);
    expect(scopeIssue({})?.kind).toBe('not_checked');
  });
});
