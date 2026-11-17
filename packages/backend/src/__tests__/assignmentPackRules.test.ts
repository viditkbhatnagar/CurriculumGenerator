import {
  bandLabelsFor,
  buildMarkScheme,
  checkPack,
  checkVariantsAlike,
  deliveryFormFor,
  enforcePackRules,
  markingModeFor,
  moduleChecks,
  packChecksByVariant,
  passMarkFrom,
} from '../services/assignmentPackRules';
import {
  isUsableGeneratedPack,
  step12ValidationFromPacks,
} from '../services/deliverableValidation';

const quizApproved = {
  assessmentType: 'MCQ knowledge checks',
  maxMarks: 20,
  weighting: 70,
  questions: [
    { questionNumber: 1, questionText: 'Q1', correctAnswer: 'A', points: 10 },
    { questionNumber: 2, questionText: 'Q2', correctAnswer: 'B', points: 10 },
  ],
};
const writtenApproved = { assessmentType: 'Mini-case exercises', maxMarks: 50, weighting: 70 };

const rubricPack = () => ({
  overview: { assignmentType: 'Case', weighting: 100 },
  assessedOutcomes: [{ mloId: 'M1-LO1' }],
  rubric: [
    { criterionName: 'A', weight: 60, fail: '', pass: '', merit: '', distinction: '' },
    { criterionName: 'B', weight: 40, fail: '', pass: '', merit: '', distinction: '' },
  ],
  bandLabels: ['Fail', 'Pass', 'Merit', 'Distinction'],
});

describe('markingModeFor and deliveryFormFor', () => {
  it('splits quizzes from written work', () => {
    expect(markingModeFor('MCQ knowledge checks')).toBe('auto_marked');
    expect(markingModeFor('Mini-case exercises')).toBe('rubric');
  });

  it('gives each delivery mode its own form, for both kinds', () => {
    for (const type of ['MCQ knowledge checks', 'Mini-case exercises']) {
      const labels = (['in_person', 'self_study', 'hybrid'] as const).map(
        (v) => deliveryFormFor(v, type).label
      );
      expect(new Set(labels).size).toBe(3);
    }
  });
});

describe('bandLabelsFor', () => {
  it('uses descriptive levels when the institution states no scheme', () => {
    expect(bandLabelsFor(undefined, ['Fail', 'Pass', 'Merit', 'Distinction'])).toEqual([
      'Not yet demonstrated',
      'Satisfactory',
      'Good',
      'Excellent',
    ]);
  });

  it('takes four distinct labels when a scheme is stated', () => {
    expect(
      bandLabelsFor('Fail/Pass/Merit/Distinction', ['Fail', 'Pass', 'Merit', 'Distinction'])
    ).toEqual(['Fail', 'Pass', 'Merit', 'Distinction']);
  });

  it('falls back when the labels returned are not four', () => {
    expect(bandLabelsFor('A to E', ['A', 'B'])).toHaveLength(4);
    expect(bandLabelsFor('A to E', ['A', 'B'])[0]).toBe('Not yet demonstrated');
  });
});

describe('passMarkFrom', () => {
  it('reads a stated percentage as marks', () => {
    expect(passMarkFrom('Learners need 40% overall', 20)).toBe(8);
  });
  it('is null when none is stated', () => {
    expect(passMarkFrom('Each component must be passed', 20)).toBeNull();
    expect(passMarkFrom(undefined, 20)).toBeNull();
  });
});

describe('buildMarkScheme', () => {
  it('takes marks per question from the approved questions', () => {
    const { answerKey, markScheme } = buildMarkScheme(quizApproved, 'pass is 50%');
    expect(answerKey.map((k) => k.marks)).toEqual([10, 10]);
    expect(markScheme).toEqual({ maxMarks: 20, passMark: 10 });
  });

  it('spreads the total evenly where questions carry no points', () => {
    const { answerKey } = buildMarkScheme({
      maxMarks: 10,
      questions: [
        { correctAnswer: 'A' },
        { correctAnswer: 'B' },
        { correctAnswer: 'C' },
        { correctAnswer: 'D' },
      ],
    });
    expect(answerKey.reduce((n, k) => n + k.marks, 0)).toBeCloseTo(10, 1);
  });
});

describe('enforcePackRules', () => {
  it('strips the rubric from a quiz pack and attaches a key and weighting from Step 7', () => {
    const { pack, corrections } = enforcePackRules(rubricPack(), 'self_study', quizApproved);
    expect(pack.rubric).toEqual([]);
    expect(pack.bandLabels).toBeUndefined();
    expect(pack.overview.weighting).toBe(70);
    expect(pack.overview.assignmentType).toBe('MCQ knowledge checks');
    expect(pack.answerKey).toHaveLength(2);
    expect(corrections.join(' ')).toMatch(/rubric removed/);
    expect(checkPack(pack, quizApproved)).toEqual([]);
  });

  it('gives a written pack descriptive bands and marks that sum to maxMarks', () => {
    const { pack } = enforcePackRules(rubricPack(), 'in_person', writtenApproved);
    expect(pack.bandLabels).toEqual(['Not yet demonstrated', 'Satisfactory', 'Good', 'Excellent']);
    expect(pack.rubric.map((c: any) => c.marks)).toEqual([30, 20]);
    expect(checkPack(pack, writtenApproved)).toEqual([]);
  });

  it('does not change its input', () => {
    const input = rubricPack();
    enforcePackRules(input, 'hybrid', writtenApproved);
    expect(input.overview.weighting).toBe(100);
  });
});

describe('checkPack', () => {
  it('flags the pilot pack: a quiz with a banded rubric weighted 100 against Step 7 at 70', () => {
    const problems = checkPack(rubricPack(), quizApproved);
    expect(problems).toEqual(
      expect.arrayContaining([
        'a quiz pack carries a banded rubric',
        'a quiz pack has no answer key',
        'weighting 100, Step 7 says 70',
      ])
    );
  });

  it('flags rubric weights that do not total 100', () => {
    const pack: any = rubricPack();
    pack.rubric[0].weight = 50;
    expect(checkPack(pack).join(' ')).toMatch(/weights total 90/);
  });
});

describe('checkVariantsAlike and moduleChecks', () => {
  const variantsFor = () => {
    const out: any = {};
    for (const v of ['in_person', 'self_study', 'hybrid'] as const) {
      out[v] = enforcePackRules(rubricPack(), v, writtenApproved).pack;
    }
    return out;
  };

  it('passes variants with identical content and different forms', () => {
    expect(moduleChecks(variantsFor(), writtenApproved).passed).toBe(true);
  });

  it('flags variants whose criteria differ', () => {
    const variants = variantsFor();
    variants.hybrid.rubric[0].criterionName = 'Z';
    expect(checkVariantsAlike(variants)).toEqual([
      'delivery modes differ in outcomes, weighting, criteria or marks',
    ]);
  });

  it('flags variants that share one form', () => {
    const variants = variantsFor();
    variants.hybrid.form = variants.in_person.form;
    variants.self_study.form = variants.in_person.form;
    expect(checkVariantsAlike(variants)).toContain('delivery modes share one form');
  });
});

describe('completeness for auto-marked packs', () => {
  it('accepts a reply with no rubric when the assessment is auto-marked', () => {
    const reply = { rubric: [], brief: { stepByStepInstructions: ['Sit the test'] } };
    expect(isUsableGeneratedPack(reply)).toBe(false);
    expect(isUsableGeneratedPack(reply, { autoMarked: true })).toBe(true);
  });

  it('counts an answer key and mark scheme as a complete marking basis', () => {
    const pack: any = {
      moduleId: 'm1',
      variants: {
        in_person: { assignmentId: 'a', rubric: [], answerKey: [{}], markScheme: {} },
        self_study: { assignmentId: 'b', rubric: [], answerKey: [{}], markScheme: {} },
        hybrid: { assignmentId: 'c', rubric: [], answerKey: [{}], markScheme: {} },
      },
    };
    expect(step12ValidationFromPacks([pack], [{ id: 'm1', mlos: [] }]).allRubricsComplete).toBe(
      true
    );
  });
});

describe('packChecksByVariant', () => {
  it('stores each variant its own problems plus the shared ones', () => {
    const variants: any = {};
    for (const v of ['in_person', 'self_study', 'hybrid'] as const) {
      variants[v] = enforcePackRules(rubricPack(), v, writtenApproved).pack;
    }
    variants.hybrid.rubric[0].weight = 10; // breaks only this variant's weights, and the alikeness
    const checks = packChecksByVariant(variants, writtenApproved);
    expect(checks.in_person!.passed).toBe(false); // shared: criteria differ across modes
    expect(checks.hybrid!.problems.join(' ')).toMatch(/weights total 50/);
    expect(checks.in_person!.problems.join(' ')).not.toMatch(/weights total/);
  });

  it('passes consistent packs', () => {
    const variants: any = {};
    for (const v of ['in_person', 'self_study', 'hybrid'] as const) {
      variants[v] = enforcePackRules(rubricPack(), v, writtenApproved).pack;
    }
    const checks = packChecksByVariant(variants, writtenApproved);
    expect(Object.values(checks).every((c) => c!.passed)).toBe(true);
  });
});
