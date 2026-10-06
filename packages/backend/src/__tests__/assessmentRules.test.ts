/**
 * The institution's assessment rules are recorded as stated, never written by the generator,
 * and every rule not stated is reported (the 21 September review, 5.7 and criterion 7).
 */
import {
  assessmentRulesForPrompt,
  cleanAssessmentRules,
  MAX_RULE_LENGTH,
  missingAssessmentRules,
} from '../services/assessmentRules';
import { unresolvedIssues } from '../services/unresolvedIssues';
import { stepExportContentHash } from '../services/exportCacheService';

describe('cleanAssessmentRules', () => {
  it('keeps the stated rules, trimmed, and ignores unknown fields', () => {
    const result = cleanAssessmentRules({ resits: '  One resit, capped at 40%  ', other: 'x' });
    expect(result).toEqual({ rules: { resits: 'One resit, capped at 40%' } });
  });

  it('lets an empty string clear a rule', () => {
    expect(cleanAssessmentRules({ moderation: '' })).toEqual({ rules: { moderation: '' } });
  });

  it('refuses a body with no rule, a rule that is not text, or one that is too long', () => {
    expect(cleanAssessmentRules({})).toHaveProperty('error');
    expect(cleanAssessmentRules(['resits'])).toHaveProperty('error');
    expect(cleanAssessmentRules({ resits: 2 })).toEqual({ error: 'Resits must be text' });
    expect(cleanAssessmentRules({ resits: 'x'.repeat(MAX_RULE_LENGTH + 1) })).toHaveProperty(
      'error'
    );
  });
});

describe('missingAssessmentRules', () => {
  it('lists every rule not stated, and none once all are', () => {
    expect(missingAssessmentRules(undefined)).toEqual([
      'Pass requirements',
      'Moderation',
      'Resits',
      'Authenticity',
      'Accessibility',
    ]);
    expect(missingAssessmentRules({ resits: 'One resit', moderation: '   ' })).not.toContain(
      'Resits'
    );
    expect(missingAssessmentRules({ resits: 'One resit', moderation: '   ' })).toContain(
      'Moderation'
    );
    expect(
      missingAssessmentRules({
        passRequirements: '40%',
        moderation: 'Second marking of 10%',
        resits: 'One resit',
        authenticity: 'Turnitin',
        accessibility: 'Not applicable: online only',
      })
    ).toEqual([]);
  });
});

describe('assessmentRulesForPrompt', () => {
  it('gives the model the stated rules', () => {
    const text = assessmentRulesForPrompt({ passRequirements: 'B- in every course' });
    expect(text).toContain('- Pass requirements: B- in every course');
    expect(text).not.toContain('Resits:');
  });

  it('tells the model to state no rule of its own when none is given', () => {
    const text = assessmentRulesForPrompt(undefined);
    expect(text).toContain('None stated');
    expect(text).toContain('Do not state a pass mark');
  });
});

describe('unresolved issues', () => {
  it('reports the rules the institution has not stated, as missing', () => {
    const issues = unresolvedIssues({ assessmentRules: { resits: 'One resit' } }, 2026);
    const rules = issues.find((i) => i.issue.startsWith('Assessment rules not stated'));
    expect(rules).toMatchObject({ step: 7, kind: 'missing' });
    expect(rules!.issue).toContain('Moderation');
    expect(rules!.issue).not.toContain('Resits');
  });

  it('reports nothing once every rule is stated', () => {
    const assessmentRules = {
      passRequirements: '40%',
      moderation: 'Second marking',
      resits: 'One resit',
      authenticity: 'Turnitin',
      accessibility: 'Extra time',
    };
    const issues = unresolvedIssues({ assessmentRules }, 2026);
    expect(issues.some((i) => i.issue.startsWith('Assessment rules not stated'))).toBe(false);
  });
});

describe('Step 7 export cache', () => {
  it('builds again when a rule changes, since Step 7 prints the rules', () => {
    const workflow = { step7: { formativeAssessments: [] }, assessmentRules: { resits: 'One' } };
    const changed = { ...workflow, assessmentRules: { resits: 'Two' } };
    expect(stepExportContentHash(workflow, 7)).not.toBe(stepExportContentHash(changed, 7));
    // Other steps do not print them, so their copies stay valid.
    expect(stepExportContentHash(workflow, 9)).toBe(stepExportContentHash(changed, 9));
  });
});
