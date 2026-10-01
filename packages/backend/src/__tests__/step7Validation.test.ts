import {
  componentsSum100,
  step7Passed,
  step7Validation,
  step7ValidationOf,
} from '../services/step7Validation';

const base = () => ({
  formatives: [
    { moduleId: 'm1', alignedMLOs: ['m1-1'], alignedPLOs: ['PLO1'] },
    { moduleId: 'm2', alignedMLOs: ['m2-1'], alignedPLOs: ['PLO2'] },
  ],
  summatives: [] as { alignmentTable?: { ploId?: string }[]; components?: { weight?: number }[] }[],
  sampleQuestionCount: 25,
  ploIds: ['PLO1', 'PLO2'],
  moduleIds: ['m1', 'm2'],
  weightingsComplete: true,
  bloomFloorMet: true,
  formativeGapCount: 0,
});

describe('step7Validation', () => {
  it('passes a programme whose assessments are mapped, weighted and cover every module', () => {
    const v = step7Validation(base());
    expect(v).toEqual({
      allFormativesMapped: true,
      allSummativesMapped: null, // no Step 7 summatives: the final assessment sits elsewhere
      weightsSum100: true,
      sufficientSampleQuestions: true,
      plosCovered: true,
      allModulesCovered: true,
      bloomFloorMet: true,
      formativeCountMet: true,
    });
    expect(step7Passed(v)).toBe(true);
  });

  it('fails a run that produced no assessments, instead of passing it', () => {
    const v = step7Validation({ ...base(), formatives: [], weightingsComplete: false });
    expect(v.allFormativesMapped).toBe(false);
    expect(v.plosCovered).toBe(false);
    expect(v.allModulesCovered).toBe(false);
    expect(v.weightsSum100).toBe(false);
    expect(step7Passed(v)).toBe(false);
  });

  it('does not pass weights when no weighting was assigned, even with no summatives', () => {
    expect(step7Validation({ ...base(), weightingsComplete: false }).weightsSum100).toBe(false);
  });

  it("fails weights when a summative's components do not add up", () => {
    const summatives = [{ alignmentTable: [{ ploId: 'PLO1' }], components: [{ weight: 60 }] }];
    expect(step7Validation({ ...base(), summatives }).weightsSum100).toBe(false);
    expect(componentsSum100({ components: [{ weight: 60 }, { weight: 40 }] })).toBe(true);
    expect(componentsSum100({})).toBe(true);
  });

  it('fails a summative with no alignment', () => {
    const summatives = [{ alignmentTable: [] }];
    expect(step7Validation({ ...base(), summatives }).allSummativesMapped).toBe(false);
  });

  it('reports PLO coverage as not checked when Step 3 has no outcomes', () => {
    expect(step7Validation({ ...base(), ploIds: [] }).plosCovered).toBeNull();
  });

  it('counts PLOs covered by summative alignment, and fails one nothing covers', () => {
    const summatives = [{ alignmentTable: [{ ploId: 'PLO3' }] }];
    expect(step7Validation({ ...base(), summatives, ploIds: ['PLO1', 'PLO3'] }).plosCovered).toBe(
      true
    );
    expect(step7Validation({ ...base(), ploIds: ['PLO1', 'PLO9'] }).plosCovered).toBe(false);
  });

  it('fails module coverage when an assessment is filed under a stray module id', () => {
    const formatives = [
      { moduleId: 'm1', alignedMLOs: ['m1-1'], alignedPLOs: ['PLO1'] },
      { moduleId: 'stray', alignedMLOs: ['x'], alignedPLOs: ['PLO2'] },
    ];
    expect(step7Validation({ ...base(), formatives }).allModulesCovered).toBe(false);
  });

  it('fails an assessment with no outcome, and tolerates missing arrays', () => {
    const formatives = [{ moduleId: 'm1' }, { moduleId: 'm2', alignedMLOs: ['m2-1'] }];
    expect(step7Validation({ ...base(), formatives }).allFormativesMapped).toBe(false);
  });
});

describe('step7ValidationOf', () => {
  const workflow = () => ({
    step3: { outcomes: [{ code: 'PLO1' }] },
    step4: { modules: [{ id: 'm1' }] },
    step7: {
      formativeAssessments: [
        { moduleId: 'm1', alignedMLOs: ['m1-1'], alignedPLOs: ['PLO1'], assessmentType: 'quiz' },
      ],
      summativeAssessments: [],
      sampleQuestions: { mcq: new Array(20).fill({}) },
      // The all-false placeholder a Step 7 reset writes.
      validation: { allFormativesMapped: false, plosCovered: false, weightsSum100: false },
    },
  });

  it('recomputes a stale report from the stored assessments without changing them', () => {
    const w = workflow();
    const before = JSON.stringify(w.step7.formativeAssessments);
    const v = step7ValidationOf(w);
    expect(v).toMatchObject({
      allFormativesMapped: true,
      plosCovered: true,
      allModulesCovered: true,
    });
    expect(JSON.stringify(w.step7.formativeAssessments)).toBe(before);
  });

  it('reports the Bloom audit and formative counts as not checked when a report predates them', () => {
    const v = step7ValidationOf(workflow());
    expect(v?.bloomFloorMet).toBeNull();
    expect(v?.formativeCountMet).toBeNull();
  });

  it('returns null when there is no Step 7', () => {
    expect(step7ValidationOf({})).toBeNull();
  });
});
