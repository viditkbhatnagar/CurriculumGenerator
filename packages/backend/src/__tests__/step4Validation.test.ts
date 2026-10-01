import { step4ValidationReport, studentHoursOf } from '../services/step4Validation';

const mod = (id: string, sequence: number, over: Record<string, unknown> = {}) => ({
  id,
  sequence,
  contactHours: 30,
  selfStudyHours: 90,
  linkedPLOs: ['PLO1'],
  mlos: [{ id: `${id}-1` }, { id: `${id}-2` }],
  prerequisites: [] as string[],
  ...over,
});

describe('step4ValidationReport', () => {
  it('passes a programme whose prerequisites come earlier, with outcomes covered', () => {
    const modules = [mod('m1', 1), mod('m2', 2, { prerequisites: ['m1'] })];
    expect(step4ValidationReport({ modules, ploIds: ['PLO1'], declaredHours: 240 })).toEqual({
      hoursMatch: true,
      contactHoursMatch: null, // Step 1 records no contact-hour target
      allPLOsCovered: true,
      progressionValid: true,
      noCircularDeps: true,
      minMLOsPerModule: true,
    });
  });

  it('fails a prerequisite that comes later, or that names no module', () => {
    const later = [mod('m1', 1, { prerequisites: ['m2'] }), mod('m2', 2)];
    expect(
      step4ValidationReport({ modules: later, ploIds: ['PLO1'], declaredHours: 240 })
        .progressionValid
    ).toBe(false);
    const dangling = [mod('m1', 1), mod('m2', 2, { prerequisites: ['m9'] })];
    expect(
      step4ValidationReport({ modules: dangling, ploIds: ['PLO1'], declaredHours: 240 })
        .progressionValid
    ).toBe(false);
  });

  it('finds a circular dependency', () => {
    const modules = [
      mod('m1', 1, { prerequisites: ['m3'] }),
      mod('m2', 2, { prerequisites: ['m1'] }),
      mod('m3', 3, { prerequisites: ['m2'] }),
    ];
    expect(
      step4ValidationReport({ modules, ploIds: ['PLO1'], declaredHours: 360 }).noCircularDeps
    ).toBe(false);
  });

  it('reports "not checked" rather than a pass when there is nothing to check against', () => {
    // These passed vacuously: no declared hours, no programme outcomes, no modules.
    const r = step4ValidationReport({ modules: [], ploIds: [], declaredHours: 0 });
    expect(r.hoursMatch).toBeNull();
    expect(r.allPLOsCovered).toBeNull();
    expect(r.minMLOsPerModule).toBeNull();
  });

  it('fails uncovered outcomes and modules with fewer than two outcomes', () => {
    const modules = [mod('m1', 1, { mlos: [{ id: 'x' }] })];
    const r = step4ValidationReport({ modules, ploIds: ['PLO1', 'PLO2'], declaredHours: 120 });
    expect(r.allPLOsCovered).toBe(false);
    expect(r.minMLOsPerModule).toBe(false);
  });

  it('compares the declared hours with what one student studies (core plus one track)', () => {
    const modules = [
      mod('core', 1, { contactHours: 40, selfStudyHours: 60 }),
      mod('t1', 2, { isElective: true, group: 'A', contactHours: 50, selfStudyHours: 50 }),
      mod('t2', 3, { isElective: true, group: 'B', contactHours: 30, selfStudyHours: 30 }),
    ];
    expect(studentHoursOf(modules)).toBe(200);
    expect(
      step4ValidationReport({ modules, ploIds: ['PLO1'], declaredHours: 200 }).hoursMatch
    ).toBe(true);
    expect(
      step4ValidationReport({ modules, ploIds: ['PLO1'], declaredHours: 300 }).hoursMatch
    ).toBe(false);
  });

  it('counts an outcome linked by an MLO as covered', () => {
    const modules = [
      mod('m1', 1, { linkedPLOs: [], mlos: [{ linkedPLOs: ['PLO1'] }, { linkedPLOs: ['PLO2'] }] }),
    ];
    expect(
      step4ValidationReport({ modules, ploIds: ['PLO1', 'PLO2'], declaredHours: 120 })
        .allPLOsCovered
    ).toBe(true);
  });
});
