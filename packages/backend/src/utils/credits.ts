/**
 * Hours per credit in each credit system, and a module's credits from its hours.
 *
 * Step 4 gave every module `totalHours / 10` credits, the UK rule, whatever the programme's
 * system, so an ECTS or US programme's module credits were wrong (Rejin's audit, 16 October
 * 2026). Pure, so it can be tested.
 */

// Support both frontend ('uk') and backend ('uk_credits') naming
export const CREDIT_MULTIPLIERS: Record<string, number> = {
  uk: 10, // Frontend naming
  uk_credits: 10, // 1 UK credit = 10 hours
  ects: 25, // 1 ECTS = 25 hours (using lower bound)
  us_semester: 45, // 1 US credit = 45 total hours
  non_credit: 1, // Direct hours entry
};

export function hoursPerCredit(system: string | undefined): number {
  return CREDIT_MULTIPLIERS[system || 'uk_credits'] || CREDIT_MULTIPLIERS.uk_credits;
}

/** A module's credits, to one decimal place; undefined for a programme that is not credit-bearing. */
export function creditsForHours(hours: unknown, system: string | undefined): number | undefined {
  const h = Number(hours);
  if (!h || system === 'non_credit') return undefined;
  return Math.round((h / hoursPerCredit(system)) * 10) / 10;
}
