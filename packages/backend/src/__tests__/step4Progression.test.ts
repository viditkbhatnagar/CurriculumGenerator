/**
 * Logan Pacey's re-test, 2 November 2026: a four-module certificate whose early modules were
 * flagged invalid by a 60% remember/understand/apply quota while the progression check passed.
 */
import { progressionAudit } from '../services/step4Progression';
import { step4Progression, step4ValidationReport } from '../services/step4Validation';
import { MAX_BLOOM_DROP } from '../services/step4Progression';

const mlos = (...levels: string[]) => levels.map((bloomLevel) => ({ bloomLevel }));

/** The re-test's modules: Bloom levels exactly as recorded. */
const retest = [
  { id: 'm1', code: 'M01', sequence: 1, mlos: mlos('analyze', 'apply', 'analyze', 'apply') },
  { id: 'm2', code: 'M02', sequence: 2, mlos: mlos('analyze', 'analyze', 'create', 'understand') },
  {
    id: 'm3',
    code: 'M03',
    sequence: 3,
    mlos: mlos('create', 'analyze', 'evaluate', 'evaluate', 'analyze'),
  },
  {
    id: 'm4',
    code: 'M04',
    sequence: 4,
    mlos: mlos('apply', 'analyze', 'analyze', 'create', 'evaluate', 'evaluate'),
  },
];
const step1 = {
  programTitle: 'Certificate in Business Analytics',
  academicLevel: 'certificate',
  creditFramework: { system: 'uk_credits', credits: 60 },
};
const level = (n: number, position: 'early' | 'middle' | 'late' = 'middle') => ({
  level: n,
  year: 1,
  position,
});

describe('step 4 progression', () => {
  it('passes the re-test data: early modules are not failed for using analyse verbs', () => {
    const { checks, problems } = step4Progression(retest, step1);
    expect(checks).toEqual({
      levelsAssigned: true,
      levelsNonDecreasing: true,
      capstoneAtTopLevel: true,
      bloomRising: true,
    });
    expect(problems).toEqual([]);
  });

  it('reports the checks in the validation report beside the prerequisite check', () => {
    const report = step4ValidationReport({ modules: retest, ploIds: [], declaredHours: 0, step1 });
    expect(report.bloomRising).toBe(true);
    expect(report.progressionValid).toBe(true);
  });

  it('fails when the final module sits below the highest level, naming it', () => {
    const modules = retest.map((m) => ({ ...m, mlos: m.mlos }));
    const { checks, problems } = progressionAudit(
      modules,
      [level(4, 'early'), level(5, 'early'), level(6), level(4, 'late')],
      null
    );
    expect(checks.levelsNonDecreasing).toBe(false);
    expect(checks.capstoneAtTopLevel).toBe(false);
    expect(problems.join(' ')).toMatch(/M04/);
  });

  it('compares an elective track only with itself', () => {
    const modules = [
      { id: 'a', code: 'A', sequence: 1 },
      { id: 'b', code: 'B', sequence: 2, isElective: true, group: 'Finance' },
      { id: 'c', code: 'C', sequence: 3, isElective: true, group: 'Marketing' },
      { id: 'd', code: 'D', sequence: 4 },
    ];
    const lv = [level(4), level(6), level(5), level(6)];
    expect(progressionAudit(modules, lv, null).checks.levelsNonDecreasing).toBe(true);
  });

  it('fails Bloom when outcomes fall away or the last module is easier than the first', () => {
    const modules = [
      { id: '1', sequence: 1, mlos: mlos('create', 'evaluate') },
      { id: '2', sequence: 2, mlos: mlos('remember', 'understand') },
    ];
    const lv = [level(5, 'early'), level(5, 'late')];
    const { checks, problems } = progressionAudit(modules, lv, 5);
    expect(checks.bloomRising).toBe(false);
    expect(problems.join(' ')).toMatch(/drops/);
    expect(MAX_BLOOM_DROP).toBe(1);
  });

  it('does not demand a low start of an advanced programme', () => {
    const modules = [
      { id: '1', sequence: 1, mlos: mlos('evaluate', 'create') },
      { id: '2', sequence: 2, mlos: mlos('analyze', 'evaluate', 'create') },
    ];
    const lv = [level(7, 'early'), level(7, 'late')];
    expect(progressionAudit(modules, lv, 7).checks.bloomRising).toBe(true);
  });

  it('is null when there is nothing to compare', () => {
    expect(progressionAudit([], [], null).checks.bloomRising).toBeNull();
    const one = progressionAudit([{ id: '1', sequence: 1 }], [level(4, 'late')], null);
    expect(one.checks.bloomRising).toBeNull();
    expect(one.checks.capstoneAtTopLevel).toBe(true);
  });
});
