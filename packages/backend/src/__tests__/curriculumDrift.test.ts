import { levelOf, auditModule, auditProportion, moduleIsClean } from '../services/curriculumDrift';

const lessons = (n: number, text: string) =>
  Array.from({ length: n }, (_, i) => ({ lessonNumber: i + 1, body: text }));

describe('levelOf', () => {
  it('reads the level Step 4 actually records', () => {
    expect(levelOf({ group: 'Year 1 – Level 4' })).toBe(4);
    expect(levelOf({ group: 'Year 3 – Level 6 › Specialization : Finance and FinTech' })).toBe(6);
  });

  it('falls back to the year when only that is given', () => {
    expect(levelOf({ group: 'Year 2' })).toBe(5);
  });

  it('returns null rather than guessing when the module says nothing', () => {
    expect(levelOf({ group: '' })).toBeNull();
    expect(levelOf({})).toBeNull();
  });
});

describe('level appropriateness', () => {
  const m06 = {
    moduleCode: 'M06',
    moduleTitle: 'Business Mathematics & Quantitative Methods',
    group: 'Year 1 – Level 4',
    topics: ['Descriptive statistics', 'Percentages and ratios'],
  };

  it('flags the final-year techniques the reviewer found in a first-year module', () => {
    const text = 'We compute MIRR and the equivalent annual annuity, then run a t-test.';
    const found = auditModule(m06, text).filter((f) => f.rule === 'level');
    expect(found.length).toBeGreaterThanOrEqual(3);
    expect(found.every((f) => f.detail.includes('Level 4'))).toBe(true);
  });

  it('allows those same techniques in a final-year module', () => {
    const m29 = {
      moduleCode: 'M29',
      moduleTitle: 'Corporate Finance',
      group: 'Year 3 – Level 6',
      topics: [],
    };
    expect(
      auditModule(m29, 'We compute MIRR and adjusted present value.').filter(
        (f) => f.rule === 'level'
      )
    ).toHaveLength(0);
  });

  it('allows a technique the module was explicitly built to teach', () => {
    const m = {
      moduleCode: 'M06',
      group: 'Year 1 – Level 4',
      moduleTitle: 'Maths',
      topics: ['Introduction to hypothesis testing'],
    };
    expect(auditModule(m, 'a t-test example').filter((f) => f.rule === 'level')).toHaveLength(0);
  });
});

describe('discipline of professional bodies', () => {
  it('flags CIPD in the economics module the reviewer named', () => {
    const m02 = {
      moduleCode: 'M02',
      moduleTitle: 'Business Economics',
      group: 'Year 1 – Level 4',
      topics: ['Supply and demand'],
    };
    const found = auditModule(m02, 'CIPD '.repeat(95)).filter((f) => f.rule === 'discipline');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('high');
  });

  it('leaves CIPD alone where it belongs', () => {
    const m35 = {
      moduleCode: 'M35',
      moduleTitle: 'Strategic Human Resource Management',
      group: 'Year 3 – Level 6',
      topics: ['Reward strategy'],
    };
    expect(
      auditModule(m35, 'CIPD '.repeat(95)).filter((f) => f.rule === 'discipline')
    ).toHaveLength(0);
  });
});

describe('jurisdiction', () => {
  it('flags UK statutes in a module whose topics do not call for them', () => {
    const m19 = {
      moduleCode: 'M19',
      moduleTitle: 'International Business',
      group: 'Year 2 – Level 5',
      topics: ['Entry modes', 'Trade and FDI'],
    };
    const found = auditModule(m19, 'Bribery Act '.repeat(62)).filter(
      (f) => f.rule === 'jurisdiction'
    );
    expect(found).toHaveLength(1);
  });

  it('leaves them where the module’s own approved topic names them', () => {
    // The reviewer approved this topic herself at Step 4.
    const m09 = {
      moduleCode: 'M09',
      moduleTitle: 'Business Ethics',
      group: 'Year 1 – Level 4',
      topics: ['UK Bribery Act and anti-corruption'],
    };
    expect(
      auditModule(m09, 'Bribery Act '.repeat(50)).filter((f) => f.rule === 'jurisdiction')
    ).toHaveLength(0);
  });
});

describe('activities that belong to another module', () => {
  it('flags dashboard work in a strategy module', () => {
    const m21 = {
      moduleCode: 'M21',
      moduleTitle: 'Strategic Management',
      group: 'Year 3 – Level 6',
      topics: ['Competitive strategy'],
    };
    const found = auditModule(m21, 'dashboard '.repeat(397)).filter((f) => f.rule === 'overlap');
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('high');
  });

  it('leaves dashboards alone in the module that owns them', () => {
    const m31 = {
      moduleCode: 'M31',
      moduleTitle: 'Business Intelligence & Data Visualisation',
      group: 'Year 3 – Level 6',
      topics: ['Interactive dashboards'],
    };
    expect(
      auditModule(m31, 'dashboard '.repeat(380)).filter((f) => f.rule === 'overlap')
    ).toHaveLength(0);
  });

  it('ignores a passing mention rather than calling it a theme', () => {
    const m = {
      moduleCode: 'M03',
      moduleTitle: 'Financial Accounting',
      group: 'Year 1 – Level 4',
      topics: ['Ledgers'],
    };
    expect(
      auditModule(m, 'dashboard dashboard dashboard').filter((f) => f.rule === 'overlap')
    ).toHaveLength(0);
  });
});

describe('proportion', () => {
  it('catches a theme taking over the later lessons', () => {
    // What the reviewer described as "the second half contains too much dashboard work".
    const m44 = {
      moduleCode: 'M44',
      moduleTitle: 'Consumer Behaviour',
      group: 'Year 3 – Level 6',
      topics: ['Consumer psychology'],
    };
    // The opening half is solidly about the subject, so this is a TAIL problem rather than the
    // theme dominating the module outright — the two are reported separately.
    const all = [
      ...lessons(15, 'consumer psychology behaviour consumer psychology behaviour'),
      ...lessons(15, 'dashboard power bi dashboard'),
    ];
    const found = auditProportion(m44, all).filter((f) => f.rule === 'tail');
    expect(found.length).toBeGreaterThan(0);
    expect(found[0].detail).toContain('later lessons');
  });

  it('reports a theme spoken of more than the subject as dominance, not tail drift', () => {
    const m22 = {
      moduleCode: 'M22',
      moduleTitle: 'Business Policy',
      group: 'Year 3 – Level 6',
      topics: ['Policy'],
    };
    const all = [...lessons(15, 'policy'), ...lessons(15, 'Bribery Act DPIA policy')];
    const rules = auditProportion(m22, all).map((f) => f.rule);
    expect(rules).toContain('dominance');
  });

  it('does not flag a module that teaches its theme evenly throughout', () => {
    const m31 = {
      moduleCode: 'M31',
      moduleTitle: 'Business Intelligence',
      group: 'Year 3 – Level 6',
      topics: ['Dashboards'],
    };
    const all = lessons(30, 'dashboard business intelligence dashboards visualisation reporting');
    expect(auditProportion(m31, all).filter((f) => f.rule === 'tail')).toHaveLength(0);
  });

  it('says nothing about a module too short to have a second half', () => {
    expect(
      auditProportion({ moduleCode: 'X', moduleTitle: 'Y', topics: [] }, lessons(2, 'dashboard'))
    ).toHaveLength(0);
  });
});

describe('moduleIsClean', () => {
  it('is false while any high finding stands', () => {
    expect(
      moduleIsClean([
        { rule: 'level', moduleCode: 'M06', detail: 'x', count: 99, severity: 'high' },
      ])
    ).toBe(false);
  });
  it('tolerates medium findings', () => {
    expect(
      moduleIsClean([
        { rule: 'level', moduleCode: 'M06', detail: 'x', count: 2, severity: 'medium' },
      ])
    ).toBe(true);
  });
  it('is true for a module with nothing found', () => {
    expect(moduleIsClean([])).toBe(true);
  });
});
