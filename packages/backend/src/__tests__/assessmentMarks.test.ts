import { markConsistency } from '../services/assessmentMarks';

const assessment = (over: Record<string, unknown> = {}) => ({
  maxMarks: 40,
  markingGuide: {
    markAllocation: [
      { component: 'Analysis', marks: 25 },
      { component: 'Recommendation', marks: 15 },
    ],
  },
  rubric: [
    { criterion: 'Analysis', maxMarks: 25 },
    { criterion: 'Recommendation', maxMarks: 15 },
  ],
  questions: [{ points: 25 }, { points: 15 }],
  ...over,
});

describe('markConsistency', () => {
  it('passes a guide and rubric that split one total the same way', () => {
    expect(markConsistency(assessment())).toMatchObject({ consistent: true, problems: [] });
  });

  it('fails a guide and rubric that each sum correctly but split the marks differently', () => {
    const check = markConsistency(
      assessment({
        rubric: [
          { criterion: 'Analysis', maxMarks: 20 },
          { criterion: 'Recommendation', maxMarks: 20 },
        ],
      })
    );
    expect(check.consistent).toBe(false);
    expect(check.problems).toEqual(['guide splits marks 25,15, rubric 20,20']);
  });

  it('fails totals that do not reach the mark total', () => {
    const check = markConsistency(assessment({ maxMarks: 50 }));
    expect(check.problems).toEqual([
      'marking guide totals 40, not 50',
      'rubric totals 40, not 50',
      'question points total 40, not 50',
    ]);
  });

  it('fails an assessment with no mark total at all', () => {
    expect(markConsistency(assessment({ maxMarks: undefined })).problems).toContain(
      'no mark total'
    );
  });
});
