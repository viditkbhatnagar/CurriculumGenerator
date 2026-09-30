import { AGU_CATALOGUE_V1_4, catalogueCourse } from '../agu/catalogue/catalogueV1_4';
import {
  buildOutlinePrompt,
  draftFromOutline,
  topicsFromDescription,
} from '../agu/generation/outlinePrompt';
import { validateDraft } from '../agu/validation/validateDraft';
import { modelAnswer, sources } from './fixtures/aguOutlineFixture';

const cr08 = catalogueCourse('CR08')!;

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

  it('keeps in the narrative only text that has no structured field of its own', () => {
    expect(draft.narrative.map((n) => n.field)).toEqual(['rationale', 'disclosure.registration']);
  });

  it('reports a claim the model wrote once, at the field it is in', () => {
    const claimed = JSON.parse(JSON.stringify(modelAnswer));
    claimed.assessments[0].brief = 'Complete this accredited assignment.';
    claimed.weeks[1].lecture.topics = ['An AACSB-accredited case'];
    const built = draftFromOutline(claimed, cr08, AGU_CATALOGUE_V1_4, sources).draft;
    const claims = validateDraft(built, AGU_CATALOGUE_V1_4)
      .filter((f) => f.code.startsWith('CLAIM_'))
      .map((f) => [f.code, f.path]);
    expect(claims).toEqual([
      ['CLAIM_ACCREDITATION', 'weeks[1].liveLecture.topics[0]'],
      ['CLAIM_NAMED_ACCREDITOR', 'weeks[1].liveLecture.topics[0]'],
      ['CLAIM_ACCREDITATION', 'assessments[0].brief'],
    ]);
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
