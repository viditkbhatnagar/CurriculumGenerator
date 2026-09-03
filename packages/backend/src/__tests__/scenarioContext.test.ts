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

describe("the reviewer's second round of scenario defects", () => {
  it('gives a company an industry that fits its name', () => {
    // She found four: "Broadleaf Utilities is a fashion and apparel scale-up", "Cortado
    // Foods... construction and real estate", "Vantage Rail is a healthcare services SME",
    // "Kilimanjaro Telecom... education technology". Industry used to be rotated separately
    // from the name and simply collided with it.
    const expected = {
      'Broadleaf Utilities': 'utilities',
      'Cortado Foods': 'food',
      'Vantage Rail': 'rail',
      'Kilimanjaro Telecom': 'telecommunications',
      'Silverbirch Publishing': 'publishing',
      'Khaleej Renewables': 'renewable',
      'Straits Clinics': 'healthcare',
      'Atlas Coast Construction': 'construction',
    };
    const seen = {};
    for (let i = 0; i < 46; i += 1) {
      const p = scenarioProfileFor(i);
      seen[p.organisation] = p.industry;
    }
    for (const [org, mustContain] of Object.entries(expected)) {
      if (seen[org]) expect(seen[org]).toContain(mustContain);
    }
  });

  it('pins one headcount per company so its two cases cannot disagree', () => {
    // Khaleej Renewables had 6,500 employees in one case and 7,800 in its pair; the two
    // cases are separate model calls that never see each other.
    const p = scenarioProfileFor(5);
    expect(typeof p.headcount).toBe('number');
    expect(p.headcount).toBeGreaterThan(0);
    const text = scenarioDirective(p, 'Any module');
    expect(text).toContain('approximately ' + p.headcount + ' employees');
    expect(text).toMatch(/must use these exact/i);
  });

  it('forbids UK statutes outside the UK, and permits them inside it', () => {
    // A Nairobi construction case aligned its compliance to the UK Bribery Act, and a Gulf
    // food producer did the same.
    const all = Array.from({ length: 46 }, (_, i) => scenarioProfileFor(i));
    const uk = all.find((p) => p.region.startsWith('United Kingdom'));
    const nonUk = all.find((p) => p.region.startsWith('Africa'));
    expect(scenarioDirective(uk, 'M')).toContain('This scenario IS set in the UK');
    const other = scenarioDirective(nonUk, 'M');
    expect(other).toContain('Do NOT cite the UK Bribery Act');
    expect(other).toContain('aligned with');
  });

  it('states the sector as a requirement, not a suggestion', () => {
    const p = scenarioProfileFor(3);
    const text = scenarioDirective(p, 'M');
    expect(text).toContain('operates in ' + p.industry);
    expect(text).toMatch(/do not describe it as being in any other industry/i);
  });
});
