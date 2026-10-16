import { creditsForHours, hoursPerCredit } from '../utils/credits';

describe("a module's credits in the programme's own system", () => {
  it('uses each system’s hours per credit, not the UK rule for all', () => {
    expect(creditsForHours(150, 'uk_credits')).toBe(15);
    expect(creditsForHours(150, 'ects')).toBe(6);
    expect(creditsForHours(135, 'us_semester')).toBe(3);
    expect(creditsForHours(25, 'ects')).toBe(1);
  });

  it('defaults to UK credits and gives none to a non-credit programme', () => {
    expect(hoursPerCredit(undefined)).toBe(10);
    expect(creditsForHours(120, 'non_credit')).toBeUndefined();
    expect(creditsForHours(0, 'ects')).toBeUndefined();
  });
});
