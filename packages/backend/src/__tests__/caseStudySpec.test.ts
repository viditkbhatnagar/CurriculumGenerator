/**
 * Rejin's audit and Logan's review, 16 October 2026: case length was stated three ways that
 * disagreed, every case in a three-year degree had one tier, and difficulty was always
 * "intermediate".
 */
import {
  caseLengthValid,
  caseLevelFor,
  caseSpecFor,
  caseTierGuide,
  levelFromText,
} from '../services/caseStudySpec';

describe('case study spec', () => {
  it("writes each module's case for the module's own year", () => {
    const bba = 'Bachelor in Business Administration';
    expect(caseLevelFor({ group: 'Year 1 – Level 4' }, bba)).toBe(4);
    expect(caseLevelFor({ group: 'Year 3 – Level 6 › Specialization : Finance' }, bba)).toBe(6);
    expect(caseLevelFor({}, bba)).toBe(6);
    expect(caseLevelFor(undefined, 'Level 7')).toBe(7);
    expect(caseLevelFor(undefined, 'something else')).toBe(5);
  });

  it('reads levels and qualification names', () => {
    expect(levelFromText('Year 2')).toBe(5);
    expect(levelFromText('MBA')).toBe(7);
    expect(levelFromText('diploma')).toBe(5);
    expect(levelFromText('certificate')).toBe(3);
    expect(levelFromText('')).toBeNull();
  });

  it('deepens and lengthens from first year to final year', () => {
    const [y1, y2, y3] = [4, 5, 6].map(caseSpecFor);
    expect([y1.difficulty, y2.difficulty, y3.difficulty]).toEqual([
      'introductory',
      'intermediate',
      'advanced',
    ]);
    expect(y1.words.max).toBeLessThan(y3.words.min + 1);
    expect(y3.tier).toBeLessThan(y1.tier);
  });

  it('states length one way: pages follow from the words', () => {
    const s = caseSpecFor(4);
    expect(s.words).toEqual({ min: 500, max: 900 });
    expect(s.pages).toBe('about 1–2 pages');
    const guide = caseTierGuide();
    expect(guide).toContain('Scenario of 500–900 words (about 1–2 pages)');
    expect(guide).not.toMatch(/10-15 pages|2-6 pages|400-600/);
  });

  it('checks a case against the length set for its level, allowing a sixth either way', () => {
    const words = { min: 1000, max: 1600 };
    expect(caseLengthValid(1200, words)).toBe(true);
    expect(caseLengthValid(860, words)).toBe(true);
    expect(caseLengthValid(600, words)).toBe(false);
    expect(caseLengthValid(1900, words)).toBe(false);
  });
});
