import { AGU_CATALOGUE_V1_4, catalogueCourse } from '../agu/catalogue/catalogueV1_4';
import { validateDraft, isReviewReady } from '../agu/validation/validateDraft';
import { findProhibitedClaims, DISCLOSURES } from '../agu/rules/usUtahRules';
import { CourseDraft } from '../agu/draft/types';

const cr08 = catalogueCourse('CR08')!;

function week(n: number): CourseDraft['weeks'][number] {
  return {
    number: n,
    theme: `Week ${n} theme`,
    outcomeIds: [`CLO${n}`],
    liveLecture: {
      title: `Lecture ${n}`,
      topics: [`Topic ${n}`],
      hours: 3,
      runSheet: [
        { startMinute: 0, endMinute: 15, segment: 'Opening / recap', activity: 'Recap' },
        { startMinute: 15, endMinute: 165, segment: 'Core', activity: 'Teach' },
        { startMinute: 165, endMinute: 180, segment: 'Wrap-up & next steps', activity: 'Close' },
      ],
    },
    // 33 monitored hours over four weeks: 8.25 each.
    monitoredStudy: [
      {
        id: `m${n}`,
        activity: 'Guided lab',
        facultyRole: 'Reviews checkpoints',
        evidenceLogged: 'Checkpoint log',
        hours: 8.25,
      },
    ],
    independentStudy: [{ id: `i${n}`, activity: 'Reading and practice', hours: 22.5 }],
    gradedItemsDue: [],
  };
}

function validDraft(): CourseDraft {
  return {
    courseCode: 'CR08',
    catalogueVersion: '1.4',
    locked: {
      title: cr08.title,
      semesterCredits: 3,
      hours: { ...cr08.hours },
      description: cr08.description,
    },
    outcomes: [1, 2, 3, 4].map((n) => ({
      id: `CLO${n}`,
      statement: `Evaluate business data problem ${n} with a suitable analytic method.`,
      bloomLevel: 'evaluate' as const,
      origin: 'proposal' as const,
    })),
    weeks: [1, 2, 3, 4].map(week),
    assessments: [
      {
        id: 'a1',
        component: 'applied_assignment',
        title: 'Applied analytics brief',
        weight: 40,
        weekDue: 4,
        outcomeIds: ['CLO1', 'CLO2'],
        proctored: false,
        aiUse: 'AI may be used to draft code; disclose prompts.',
      },
      {
        id: 'a2',
        component: 'weekly_quiz_discussion',
        title: 'Weekly quizzes',
        weight: 20,
        weekDue: 1,
        outcomeIds: ['CLO1', 'CLO2', 'CLO3', 'CLO4'],
        proctored: false,
        aiUse: 'No AI use during quizzes.',
      },
      {
        id: 'a3',
        component: 'final_exam',
        title: 'Final exam',
        weight: 40,
        weekDue: 4,
        outcomeIds: ['CLO3', 'CLO4'],
        proctored: true,
        aiUse: 'No AI use.',
      },
    ],
    readings: [1, 2, 3, 4].map((n) => ({
      id: `r${n}`,
      citation: `Open text chapter ${n}`,
      week: n,
      required: true,
      access: 'open' as const,
    })),
    cases: [
      {
        id: 'c1',
        title: 'Retail demand case',
        week: 2,
        source: 'hypothetical',
        outcomeIds: ['CLO2'],
        rights: '',
      },
    ],
    narrative: [{ field: 'syllabus.description', text: DISCLOSURES[0].text }],
  };
}

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
