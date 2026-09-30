import { AGU_CATALOGUE_V1_4, catalogueCourse } from '../agu/catalogue/catalogueV1_4';
import {
  buildOutlinePrompt,
  draftFromOutline,
  OfferedSource,
  topicsFromDescription,
} from '../agu/generation/outlinePrompt';
import { validateDraft } from '../agu/validation/validateDraft';

const cr08 = catalogueCourse('CR08')!;
const sources: OfferedSource[] = [1, 2, 3, 4, 5].map((n) => ({
  sourceId: `W${n}`,
  citation: `Author ${n} (2024). Open paper ${n}. Journal.`,
  openAccess: true,
  link: `https://example.org/${n}.pdf`,
}));

const week = (n: number) => ({
  number: n,
  theme: `Theme ${n}`,
  outcomeNumbers: [n],
  lecture: {
    title: `Lecture ${n}`,
    topics: [`Topic ${n}`],
    runSheet: [
      { start: 0, end: 15, segment: 'Opening / recap', activity: 'Recap' },
      { start: 15, end: 165, segment: 'Core', activity: 'Teach' },
      { start: 165, end: 180, segment: 'Wrap-up & next steps', activity: 'Close' },
    ],
  },
  monitoredStudy: [
    {
      activity: 'Guided lab',
      facultyRole: 'Reviews checkpoints',
      evidenceLogged: 'Checkpoint log',
      hours: 8.25,
    },
  ],
  independentStudy: [{ activity: 'Reading', hours: 22.5 }],
  gradedItemsDue: [],
});

const modelAnswer = {
  title: 'A different title the model tried',
  outcomes: [1, 2, 3, 4].map((n) => ({
    statement: `Evaluate decision problem ${n} using descriptive analytics.`,
    bloomLevel: 'evaluate',
  })),
  weeks: [1, 2, 3, 4].map(week),
  assessments: [
    {
      component: 'applied_assignment',
      title: 'Brief',
      weight: 40,
      weekDue: 4,
      outcomeNumbers: [1, 2],
      aiUse: 'Disclose prompts.',
    },
    {
      component: 'weekly_quiz_discussion',
      title: 'Quizzes',
      weight: 20,
      weekDue: 1,
      outcomeNumbers: [1, 2, 3, 4, 9],
      aiUse: 'No AI.',
    },
    {
      component: 'final_exam',
      title: 'Final',
      weight: 40,
      weekDue: 4,
      outcomeNumbers: [3, 4],
      aiUse: 'No AI.',
    },
  ],
  readings: [
    { sourceNumber: 1, week: 1 },
    { sourceNumber: 2, week: 2 },
    { sourceNumber: 3, week: 3 },
    { sourceNumber: 4, week: 4 },
    { sourceNumber: 17, week: 2 },
  ],
  cases: [{ title: 'Retailer demand forecast', week: 2, outcomeNumbers: [2] }],
  rationale: 'Applied, no-code emphasis as requested.',
};

describe('buildOutlinePrompt', () => {
  const { system, user } = buildOutlinePrompt(
    cr08,
    AGU_CATALOGUE_V1_4,
    { emphasis: 'applied / no-code' },
    sources
  );

  it('states the locked facts and the fixed course shape', () => {
    expect(user).toContain('Code: CR08');
    expect(user).toContain('Title: Business Analytics & AI for Decision-Making');
    expect(user).toContain(
      'Applied assignment 40%, Weekly quizzes / discussion 20%, Proctored final exam 40%'
    );
    expect(user).toContain('Emphasis: applied / no-code');
  });

  it('offers only the verified sources, by number', () => {
    expect(user).toContain('1. Author 1 (2024). Open paper 1. Journal.');
    expect(user).toContain('Choose readings ONLY from the numbered sources');
  });

  it('forbids institutional claims and UK framing', () => {
    expect(system).toMatch(/never claim accreditation/i);
    expect(system).toMatch(/UK GDPR/);
  });
});

describe('draftFromOutline', () => {
  const { draft, findings } = draftFromOutline(modelAnswer, cr08, AGU_CATALOGUE_V1_4, sources);

  it('takes locked facts from the catalogue, not the model', () => {
    expect(draft.locked.title).toBe(cr08.title);
    expect(draft.locked.hours).toEqual({ total: 135, contact: 45, independent: 90 });
  });

  it('drops a reading that is not one of the verified sources, and says so', () => {
    expect(draft.readings.map((r) => r.sourceId)).toEqual(['W1', 'W2', 'W3', 'W4']);
    expect(findings.map((f) => f.code)).toContain('READING_NOT_OFFERED');
  });

  it('drops an outcome reference the model invented', () => {
    expect(draft.assessments[1].outcomeIds).toEqual(['CLO1', 'CLO2', 'CLO3', 'CLO4']);
  });

  it('labels generated cases hypothetical and proctors the final exam', () => {
    expect(draft.cases[0].source).toBe('hypothetical');
    expect(draft.assessments.find((a) => a.component === 'final_exam')?.proctored).toBe(true);
  });

  it('produces a draft the validators accept when the model follows the shape', () => {
    const blocking = validateDraft(draft, AGU_CATALOGUE_V1_4).filter(
      (f) => f.severity === 'blocking'
    );
    expect(blocking).toEqual([]);
  });
});

describe('topicsFromDescription', () => {
  it('turns the catalogue "Covers ..." sentence into search phrases', () => {
    expect(topicsFromDescription(cr08.description)).toEqual([
      'data collection',
      'preparation',
      'descriptive',
      'predictive analytics',
      'data visualization',
      'statistical analysis',
      'machine learning fundamentals in support of evidence-based decision-making',
    ]);
  });
});
