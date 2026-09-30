import { AGU_CATALOGUE_V1_4 } from '../agu/catalogue/catalogueV1_4';
import {
  validateDraft,
  isReviewReady,
  reviewStatus,
  outcomeActions,
} from '../agu/validation/validateDraft';
import { findProhibitedClaims, DISCLOSURES } from '../agu/rules/usUtahRules';
import { CourseDraft } from '../agu/draft/types';
import { validDraft } from './fixtures/aguDraftFixture';

const codes = (d: CourseDraft) => validateDraft(d, AGU_CATALOGUE_V1_4).map((f) => f.code);

describe('validateDraft', () => {
  it('passes a complete CR08 draft with no blocking finding', () => {
    const findings = validateDraft(validDraft(), AGU_CATALOGUE_V1_4);
    expect(findings.filter((f) => f.severity === 'blocking')).toEqual([]);
    expect(isReviewReady(findings)).toBe(true);
  });

  it('blocks a changed catalogue title or hours', () => {
    const d = validDraft();
    d.locked.title = 'Business Analytics';
    d.locked.hours.contact = 40;
    expect(codes(d)).toEqual(expect.arrayContaining(['LOCKED_TITLE', 'LOCKED_HOURS']));
  });

  it('blocks too few outcomes and vague verbs', () => {
    const d = validDraft();
    d.outcomes = d.outcomes.slice(0, 3);
    d.outcomes[0].statement = 'Understand analytics.';
    expect(codes(d)).toEqual(expect.arrayContaining(['OUTCOME_COUNT', 'OUTCOME_NOT_MEASURABLE']));
  });

  it('blocks an unnamed lecture and hours that do not reconcile', () => {
    const d = validDraft();
    d.weeks[1].liveLecture.topics = [''];
    d.weeks[2].independentStudy[0].hours = 3.5;
    expect(codes(d)).toEqual(expect.arrayContaining(['LECTURE_UNNAMED', 'INDEPENDENT_HOURS']));
  });

  it('refuses to count monitored study as contact without faculty role and logged evidence', () => {
    const d = validDraft();
    d.weeks[0].monitoredStudy[0].evidenceLogged = '';
    expect(codes(d)).toContain('CONTACT_UNEVIDENCED');
  });

  it('blocks an outcome that is taught but never assessed', () => {
    const d = validDraft();
    d.assessments = d.assessments.map((a) => ({
      ...a,
      outcomeIds: a.outcomeIds.filter((id) => id !== 'CLO4'),
    }));
    expect(codes(d)).toContain('OUTCOME_NOT_ASSESSED');
  });

  it('holds non-capstone courses to 40/20/40 with a proctored final', () => {
    const d = validDraft();
    d.assessments[0].weight = 50;
    d.assessments[2].weight = 30;
    d.assessments[2].proctored = false;
    expect(codes(d)).toEqual(expect.arrayContaining(['ASSESSMENT_SCHEME', 'FINAL_NOT_PROCTORED']));
  });

  it('requires every assessment to state its AI rules', () => {
    const d = validDraft();
    d.assessments[0].aiUse = '';
    expect(codes(d)).toContain('ASSESSMENT_AI_RULES');
  });

  it('blocks required readings that are not openly accessible', () => {
    const d = validDraft();
    d.readings[0].access = 'paywalled';
    expect(codes(d)).toContain('READING_ACCESS');
  });

  it('warns when the same source is assigned twice', () => {
    const d = validDraft();
    d.readings[1] = { ...d.readings[1], citation: d.readings[0].citation, sourceId: 'W1' };
    d.readings[0] = { ...d.readings[0], sourceId: 'W1' };
    expect(codes(d)).toContain('READING_DUPLICATE');
  });

  it('blocks accreditation and placement claims in the narrative', () => {
    const d = validDraft();
    d.narrative.push({
      field: 'guide.intro',
      text: 'This accredited MBA guarantees a job placement on completion.',
    });
    expect(codes(d)).toEqual(
      expect.arrayContaining(['CLAIM_ACCREDITATION', 'CLAIM_PLACEMENT_OR_EARNINGS'])
    );
  });

  it('fails an empty draft instead of passing it', () => {
    const d = validDraft();
    d.outcomes = [];
    d.weeks = [];
    d.assessments = [];
    d.readings = [];
    const found = codes(d);
    expect(found).toEqual(
      expect.arrayContaining([
        'OUTCOME_COUNT',
        'WEEK_COUNT',
        'CONTACT_HOURS',
        'ASSESSMENT_NONE',
        'READINGS_NONE',
      ])
    );
  });
});

describe('validateDraft on a draft with sections missing', () => {
  // The route used to accept { outcomes: [], weeks: [] } and then throw on the missing lists.
  const partial = (): CourseDraft => {
    const { courseCode, catalogueVersion, locked, outcomes, weeks } = validDraft();
    return { courseCode, catalogueVersion, locked, outcomes, weeks } as unknown as CourseDraft;
  };
  const find = (d: CourseDraft) => validateDraft(d, AGU_CATALOGUE_V1_4);

  it('does not throw', () => {
    expect(() => find(partial())).not.toThrow();
    expect(() => find({} as CourseDraft)).not.toThrow();
    expect(() => find(null as unknown as CourseDraft)).not.toThrow();
  });

  it('reports each missing list as a blocking finding that names it', () => {
    const missing = find(partial()).filter((f) => f.code === 'SECTION_MISSING');
    expect(missing.map((f) => f.path).sort()).toEqual([
      'assessments',
      'cases',
      'narrative',
      'readings',
    ]);
    expect(missing.every((f) => f.severity === 'blocking')).toBe(true);
    expect(missing[0].message).toMatch(/missing/i);
  });

  it('treats a missing list as empty, so the checks that depend on it still fail', () => {
    expect(find(partial()).map((f) => f.code)).toEqual(
      expect.arrayContaining(['ASSESSMENT_NONE', 'READINGS_NONE', 'OUTCOME_NOT_ASSESSED'])
    );
  });

  it('is never review ready', () => {
    expect(isReviewReady(find(partial()))).toBe(false);
    expect(isReviewReady(find({} as CourseDraft))).toBe(false);
  });

  it('treats a list that is not a list as missing, not as data', () => {
    const d = validDraft();
    (d as any).readings = 'none';
    (d as any).cases = { 0: 'x' };
    const missing = find(d).filter((f) => f.code === 'SECTION_MISSING');
    expect(missing.map((f) => f.path).sort()).toEqual(['cases', 'readings']);
  });

  it('reports a missing locked section instead of comparing against undefined', () => {
    const d = validDraft();
    delete (d as any).locked;
    const found = find(d);
    expect(found).toContainEqual(
      expect.objectContaining({ code: 'SECTION_MISSING', path: 'locked', severity: 'blocking' })
    );
    expect(found.map((f) => f.code)).not.toContain('LOCKED_TITLE');
  });

  it('reports a missing hours block as a hours mismatch', () => {
    const d = validDraft();
    delete (d.locked as any).hours;
    expect(find(d).map((f) => f.code)).toContain('LOCKED_HOURS');
  });
});

describe('reviewStatus', () => {
  it('derives the status from the findings alone', () => {
    const blocking = { code: 'X', severity: 'blocking' as const, message: 'm' };
    const warning = { code: 'Y', severity: 'warning' as const, message: 'm' };
    expect(reviewStatus([])).toBe('ready_for_review');
    expect(reviewStatus([warning])).toBe('ready_for_review');
    expect(reviewStatus([warning, blocking])).toBe('needs_faculty');
  });
});

describe('findProhibitedClaims', () => {
  it('lets the required disclosure deny accreditation', () => {
    for (const d of DISCLOSURES) expect(findProhibitedClaims(d.text)).toEqual([]);
  });

  it('catches a named accreditor and state approval', () => {
    const ids = findProhibitedClaims(
      'The program is DEAC aligned. It is approved by the State of Utah.'
    ).map((m) => m.ruleId);
    expect(ids).toEqual(expect.arrayContaining(['named_accreditor', 'state_approval']));
  });

  it('warns on UK framing such as UK GDPR', () => {
    const m = findProhibitedClaims('Apply UK GDPR principles to customer data.');
    expect(m.map((x) => x.ruleId)).toEqual(['uk_framing']);
    expect(m[0].severity).toBe('warning');
  });
});

describe('outcomeActions', () => {
  it('counts the verbs that open a clause, not nouns that are also on the verb list', () => {
    // CR08's CLO3 was reported as four actions, "model" among them, from "predictive model".
    expect(
      outcomeActions(
        'Interpret and evaluate predictive model outputs (e.g., confusion matrix, ROC-AUC) to set decision thresholds and assess risk-reward trade-offs.'
      )
    ).toEqual(['interpret', 'evaluate', 'assess']);
    expect(outcomeActions('Analyse how firms use financial models to design budgets.')).toEqual([
      'analyse',
    ]);
  });

  it('skips a leading adverb', () => {
    expect(outcomeActions('Critically evaluate competing forecasts.')).toEqual(['evaluate']);
  });
});
