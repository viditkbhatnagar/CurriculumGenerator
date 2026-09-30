import { circularDefinitions, usSpellings } from '../services/glossaryValidation';
import { casesWithAssessmentQuestions } from '../services/caseStudyValidation';

describe('circularDefinitions', () => {
  it('flags a definition that uses its own term', () => {
    const terms = [
      { term: 'Liquidity risk', definition: 'The liquidity risk a firm carries when it...' },
      { term: 'Working capital', definition: 'Current assets minus current liabilities.' },
    ];
    expect(circularDefinitions(terms)).toEqual(['Liquidity risk']);
  });

  it('matches whole words, so a term inside a longer word is not circular', () => {
    const terms = [{ term: 'Cost', definition: 'A costly, costing-based view of spending.' }];
    expect(circularDefinitions(terms)).toEqual([]);
  });

  it('treats an acronym used in its own definition as circular', () => {
    expect(
      circularDefinitions([{ term: 'KPI', definition: 'A KPI measures performance.' }])
    ).toEqual(['KPI']);
  });
});

describe('usSpellings', () => {
  it('finds US spellings in a UK-English glossary', () => {
    const found = usSpellings([
      { term: 'Consumer behaviour', definition: 'How buyer behavior changes with color cues.' },
    ]);
    expect(found).toEqual([{ term: 'Consumer behaviour', words: ['behavior', 'color'] }]);
  });

  it('does not count proper nouns or Oxford -ize spellings', () => {
    expect(
      usSpellings([
        { term: 'Offset', definition: 'Used by the Department of Defense to organize contracts.' },
      ])
    ).toEqual([]);
  });
});

describe('casesWithAssessmentQuestions', () => {
  it('flags a case that carries its own multiple-choice items', () => {
    const cases = [
      {
        title: 'Harbour Freight',
        scenario: 'Which option cuts cost? A) Consolidate B) Outsource C) Expand D) Wait',
      },
    ];
    expect(casesWithAssessmentQuestions(cases)).toEqual(['Harbour Freight']);
  });

  it('flags an answer key anywhere in the case', () => {
    const cases = [{ title: 'X', assessmentHooks: { keyFacts: ['Correct answer: B'] } }];
    expect(casesWithAssessmentQuestions(cases)).toEqual(['X']);
  });

  it('leaves open discussion prompts and quarterly figures alone', () => {
    const cases = [
      {
        title: 'Y',
        scenario: 'Q1 revenue fell 8% after A. Patel left the board.',
        discussionPrompts: ['What should the board do next, and why?'],
      },
    ];
    expect(casesWithAssessmentQuestions(cases)).toEqual([]);
  });
});
