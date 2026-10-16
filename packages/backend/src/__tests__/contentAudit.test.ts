/**
 * Logan's review, 16 October 2026: "There's a check for content pitched above its level, but it
 * isn't switched on." These tests cover it switched on: findings from stored lessons, and the
 * lines they become among the unresolved issues.
 */
import { contentAuditIssues } from '../services/contentAuditIssues';
import { findingsFor } from '../services/contentAuditRunner';
import { unresolvedIssues } from '../services/unresolvedIssues';

const year1Economics = {
  id: 'mod-m02',
  code: 'M02',
  title: 'Business Economics',
  group: 'Year 1 – Level 4',
  topics: ['Demand and supply', 'Elasticity'],
};
const lessons = (text: string, n = 6) =>
  Array.from({ length: n }, (_, i) => ({
    lessonId: `L${i}`,
    lessonTitle: `Lesson ${i}`,
    body: text,
  }));

describe('content audit', () => {
  it('finds a Level 6 technique and CIPD in a Year 1 economics module', () => {
    const findings = findingsFor(year1Economics, {
      moduleId: 'mod-m02',
      lessons: lessons('Compare NPV with MIRR. Apply the CIPD PESTLE lens.'),
    });
    const rules = findings.map((f) => f.rule);
    expect(rules).toContain('level');
    expect(rules).toContain('discipline');
    expect(findings.find((f) => f.rule === 'level')?.detail).toMatch(/MIRR needs Level 6/);
  });

  it('does not take the word "did" for difference-in-differences', () => {
    const findings = findingsFor(year1Economics, {
      moduleId: 'mod-m02',
      lessons: lessons('What did the price change do? Did demand fall?'),
    });
    expect(findings).toEqual([]);
    const real = findingsFor(year1Economics, {
      moduleId: 'mod-m02',
      lessons: lessons('Estimate the effect with a DiD design (difference-in-differences).'),
    });
    expect(real.map((f) => f.detail)).toContain(
      'difference-in-differences needs Level 6; this module is Level 4'
    );
  });

  it('finds nothing in clean lessons', () => {
    expect(
      findingsFor(year1Economics, {
        moduleId: 'mod-m02',
        lessons: lessons('Shift the demand curve.'),
      })
    ).toEqual([]);
  });

  it('lists one line per kind of fault, naming the modules', () => {
    const issues = contentAuditIssues(
      {
        modules: {
          'mod-m02': {
            moduleCode: 'M02',
            checkedAt: '2026-10-16',
            findings: [
              {
                rule: 'level',
                moduleCode: 'M02',
                detail: 'MIRR needs Level 6; this module is Level 4',
                count: 6,
                severity: 'medium',
              },
              {
                rule: 'discipline',
                moduleCode: 'M02',
                detail: 'CIPD is cited outside its discipline',
                count: 6,
                severity: 'medium',
              },
            ],
          },
          'mod-m10': {
            moduleCode: 'M10',
            checkedAt: '2026-10-16',
            findings: [
              {
                rule: 'level',
                moduleCode: 'M10',
                detail: 't-tests needs Level 5; this module is Level 4',
                count: 30,
                severity: 'high',
              },
            ],
          },
          'mod-m03': { moduleCode: 'M03', checkedAt: '2026-10-16', findings: [] },
        },
      },
      true
    );
    expect(issues).toHaveLength(2);
    expect(issues[0]).toEqual({
      kind: 'review',
      issue:
        "Lesson content is pitched above the module's level in 2 modules: M02 (MIRR needs Level 6; this module is Level 4, 6×), M10 (t-tests needs Level 5; this module is Level 4, 30×)",
    });
    expect(issues[1].issue).toMatch(
      /^A professional body is cited outside its discipline in 1 module: M02/
    );
  });

  it('says the lessons were not checked, rather than nothing, when they never were', () => {
    expect(contentAuditIssues(undefined, true)).toEqual([
      expect.objectContaining({ kind: 'not_checked' }),
    ]);
    expect(contentAuditIssues(undefined, false)).toEqual([]);
  });

  it('puts the findings among the unresolved issues of Step 10', () => {
    const workflow = {
      step4: { modules: [year1Economics] },
      step10: { moduleLessonPlans: [{ moduleId: 'mod-m02', moduleCode: 'M02', lessons: [] }] },
      contentAudit: {
        modules: {
          'mod-m02': {
            moduleCode: 'M02',
            checkedAt: '2026-10-16',
            findings: [
              {
                rule: 'jurisdiction',
                moduleCode: 'M02',
                detail: 'UK GDPR appears in a module whose topics do not call for it',
                count: 3,
                severity: 'medium',
              },
            ],
          },
        },
      },
    };
    const step10 = unresolvedIssues(workflow, 2026).filter(
      (i) => i.step === 10 && /law/.test(i.issue)
    );
    expect(step10).toEqual([expect.objectContaining({ kind: 'review', stepName: 'Lesson Plans' })]);
  });
});
