// The frontend helper that shows library concept codes as readable references. The frontend has
// no test runner, and the helper is pure, so it is tested here.
import { findConceptCodes, replaceConceptCodes } from '../../../frontend/src/lib/conceptReferences';

const refs = new Map([
  ['K-DBS-0001', 'Ault et al., Principles of Data Science, ch. 1'],
  ['K-DBS-0003', 'Ault et al., Principles of Data Science, ch. 1'],
  ['K-MKT-0440', 'Kotler et al., Principles of Marketing, ch. 6, p. 235'],
]);

describe('findConceptCodes', () => {
  it('lists distinct codes in order', () => {
    expect(findConceptCodes('(K-MKT-0440, K-DBS-0001) and K-MKT-0440')).toEqual([
      'K-MKT-0440',
      'K-DBS-0001',
    ]);
    expect(findConceptCodes(undefined)).toEqual([]);
    expect(findConceptCodes('no codes here')).toEqual([]);
  });
});

describe('replaceConceptCodes', () => {
  it('collapses a group of codes from one book into one reference', () => {
    expect(replaceConceptCodes('Models (K-DBS-0001, K-DBS-0003)', refs)).toBe(
      'Models (Ault et al., Principles of Data Science, ch. 1)'
    );
  });

  it('joins distinct references in a group with semicolons', () => {
    expect(replaceConceptCodes('x [K-DBS-0001; K-MKT-0440]', refs)).toBe(
      'x [Ault et al., Principles of Data Science, ch. 1; Kotler et al., Principles of Marketing, ch. 6, p. 235]'
    );
  });

  it('replaces a bare code and leaves unknown codes as stored', () => {
    expect(replaceConceptCodes('See K-MKT-0440 and K-XXX-0001.', refs)).toBe(
      'See Kotler et al., Principles of Marketing, ch. 6, p. 235 and K-XXX-0001.'
    );
    expect(replaceConceptCodes('(K-DBS-0001, K-XXX-0001)', refs)).toBe(
      '(Ault et al., Principles of Data Science, ch. 1, K-XXX-0001)'
    );
  });

  it('accepts a plain record as well as a map', () => {
    expect(replaceConceptCodes('K-MKT-0440', { 'K-MKT-0440': 'R' })).toBe('R');
  });
});
