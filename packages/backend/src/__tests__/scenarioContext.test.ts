/**
 * Where scenarios are set, and which organisation they are about.
 *
 * Both rules exist because the programme's reviewer measured the output and found it
 * lopsided: 7,328 UK markers across Steps 7 and 8 with zero references to the UAE on a Dubai
 * programme, and "Meridian Retail" in 59 of 89 case studies.
 */

import {
  scenarioProfileFor,
  scenarioDirective,
  INTERNATIONAL_BALANCE_RULE,
} from '../services/scenarioContext';

describe('scenarioProfileFor', () => {
  it('is deterministic, so a regenerated module keeps its organisation', () => {
    // An author who regenerates one module should not find the company renamed under them.
    expect(scenarioProfileFor(7)).toEqual(scenarioProfileFor(7));
  });

  it('does not make any one region the default', () => {
    const regions = Array.from({ length: 46 }, (_, i) => scenarioProfileFor(i).region);
    const counts = regions.reduce<Record<string, number>>((acc, r) => {
      acc[r] = (acc[r] || 0) + 1;
      return acc;
    }, {});
    // Seven regions over 46 modules: none should hold more than a fifth of the programme.
    // Before this, one region held effectively all of it.
    const worst = Math.max(...Object.values(counts));
    expect(worst).toBeLessThanOrEqual(Math.ceil(46 / 5));
  });

  it('includes the UAE/GCC, which the programme had none of', () => {
    const regions = Array.from({ length: 46 }, (_, i) => scenarioProfileFor(i).region);
    expect(regions.some((r) => r.includes('UAE'))).toBe(true);
  });

  it('keeps the UK in the rotation without letting it dominate', () => {
    // The objection was to the UK being the default, not to its presence.
    const regions = Array.from({ length: 46 }, (_, i) => scenarioProfileFor(i).region);
    const uk = regions.filter((r) => r.includes('United Kingdom')).length;
    expect(uk).toBeGreaterThan(0);
    expect(uk).toBeLessThanOrEqual(Math.ceil(46 / 5));
  });

  it('gives 46 consecutive modules 46 distinct organisations', () => {
    // This is the fix for "Meridian Retail" appearing in 59 of 89 cases: names are assigned,
    // not invented independently ninety-two times over.
    const names = Array.from({ length: 46 }, (_, i) => scenarioProfileFor(i).organisation);
    expect(new Set(names).size).toBe(46);
  });

  it('varies industry and size independently of region', () => {
    const sameRegion = [0, 7, 14, 21].map((i) => scenarioProfileFor(i));
    expect(new Set(sameRegion.map((p) => p.region)).size).toBe(1);
    // Otherwise every UAE case would be a retailer.
    expect(new Set(sameRegion.map((p) => p.industry)).size).toBeGreaterThan(1);
  });

  it('survives a nonsense index rather than throwing', () => {
    for (const bad of [-3, NaN, 1.7]) {
      expect(scenarioProfileFor(bad as number).organisation).toBeTruthy();
    }
  });
});

describe('scenarioDirective', () => {
  const text = scenarioDirective(scenarioProfileFor(0), 'Introduction to Management');

  it('names the organisation and forbids inventing another', () => {
    expect(text).toContain(scenarioProfileFor(0).organisation);
    expect(text).toMatch(/Do NOT invent a\s+different company/i);
  });

  it('separates UK spelling from a UK setting', () => {
    // The single line "Use UK English spelling throughout" is what produced the bias.
    expect(text).toMatch(/SPELLING/);
    expect(text).toMatch(/does NOT mean the scenario is\s+British/i);
  });

  it('restricts national law to modules where it is relevant', () => {
    expect(text).toMatch(/Bribery Act/);
    expect(text).toMatch(/ONLY where the module's own topics or outcomes/i);
  });

  it('names the module so the setting is visibly per-module', () => {
    expect(text).toContain('Introduction to Management');
  });
});

describe('INTERNATIONAL_BALANCE_RULE', () => {
  it("states the balance in the reviewer's own terms", () => {
    expect(INTERNATIONAL_BALANCE_RULE).toMatch(/UAE\/GCC/);
    expect(INTERNATIONAL_BALANCE_RULE).toMatch(/Asia-Pacific/);
    expect(INTERNATIONAL_BALANCE_RULE).toMatch(/jurisdiction-neutral/);
  });
});
