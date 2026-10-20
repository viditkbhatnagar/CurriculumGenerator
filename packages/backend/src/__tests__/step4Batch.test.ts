import {
  hasContent,
  matchBatchContent,
  normaliseModuleCode,
  returnedModules,
} from '../services/step4Batch';

const asked = [
  { code: 'M01', title: 'Strategic Problem Framing' },
  { code: 'M02', title: 'Probability and Statistics' },
];
const body = (extra: any) => ({ topics: ['t'], mlos: [{}], ...extra });

describe('Step 4 batch matching', () => {
  it('reads the usual reply shapes', () => {
    expect(returnedModules({ modules: [1] })).toEqual([1]);
    expect(returnedModules([2])).toEqual([2]);
    expect(returnedModules({ specifications: [3] })).toEqual([3]);
    expect(returnedModules('nope')).toEqual([]);
  });

  it('treats M1, m01 and M-01 as M01', () => {
    expect(normaliseModuleCode('M1')).toBe('M01');
    expect(normaliseModuleCode('m01')).toBe('M01');
    expect(normaliseModuleCode('M-01')).toBe('M01');
  });

  it('matches by code, then title, then position', () => {
    const byCode = matchBatchContent(asked, [
      body({ code: 'M2', x: 'b' }),
      body({ code: 'M1', x: 'a' }),
    ]);
    expect(byCode.get('M01').x).toBe('a');
    const byTitle = matchBatchContent(asked, [
      body({ title: 'Probability and Statistics', x: 'b' }),
    ]);
    expect(byTitle.get('M02').x).toBe('b');
    const byPosition = matchBatchContent(asked, [body({ x: 'a' }), body({ x: 'b' })]);
    expect(byPosition.get('M02').x).toBe('b');
  });

  it('does not guess by position when the counts differ', () => {
    expect(matchBatchContent(asked, [body({ x: 'a' })]).size).toBe(0);
  });

  it('knows an empty entry from a written one', () => {
    expect(hasContent(body({}))).toBe(true);
    expect(hasContent({ code: 'M01' })).toBe(false);
  });
});
