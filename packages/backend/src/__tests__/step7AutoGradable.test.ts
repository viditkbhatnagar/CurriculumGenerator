/**
 * Step 7 is the auto-gradable step. Logan Pacey's run of 2 November 2026 held 50 formative
 * questions and none was multiple choice, with every validation flag green.
 */
import { approvalDecision, failedChecks } from '../services/approvalChecks';
import {
  autoGradableShare,
  isWellFormedMcq,
  MIN_AUTO_GRADABLE_SHARE,
  step7Passed,
  step7Validation,
} from '../services/step7Validation';

const mcq = (over: any = {}) => ({
  questionType: 'mcq',
  options: ['A one', 'B two', 'C three', 'D four'],
  correctAnswer: 'B two',
  ...over,
});
const activity = (questions: any[], over: any = {}) => ({
  moduleId: 'm1',
  alignedMLOs: ['m1-1'],
  alignedPLOs: ['PLO1'],
  purpose: 'formative',
  questions,
  ...over,
});

describe('isWellFormedMcq', () => {
  it('accepts four options with the key matching exactly one', () => {
    expect(isWellFormedMcq(mcq())).toBe(true);
  });
  it('folds spelling variants of the type and ignores case and spacing in the key', () => {
    expect(
      isWellFormedMcq(mcq({ questionType: 'Multiple Choice', correctAnswer: ' b  TWO ' }))
    ).toBe(true);
  });
  it('rejects an mcq with no options', () => {
    expect(isWellFormedMcq(mcq({ options: undefined }))).toBe(false);
    expect(isWellFormedMcq(mcq({ options: [] }))).toBe(false);
  });
  it('rejects fewer than three distinct non-empty options', () => {
    expect(isWellFormedMcq(mcq({ options: ['A', 'A', 'B', ' '], correctAnswer: 'B' }))).toBe(false);
  });
  it('rejects a key that matches no option, a numeric key, or a key matching two options', () => {
    expect(isWellFormedMcq(mcq({ correctAnswer: 'Z nine' }))).toBe(false);
    expect(isWellFormedMcq(mcq({ correctAnswer: 1 }))).toBe(false);
    expect(isWellFormedMcq(mcq({ options: ['X', 'X', 'Y', 'Z'], correctAnswer: 'X' }))).toBe(false);
  });
  it('rejects non-mcq types', () => {
    expect(isWellFormedMcq(mcq({ questionType: 'scenario' }))).toBe(false);
  });
});

describe('autoGradableShare', () => {
  it('is null when there are no questions', () => {
    expect(autoGradableShare([activity([])]).share).toBeNull();
  });
  it("reproduces Logan's run: scenario and file-upload questions give 0", () => {
    const qs = [{ questionType: 'scenario' }, { questionType: 'file_upload' }];
    expect(autoGradableShare([activity(qs)])).toEqual({ share: 0, gradable: 0, total: 2 });
  });
  it('leaves module summatives out of the count', () => {
    const r = autoGradableShare([
      activity([mcq()]),
      activity([{ questionType: 'practical' }], { purpose: 'module_summative' }),
    ]);
    expect(r).toEqual({ share: 1, gradable: 1, total: 1 });
  });
});

describe('step7Validation auto-gradable and sample checks', () => {
  const input = (questions: any[], mcqSampleCount = 10) => ({
    formatives: [activity(questions)] as any[],
    summatives: [],
    sampleQuestionCount: 25,
    mcqSampleCount,
    ploIds: ['PLO1'],
    moduleIds: ['m1'],
    weightingsComplete: true,
    bloomFloorMet: true,
    formativeGapCount: 0,
  });

  it('passes at the threshold and records the share', () => {
    const v = step7Validation(input([mcq(), mcq(), mcq(), { questionType: 'practical' }]));
    expect(v.autoGradableShare).toBe(0.75);
    expect(MIN_AUTO_GRADABLE_SHARE).toBe(0.75);
    expect(v.autoGradableMet).toBe(true);
    expect(step7Passed(v)).toBe(true);
  });
  it('fails below the threshold', () => {
    const v = step7Validation(input([mcq(), { questionType: 'practical' }]));
    expect(v.autoGradableMet).toBe(false);
    expect(step7Passed(v)).toBe(false);
  });
  it('fails the sample check when there are enough samples but none is multiple choice', () => {
    expect(step7Validation(input([mcq()], 0)).sufficientSampleQuestions).toBe(false);
  });
});

describe('failedChecks for Step 7', () => {
  it('lists a low auto-gradable share, a missing MCQ sample and recorded sample failures', () => {
    const issues = failedChecks(7, {
      validation: {
        autoGradableMet: false,
        autoGradableShare: 0,
        sufficientSampleQuestions: false,
      },
      sampleFailures: [{ type: 'mcq', message: 'timed out' }],
    });
    expect(issues).toHaveLength(3);
    expect(issues[0]).toMatch(/0%/);
    expect(issues[2]).toMatch(/mcq.*timed out/);
  });
  it('finds nothing when the checks passed, were not run, or the step is absent', () => {
    expect(
      failedChecks(7, { validation: { autoGradableMet: true, sufficientSampleQuestions: true } })
    ).toEqual([]);
    expect(failedChecks(7, { validation: { autoGradableMet: null } })).toEqual([]);
    expect(failedChecks(7, {})).toEqual([]);
  });
  it('approves only with a real reason', () => {
    const issues = failedChecks(7, {
      validation: { autoGradableMet: false, autoGradableShare: 0.2 },
    });
    expect(approvalDecision(issues, 'ok').allowed).toBe(false);
    expect(
      approvalDecision(issues, 'Programme is practice-based; agreed with Dr Sherin').allowed
    ).toBe(true);
  });
});
