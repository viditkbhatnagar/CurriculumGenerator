/**
 * The checks that would have caught what the reviewer caught by hand.
 *
 * She noticed the OpenStax chapter she had approved for M06 never appeared in a lesson. The cause
 * was that it carried no linked outcome, so the matcher skipped it. Behind that, 240 of 451
 * readings were unlinked and one outcome in the whole programme had no reading at all.
 */

import {
  outcomesOf,
  unlinkedReadings,
  outcomesWithoutCoreReading,
  moduleCoverage,
  coverageReport,
} from '../services/readingCoverage';

const outcomes = [
  { id: 'M06-LO1', statement: 'Apply percentages and break-even analysis.' },
  { id: 'M06-LO2', statement: 'Use a spreadsheet to compute descriptive statistics.' },
  { id: 'M06-LO4', statement: 'Calculate interest and annuity payments.' },
];

describe('a reading that claims no outcome reaches no lesson', () => {
  it('reads either field name used for linked outcomes', () => {
    expect(outcomesOf({ linkedMLOs: ['A'] })).toEqual(['A']);
    expect(outcomesOf({ mloIds: ['B'] })).toEqual(['B']);
    expect(outcomesOf({})).toEqual([]);
  });

  it('flags the approved chapter that was listed but never linked', () => {
    const readings = [
      { title: 'Business analytics review', category: 'core', linkedMLOs: ['M06-LO1', 'M06-LO2'] },
      { title: 'Contemporary Mathematics, Ch 6: Money Management', category: 'core' },
    ];
    const flagged = unlinkedReadings(readings).map((r) => r.title);
    expect(flagged).toEqual(['Contemporary Mathematics, Ch 6: Money Management']);
  });

  it('counts an empty array as unlinked, not as linked-to-nothing', () => {
    expect(unlinkedReadings([{ title: 'Supplementary', linkedMLOs: [] }])).toHaveLength(1);
  });
});

describe('an outcome with no core reading', () => {
  it('names the outcome a lesson could not set reading for', () => {
    const readings = [
      { title: 'Stats text', category: 'core', linkedMLOs: ['M06-LO1', 'M06-LO2'] },
      { title: 'Finance blog', category: 'supplementary', linkedMLOs: ['M06-LO4'] },
    ];
    // Supplementary does not discharge a core outcome.
    expect(outcomesWithoutCoreReading(outcomes, readings)).toEqual(['M06-LO4']);
  });

  it('is satisfied once the chapter is linked', () => {
    const readings = [
      { title: 'Stats text', category: 'core', linkedMLOs: ['M06-LO1', 'M06-LO2'] },
      { title: 'Contemporary Mathematics', category: 'core', linkedMLOs: ['M06-LO4'] },
    ];
    expect(outcomesWithoutCoreReading(outcomes, readings)).toEqual([]);
  });
});

describe('module and programme reporting', () => {
  it('marks a module unsound when anything is unlinked or uncovered', () => {
    const bad = moduleCoverage('M06', outcomes, [
      { title: 'Stats', category: 'core', linkedMLOs: ['M06-LO1', 'M06-LO2'] },
      { title: 'Orphan', category: 'supplementary' },
    ]);
    expect(bad.ok).toBe(false);
    expect(bad.unlinked).toBe(1);
    expect(bad.uncoveredOutcomes).toEqual(['M06-LO4']);
  });

  it('reports only the modules worth acting on', () => {
    const clean = {
      moduleCode: 'M01',
      outcomes: [{ id: 'M01-LO1' }],
      readings: [{ category: 'core', linkedMLOs: ['M01-LO1'] }],
    };
    const broken = {
      moduleCode: 'M06',
      outcomes,
      readings: [{ category: 'core', linkedMLOs: ['M06-LO1', 'M06-LO2'] }, { category: 'core' }],
    };
    const report = coverageReport([clean, broken]);
    expect(report.modulesChecked).toBe(2);
    expect(report.problems.map((p) => p.moduleCode)).toEqual(['M06']);
    expect(report.outcomesWithNoReading).toEqual(['M06-LO4']);
    expect(report.totalUnlinked).toBe(1);
  });

  it('reports nothing for a sound programme', () => {
    const report = coverageReport([
      {
        moduleCode: 'M01',
        outcomes: [{ id: 'M01-LO1' }],
        readings: [{ category: 'core', linkedMLOs: ['M01-LO1'] }],
      },
    ]);
    expect(report.problems).toEqual([]);
    expect(report.outcomesWithNoReading).toEqual([]);
  });
});
