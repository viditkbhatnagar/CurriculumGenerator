/**
 * A programme is listed and headed by its Step 1 title, whichever route changed the title.
 */
import { programmeNameFor } from '../utils/programmeName';

describe('programmeNameFor', () => {
  it('renames the programme to its Step 1 title', () => {
    expect(
      programmeNameFor(
        'Certificate Programme in Applied Fashion Design',
        ' Diploma in Applied Fashion Design '
      )
    ).toBe('Diploma in Applied Fashion Design');
  });

  it('changes nothing when they already agree, or when there is no title', () => {
    expect(programmeNameFor('BBA', 'BBA')).toBeUndefined();
    expect(programmeNameFor('BBA', '')).toBeUndefined();
    expect(programmeNameFor('BBA', undefined)).toBeUndefined();
  });
});
