import { step5ValidationReport, step5Compliant } from '../services/step5Validation';

const YEAR = 2026;
const modules = [
  { id: 'm1', mlos: [{ id: 'm1-1' }, { id: 'm1-2' }] },
  { id: 'm2', mlos: [{ id: 'm2-1' }] },
];
const source = (moduleId: string, linkedMLOs: string[], extra: any = {}) => ({
  moduleId,
  linkedMLOs,
  category: 'peer_reviewed_journal',
  type: 'academic',
  year: 2024,
  citation: 'A. Author (2024). Title.',
  authors: ['A. Author'],
  title: 'Title',
  accessStatus: 'free_full_text',
  ...extra,
});
const wellSourced = [
  source('m1', ['m1-1', 'm1-2']),
  source('m1', ['m1-1', 'm1-2'], { type: 'applied', category: 'professional_body' }),
  source('m2', ['m2-1']),
  source('m2', ['m2-1'], { type: 'applied', category: 'professional_body' }),
];

describe('step5ValidationReport', () => {
  it('passes nothing when there are no sources', () => {
    const report = step5ValidationReport([], modules, YEAR);
    const passed = Object.entries(report).filter(([, v]) => v === true);
    expect(passed).toEqual([]);
  });

  it('fails minimum sources when an outcome has fewer than two', () => {
    const thin = [...wellSourced.slice(0, 3)];
    expect(step5ValidationReport(thin, modules, YEAR).minimumSourcesPerTopic).toBe(false);
  });

  it('passes minimum sources when every outcome has two', () => {
    expect(step5ValidationReport(wellSourced, modules, YEAR).minimumSourcesPerTopic).toBe(true);
  });

  it('fails traceability when a source is linked to no outcome', () => {
    const orphan = [...wellSourced, source('m1', [])];
    expect(step5ValidationReport(orphan, modules, YEAR).traceabilityComplete).toBe(false);
  });

  it('fails traceability when an outcome has no source', () => {
    const missing = wellSourced.filter((s) => s.moduleId !== 'm2');
    expect(step5ValidationReport(missing, modules, YEAR).traceabilityComplete).toBe(false);
  });

  it('does not claim to have checked APA formatting', () => {
    expect(step5ValidationReport(wellSourced, modules, YEAR).apaAccuracy).toBeNull();
  });

  it('fails every-outcome-supported for a module that declares no outcomes', () => {
    const report = step5ValidationReport(wellSourced, [...modules, { id: 'm3', mlos: [] }], YEAR);
    expect(report.everyMLOSupported).toBe(false);
  });
});

describe('step5Compliant', () => {
  it('ignores checks that were not run but requires every other one to pass', () => {
    const report = step5ValidationReport(wellSourced, modules, YEAR);
    expect(step5Compliant(report)).toBe(true);
    expect(step5Compliant({ ...report, freeAccessRatio: false })).toBe(false);
  });
});
