import fixture from './fixtures/logistics-2026-09-21.json';
import { unresolvedIssues } from '../services/unresolvedIssues';

describe('unresolvedIssues', () => {
  it("lists the Logistics test's defects that the export used to hide", () => {
    // The 21 September 2026 test: no case studies, assessments not linked, sources short.
    const workflow = {
      ...fixture,
      step10: { ...fixture.step10, moduleLessonPlans: fixture.moduleLessonPlans },
    };
    const issues = unresolvedIssues(workflow, 2026);
    const say = (step: number) => issues.filter((i) => i.step === step).map((i) => i.issue);

    expect(say(10)).toEqual(
      expect.arrayContaining([
        'Case studies are used in lessons',
        'Assessments are linked to lessons',
      ])
    );
    expect(say(5)).toEqual(expect.arrayContaining(['Every module outcome has a source']));
    const step1 = issues.filter((i) => i.step === 1).map((i) => i.kind);
    expect(step1).toEqual(expect.arrayContaining(['proposal', 'not_checked']));
    // Steps the fixture does not hold are reported missing, not skipped.
    expect(issues.filter((i) => i.kind === 'missing').map((i) => i.step)).toEqual(
      expect.arrayContaining([2, 3, 6, 7, 9, 11, 12, 13])
    );
  });

  it('marks a check that could not run as not checked, not as a failure', () => {
    const issues = unresolvedIssues(
      { step4: { modules: [] }, step1: { creditFramework: {} } },
      2026
    );
    const hours = issues.find((i) => i.issue.startsWith('Module hours add up'));
    expect(hours?.kind).toBe('not_checked');
  });

  it('does not report case studies short when the author recorded none are needed', () => {
    const issues = unresolvedIssues(
      { step8: { notRequired: true, validationReport: { hasCaseStudies: false } } },
      2026
    );
    expect(issues.some((i) => i.step === 8)).toBe(false);
  });

  it('reports every step missing for an empty programme', () => {
    const missing = unresolvedIssues({}, 2026).filter((i) => i.kind === 'missing');
    expect(missing.filter((i) => i.issue === 'This step has not been generated')).toHaveLength(13);
    // and the institution's assessment rules, which no step generates.
    expect(missing).toHaveLength(14);
  });
});

describe('competency coverage', () => {
  it('names essential competencies that no programme outcome covers', () => {
    const issues = unresolvedIssues(
      {
        step2: {
          knowledgeItems: [
            { id: 'K1', importance: 'essential' },
            { id: 'K2', importance: 'desirable' },
          ],
          competencyItems: [{ id: 'C1', importance: 'essential' }],
        },
        step3: { outcomes: [{ code: 'PLO1', linkedKSCs: ['C1'] }] },
      },
      2026
    );
    const coverage = issues.find((i) => i.step === 3);
    expect(coverage?.kind).toBe('review');
    expect(coverage?.issue).toMatch(/^1 essential competency item\(s\).*K1$/);
  });
});
