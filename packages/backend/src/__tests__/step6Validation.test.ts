import { step6Checks, step6Passed, step6ReportOf } from '../services/step6Validation';

const YEAR = 2026;

const source = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  category: 'peer_reviewed_journal',
  type: 'academic',
  year: 2024,
  title: `Title ${id}`,
  authors: ['A. Author'],
  citation: `Author, A. (2024). Title ${id}.`,
  accessStatus: 'open_access',
  ...over,
});

const reading = (sourceId: string, category: string, over: Record<string, unknown> = {}) => ({
  sourceId,
  moduleId: 'm1',
  category,
  linkedMLOs: ['m1-1'],
  estimatedReadingMinutes: 60,
  ...over,
});

/** A module that meets every rule: 3 core, 4 supplementary, academic and applied sources. */
function healthy() {
  const sources = [source('s1'), source('s2', { type: 'applied', category: 'professional_body' })];
  const readings = [
    ...['s1', 's1', 's2'].map((s) => reading(s, 'core')),
    ...['s1', 's2', 's1', 's2'].map((s) => reading(s, 'supplementary')),
  ];
  const modules = [{ id: 'm1', title: 'Module 1', selfStudyHours: 20 }];
  return { readings, modules, sources, currentYear: YEAR };
}

describe('step6Checks', () => {
  it('passes a module that meets every rule', () => {
    const { validationReport, moduleSummaries } = step6Checks(healthy());
    expect(validationReport).toEqual({
      coreCountValid: true,
      supplementaryCountValid: true,
      allCoreMapToMLO: true,
      allAGICompliant: true,
      academicAppliedMix: true,
      readingTimeWithinBudget: true,
      allAccessible: true,
    });
    expect(step6Passed(validationReport)).toBe(true);
    expect(moduleSummaries[0]).toMatchObject({ coreCount: 3, readingTimePercent: 35 });
  });

  it('fails every check when there is nothing to check', () => {
    const { validationReport } = step6Checks({
      readings: [],
      modules: [],
      sources: [],
      currentYear: YEAR,
    });
    expect(Object.values(validationReport).every((v) => v === false)).toBe(true);
    expect(step6Passed(validationReport)).toBe(false);
  });

  it('fails a module with no readings instead of passing it', () => {
    const input = healthy();
    const { validationReport } = step6Checks({
      ...input,
      modules: [...input.modules, { id: 'm2', title: 'Module 2', selfStudyHours: 20 }],
    });
    expect(validationReport.allCoreMapToMLO).toBe(false);
    expect(validationReport.academicAppliedMix).toBe(false);
  });

  it('reads the academic/applied mix from the cited source, since readings carry no type', () => {
    const input = healthy();
    const allAcademic = input.sources.map((s) => ({ ...s, type: 'academic' }));
    expect(step6Checks(input).validationReport.academicAppliedMix).toBe(true);
    expect(
      step6Checks({ ...input, sources: allAcademic }).validationReport.academicAppliedMix
    ).toBe(false);
  });

  it("does not take the model's agiCompliant claim: it tests the cited source", () => {
    const input = healthy();
    const claimed = input.readings.map((r) => ({ ...r, agiCompliant: true }));
    const old = input.sources.map((s) => ({ ...s, year: 2001 }));
    expect(
      step6Checks({ ...input, readings: claimed, sources: old }).validationReport.allAGICompliant
    ).toBe(false);
  });

  it('fails a reading whose source cannot be found, for compliance and access', () => {
    const input = healthy();
    const readings = [...input.readings, reading('missing', 'supplementary')];
    const { validationReport } = step6Checks({ ...input, readings });
    expect(validationReport.allAGICompliant).toBe(false);
    expect(validationReport.allAccessible).toBe(false);
  });

  it('fails a reading whose source was rejected for access', () => {
    const input = healthy();
    const sources = input.sources.map((s, i) => (i ? { ...s, accessStatus: 'rejected' } : s));
    expect(step6Checks({ ...input, sources }).validationReport.allAccessible).toBe(false);
  });

  it('leaves reading time unchecked when hours are unset, instead of inventing ten', () => {
    const input = healthy();
    const { validationReport, moduleSummaries } = step6Checks({
      ...input,
      modules: [{ id: 'm1', title: 'Module 1' }],
    });
    expect(moduleSummaries[0].readingTimePercent).toBeNull();
    expect(validationReport.readingTimeWithinBudget).toBeNull();
  });

  it('fails reading time over budget even when another module has no hours set', () => {
    const input = healthy();
    const { validationReport } = step6Checks({
      ...input,
      modules: [
        { id: 'm1', title: 'Module 1', selfStudyHours: 2 },
        { id: 'm2', title: 'Module 2' },
      ],
    });
    expect(validationReport.readingTimeWithinBudget).toBe(false);
  });

  it('fails core counts outside 3-6', () => {
    const input = healthy();
    const readings = input.readings.filter((r, i) => r.category !== 'core' || i === 0);
    expect(step6Checks({ ...input, readings }).validationReport.coreCountValid).toBe(false);
  });
});

describe('step6ReportOf', () => {
  it('recomputes the report, issues and verdict for a stored reading list', () => {
    const input = healthy();
    const view = step6ReportOf(
      {
        step4: { modules: input.modules },
        step5: { sources: input.sources.map((s, i) => (i ? { ...s, year: 2001 } : s)) },
        step6: { readings: input.readings },
      },
      YEAR
    );
    expect(view?.validationReport.allAGICompliant).toBe(false);
    expect(view?.isValid).toBe(false);
    expect(view?.validationIssues).toEqual([
      'Some readings cite a source that fails the source rules, was added by hand and not yet reviewed, or cannot be found',
    ]);
  });

  it('returns null when there is no Step 6', () => {
    expect(step6ReportOf({}, YEAR)).toBeNull();
  });
});
