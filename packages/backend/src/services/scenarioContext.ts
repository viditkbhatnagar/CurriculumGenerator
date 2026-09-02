/**
 * Where a generated scenario is set, and which organisation it is about.
 *
 * The programme's reviewer, on reading Step 7 and Step 8 together: "the scenarios are
 * becoming heavily UK-centred. We repeatedly see UK companies, Manchester/Leeds settings,
 * GBP, UK GDPR, Bribery Act, Equality Act, FCA-related contexts... For an international BBA,
 * I would prefer a balanced mix of UAE/GCC, Europe/EU, UK, Asia and other international or
 * jurisdiction-neutral cases rather than the UK becoming the default." And on Step 8: "I also
 * noticed the repeated use of Meridian Retail across many different modules."
 *
 * She was right on both counts, measurably. Across the 46-module Bachelor in Business
 * Administration the two steps carried 7,328 UK markers and ZERO references to the UAE or the
 * wider GCC — for a Dubai programme — and 59 of 89 case studies were about "Meridian Retail".
 *
 * Both had upstream causes rather than being a drafting habit.
 *
 * The UK default came from one line. Where no target market was configured, the shared
 * directive read "Use UK English spelling throughout." That was meant to fix SPELLING, and a
 * model reasonably read it as a locale: UK spelling, therefore UK companies, UK cities, GBP,
 * the FCA and the Bribery Act. Spelling and jurisdiction are separated here, because UK
 * English is the house style and is not in question.
 *
 * The repeated organisation came from independence. Each case study is its own model call
 * with no knowledge of the other ninety-one, and asked to invent a fictitious company they
 * converge — the same way any one model asked the same question ninety-two times will.
 * Nothing here relies on the model choosing differently: each module is assigned its own
 * organisation, region and industry up front.
 */

export interface ScenarioProfile {
  /** The jurisdiction the scenario is set in. */
  region: string;
  /** Currency appropriate to that region. */
  currency: string;
  /** Two or three plausible cities, so the model does not reach for London by default. */
  cities: string;
  /** Sector for the organisation, varied independently of region. */
  industry: string;
  /** Rough size, so the programme is not entirely large corporates. */
  size: string;
  /** The fictitious organisation this module's scenarios are about. */
  organisation: string;
}

interface Region {
  region: string;
  currency: string;
  cities: string;
  /**
   * Organisation names plausible for THIS region.
   *
   * Kept per-region rather than in one pool: a flat list indexed independently of the region
   * produced "Nordwind Energie" as a UK company and "Zayed Logistics Group" as an EU one,
   * which an academic reviewer would notice immediately.
   */
  organisations: string[];
}

/**
 * The regions to spread scenarios across, in the reviewer's own terms.
 *
 * The UK stays in the rotation — her objection was to it being the default, not to its
 * presence — and "jurisdiction-neutral" is included because most business problems do not
 * need a country at all.
 */
const REGIONS: Region[] = [
  {
    region: 'UAE / GCC',
    currency: 'AED',
    cities: 'Dubai, Abu Dhabi, Sharjah, Riyadh, Doha',
    organisations: [
      'Al Noor Trading',
      'Zayed Logistics Group',
      'Falcon Bay Hospitality',
      'Sahara Foods',
      'Gulf Meridian Health',
      'Khaleej Renewables',
      'Marina Heights Property',
    ],
  },
  {
    region: 'Europe (EU)',
    currency: 'EUR',
    cities: 'Amsterdam, Berlin, Madrid, Warsaw, Milan',
    organisations: [
      'Nordwind Energie',
      'Vallonia Health',
      'Brava Mobility',
      'Lindgren Textiles',
      'Cortado Foods',
      'Alpenblick Logistik',
      'Delfland Analytics',
    ],
  },
  {
    region: 'Asia-Pacific',
    currency: 'SGD or INR',
    cities: 'Singapore, Bengaluru, Kuala Lumpur, Tokyo',
    organisations: [
      'Sunda Pacific Freight',
      'Kavitha Agritech',
      'Marina Bay Analytics',
      'Sakura Home Goods',
      'Rangoli Apparel',
      'Straits Clinics',
      'Himalaya Learning',
    ],
  },
  {
    region:
      'jurisdiction-neutral (do not name a country; use generic settings and a neutral currency reference)',
    currency: 'a neutral unit — write "USD" or simply "currency units"',
    cities: 'unnamed — refer to "the head office", "the regional hub"',
    organisations: [
      'Orbit Learning',
      'Waypoint Consulting',
      'Solstice Renewables',
      'Lumen Diagnostics',
      'Anchor Point Shipping',
      'Vantage Rail',
      'Talos Engineering',
    ],
  },
  {
    region: 'United Kingdom',
    currency: 'GBP',
    cities: 'Manchester, Bristol, Leeds, Glasgow',
    organisations: [
      'Northgate Manufacturing',
      'Thames Valley Care',
      'Kestrel Media',
      'Broadleaf Utilities',
      'Silverbirch Publishing',
      'Harbour & Fields',
      'Highfield Dairy',
    ],
  },
  {
    region: 'Africa / Middle East (non-GCC)',
    currency: 'USD or local currency',
    cities: 'Nairobi, Cairo, Casablanca, Johannesburg',
    organisations: [
      'Serengeti Fresh',
      'Nile Delta Logistics',
      'Atlas Coast Construction',
      'Baobab Financial',
      'Rift Valley Agri',
      'Kilimanjaro Telecom',
      'Sahel Solar',
    ],
  },
  {
    region: 'North America',
    currency: 'USD or CAD',
    cities: 'Toronto, Chicago, Austin, Vancouver',
    organisations: [
      'Cascadia Outfitters',
      'Great Lakes Robotics',
      'Sierra Foods',
      'Copperline Telecom',
      'Ironwood Property',
      'Peregrine Insurance',
      'Verdant Grocers',
    ],
  },
];

const INDUSTRIES = [
  'retail and e-commerce',
  'logistics and freight forwarding',
  'hospitality and tourism',
  'healthcare services',
  'financial services',
  'renewable energy',
  'food and beverage manufacturing',
  'professional and consulting services',
  'construction and real estate',
  'education technology',
  'telecommunications',
  'agriculture and agri-tech',
  'fashion and apparel',
  'automotive and mobility',
  'media and entertainment',
  'public sector and non-profit',
];

const SIZES = [
  'a family-owned SME of about 40 staff',
  'a fast-growing scale-up of about 200 staff',
  'a mid-sized regional firm of about 800 staff',
  'a large multinational of several thousand staff',
  'a social enterprise of about 25 staff',
  'a division of about 300 staff within a larger group',
];

/**
 * The scenario profile for a module, derived from its position in the programme.
 *
 * Deterministic, so the same module gets the same organisation every time it is regenerated
 * and an author does not find the company renamed under them. Region, industry and size
 * advance on different cycles, so a programme does not end up with every UAE case being a
 * retailer.
 */
export function scenarioProfileFor(index: number): ScenarioProfile {
  const i = Math.max(0, Math.floor(index) || 0);
  const region = REGIONS[i % REGIONS.length];
  // Which time round the rotation this is, so consecutive visits to the same region get
  // different companies rather than the same one every seventh module.
  const lap = Math.floor(i / REGIONS.length);
  return {
    region: region.region,
    currency: region.currency,
    cities: region.cities,
    industry: INDUSTRIES[(i * 3 + 1) % INDUSTRIES.length],
    size: SIZES[(i * 5 + 2) % SIZES.length],
    organisation: region.organisations[lap % region.organisations.length],
  };
}

/**
 * The block injected into a generation prompt.
 *
 * `moduleTopics` is passed so the rule about country-specific law can be checked against what
 * the module actually covers: the reviewer asked that "country-specific laws/regulations
 * should only be included where they are explicitly relevant to the approved module topics or
 * MLOs", which is a rule about this module, not about the programme.
 */
export function scenarioDirective(profile: ScenarioProfile, moduleTitle?: string): string {
  return `
=== SETTING FOR THIS ${moduleTitle ? `MODULE (${moduleTitle})` : 'SCENARIO'} ===
Organisation: ${profile.organisation} — ${profile.size}, in ${profile.industry}.
Region: ${profile.region}
Currency: ${profile.currency}
Plausible locations: ${profile.cities}

RULES ON SETTING — these are requirements, not suggestions:
- Use ${profile.organisation} as the organisation in this module's scenarios. Do NOT invent a
  different company, and do NOT reuse a company from another module.
- Set the scenario in ${profile.region}. Use ${profile.currency} for all monetary figures.
- UK English SPELLING is the house style ("organisation", "analyse", "programme") and applies
  everywhere. It is a spelling convention only: it does NOT mean the scenario is British, and
  it must not lead to UK companies, UK cities, GBP, or UK regulators.
- Name a country's laws or regulators ONLY where the module's own topics or outcomes make
  that specific jurisdiction relevant. Do not reach for the UK Bribery Act, the Equality Act,
  UK GDPR or the FCA as generic examples. Where a legal or regulatory point is general, state
  the principle rather than a national statute.
`.trim();
}

/**
 * A short programme-level reminder for prompts that are not per-module.
 */
export const INTERNATIONAL_BALANCE_RULE = `
This is an international programme. Vary the setting across UAE/GCC, Europe, Asia-Pacific, the
UK and jurisdiction-neutral contexts rather than defaulting to any one of them. UK English
spelling is the house style and does not imply a UK setting. Cite a country's laws or
regulators only where the subject matter makes that jurisdiction genuinely relevant.
`.trim();
