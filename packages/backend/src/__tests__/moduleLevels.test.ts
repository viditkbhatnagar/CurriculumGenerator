/**
 * Logan Pacey's re-test, 2 November 2026: no module had a year or level, and the final module
 * of a four-module certificate was tagged "middle".
 */
import {
  authorLevelEdit,
  deriveModuleLevels,
  levelsFor,
  withModuleLevels,
} from '../services/moduleLevels';

const mods = (n: number, credits: number, extra: any = {}) =>
  Array.from({ length: n }, (_, i) => ({ code: `M0${i + 1}`, sequence: i + 1, credits, ...extra }));

describe('module levels', () => {
  it('puts every module of a one-year certificate at one level and year, with the last late', () => {
    const step1 = {
      programTitle: 'Certificate in Business Analytics',
      academicLevel: 'certificate',
      creditFramework: { system: 'uk_credits', credits: 60 },
    };
    const levels = deriveModuleLevels(mods(4, 15), step1);
    expect(new Set(levels.map((l) => l.level)).size).toBe(1);
    expect(levels.every((l) => l.year === 1 && l.levelFramework === 'RQF')).toBe(true);
    expect(levels.map((l) => l.position)).toEqual(['early', 'early', 'middle', 'late']);
    expect(levels[0].levelLabel).toBe('RQF Level 4 · Year 1');
    expect(levels[0].levelOrigin).toBe('derived');
  });

  it('runs a three-year FHEQ bachelor at levels 4, 5, 6 by cumulative credits', () => {
    const step1 = {
      programTitle: 'Bachelor of Business',
      creditFramework: { system: 'uk_credits', credits: 360 },
    };
    const levels = deriveModuleLevels(mods(12, 30), step1);
    expect(levels[0]).toMatchObject({
      year: 1,
      level: 4,
      levelFramework: 'FHEQ',
      position: 'early',
    });
    expect(levels[5]).toMatchObject({ year: 2, level: 5 });
    expect(levels[11]).toMatchObject({ year: 3, level: 6, position: 'late' });
  });

  it('lets the blueprint group win, and keeps author values', () => {
    const step1 = {
      programTitle: 'Bachelor of Business',
      creditFramework: { system: 'ects', credits: 180 },
    };
    const modules = [
      { sequence: 1, group: 'Year 1 – Level 4' },
      { sequence: 2, group: 'Year 2' },
      { sequence: 3, level: 7, year: 3, levelOrigin: 'author', levelFramework: 'EQF' },
    ];
    const levels = deriveModuleLevels(modules, step1);
    expect(levels[0]).toMatchObject({ level: 4, year: 1, levelOrigin: 'blueprint' });
    expect(levels[1]).toMatchObject({
      year: 2,
      levelOrigin: 'blueprint',
      levelFramework: 'EQF',
      level: 6,
    });
    expect(levels[2]).toMatchObject({ level: 7, year: 3, levelOrigin: 'author' });
  });

  it('writes levels onto new modules, and phase follows position', () => {
    const step1 = { programTitle: 'MBA', creditFramework: { system: 'ects', credits: 90 } };
    const input = mods(4, 10);
    const out = withModuleLevels(input, step1);
    expect((input[0] as any).level).toBeUndefined();
    expect(out.map((m: any) => m.phase)).toEqual(['early', 'early', 'middle', 'late']);
    expect(out.every((m: any) => m.level === 7)).toBe(true);
  });

  it("checks an author's edit and marks it as the author's", () => {
    const current = deriveModuleLevels(mods(1, 15), {
      academicLevel: 'certificate',
      creditFramework: { system: 'uk_credits', credits: 60 },
    })[0];
    expect(authorLevelEdit({ level: 9 }, current)).toHaveProperty('error');
    expect(authorLevelEdit({ year: 0 }, current)).toHaveProperty('error');
    const ok: any = authorLevelEdit({ level: 5 }, current);
    expect(ok.fields).toMatchObject({
      level: 5,
      levelOrigin: 'author',
      levelLabel: 'RQF Level 5 · Year 1',
    });
  });

  it('derives for an existing workflow with no stored levels', () => {
    const wf = {
      step1: { academicLevel: 'diploma', creditFramework: { system: 'uk_credits', credits: 60 } },
      step4: { modules: mods(2, 30) },
    };
    expect(levelsFor(wf)).toHaveLength(2);
    expect(levelsFor({})).toEqual([]);
  });
});
