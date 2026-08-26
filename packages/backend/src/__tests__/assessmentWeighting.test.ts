/**
 * Weighting semantics after the formative/summative correction.
 *
 * The programme's author read a document whose strategy table said "Formative Weight: 30%"
 * above 92 items each stamped "Weighting: 50%", and asked which was true. Neither described
 * the other: the 30 was her stored preference echoed back, and the 50 came from a branch that
 * gives a module's assessments the whole 100% when the module has no summative — which no
 * module ever had, because module-level summatives were declared in the types and generated
 * nowhere.
 */

import {
  applyAssessmentWeightings,
  isUngraded,
  programmeSplit,
  weightingsAreComplete,
  type WeightableAssessment,
} from '../utils/assessmentWeighting';

describe('isUngraded', () => {
  it('recognises formative activity by either marker', () => {
    expect(isUngraded({ purpose: 'formative' })).toBe(true);
    expect(isUngraded({ graded: false })).toBe(true);
  });

  it('treats a record written before the distinction existed as graded', () => {
    // Those records carry marks and a rubric, which is what they are: module summatives
    // filed under the wrong name. Defaulting them to ungraded would erase real marks.
    expect(isUngraded({ maxMarks: 12 })).toBe(false);
  });
});

describe('applyAssessmentWeightings', () => {
  it('weights ungraded formative activity at nil, not at half a module', () => {
    const formative: WeightableAssessment = { moduleId: 'M1', purpose: 'formative', graded: false };
    const summative: WeightableAssessment = { moduleId: 'M1', graded: true, maxMarks: 40 };
    applyAssessmentWeightings([formative, summative], [], { formative: 30, summative: 70 });
    expect(formative.weighting).toBe(0);
    expect(summative.weighting).toBe(100);
  });

  it('shares a module mark between its graded assessments in proportion to marks', () => {
    const a: WeightableAssessment = { moduleId: 'M1', graded: true, maxMarks: 30 };
    const b: WeightableAssessment = { moduleId: 'M1', graded: true, maxMarks: 10 };
    applyAssessmentWeightings([a, b], [], { formative: 30, summative: 70 });
    expect(a.weighting).toBe(75);
    expect(b.weighting).toBe(25);
    expect((a.weighting || 0) + (b.weighting || 0)).toBe(100);
  });

  it('does not put the course-level summative in a phantom module bucket', () => {
    // It used to be grouped under the literal 'unassigned', leaving a 46-module programme
    // with 47 entries in the totals array, one of which was not a module.
    const moduleWork = [{ moduleId: 'M1', graded: true, maxMarks: 20 }];
    const final = [{ maxMarks: 100 }];
    const totals = applyAssessmentWeightings(moduleWork, final, {
      formative: 30,
      summative: 70,
    });
    expect(totals.map((t) => t.moduleId).sort()).toEqual(['M1', 'course-level']);
    expect(totals.find((t) => t.moduleId === 'unassigned')).toBeUndefined();
  });

  it('reports every group summing to 100', () => {
    const totals = applyAssessmentWeightings(
      [
        { moduleId: 'M1', purpose: 'formative', graded: false },
        { moduleId: 'M1', graded: true, maxMarks: 20 },
        { moduleId: 'M2', graded: true, maxMarks: 15 },
      ],
      [{ maxMarks: 100 }],
      { formative: 30, summative: 70 }
    );
    expect(weightingsAreComplete(totals)).toBe(true);
  });

  it('does not report completeness when there is nothing to weight', () => {
    // `.every()` over an empty array is true; this codebase has shipped that mistake before.
    expect(weightingsAreComplete([])).toBe(false);
  });

  it('reports a module holding only ungraded activity as totalling nil, not as absent', () => {
    // Leaving it out of the totals was the more comfortable answer and the wrong one: a
    // module whose graded assessment failed to generate would disappear from the arithmetic
    // and `weightingsAreComplete` would report completeness over the modules that survived.
    const totals = applyAssessmentWeightings(
      [{ moduleId: 'M9', purpose: 'formative', graded: false }],
      [],
      { formative: 30, summative: 70 }
    );
    expect(totals).toEqual([{ moduleId: 'M9', total: 0 }]);
    expect(weightingsAreComplete(totals)).toBe(false);
  });
});

describe('programmeSplit', () => {
  it('reads the configured split, defaulting to 30/70', () => {
    expect(programmeSplit({ formative: 40, summative: 60 })).toEqual({
      moduleAssessments: 40,
      finalSummative: 60,
    });
    expect(programmeSplit(undefined)).toEqual({ moduleAssessments: 30, finalSummative: 70 });
  });
});
