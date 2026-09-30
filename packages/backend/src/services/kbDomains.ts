/**
 * Knowledge-base domain names, as stored and as the prompts ask for them.
 *
 * Every workflow step asks for domains under names the knowledge base never used:
 * 'curriculum-design', 'competency-framework', 'standards', 'accreditations', 'typeOfOutputs',
 * 'Subject Books'. The stored values are the underscored names below. ragEngine then passed
 * only the FIRST requested domain as an exact match, so even with a working vector index every
 * search was filtered down to nothing.
 *
 * Pure, no imports, so it can be tested.
 */

export const KB_DOMAINS = [
  'accreditation_standards',
  'competency_frameworks',
  'curriculum_design',
  'education_standards',
  'output_templates',
  'uk_diploma_programs',
] as const;

export type KBDomain = (typeof KB_DOMAINS)[number];

const ALIASES: Record<string, KBDomain[]> = {
  'curriculum-design': ['curriculum_design'],
  'competency-framework': ['competency_frameworks'],
  standards: ['education_standards', 'accreditation_standards'],
  accreditation: ['accreditation_standards'],
  accreditations: ['accreditation_standards'],
  typeofoutputs: ['output_templates'],
  'uk-diploma-programs': ['uk_diploma_programs'],
};

const isStoredDomain = (name: string): name is KBDomain =>
  (KB_DOMAINS as readonly string[]).includes(name);

/**
 * The stored domains a request refers to. Returns undefined when nothing was requested or
 * nothing requested exists, meaning "search the whole knowledge base": filtering to an empty
 * set would return no context at all, which is the failure this replaces.
 */
export function resolveKBDomains(requested?: string[]): KBDomain[] | undefined {
  if (!requested?.length) return undefined;
  const resolved = new Set<KBDomain>();
  for (const raw of requested) {
    const name = (raw || '').trim();
    if (isStoredDomain(name)) {
      resolved.add(name);
      continue;
    }
    const key = name.toLowerCase().replace(/[\s_]+/g, '-');
    for (const domain of ALIASES[key] || ALIASES[key.replace(/-/g, '')] || []) {
      resolved.add(domain);
    }
  }
  return resolved.size ? Array.from(resolved) : undefined;
}
