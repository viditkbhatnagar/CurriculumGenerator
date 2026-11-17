/**
 * Logan Pacey, 17 November 2026, Diploma in Logistics pilot: no deck held a case or a formative
 * slide.
 */
import {
  caseFor,
  caseSlides,
  chooseFormativeCheck,
  formativeSlide,
  scenarioExcerpt,
  withRequiredSlides,
} from '../services/deckRequiredSlides';
import { deckMloCoverage } from '../services/deckRules';

const lesson: any = {
  linkedMLOs: ['M3-LO2'],
  caseStudyActivity: {
    caseStudyId: 'cs1',
    caseTitle: 'Port Delay',
    linkedMLOs: ['M3-LO2', 'M9-LO1'],
    learningPurpose: 'Practise routing under disruption',
    instructorInstructions: 'Work in pairs',
    studentOutputExpectations: ['A revised route'],
    assessmentHooks: {
      keyFacts: ['Fact one'],
      misconceptions: ['Speed beats cost'],
      decisionPoints: ['Reroute or wait?', 'Who is told first?'],
    },
  },
  formativeChecks: [
    {
      checkId: 'a',
      type: 'discussion_question',
      question: 'Why?',
      linkedMLO: 'M3-LO2',
      duration: 5,
    },
    {
      checkId: 'b',
      type: 'mcq',
      question: 'Which route is shortest?',
      options: ['North', 'South'],
      correctAnswer: 'B',
      explanation: 'South is shorter',
      linkedMLO: 'M3-LO2',
      duration: 2,
    },
  ],
};
const step8 = [
  {
    id: 'cs1',
    title: 'Port Delay',
    organizationName: 'Harbour Ltd',
    industryContext: 'Shipping',
    scenario:
      'A container ship is delayed. The port is congested. Trucks queue for days. Costs rise sharply.',
  },
];
const base = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    slideNumber: i + 1,
    slideType: i === 0 ? 'title' : 'content',
    title: i === n - 1 ? 'Summary: key takeaways' : `S${i}`,
    content: { type: 'bullets', title: i === n - 1 ? 'Summary: key takeaways' : `S${i}` },
    speakerNotes: '',
  }));

describe('caseFor', () => {
  it('finds the Step 8 case by id, then by title, else nothing', () => {
    expect(caseFor(lesson, step8)?.id).toBe('cs1');
    const byTitle = { caseStudyActivity: { caseStudyId: 'zz', caseTitle: ' port delay ' } };
    expect(caseFor(byTitle, step8)?.id).toBe('cs1');
    expect(caseFor({}, step8)).toBeUndefined();
    expect(caseFor(lesson, [])).toBeUndefined();
  });
});

describe('scenarioExcerpt', () => {
  it('keeps whole sentences within the limit', () => {
    const long = Array.from({ length: 30 }, (_, i) => `Sentence number ${i} is here.`).join(' ');
    const out = scenarioExcerpt(long);
    expect(out.length).toBeLessThanOrEqual(5);
    expect(out.every((s) => s.endsWith('.'))).toBe(true);
    expect(scenarioExcerpt('')).toEqual([]);
  });
});

describe('caseSlides', () => {
  it('builds a scenario slide and a decision slide, tagged with the lesson outcomes only', () => {
    const slides = caseSlides(lesson, caseFor(lesson, step8));
    expect(slides.map((s) => s.title)).toEqual([
      'Case: Port Delay',
      'Decisions in the case: Port Delay',
    ]);
    expect(slides.every((s) => s.slideType === 'case_study')).toBe(true);
    expect(slides[0].content.content[0]).toBe('Organisation: Harbour Ltd, Shipping');
    expect(slides[1].content.content).toEqual(['Reroute or wait?', 'Who is told first?']);
    expect(slides[0].content.mlos).toEqual(['M3-LO2']);
  });

  it('falls back to the facts on the lesson when Step 8 holds no case', () => {
    const slides = caseSlides(lesson, undefined);
    expect(slides[0].content.content).toEqual(['Fact one']);
  });

  it('builds nothing for a lesson with no case, or a case with nothing to show', () => {
    expect(caseSlides({ formativeChecks: [] })).toEqual([]);
    expect(caseSlides({ caseStudyActivity: { caseTitle: 'X' } })).toEqual([]);
  });
});

describe('formativeSlide', () => {
  it('prefers a multiple-choice check, with the answer in the notes only', () => {
    expect(chooseFormativeCheck(lesson).checkId).toBe('b');
    const s = formativeSlide(lesson, [
      { title: 'Quiz 1', assessmentType: 'quiz', alignedMLOs: ['m3-lo2'] },
    ])!;
    expect(s.slideType).toBe('formative_check');
    expect(s.content.content).toEqual(['Which route is shortest?', 'A. North', 'B. South']);
    expect(JSON.stringify(s.content.content)).not.toMatch(/South is shorter/);
    expect(s.speakerNotes).toMatch(/Answer: B/);
    expect(s.speakerNotes).toMatch(/Quiz 1 \(quiz\)/);
    expect(s.content.mlos).toEqual(['M3-LO2']);
  });

  it('shows a discussion check without options, and nothing when there are no checks', () => {
    const s = formativeSlide({ formativeChecks: [lesson.formativeChecks[0]] })!;
    expect(s.title).toBe('Discussion question');
    expect(s.content.content).toEqual(['Why?']);
    expect(formativeSlide({ formativeChecks: [] })).toBeUndefined();
  });
});

describe('withRequiredSlides', () => {
  it('inserts case then formative slides before the summary and numbers the deck again', () => {
    const out = withRequiredSlides(base(11), lesson, { caseStudies: step8 });
    expect(out).toHaveLength(14);
    expect(out.map((s) => s.slideType).slice(-4)).toEqual([
      'case_study',
      'case_study',
      'formative_check',
      'content',
    ]);
    expect(out[out.length - 1].title).toMatch(/Summary/);
    expect(out.map((s) => s.slideNumber)).toEqual(out.map((_, i) => i + 1));
  });

  it('adds only the formative slide for a lesson without a case, and does not mutate', () => {
    const slides = base(11);
    const out = withRequiredSlides(slides, { ...lesson, caseStudyActivity: undefined });
    expect(out).toHaveLength(12);
    expect(slides).toHaveLength(11);
  });

  it('keeps slides of either kind the deck already has', () => {
    const slides = [...base(11)];
    slides.splice(3, 0, { ...slides[3], slideType: 'formative_check' });
    const out = withRequiredSlides(slides, lesson, { caseStudies: step8 });
    expect(out.filter((s) => s.slideType === 'formative_check')).toHaveLength(1);
  });

  it('appends when the deck has no summary, and the tags feed outcome coverage', () => {
    const slides = base(5).map((s) => ({
      ...s,
      title: 'x',
      content: { ...s.content, title: 'x' },
    }));
    const out = withRequiredSlides(slides, lesson, { caseStudies: step8 });
    expect(out[out.length - 1].slideType).toBe('formative_check');
    expect(deckMloCoverage(lesson, out).missing).toEqual([]);
  });

  it('stays inside 12-20 for the model range plus the most that is added', () => {
    expect(withRequiredSlides(base(11), { ...lesson, caseStudyActivity: undefined })).toHaveLength(
      12
    );
    expect(withRequiredSlides(base(17), lesson, { caseStudies: step8 })).toHaveLength(20);
  });
});
