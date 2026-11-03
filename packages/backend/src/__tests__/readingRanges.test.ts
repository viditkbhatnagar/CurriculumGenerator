import { balanceCoreSupplementary, targetCoreCount } from '../services/readingRanges';
import { step6Checks } from '../services/step6Validation';

const reading = (i: number, category: string, over: Record<string, unknown> = {}) => ({
  sourceId: `s${i}`,
  moduleId: 'm1',
  category,
  linkedMLOs: ['m1-1'],
  mloRelevance: 'medium',
  estimatedReadingMinutes: 30,
  ...over,
});

const list = (core: number, supp: number) => [
  ...Array.from({ length: core }, (_, i) => reading(i, 'core')),
  ...Array.from({ length: supp }, (_, i) => reading(core + i, 'supplementary')),
];

const split = (rs: { category: string }[]) => [
  rs.filter((r) => r.category === 'core').length,
  rs.filter((r) => r.category === 'supplementary').length,
];

describe('balanceCoreSupplementary', () => {
  it.each([
    [7, 3, [6, 4]], // Logan's M1
    [4, 5, [4, 5]], // M2: already in range
    [7, 2, [5, 4]], // M3
    [6, 3, [5, 4]], // M4
  ])('moves %i core / %i supplementary into range', (core, supp, expected) => {
    expect(split(balanceCoreSupplementary(list(core, supp)))).toEqual(expected);
  });

  it('leaves a list already in range untouched', () => {
    const rs = list(4, 5);
    expect(balanceCoreSupplementary(rs)).toEqual(rs);
  });

  it('demotes the weakest core readings first and marks them', () => {
    const rs = [
      reading(0, 'core', { mloRelevance: 'low', linkedMLOs: ['a'] }),
      ...Array.from({ length: 6 }, (_, i) => reading(i + 1, 'core', { mloRelevance: 'high' })),
      ...Array.from({ length: 3 }, (_, i) => reading(i + 7, 'supplementary')),
    ];
    const out = balanceCoreSupplementary(rs);
    expect(out[0].category).toBe('supplementary');
    expect((out[0] as any).categoryBasis).toMatch(/set in code/);
    expect(out.slice(1, 7).every((r) => r.category === 'core')).toBe(true);
  });

  it('promotes only readings linked to an outcome', () => {
    const rs = [
      ...list(2, 0),
      reading(10, 'supplementary', { linkedMLOs: [] }),
      ...Array.from({ length: 5 }, (_, i) => reading(20 + i, 'supplementary')),
    ];
    const out = balanceCoreSupplementary(rs);
    expect(out[2].category).toBe('supplementary');
    expect(split(out)).toEqual([3, 5]);
  });

  it('does not create readings: five readings give 3 core and 2 supplementary', () => {
    expect(split(balanceCoreSupplementary(list(5, 0)))).toEqual([3, 2]);
    expect(targetCoreCount(5, 5)).toBe(3);
  });
});

describe('Step 6 supply shortfall', () => {
  const sources = Array.from({ length: 5 }, (_, i) => ({
    id: `s${i}`,
    moduleId: 'm1',
    type: 'academic',
    year: 2024,
    title: 't',
    authors: ['A'],
    citation: 'c',
    accessStatus: 'open_access',
    category: 'peer_reviewed_journal',
  }));
  const modules = [{ id: 'm1', title: 'M1', selfStudyHours: 40 }];

  it('is not a Step 6 failure when every source is already a reading', () => {
    const readings = balanceCoreSupplementary(list(5, 0));
    const { moduleSummaries, validationReport } = step6Checks({
      readings,
      modules,
      sources,
      currentYear: 2026,
    });
    expect(moduleSummaries[0].sourceSupplyShortfall).toBe(true);
    expect(validationReport.coreCountValid).toBe(true);
    expect(validationReport.supplementaryCountValid).toBe(true);
  });

  it('still fails when sources were left unused', () => {
    const readings = balanceCoreSupplementary(list(3, 1));
    const { moduleSummaries, validationReport } = step6Checks({
      readings,
      modules,
      sources,
      currentYear: 2026,
    });
    expect(moduleSummaries[0].sourceSupplyShortfall).toBe(false);
    expect(validationReport.supplementaryCountValid).toBe(false);
  });
});
