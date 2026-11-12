/**
 * Logan Pacey, email of 12 November 2026: the level is set in Step 1, pre-filled from the
 * credential type, and a defaulted level is shown to the reviewer.
 */
import {
  defaultLevelFor,
  levelOriginOf,
  programmeLevelFromInput,
} from '../services/programmeLevel';
import { deriveModuleLevels, programmeLevelInfo } from '../services/moduleLevels';
import { programmeFraming } from '../services/programmeFraming';

describe('defaultLevelFor', () => {
  it.each([
    ['certificate', 'Certificate in Business Analytics', 4],
    ['diploma', 'Diploma in Management', 5],
    ['diploma', 'Postgraduate Diploma in Management', 7],
    ['diploma', 'Executive Diploma in Leadership', 7],
    ['diploma', 'MBA in Technology', 7],
    ['certificate', 'Level 6 Certificate in Law', 6],
    ['micro-credential', 'Data Skills', 4],
    ['certificate', 'BBA', 6],
    [undefined, '', 4],
  ])('%s / %s -> RQF %i', (type, title, expected) => {
    expect(defaultLevelFor(type, title)).toBe(expected);
  });
});

describe('level origin', () => {
  it('stores a valid level and treats anything but "stated" as default', () => {
    expect(programmeLevelFromInput({ programmeLevel: 7, programmeLevelOrigin: 'stated' })).toEqual({
      programmeLevel: 7,
      programmeLevelOrigin: 'stated',
    });
    expect(programmeLevelFromInput({ programmeLevel: '4' })?.programmeLevelOrigin).toBe('default');
    expect(programmeLevelFromInput({ programmeLevel: 9 })).toBeNull();
    expect(programmeLevelFromInput({})).toBeNull();
  });

  it('counts a workflow with no stored level as default', () => {
    expect(levelOriginOf({ programTitle: 'x' })).toBe('default');
    expect(levelOriginOf({ programmeLevel: 5, programmeLevelOrigin: 'stated' })).toBe('stated');
  });
});

describe('module levels honour the Step 1 level', () => {
  const mods = [1, 2, 3, 4].map((n) => ({ code: `M${n}`, sequence: n, credits: 15 }));
  const base = {
    programTitle: 'Certificate in Business Analytics',
    academicLevel: 'certificate',
    creditFramework: { system: 'uk_credits', credits: 60 },
  };

  it('keeps the derived RQF 4 and shows the note for an old workflow', () => {
    expect(deriveModuleLevels(mods, base)[0].level).toBe(4);
    expect(programmeLevelInfo(base)).toEqual({
      level: 4,
      framework: 'RQF',
      origin: 'default',
      note: 'Level not stated, defaulted to RQF 4',
    });
  });

  it('uses the stored level and shows no note when stated', () => {
    const step1 = { ...base, programmeLevel: 5, programmeLevelOrigin: 'stated' };
    expect(deriveModuleLevels(mods, step1).every((l) => l.level === 5)).toBe(true);
    expect(programmeLevelInfo(step1).note).toBeNull();
  });

  it('shows the note for a defaulted stored level, and author edits still win', () => {
    const step1 = { ...base, programmeLevel: 4, programmeLevelOrigin: 'default' };
    expect(programmeLevelInfo(step1).note).toBe('Level not stated, defaulted to RQF 4');
    const edited = [{ ...mods[0], level: 6, levelOrigin: 'author' }, ...mods.slice(1)];
    expect(deriveModuleLevels(edited, step1).map((l) => l.level)).toEqual([6, 4, 4, 4]);
  });

  it('feeds a stated level into the prompts only when stated', () => {
    const stated = programmeFraming({ ...base, programmeLevel: 7, programmeLevelOrigin: 'stated' });
    expect(stated.level).toBe(7);
    const dflt = programmeFraming({ ...base, programmeLevel: 7, programmeLevelOrigin: 'default' });
    expect(dflt.level).toBeNull();
  });
});
