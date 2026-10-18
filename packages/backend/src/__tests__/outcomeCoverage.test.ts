import { aimIndex, step3CoverageReport, tidyOutcome } from '../services/outcomeCoverage';
import { jobTaskIndex } from '../services/competencyFramework';

const step1 = {
  programAims: ['To develop analytical capability', 'To prepare learners for practice'],
  jobRoles: [{ title: 'Analyst', tasks: ['Build forecasts', 'Brief managers'] }],
};
const step2 = {
  knowledgeItems: [
    { id: 'K1', importance: 'essential' },
    { id: 'K2', importance: 'essential' },
  ],
  skillItems: [{ id: 'S1', importance: 'essential' }],
  competencyItems: [{ id: 'C1', importance: 'desirable' }],
};
const context = {
  kscIds: new Set(['K1', 'K2', 'S1', 'C1']),
  aims: aimIndex(step1.programAims),
  tasks: jobTaskIndex(step1.jobRoles),
};

describe('tidyOutcome', () => {
  it('keeps only links to aims, competencies and tasks that exist, and folds the spelling', () => {
    const plo = tidyOutcome(
      {
        code: 'PLO1',
        bloomLevel: 'analyse',
        aimIds: ['a1', 'A9'],
        linkedKSCs: ['K1', 'K99'],
        jobTaskIds: ['JT2', 'JT7'],
        evidenceRequired: 'A written analysis of a realistic case',
      },
      context
    );
    expect(plo).toMatchObject({
      bloomLevel: 'analyze',
      aimIds: ['A1'],
      linkedKSCs: ['K1'],
      jobTaskIds: ['JT2'],
      jobTaskMapping: ['Brief managers'],
      assessmentAlignment: 'A written analysis of a realistic case',
    });
  });
});

describe('step3CoverageReport', () => {
  const outcomes = [
    {
      code: 'PLO1',
      statement: 'Analyse forecasts',
      bloomLevel: 'analyze',
      aimIds: ['A1'],
      linkedKSCs: ['K1'],
      jobTaskIds: ['JT1'],
    },
    {
      code: 'PLO2',
      statement: 'Evaluate options',
      bloomLevel: 'evaluate',
      aimIds: ['A1'],
      linkedKSCs: ['S1'],
      jobTaskIds: [],
    },
  ];

  it('counts essential coverage over essential items only, and names what is missing', () => {
    const report = step3CoverageReport(outcomes, step2, step1);
    expect(report).toMatchObject({
      essentialCompetencies: 3,
      competenciesCovered: 2,
      coveragePercent: 67,
      uncoveredEssential: ['K2'],
      uncoveredAims: ['A2'],
      uncoveredJobTasks: ['JT2'],
      computedBy: 'code',
    });
    expect(report.validation.allEssentialAccountedFor).toBe(false);
    expect(report.validation.allAimsCovered).toBe(false);
  });

  it('accepts an essential item deferred to modules only with a reason', () => {
    const withReason = step3CoverageReport(outcomes, step2, step1, [
      { id: 'K2', reason: 'Taught within modules' },
    ]);
    expect(withReason.uncoveredEssential).toEqual([]);
    expect(withReason.validation.allEssentialAccountedFor).toBe(true);
    const noReason = step3CoverageReport(outcomes, step2, step1, [{ id: 'K2' }]);
    expect(noReason.uncoveredEssential).toEqual(['K2']);
  });

  it('passes nothing on an empty list', () => {
    const report = step3CoverageReport([], step2, step1);
    expect(report.validation).toMatchObject({
      allEssentialAccountedFor: false,
      allAimsCovered: false,
      allUnique: false,
      withinWordLimit: false,
    });
  });

  it('does not demand a lower-order exit outcome', () => {
    const report = step3CoverageReport(outcomes, step2, step1);
    expect(report.validation.hasLowerLevel).toBe(false);
    expect(Object.keys(report.validation)).not.toContain('noSingleLevelOver50');
  });
});
