import { escapeRegex, intParam, stringParam } from '../utils/requestValues';

describe('stringParam', () => {
  it('passes a string through, trimmed and capped', () => {
    expect(stringParam(' step10_complete ')).toBe('step10_complete');
    expect(stringParam('x'.repeat(300), 100)).toHaveLength(100);
  });
  it('drops objects, arrays, empty strings and missing values', () => {
    expect(stringParam({ $ne: 'zzz' })).toBeUndefined();
    expect(stringParam(['a', 'b'])).toBeUndefined();
    expect(stringParam('  ')).toBeUndefined();
    expect(stringParam(undefined)).toBeUndefined();
  });
});

describe('intParam', () => {
  it('reads a whole number within its range', () => {
    expect(intParam('20', 50, 1, 200)).toBe(20);
    expect(intParam('5000', 50, 1, 200)).toBe(200);
    expect(intParam('-3', 0, 0, 1e6)).toBe(0);
  });
  it('falls back for anything else', () => {
    expect(intParam('abc', 50, 1, 200)).toBe(50);
    expect(intParam('1.5', 50, 1, 200)).toBe(50);
    expect(intParam({}, 50, 1, 200)).toBe(50);
  });
});

describe('escapeRegex', () => {
  it('makes every special character literal', () => {
    const text = 'a.b*c+(d)?[e]{f}|g^h$i\\j';
    expect(new RegExp(escapeRegex(text)).test(text)).toBe(true);
    expect(new RegExp(`^${escapeRegex('(a+)+$')}$`).test('aaaa')).toBe(false);
  });
});
