/**
 * Domains an administrator adds to the library.
 *
 * Incident: Athira Hari (India Learns, 19 November 2026) tried to add fashion textbooks and the
 * Add a book form offered only "Business & Management" and "AI, Data & Computing", and refused a
 * book with no domain. The domains were a fixed list in code.
 *
 * The built-in domains stay in knowledge/ontology and keep their keys. Domains added here are
 * stored in the `kbdomains` collection and merged after the built-in ones. A new domain needs
 * only a key and a name; areas are optional, and a domain with none gets one general area so a
 * book in it can still be ingested. Area names and codes must not clash with any other domain's,
 * because concepts are filed by area name and concept codes are built from the area code.
 *
 * `allDomains()` is synchronous and reads a cache that `refreshDomains()` fills from the
 * database; routes and the ingest worker refresh before they read it.
 */
import { Area, Domain, DOMAINS } from './ontology';
import { KbDomain } from './models';

const KEY_PATTERN = /^[a-z][a-z0-9-]{1,39}$/;
const MAX_AREAS = 30;
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'.split('');

export interface NewDomainInput {
  key?: unknown;
  name?: unknown;
  description?: unknown;
  areas?: unknown;
}

export type DomainCheck = { ok: true; domain: Domain } | { ok: false; error: string };

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');
const text = (v: unknown, max: number) =>
  String(v ?? '')
    .trim()
    .slice(0, max);

/** The first code from a three-letter base that no area uses yet. */
function freeCode(base: string, taken: Set<string>): string | undefined {
  const two = base.slice(0, 2);
  return [base, ...LETTERS.map((l) => two + l)].find((c) => !taken.has(c));
}

/** A domain with no areas of its own is given one general area, named after the domain. */
export function generalAreaFor(name: string, takenCodes: Set<string>): Area {
  const base = squash(name).toUpperCase().replace(/[0-9]/g, '').padEnd(3, 'X').slice(0, 3);
  return { code: freeCode(base, takenCodes) || 'GEN', name: `${name} (general)`, subAreas: [] };
}

function toArea(raw: any): Area | null {
  const name = text(raw?.name ?? raw, 80);
  if (!name) return null;
  const subAreas = (Array.isArray(raw?.subAreas) ? raw.subAreas : [])
    .map((s: unknown) => text(s, 80))
    .filter(Boolean)
    .slice(0, 20);
  return { code: text(raw?.code, 3).toUpperCase(), name, subAreas };
}

/**
 * Check a proposed domain against the domains that already exist and return it in full form
 * (areas coded, a general area supplied when none were given). Pure.
 */
export function validateNewDomain(input: NewDomainInput, existing: Domain[]): DomainCheck {
  const key = text(input.key, 40).toLowerCase();
  const name = text(input.name, 80);
  if (!KEY_PATTERN.test(key)) {
    return {
      ok: false,
      error:
        'The key must be 2 to 40 characters: lower-case letters, digits and hyphens, starting with a letter',
    };
  }
  if (!name) return { ok: false, error: 'A domain name is required' };
  if (existing.some((d) => d.key === key)) {
    return { ok: false, error: `A domain with the key "${key}" already exists` };
  }
  if (existing.some((d) => squash(d.name) === squash(name))) {
    return { ok: false, error: `A domain named "${name}" already exists` };
  }

  const rawAreas = Array.isArray(input.areas) ? input.areas : [];
  if (rawAreas.length > MAX_AREAS) {
    return { ok: false, error: `A domain can have at most ${MAX_AREAS} areas` };
  }
  const takenCodes = new Set(existing.flatMap((d) => d.areas.map((a) => a.code)));
  const takenNames = new Set(existing.flatMap((d) => d.areas.map((a) => squash(a.name))));
  const areas: Area[] = [];
  for (const raw of rawAreas) {
    const area = toArea(raw);
    if (!area) continue;
    if (takenNames.has(squash(area.name))) {
      return { ok: false, error: `The area "${area.name}" already exists in the library` };
    }
    if (!area.code) {
      const base = squash(area.name).toUpperCase().replace(/[0-9]/g, '').padEnd(3, 'X').slice(0, 3);
      const code = freeCode(base, takenCodes);
      if (!code) return { ok: false, error: `No free area code for "${area.name}"` };
      area.code = code;
    }
    if (!/^[A-Z]{3}$/.test(area.code)) {
      return { ok: false, error: `The area code "${area.code}" must be three letters` };
    }
    if (takenCodes.has(area.code)) {
      return { ok: false, error: `The area code "${area.code}" is already used` };
    }
    takenCodes.add(area.code);
    takenNames.add(squash(area.name));
    areas.push(area);
  }
  if (!areas.length) areas.push(generalAreaFor(name, takenCodes));
  const description = text(input.description, 400);
  return { ok: true, domain: { key, name, ...(description ? { description } : {}), areas } };
}

/** Built-in domains first, then stored ones; a stored domain never replaces a built-in key. */
export function mergeDomains(builtIn: Domain[], extra: Domain[]): Domain[] {
  const seen = new Set(builtIn.map((d) => d.key));
  const added = extra.filter((d) => {
    if (seen.has(d.key)) return false;
    seen.add(d.key);
    return true;
  });
  return [...builtIn, ...added];
}

let stored: Domain[] = [];

export const allDomains = (): Domain[] => mergeDomains(DOMAINS, stored);

/** Reload the stored domains. A failed read throws, leaving the last good list in place. */
export async function refreshDomains(): Promise<Domain[]> {
  const rows: any[] = await KbDomain.find().sort({ createdAt: 1 }).lean();
  stored = rows.map((r) => ({
    key: r.key,
    name: r.name,
    description: r.description || undefined,
    areas: (r.areas || []).map((a: any) => ({
      code: a.code,
      name: a.name,
      subAreas: a.subAreas || [],
    })),
  }));
  return allDomains();
}

/** Validate against everything that exists now and store the new domain. */
export async function addDomain(input: NewDomainInput, createdBy?: string): Promise<DomainCheck> {
  const current = await refreshDomains();
  const checked = validateNewDomain(input, current);
  if ('error' in checked) return checked;
  try {
    await KbDomain.create({ ...checked.domain, createdBy });
  } catch (error: any) {
    if (error?.code === 11000) {
      return { ok: false, error: `A domain with the key "${checked.domain.key}" already exists` };
    }
    throw error;
  }
  await refreshDomains();
  return checked;
}
