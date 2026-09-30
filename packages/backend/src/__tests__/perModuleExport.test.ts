import { moduleEntryAt, parseModuleIndex, PER_MODULE_ARRAYS } from '../utils/perModuleExport';

describe('parseModuleIndex', () => {
  it('is undefined when no module was asked for', () => {
    expect(parseModuleIndex(undefined)).toBeUndefined();
  });

  it('reads a whole number', () => {
    expect(parseModuleIndex('0')).toBe(0);
    expect(parseModuleIndex('27')).toBe(27);
  });

  it('refuses anything that is not a non-negative whole number', () => {
    // parseInt accepted all of these: "abc" became NaN, "2x" became 2, "-1" stayed -1.
    for (const raw of ['', 'abc', '-1', '1.5', '2x', ' 3', '1e3', '0x10']) {
      expect(parseModuleIndex(raw)).toBeNull();
    }
  });

  it('refuses a repeated parameter, which Express reads as an array', () => {
    expect(parseModuleIndex(['1', '2'])).toBeNull();
  });

  it('refuses an index too long to be a module position', () => {
    expect(parseModuleIndex('1234567')).toBeNull();
  });
});

describe('moduleEntryAt', () => {
  const workflow = {
    step10: {
      moduleLessonPlans: [
        { moduleId: 'mod-m01', moduleCode: 'M01' },
        { moduleId: 'mod-m42', moduleCode: 'M42' },
      ],
    },
    step11: { modulePPTDecks: [{ moduleId: 'mod4', moduleCode: 'MOD104' }] },
    step12: { moduleAssignmentPacks: [{ moduleId: 'mod3', moduleCode: '' }] },
    step5: { sources: [{ id: 's1' }] },
  };

  it('returns the stored entry the index names, in stored order', () => {
    expect(moduleEntryAt(workflow, 10, 1)).toEqual({ moduleId: 'mod-m42', moduleCode: 'M42' });
    expect(moduleEntryAt(workflow, 11, 0)).toEqual({ moduleId: 'mod4', moduleCode: 'MOD104' });
    expect(moduleEntryAt(workflow, 12, 0)).toEqual({ moduleId: 'mod3', moduleCode: '' });
  });

  it('returns nothing for an index outside the array, instead of the whole step', () => {
    expect(moduleEntryAt(workflow, 10, 2)).toBeUndefined();
    expect(moduleEntryAt(workflow, 10, 99)).toBeUndefined();
    expect(moduleEntryAt(workflow, 10, -1)).toBeUndefined();
    expect(moduleEntryAt(workflow, 10, NaN)).toBeUndefined();
    expect(moduleEntryAt(workflow, 10, 0.5)).toBeUndefined();
  });

  it('returns nothing for a step that has no per-module array', () => {
    expect(moduleEntryAt(workflow, 5, 0)).toBeUndefined();
    expect(moduleEntryAt({}, 10, 0)).toBeUndefined();
    expect(moduleEntryAt(null, 10, 0)).toBeUndefined();
    expect(moduleEntryAt({ step10: { moduleLessonPlans: 'x' } }, 10, 0)).toBeUndefined();
  });

  it('returns nothing for a hole in the array', () => {
    expect(moduleEntryAt({ step10: { moduleLessonPlans: [null] } }, 10, 0)).toBeUndefined();
  });

  it('names the arrays of steps 10 to 12 only', () => {
    expect(Object.keys(PER_MODULE_ARRAYS).map(Number)).toEqual([10, 11, 12]);
    expect(Object.isFrozen(PER_MODULE_ARRAYS)).toBe(true);
  });
});
