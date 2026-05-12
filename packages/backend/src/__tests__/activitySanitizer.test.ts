import {
  sanitizeActivityString,
  sanitizeActivityArray,
  ACTIVITY_MAX_ITEMS,
  ACTIVITY_MAX_CHARS,
} from '../services/activitySanitizer';

describe('sanitizeActivityString', () => {
  it('returns null for non-strings', () => {
    expect(sanitizeActivityString(null)).toBeNull();
    expect(sanitizeActivityString(undefined)).toBeNull();
    expect(sanitizeActivityString(42)).toBeNull();
    expect(sanitizeActivityString({})).toBeNull();
  });

  it('returns null for empty / whitespace-only strings', () => {
    expect(sanitizeActivityString('')).toBeNull();
    expect(sanitizeActivityString('   ')).toBeNull();
    expect(sanitizeActivityString('\t\n')).toBeNull();
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeActivityString('  Lecture (4h)  ')).toBe('Lecture (4h)');
  });

  it('strips HTML tags', () => {
    expect(sanitizeActivityString('<b>Lecture</b>: orientation (4h)')).toBe(
      'Lecture: orientation (4h)'
    );
    expect(sanitizeActivityString('<script>alert(1)</script>Workshop')).toBe('alert(1)Workshop');
  });

  it('drops ASCII control characters but keeps newline + tab', () => {
    const input = `Line one\x01\x07\nLine two\twith tab\x1F`;
    expect(sanitizeActivityString(input)).toBe('Line one\nLine two\twith tab');
  });

  it('caps strings at ACTIVITY_MAX_CHARS', () => {
    const long = 'a'.repeat(ACTIVITY_MAX_CHARS + 100);
    const out = sanitizeActivityString(long);
    expect(out).toHaveLength(ACTIVITY_MAX_CHARS);
  });

  it('preserves Logan-style activity strings verbatim', () => {
    const examples = [
      'Lecture: Programme orientation and the fashion retail landscape (4h)',
      'Workshop: Retail Promotional Cycle and Execution Basics (8h)',
      'Lab: Retail Operations and POS Simulation Lab (6h)',
    ];
    for (const ex of examples) {
      expect(sanitizeActivityString(ex)).toBe(ex);
    }
  });
});

describe('sanitizeActivityArray', () => {
  it('throws when input is not an array', () => {
    expect(() => sanitizeActivityArray('not-an-array', 'contactActivities')).toThrow(
      /must be an array/
    );
    expect(() => sanitizeActivityArray({} as unknown, 'contactActivities')).toThrow(
      /must be an array/
    );
  });

  it('throws when array exceeds ACTIVITY_MAX_ITEMS', () => {
    const tooMany = Array.from({ length: ACTIVITY_MAX_ITEMS + 1 }, (_, i) => `Item ${i}`);
    expect(() => sanitizeActivityArray(tooMany, 'contactActivities')).toThrow(/at most 50/);
  });

  it('filters out empty / non-string entries silently', () => {
    const mixed = ['Lecture (4h)', '', '   ', null, 42, 'Workshop (8h)'];
    expect(sanitizeActivityArray(mixed, 'contactActivities')).toEqual([
      'Lecture (4h)',
      'Workshop (8h)',
    ]);
  });

  it('round-trips a clean Logan-style payload', () => {
    const input = [
      'Lecture: Programme orientation and the fashion retail landscape (4h)',
      'Workshop: Retail Promotional Cycle and Execution Basics (8h)',
      'Lab: Retail Operations and POS Simulation Lab (6h)',
    ];
    expect(sanitizeActivityArray(input, 'contactActivities')).toEqual(input);
  });

  it('accepts the empty array (clearing all activities)', () => {
    expect(sanitizeActivityArray([], 'contactActivities')).toEqual([]);
  });
});
