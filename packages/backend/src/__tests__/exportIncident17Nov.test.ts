/**
 * Logan Pacey's email of 17 November 2026 (Diploma in Logistics pilot, workflow
 * 6af5a0a3b706bd9a5b7af54a): the whole-programme export said the job roles had not been matched
 * to occupation codes when they had, never mentioned an unconfirmed programme level, and
 * stopped at Step 13 although a Step 14 syllabus existed.
 */
import JSZip from 'jszip';

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: JSON.stringify({ paragraphs: [], bullets: [] }) } }],
        }),
      },
    },
  })),
}));

import { unresolvedIssues } from '../services/unresolvedIssues';
import { exportContentOf, exportRenderDataOf } from '../services/exportWorkflowData';
import { hashExportInput } from '../services/exportCacheService';
import { wordExportService } from '../services/wordExportService';

const evidence = {
  roles: [
    {
      role: 'Logistics Coordinator',
      matches: ['India', 'US', 'UK', 'Singapore'].map((country) => ({ country })),
    },
  ],
};

const step14 = (extra: object = {}) => ({
  inputs: { instructor: { name: 'Dr Example' }, semester: 'Autumn 2026' },
  generatedSections: {
    courseDescription: 'SYLLABUSMARKER description',
    learningOutcomes: ['Explain freight'],
    moduleSyllabi: [
      {
        moduleId: 'm1',
        moduleCode: 'M1',
        moduleTitle: 'Freight',
        completeness: { ok: true, checks: [{ key: 'learn', label: 'Learn', ok: true }] },
      },
    ],
  },
  ...extra,
});

const levelIssues = (step1: object) =>
  unresolvedIssues({ step1: { jobRoles: ['x'], ...step1 } }, 2026).filter((i) =>
    i.issue.includes('level')
  );

describe('programme level in the unresolved issues', () => {
  it('flags a level that was pre-filled and not confirmed', () => {
    expect(levelIssues({ programmeLevel: 5, programmeLevelOrigin: 'default' })).toEqual([
      expect.objectContaining({
        step: 1,
        kind: 'proposal',
        issue:
          'Programme level 5 was pre-filled from the credential type and not confirmed in Step 1.',
      }),
    ]);
  });

  it('flags a workflow saved before the field existed', () => {
    expect(levelIssues({})).toHaveLength(1);
  });

  it('is silent once the author stated the level', () => {
    expect(levelIssues({ programmeLevel: 5, programmeLevelOrigin: 'stated' })).toHaveLength(0);
  });
});

describe('occupation evidence in the unresolved issues', () => {
  it('does not say the roles are unmatched once the evidence is passed in', () => {
    const base = { step1: { jobRoles: ['Logistics Coordinator'] } };
    const blind = unresolvedIssues(base, 2026).map((i) => i.issue);
    expect(blind.some((t) => t.includes('not been matched to national occupation'))).toBe(true);
    const seen = unresolvedIssues({ ...base, occupationEvidence: evidence }, 2026).map(
      (i) => i.issue
    );
    expect(seen.some((t) => t.includes('not been matched to national occupation'))).toBe(false);
  });
});

describe('Step 14 in the unresolved issues', () => {
  it('does not call an absent syllabus a missing step', () => {
    expect(unresolvedIssues({}, 2026).some((i) => i.step === 14)).toBe(false);
  });

  it('lists a course syllabus whose check failed, and one never checked', () => {
    const failing = step14({ approvedAt: new Date() }) as any;
    failing.generatedSections.moduleSyllabi[0].completeness = {
      ok: false,
      checks: [
        { key: 'weightsSum100', label: 'Weights add up', ok: false, detail: 'They add up to 40%' },
      ],
    };
    const issues = unresolvedIssues({ step14: failing }, 2026).filter((i) => i.step === 14);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ kind: 'fail' });
    expect(issues[0].issue).toContain('M1 Freight');

    const legacy = step14({ approvedAt: new Date() }) as any;
    delete legacy.generatedSections.moduleSyllabi;
    expect(unresolvedIssues({ step14: legacy }, 2026).find((i) => i.step === 14)).toMatchObject({
      kind: 'not_checked',
    });
  });

  it('flags a syllabus generated but not approved, and one never generated', () => {
    expect(unresolvedIssues({ step14: step14() }, 2026).find((i) => i.step === 14)).toMatchObject({
      kind: 'proposal',
    });
    expect(
      unresolvedIssues({ step14: step14({ approvedAt: new Date() }) }, 2026).some(
        (i) => i.step === 14
      )
    ).toBe(false);
    expect(
      unresolvedIssues({ step14: { inputs: {} } }, 2026).find((i) => i.step === 14)
    ).toMatchObject({ kind: 'missing' });
  });
});

describe('export input', () => {
  const wf = {
    projectName: 'P',
    step1: { a: 1 },
    step14: step14(),
    occupationEvidence: evidence,
    kbEvidence: { step1: { passages: 0 } },
    knowledgeLibrary: { books: [] },
    createdAt: new Date('2026-01-01'),
  };

  it('carries the evidence and Step 14 to the renderer and the cache key', () => {
    for (const data of [exportContentOf(wf), exportRenderDataOf(wf)]) {
      expect(data).toMatchObject({
        step14: wf.step14,
        occupationEvidence: evidence,
        kbEvidence: wf.kbEvidence,
        knowledgeLibrary: wf.knowledgeLibrary,
      });
    }
    expect(exportRenderDataOf(wf).createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('changes the cache key when the occupation evidence, Step 14 or KB evidence changes', () => {
    const key = (w: object) => hashExportInput(exportContentOf(w));
    expect(key({ ...wf, occupationEvidence: { roles: [] } })).not.toBe(key(wf));
    expect(key({ ...wf, step14: step14({ approvedAt: 'x' }) })).not.toBe(key(wf));
    expect(key({ ...wf, kbEvidence: {} })).not.toBe(key(wf));
  });
});

describe('Step 14 in the whole-programme document', () => {
  const textOf = async (data: object) => {
    const buffer = await wordExportService.generateDocument(data as any);
    const zip = await JSZip.loadAsync(buffer);
    return (await zip.file('word/document.xml')!.async('string')).replace(/<[^>]+>/g, '');
  };

  it('prints the syllabus, saying when it is unapproved', async () => {
    const out = await textOf({
      projectName: 'P',
      step1: { programTitle: 'P' },
      step14: step14(),
    });
    expect(out).toContain('14. Programme Syllabus');
    expect(out).toContain('SYLLABUSMARKER description');
    expect(out).toContain('not yet approved');
  });

  it('prints no Step 14 section when no syllabus was generated', async () => {
    const out = await textOf({ projectName: 'P', step1: { programTitle: 'P' } });
    expect(out).not.toContain('14. Programme Syllabus');
  });

  it('shows the roles as matched when the evidence is supplied', async () => {
    const out = await textOf({
      projectName: 'P',
      step1: { programTitle: 'P', jobRoles: ['Logistics Coordinator'] },
      occupationEvidence: evidence,
    });
    expect(out).not.toContain('not been matched to national occupation');
  });
});
