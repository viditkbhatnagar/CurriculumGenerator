import { assignMlosToLessons, matchScore } from '../services/mloAssignment';

// The real M06 outcomes from the reviewed programme.
const M06 = [
  {
    id: 'M06-LO1',
    statement:
      'Apply percentages, ratios, linear equations and break-even analysis to solve routine business problems.',
  },
  {
    id: 'M06-LO2',
    statement:
      'Use Excel to clean a small dataset, compute descriptive statistics and present results with appropriate charts.',
  },
  {
    id: 'M06-LO3',
    statement:
      'Apply probability, the normal distribution and expected value to estimate the likelihood of routine business outcomes and choose between simple alternatives.',
  },
  {
    id: 'M06-LO4',
    statement: 'Calculate interest and annuity payments for simple cash-flow scenarios.',
  },
];

describe('matchScore', () => {
  it('scores a lesson against the outcome it teaches', () => {
    const t =
      'Applying simple and compound interest and ordinary annuities to short cash-flow cases';
    expect(matchScore(t, M06[3])).toBeGreaterThan(matchScore(t, M06[1]));
  });

  it('ignores filler words that would match everything', () => {
    expect(matchScore('apply business data analysis to make decisions', M06[1])).toBe(0);
  });
});

describe('assignMlosToLessons', () => {
  it('gives the interest lesson the interest outcome', () => {
    // The defect: this lesson was mapped to Excel and probability, never to interest.
    const texts = [
      'Applying simple and compound interest and ordinary annuities to cash-flow cases',
    ];
    expect(assignMlosToLessons(texts, M06)[0]).toContain(3);
  });

  it('gives the spreadsheet lesson the spreadsheet outcome', () => {
    const texts = ['Cleaning a dataset in Excel and presenting descriptive statistics as charts'];
    expect(assignMlosToLessons(texts, M06)[0]).toContain(1);
  });

  it('is not a rotation — identical lessons get identical outcomes', () => {
    const texts = Array.from({ length: 8 }, () => 'compound interest and annuity payments');
    const out = assignMlosToLessons(texts, M06);
    expect(new Set(out.map((a) => a[0])).size).toBe(1);
    expect(out[0][0]).toBe(3);
  });

  it('still teaches every outcome somewhere', () => {
    // Even when every lesson is about one topic, no outcome may be left unclaimed.
    const texts = Array.from({ length: 12 }, () => 'compound interest and annuity payments');
    const out = assignMlosToLessons(texts, M06);
    for (let i = 0; i < M06.length; i++) {
      expect(out.some((a) => a.includes(i))).toBe(true);
    }
  });

  it('does not attach a second outcome the lesson has nothing to do with', () => {
    // At realistic module size, where coverage is satisfied by other lessons, the interest
    // lesson must not also claim the spreadsheet outcome.
    const texts = [
      'Cleaning a dataset in Excel and presenting descriptive statistics as charts',
      'Probability and the normal distribution to estimate likelihood',
      'Percentages, ratios and break-even for routine problems',
      'compound interest and annuity payments for cash-flow scenarios',
    ];
    expect(assignMlosToLessons(texts, M06)[3]).not.toContain(1); // Excel
  });

  it('falls back to a spread when a lesson shares no vocabulary at all', () => {
    const out = assignMlosToLessons(['aardvark zebra', 'aardvark zebra'], M06);
    expect(out[0][0]).not.toBe(out[1][0]);
  });

  it('handles a module with one outcome, and with none', () => {
    expect(assignMlosToLessons(['x', 'y'], [M06[0]])).toEqual([[0], [0]]);
    expect(assignMlosToLessons(['x'], [])).toEqual([[]]);
  });
});
