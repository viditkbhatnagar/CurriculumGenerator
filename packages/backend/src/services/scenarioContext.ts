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
  /**
   * The ONE city this company is based in.
   *
   * A list let each of a module's two independent calls pick differently: Vallonia Health was
   * in Milan in one case and Amsterdam in its pair. Same defect as the headcount drift — a
   * standing fact about a company cannot be left to a per-call choice.
   */
  city: string;
  /** Sector for the organisation, varied independently of region. */
  industry: string;
  /** Rough size, so the programme is not entirely large corporates. */
  size: string;
  /**
   * The company's fixed baseline figures.
   *
   * A module's two case studies are separate model calls that never see each other, so each
   * invented its own numbers for the same company: Khaleej Renewables had 6,500 employees in
   * one case and 7,800 in its pair, and Silverbirch Publishing moved from 2,500 shipments a
   * month to 400. Stating the figures once, and requiring both cases to use them, is the only
   * way two independent calls can agree.
   */
  headcount: number;
  /** The fictitious organisation this module's scenarios are about. */
  organisation: string;
}

interface Organisation {
  name: string;
  /**
   * The sector this company is in — carried WITH the name, not chosen separately.
   *
   * Industry used to be a separate rotation indexed off the module number, so it collided
   * with names that already imply a sector: "Broadleaf Utilities is a fashion and apparel
   * scale-up", "Cortado Foods... construction and real estate", "Vantage Rail is a healthcare
   * services SME", "Kilimanjaro Telecom... education technology". The reviewer caught all
   * four. A name and its industry are one fact, so they are stored as one.
   */
  industry: string;
}

interface Region {
  region: string;
  currency: string;
  cities: string[];
  /**
   * Organisations plausible for THIS region.
   *
   * Kept per-region rather than in one pool: a flat list indexed independently of the region
   * produced "Nordwind Energie" as a UK company and "Zayed Logistics Group" as an EU one,
   * which an academic reviewer would notice immediately.
   */
  organisations: Organisation[];
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
    cities: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Riyadh', 'Doha'],
    organisations: [
      { name: 'Al Noor Trading', industry: 'logistics and freight forwarding' },
      { name: 'Zayed Industrial Group', industry: 'industrial manufacturing' },
      { name: 'Falcon Bay Hospitality', industry: 'hospitality and tourism' },
      { name: 'Sahara Foods', industry: 'food and beverage manufacturing' },
      { name: 'Gulf Meridian Health', industry: 'healthcare services' },
      { name: 'Khaleej Renewables', industry: 'renewable energy' },
      { name: 'Marina Heights Property', industry: 'construction and real estate' },
    ],
  },
  {
    region: 'Europe (EU)',
    currency: 'EUR',
    cities: ['Amsterdam', 'Berlin', 'Madrid', 'Warsaw', 'Milan'],
    organisations: [
      { name: 'Nordwind Energie', industry: 'renewable energy' },
      { name: 'Vallonia Health', industry: 'healthcare services' },
      { name: 'Brava Mobility', industry: 'automotive and mobility' },
      { name: 'Lindgren Textiles', industry: 'fashion and apparel' },
      { name: 'Cortado Foods', industry: 'food and beverage manufacturing' },
      { name: 'Alpenblick Logistik', industry: 'logistics and freight forwarding' },
      { name: 'Delfland Analytics', industry: 'professional and consulting services' },
    ],
  },
  {
    region: 'Asia-Pacific',
    currency: 'SGD or INR',
    cities: ['Singapore', 'Bengaluru', 'Kuala Lumpur', 'Tokyo'],
    organisations: [
      { name: 'Sunda Pacific Freight', industry: 'logistics and freight forwarding' },
      { name: 'Kavitha Agritech', industry: 'agriculture and agri-tech' },
      { name: 'Marina Bay Analytics', industry: 'professional and consulting services' },
      { name: 'Sakura Home Goods', industry: 'retail and e-commerce' },
      { name: 'Rangoli Apparel', industry: 'fashion and apparel' },
      { name: 'Straits Clinics', industry: 'healthcare services' },
      { name: 'Himalaya Learning', industry: 'education technology' },
    ],
  },
  {
    region:
      'jurisdiction-neutral (do not name a country; use generic settings and a neutral currency reference)',
    currency: 'a neutral unit — write "USD" or simply "currency units"',
    cities: ['unnamed — refer to "the head office"', '"the regional hub"'],
    organisations: [
      { name: 'Orbit Learning', industry: 'education technology' },
      { name: 'Waypoint Consulting', industry: 'professional and consulting services' },
      { name: 'Solstice Renewables', industry: 'renewable energy' },
      { name: 'Lumen Diagnostics', industry: 'healthcare services' },
      { name: 'Anchor Point Shipping', industry: 'logistics and freight forwarding' },
      { name: 'Vantage Rail', industry: 'rail transport and infrastructure' },
      { name: 'Talos Engineering', industry: 'industrial manufacturing' },
    ],
  },
  {
    region: 'United Kingdom',
    currency: 'GBP',
    cities: ['Manchester', 'Bristol', 'Leeds', 'Glasgow'],
    organisations: [
      { name: 'Northgate Manufacturing', industry: 'industrial manufacturing' },
      { name: 'Thames Valley Care', industry: 'healthcare services' },
      { name: 'Kestrel Media', industry: 'media and entertainment' },
      { name: 'Broadleaf Utilities', industry: 'utilities and energy networks' },
      { name: 'Silverbirch Publishing', industry: 'publishing and media' },
      { name: 'Harbour & Fields', industry: 'retail and e-commerce' },
      { name: 'Highfield Dairy', industry: 'food and beverage manufacturing' },
    ],
  },
  {
    region: 'Africa / Middle East (non-GCC)',
    currency: 'USD or local currency',
    cities: ['Nairobi', 'Cairo', 'Casablanca', 'Johannesburg'],
    organisations: [
      { name: 'Serengeti Fresh', industry: 'agriculture and agri-tech' },
      { name: 'Nile Delta Logistics', industry: 'logistics and freight forwarding' },
      { name: 'Atlas Coast Construction', industry: 'construction and real estate' },
      { name: 'Baobab Financial', industry: 'financial services' },
      { name: 'Rift Valley Agri', industry: 'agriculture and agri-tech' },
      { name: 'Kilimanjaro Telecom', industry: 'telecommunications' },
      { name: 'Sahel Solar', industry: 'renewable energy' },
    ],
  },
  {
    region: 'North America',
    currency: 'USD or CAD',
    cities: ['Toronto', 'Chicago', 'Austin', 'Vancouver'],
    organisations: [
      { name: 'Cascadia Outfitters', industry: 'retail and e-commerce' },
      { name: 'Great Lakes Robotics', industry: 'industrial automation' },
      { name: 'Sierra Foods', industry: 'food and beverage manufacturing' },
      { name: 'Copperline Telecom', industry: 'telecommunications' },
      { name: 'Ironwood Property', industry: 'construction and real estate' },
      { name: 'Peregrine Insurance', industry: 'financial services' },
      { name: 'Verdant Grocers', industry: 'retail and e-commerce' },
    ],
  },
];

/** Headcount for each size band, in the same order — one fact, stated once. */
const SIZE_HEADCOUNT = [40, 200, 800, 4200, 25, 300];

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
  const org = region.organisations[lap % region.organisations.length];
  // Derived from the size band so the headcount and the description cannot contradict
  // each other, and deterministic so a regenerated module keeps the same company.
  const sizeIndex = (i * 5 + 2) % SIZES.length;
  const headcount = SIZE_HEADCOUNT[sizeIndex];
  return {
    region: region.region,
    currency: region.currency,
    // One city, chosen deterministically, so both of a module's cases agree on it.
    city: region.cities[(i * 2 + lap) % region.cities.length],
    // The industry comes from the company, not from a parallel rotation. Rotating it
    // separately produced "Broadleaf Utilities, a fashion and apparel scale-up".
    industry: org.industry,
    size: SIZES[sizeIndex],
    headcount,
    organisation: org.name,
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
Based in: ${profile.city}

RULES ON SETTING — these are requirements, not suggestions:
- Use ${profile.organisation} as the organisation in this module's scenarios. Do NOT invent a
  different company, and do NOT reuse a company from another module.
- ${profile.organisation} operates in ${profile.industry}. Everything about it must fit that
  sector — do not describe it as being in any other industry.
- FIXED FACTS about this company. Every case study for this module must use these exact
  figures, because another case study is being written about the same company and the two
  must agree:
    * Headcount: approximately ${profile.headcount} employees. Use this number, not another.
    * Head office: ${profile.city}. Do not relocate the company to another city.
    * Size and character: ${profile.size}
    * Sector: ${profile.industry}
  Any other baseline figure you introduce (sites, volumes, revenue) should be presented as
  specific to THIS case's situation, not as a standing fact about the company.
- Set the scenario in ${profile.region}. Use ${profile.currency} for all monetary figures.
- UK English SPELLING is the house style ("organisation", "analyse", "programme") and applies
  everywhere. It is a spelling convention only: it does NOT mean the scenario is British, and
  it must not lead to UK companies, UK cities, GBP, or UK regulators.
- LAW AND REGULATORS. ${
    profile.region.startsWith('United Kingdom')
      ? 'This scenario IS set in the UK, so UK statutes are appropriate where the module covers them.'
      : `This scenario is NOT set in the UK. Do NOT cite the UK Bribery Act, the Equality Act, UK GDPR, the FCA, HMRC or Companies House — not as examples, not as benchmarks, and not as "aligned with" or "consistent with" a UK standard. A reviewer found a Nairobi construction case aligning its compliance to the UK Bribery Act and a Gulf food producer doing the same; both read as the UK slipping back in by habit. Where the module genuinely covers regulation, either name an instrument that applies in ${profile.region}, or state the underlying principle (for example "anti-bribery controls covering facilitation payments and third-party due diligence") without attaching it to any country.`
  }
- Name a country's laws or regulators ONLY where the module's own topics or outcomes make
  that jurisdiction relevant. Where a legal point is general, state the principle.
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

/** UK statutes and regulators that kept appearing in scenarios set elsewhere. */
const UK_LEGAL_MARKERS = [
  'Bribery Act',
  'Equality Act',
  'UK GDPR',
  'Companies House',
  'HMRC',
  'Financial Conduct Authority',
];

/**
 * Case studies that cite UK law while being set outside the UK.
 *
 * The prompt forbids this by name, and the model does it anyway — a Nairobi construction firm
 * and a Gulf food producer both "aligned to UK Bribery Act principles", and an Italian
 * healthcare SME did the same on the very next run after the rule was tightened. An
 * instruction the model can quietly ignore is not a guarantee, so the result is measured
 * rather than assumed, and the author is told which cases to look at.
 */
export function ukLawInNonUkCases(
  caseStudies: any[],
  profileFor: (index: number) => ScenarioProfile,
  moduleIndexOf: (moduleId: string) => number
): { moduleId: string; organisation: string; markers: string[] }[] {
  const out: { moduleId: string; organisation: string; markers: string[] }[] = [];
  for (const cs of caseStudies || []) {
    const idx = moduleIndexOf(String(cs?.moduleId || ''));
    if (idx < 0) continue;
    const profile = profileFor(idx);
    if (profile.region.startsWith('United Kingdom')) continue;
    // Only the prose this step WROTE. `linkedTopics`, `linkedMLOs` and `linkedModules` are
    // copied from the approved Step 4 curriculum, and two of this programme's module topics
    // are literally "UK Bribery Act and anti-corruption" and "Ethics, compliance and conduct
    // (including UK Bribery Act)". Scanning the whole record flagged those back at the author
    // as defects and sent the repair pass off to rewrite correct content — when her own rule
    // is that national law belongs wherever "explicitly relevant to the approved module
    // topics or MLOs", which is precisely what those are.
    const narrative = [
      cs?.title,
      cs?.scenario,
      cs?.organizationalContext,
      cs?.backgroundInformation,
      cs?.challengeDescription,
      cs?.suggestedApproach,
      cs?.sampleSolution,
      cs?.teachingNote,
      cs?.usageGuidance,
      ...(Array.isArray(cs?.discussionPrompts) ? cs.discussionPrompts : []),
      ...(Array.isArray(cs?.exhibitList)
        ? cs.exhibitList.map((e: any) => `${e?.title ?? ''} ${e?.description ?? ''}`)
        : []),
    ]
      .filter(Boolean)
      .join(' ');
    const markers = UK_LEGAL_MARKERS.filter((m) => narrative.includes(m));
    if (markers.length > 0) {
      out.push({
        moduleId: String(cs.moduleId),
        organisation: String(cs.brandName || cs.organizationName || profile.organisation),
        markers,
      });
    }
  }
  return out;
}

/**
 * The extra instruction given when regenerating a case that cited UK law it should not have.
 *
 * Quoting the violation back is the part that works. The standing rule already forbids these
 * statutes by name, and the model still produced them three runs running — the Bribery Act
 * is simply the canonical anti-bribery reference and it surfaces whenever a scenario touches
 * compliance. Naming what it actually wrote, and what to write instead, is a different
 * instruction from a rule it has already demonstrated it will not follow unprompted.
 */
export function ukLawRepairNote(markers: string[], region: string): string {
  return [
    `!! THIS CASE WAS REJECTED. Your previous version cited ${markers.join(' and ')}.`,
    `This scenario is set in ${region}, NOT the United Kingdom. UK legislation and UK`,
    'regulators must not appear at all — not as law, not as an example, not as a benchmark,',
    'and not as something the organisation is "aligned with" or "consistent with".',
    '',
    'Rewrite the compliance and regulatory content so that it either:',
    `  (a) names an instrument or regulator that genuinely applies in ${region}, or`,
    '  (b) states the underlying principle without attaching it to any country — for example',
    '      "anti-bribery controls covering facilitation payments, gifts and hospitality, and',
    '      third-party due diligence" rather than naming a national statute.',
    '',
    'Keep everything else about the case — the organisation, its sector, its headcount, its',
    'city, the scenario and the teaching intent — exactly as it was.',
  ].join('\n');
}
