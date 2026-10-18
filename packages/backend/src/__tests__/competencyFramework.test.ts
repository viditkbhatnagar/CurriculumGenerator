import {
  competencyCeiling,
  jobTaskIndex,
  jobTaskPromptLines,
  resolveEvidence,
  tidyStep2Output,
} from '../services/competencyFramework';

describe('competencyCeiling', () => {
  it('grows with programme size instead of giving every programme 15-25', () => {
    expect(competencyCeiling(135)).toBe(9);
    expect(competencyCeiling(600)).toBe(22);
    expect(competencyCeiling(4500)).toBe(39);
    expect(competencyCeiling(135)).toBeLessThan(competencyCeiling(4500));
  });

  it('stays within sane bounds', () => {
    expect(competencyCeiling(10)).toBeGreaterThanOrEqual(8);
    expect(competencyCeiling(100000)).toBe(40);
    expect(competencyCeiling(undefined)).toBe(20);
  });
});

const roles = [
  { title: 'HR Officer', tasks: ['Conduct workforce analysis', 'Draft staffing plans'] },
  { title: 'Payroll Clerk', tasks: [] },
];

describe('job tasks', () => {
  it('gives each SME task a stable id, in entry order', () => {
    expect(jobTaskIndex(roles)).toEqual([
      { id: 'JT1', role: 'HR Officer', task: 'Conduct workforce analysis' },
      { id: 'JT2', role: 'HR Officer', task: 'Draft staffing plans' },
    ]);
    expect(jobTaskPromptLines(roles, jobTaskIndex(roles))).toBe(
      '- HR Officer\n  JT1: Conduct workforce analysis\n  JT2: Draft staffing plans\n- Payroll Clerk (no tasks supplied)'
    );
  });
});

describe('resolveEvidence', () => {
  const sources = ['CIPD Profession Map', 'UK Skills Framework'];

  it('accepts only a passage that was actually supplied', () => {
    expect(resolveEvidence('SOURCE 2', sources)).toEqual({
      kind: 'knowledge base',
      source: 'UK Skills Framework',
      passage: 2,
    });
    expect(resolveEvidence('[SOURCE 7]', sources).kind).toBe('none');
  });

  it('never lets a body name stand in for a supplied passage', () => {
    expect(resolveEvidence('SHRM BoCK - Talent Acquisition Domain', sources)).toEqual({
      kind: 'none',
      source: 'General knowledge (no supplied source)',
    });
  });

  it('recognises occupation and SME evidence', () => {
    expect(resolveEvidence('OCCUPATION', sources).kind).toBe('occupational standard');
    expect(resolveEvidence('SME', sources).kind).toBe('SME input');
  });
});

describe('tidyStep2Output', () => {
  const tasks = jobTaskIndex(roles);
  const parsed = {
    knowledgeItems: [
      { id: 'K1', importance: 'essential', evidence: 'SOURCE 1', linkedJobTaskIds: ['JT1', 'JT9'] },
    ],
    skillItems: [
      { id: 'S1', importance: 'essential', evidence: 'OCCUPATION', linkedJobTaskIds: ['jt1'] },
      { id: 'S2', importance: 'desirable', evidence: 'PMI Talent Triangle', linkedJobTaskIds: [] },
    ],
    competencyItems: [],
    benchmarkingReport: {
      programsAnalyzed: [{ programName: 'Invented MBA', relevance: 'high' }],
      keyFindings: ['Coverage of JT2 is thin'],
      distributionSummary: { knowledgePercent: 35 },
    },
  };
  const out = tidyStep2Output(parsed, {
    passageSources: ['CIPD Profession Map'],
    tasks,
    benchmarkPrograms: [{ programName: 'MBA', institution: 'Example University' }],
  });

  it('fills task wording from the SME text and drops ids that were never supplied', () => {
    expect(out.knowledgeItems![0]).toMatchObject({
      linkedJobTaskIds: ['JT1'],
      linkedJobTasks: ['Conduct workforce analysis'],
      source: 'CIPD Profession Map',
      evidenceKind: 'knowledge base',
    });
    expect(out.skillItems![0].linkedJobTaskIds).toEqual(['JT1']);
  });

  it('counts the distribution and the evidence instead of trusting the model', () => {
    const report = out.benchmarkingReport as any;
    expect(report.distributionSummary).toEqual({
      knowledgePercent: 33,
      skillPercent: 67,
      competencyPercent: 0,
      essentialCount: 2,
      desirableCount: 1,
    });
    expect(report.evidenceSummary).toEqual({
      knowledgeBase: 1,
      occupationalStandard: 1,
      smeInput: 0,
      noSuppliedSource: 1,
    });
    expect(report.jobTaskCoverage).toEqual({ covered: 1, total: 2, uncovered: ['JT2'] });
  });

  it('lists named benchmark programmes as not analysed, and drops invented ones', () => {
    const report = out.benchmarkingReport as any;
    expect(report.programsAnalyzed).toEqual([
      {
        programName: 'MBA',
        institution: 'Example University',
        relevance: 'named by the SME; curriculum not supplied, so not analysed',
      },
    ]);
    expect(report.keyFindings).toEqual(['Coverage of JT2 is thin']);
  });
});
