import { step13Validation } from '../services/step13Validation';

const outcomes = [
  { id: 'PLO1', code: 'PLO1' },
  { id: 'plo-user-abc', code: 'PLO2' },
];

/** A consistent exam: A 2 x 5 marks, B one scenario of 2 x 10, C one task of 30. Total 60. */
function exam() {
  return {
    overview: {
      totalMarks: 60,
      sectionBreakdown: [
        { section: 'Section A: Knowledge & Application Checks', marks: 10, questionCount: 2 },
        { section: 'Section B: Scenario-Based Analysis', marks: 20, questionCount: 1 },
        { section: 'Section C: Applied Tasks', marks: 30, questionCount: 1 },
      ],
    },
    sectionA: [
      { questionId: 'A1', marks: 5, correctAnswer: 'B', linkedPLOs: ['PLO1'] },
      { questionId: 'A2', marks: 5, correctAnswer: 'C', linkedPLOs: ['PLO1'] },
    ],
    sectionBIncluded: true,
    sectionB: [
      {
        scenarioId: 'B1',
        totalMarks: 20,
        questions: [
          { marks: 10, modelAnswer: 'Because…', linkedPLOs: ['plo-user-abc'] },
          { marks: 10, modelAnswer: 'Therefore…', linkedPLOs: ['PLO1'] },
        ],
      },
    ],
    sectionC: [{ taskId: 'C1', marks: 30, modelAnswer: 'A plan…', linkedPLOs: ['PLO1'] }],
    markingScheme: {
      sectionA: [
        { questionId: 'A1', modelAnswer: 'Correct answer: B.' },
        { questionId: 'A2', modelAnswer: 'Correct answer: C.' },
      ],
      sectionB: [{ scenarioId: 'B1' }],
      sectionC: [{ taskId: 'C1' }],
    },
  };
}

describe('step13Validation', () => {
  it('passes a consistent exam, counting a PLO cited by its id or its code', () => {
    expect(step13Validation(exam(), outcomes)).toEqual({
      marksAddUp: true,
      allSectionsPresent: true,
      allPLOsCovered: true,
      markingSchemeComplete: true,
      modelAnswersComplete: true,
    });
  });

  it('fails marks when the breakdown leaves out a section that has questions', () => {
    const e = exam();
    e.overview.sectionBreakdown = e.overview.sectionBreakdown.slice(0, 2);
    expect(step13Validation(e, outcomes).marksAddUp).toBe(false);
  });

  it('fails marks when the breakdown states the wrong count or marks for a section', () => {
    const e = exam();
    e.overview.sectionBreakdown[1] = { ...e.overview.sectionBreakdown[1], questionCount: 2 };
    expect(step13Validation(e, outcomes).marksAddUp).toBe(false);
    const f = exam();
    f.overview.sectionBreakdown[2] = { ...f.overview.sectionBreakdown[2], marks: 35 };
    expect(step13Validation(f, outcomes).marksAddUp).toBe(false);
  });

  it("fails marks when the total or a scenario's total disagrees with its questions", () => {
    const e = exam();
    e.overview.totalMarks = 100;
    expect(step13Validation(e, outcomes).marksAddUp).toBe(false);
    const f = exam();
    f.sectionB[0].totalMarks = 25;
    expect(step13Validation(f, outcomes).marksAddUp).toBe(false);
  });

  it('fails the marking scheme when a Section A question has no entry', () => {
    const e = exam();
    e.markingScheme.sectionA = e.markingScheme.sectionA.slice(0, 1);
    expect(step13Validation(e, outcomes).markingSchemeComplete).toBe(false);
  });

  it('fails model answers when a task has none', () => {
    const e = exam();
    e.sectionC[0].modelAnswer = '  ';
    expect(step13Validation(e, outcomes).modelAnswersComplete).toBe(false);
  });

  it('fails a PLO no item cites, and reports coverage unchecked with no PLOs', () => {
    expect(
      step13Validation(exam(), [...outcomes, { id: 'PLO3', code: 'PLO3' }]).allPLOsCovered
    ).toBe(false);
    expect(step13Validation(exam(), []).allPLOsCovered).toBeNull();
  });

  it('requires Section B only when the exam includes it', () => {
    const e = { ...exam(), sectionB: [], sectionBIncluded: true };
    expect(step13Validation(e, outcomes).allSectionsPresent).toBe(false);
    const selfStudy = exam();
    selfStudy.sectionBIncluded = false;
    selfStudy.overview.totalMarks = 40;
    selfStudy.overview.sectionBreakdown = [
      selfStudy.overview.sectionBreakdown[0],
      selfStudy.overview.sectionBreakdown[2],
    ];
    const v = step13Validation(selfStudy, outcomes);
    expect(v.allSectionsPresent).toBe(true);
    expect(v.marksAddUp).toBe(true);
  });

  it('fails everything that needs questions when the exam is empty', () => {
    const v = step13Validation({}, outcomes);
    expect(v.marksAddUp).toBe(false);
    expect(v.allSectionsPresent).toBe(false);
    expect(v.markingSchemeComplete).toBe(false);
    expect(v.modelAnswersComplete).toBe(false);
  });
});
