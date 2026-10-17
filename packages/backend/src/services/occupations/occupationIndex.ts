/**
 * Matching job roles to national occupations by meaning.
 *
 * Each occupation (occupationParsers) is embedded once from its title, description, first tasks
 * and other names; a programme's job roles are embedded the same way, and each role is matched to
 * its closest occupations in each country. Vectors are the model's 1,536-dimension embeddings
 * shortened to 512 and renormalised, which is how OpenAI's text-embedding-3 models shorten them
 * themselves; the whole index then fits in about 14 MB, so it is searched in memory.
 *
 * Pure, so it can be tested; storage, embedding calls and caching are in occupationStore.
 */
import crypto from 'crypto';
import type { OccupationCountry, OccupationRecord, OccupationSystem } from './occupationParsers';

export const INDEX_DIMENSIONS = 512;
/** Matches kept per role and country. */
export const MATCHES_PER_COUNTRY = 3;
/**
 * Cosine similarity below which an occupation is not a match. Calibrated on production after
 * the first sync (see occupationStore): related role and occupation texts score well above it,
 * unrelated ones below.
 */
export const MATCH_FLOOR = 0.4;

export const COUNTRIES: { country: OccupationCountry; system: OccupationSystem; name: string }[] = [
  { country: 'IN', system: 'NCO 2015', name: 'India' },
  { country: 'US', system: 'O*NET-SOC 2019', name: 'United States' },
  { country: 'UK', system: 'UK SOC 2020', name: 'United Kingdom' },
  { country: 'SG', system: 'SSOC 2024', name: 'Singapore' },
];

const MAX_TEXT = 2000;

/** The text an occupation is embedded from. */
export function occupationText(o: OccupationRecord): string {
  const parts = [
    `${o.title}.`,
    o.description,
    o.tasks.slice(0, 6).join(' '),
    o.alternateTitles.length ? `Also called: ${o.alternateTitles.slice(0, 10).join(', ')}.` : '',
  ];
  return parts.filter(Boolean).join(' ').slice(0, MAX_TEXT);
}

/** The text a job role is embedded from. */
export function roleText(role: { title?: string; description?: string; tasks?: string[] }) {
  return [`${role.title || ''}.`, role.description || '', (role.tasks || []).join(' ')]
    .filter((s) => s && s !== '.')
    .join(' ')
    .slice(0, MAX_TEXT);
}

/** Identifies the text and shortening a stored vector was made from, so a sync redoes changes. */
export function textHash(text: string, model: string): string {
  return crypto.createHash('sha1').update(`${model}|${INDEX_DIMENSIONS}|${text}`).digest('hex');
}

/** A vector cut to `dims` and scaled back to length 1. */
export function shorten(vector: number[], dims = INDEX_DIMENSIONS): number[] {
  const cut = vector.slice(0, dims);
  const norm = Math.sqrt(cut.reduce((s, v) => s + v * v, 0)) || 1;
  return cut.map((v) => v / norm);
}

export interface IndexEntry {
  country: OccupationCountry;
  system: OccupationSystem;
  code: string;
  title: string;
  vector: Float32Array;
}

export interface OccupationMatch {
  country: OccupationCountry;
  system: OccupationSystem;
  code: string;
  title: string;
  similarity: number;
}

const dot = (a: ArrayLike<number>, b: ArrayLike<number>) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};

/** The closest occupations to a (shortened, normalised) query vector, per country. */
export function topMatches(
  query: ArrayLike<number>,
  entries: IndexEntry[],
  { perCountry = MATCHES_PER_COUNTRY, floor = MATCH_FLOOR } = {}
): OccupationMatch[] {
  const best = new Map<OccupationCountry, OccupationMatch[]>();
  for (const e of entries) {
    const similarity = dot(query, e.vector);
    if (similarity < floor) continue;
    const list = best.get(e.country) || [];
    list.push({
      country: e.country,
      system: e.system,
      code: e.code,
      title: e.title,
      similarity: Math.round(similarity * 1000) / 1000,
    });
    list.sort((a, b) => b.similarity - a.similarity);
    if (list.length > perCountry) list.length = perCountry;
    best.set(e.country, list);
  }
  return COUNTRIES.flatMap(({ country }) => best.get(country) || []);
}

/** What a programme's job roles were matched to (stored on the workflow as occupationEvidence). */
export interface OccupationEvidence {
  matchedAt: string | Date;
  floor: number;
  roles: { role: string; matches: OccupationMatch[] }[];
}

/**
 * Issues for the subject expert: roles matched to no occupation in any country, and countries
 * in which no role found a match.
 */
export function occupationEvidenceIssues(
  evidence: OccupationEvidence | undefined,
  hasJobRoles: boolean
): { kind: 'review' | 'not_checked'; issue: string }[] {
  if (!hasJobRoles) return [];
  if (!evidence?.roles?.length) {
    return [
      {
        kind: 'not_checked',
        issue:
          'The job roles have not been matched to national occupation codes (India, US, UK, Singapore)',
      },
    ];
  }
  const issues: { kind: 'review'; issue: string }[] = [];
  const unmatched = evidence.roles.filter((r) => !r.matches.length).map((r) => r.role);
  if (unmatched.length) {
    issues.push({
      kind: 'review',
      issue: `No national occupation matches these job roles, so their skills rest on the AI model alone: ${unmatched.join(', ')}`,
    });
  }
  const covered = new Set(evidence.roles.flatMap((r) => r.matches.map((m) => m.country)));
  const missing = COUNTRIES.filter((c) => !covered.has(c.country)).map((c) => c.name);
  if (unmatched.length < evidence.roles.length && missing.length) {
    issues.push({
      kind: 'review',
      issue: `No job role matches an occupation in ${missing.join(', ')}`,
    });
  }
  return issues;
}
