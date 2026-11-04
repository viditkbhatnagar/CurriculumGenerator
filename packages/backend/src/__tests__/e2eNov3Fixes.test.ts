import { chaptersServingOutcomes } from '../knowledge/chapterSources';
import { isAppliedSource } from '../services/step5Validation';
import { casesWithAssessmentQuestions } from '../services/caseStudyValidation';

describe('chaptersServingOutcomes', () => {
  it('drops a library chapter linked to no outcome and keeps every other source', () => {
    const sources = [
      { id: 'lib-M04-1', linkedMLOs: ['M4-LO2'] },
      { id: 'lib-M04-2', linkedMLOs: [] },
      { id: 'src-mod4-3', linkedMLOs: [] },
    ];
    const { kept, dropped } = chaptersServingOutcomes(sources);
    expect(kept.map((s) => s.id)).toEqual(['lib-M04-1', 'src-mod4-3']);
    expect(dropped.map((s) => s.id)).toEqual(['lib-M04-2']);
  });
});

describe('isAppliedSource', () => {
  it('counts applied and industry sources, as Step 6 does', () => {
    expect(isAppliedSource({ type: 'applied' })).toBe(true);
    expect(isAppliedSource({ type: 'industry' })).toBe(true);
    expect(isAppliedSource({ type: 'academic' })).toBe(false);
    expect(isAppliedSource(undefined)).toBe(false);
  });
});

describe('casesWithAssessmentQuestions: answer keys', () => {
  it('does not flag a teaching note saying there is no single correct answer (3 Nov run)', () => {
    const note = {
      title: 'Before the Dashboard',
      teachingNote: 'The case supports discussion rather than a single correct answer.',
    };
    expect(casesWithAssessmentQuestions([note])).toEqual([]);
  });

  it('still flags an answer key', () => {
    const keyed = { title: 'A', teachingNote: 'Correct answer: B' };
    const stated = { title: 'B', teachingNote: 'The correct answer is C.' };
    expect(casesWithAssessmentQuestions([keyed])).toEqual(['A']);
    expect(casesWithAssessmentQuestions([stated])).toEqual(['B']);
  });
});
