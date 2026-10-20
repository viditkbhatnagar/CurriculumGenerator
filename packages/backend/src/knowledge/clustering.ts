/**
 * Concepts across books: when two treatments are the same concept, how a concept's evidence
 * is ranked, and how important a concept is to its domain.
 *
 * Rejin's design (sections 3, 4, 10 and 11): without deduplication, "a query for competitive
 * strategy might return ten almost identical chunks explaining Five Forces ... whichever
 * concept appears in the greatest number of books dominates retrieval". So equivalent
 * treatments are merged into one concept, and a concept's importance is computed in code from
 * how many of the domain's books teach it and how deeply, never asked of the model.
 *
 * Pure, so it can be tested. The similarity thresholds are constants calibrated on production
 * (knowledge/routes: POST /calibrate) and recorded here with the evidence for them.
 */
import type { EvidenceRole, Importance, Treatment } from './models';

/** Words that name the kind of thing rather than the thing: "Five Forces model" = "Five Forces". */
const GENERIC_SUFFIX =
  /\s+(model|framework|theory|analysis|approach|method|technique|concept|principle|tool|process)$/;
const LEADING = /^(the|a|an)\s+/;

const singular = (w: string) =>
  w.length > 4 && w.endsWith('s') && !/(ss|us|is|ys)$/.test(w) ? w.slice(0, -1) : w;

/**
 * A comparison key for a concept name: lower case, possessives and bracketed abbreviations
 * removed, a leading article and a trailing generic word dropped, simple plurals singular.
 * "Porter's Five Forces Model" and "the five forces" share the key "porter five force"/"five
 * force"; the key is one signal among several, never the only one.
 */
export function conceptKey(name: string): string {
  let k = String(name || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/['’]s\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  k = k.replace(LEADING, '');
  for (let i = 0; i < 2; i++) k = k.replace(GENERIC_SUFFIX, '');
  return k.split(' ').filter(Boolean).map(singular).join(' ');
}

/** Keys a concept answers to: its name and each alias, plus the name without a leading eponym. */
export function keysFor(name: string, aliases: string[] = []): string[] {
  const keys = new Set<string>();
  for (const n of [name, ...aliases]) {
    const k = conceptKey(n);
    if (!k) continue;
    keys.add(k);
    // "porter five force" also answers to "five force".
    const words = k.split(' ');
    if (words.length >= 3) keys.add(words.slice(1).join(' '));
  }
  return Array.from(keys);
}

export function jaccard(a: string, b: string): number {
  const A = new Set(a.split(' ').filter(Boolean));
  const B = new Set(b.split(' ').filter(Boolean));
  if (!A.size || !B.size) return 0;
  let both = 0;
  for (const w of A) if (B.has(w)) both++;
  return both / (A.size + B.size - both);
}

export function dot(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += a[i] * b[i];
  return s;
}

/**
 * Cosine similarity at or above which two concepts in the same area are the same concept, on
 * 512-dimension text-embedding-3-large vectors of "name: definition". Below MERGE_BAND_LOW
 * they never merge; in between they merge only when their names share most words.
 * Provisional until calibrated (see knowledge/routes POST /calibrate).
 */
export const MERGE_SIMILARITY = 0.9;
export const MERGE_BAND_LOW = 0.84;
export const MERGE_NAME_OVERLAP = 0.5;

export interface Candidate {
  key: string;
  keys: string[];
  area: string;
  vector: ArrayLike<number>;
}

export interface Existing {
  id: string;
  key: string;
  keys: string[];
  area: string;
  vector: ArrayLike<number>;
}

/**
 * The existing concept a candidate is the same as, or null for a new concept. Concepts are
 * compared within their area only: "regression" in statistics and in software testing are
 * different things.
 */
export function matchConcept(
  c: Candidate,
  existing: Existing[]
): { id: string; why: string } | null {
  const sameArea = existing.filter((e) => e.area === c.area);
  const keyHit = sameArea.find((e) => e.keys.some((k) => c.keys.includes(k)));
  if (keyHit) return { id: keyHit.id, why: 'name' };
  let best: Existing | null = null;
  let bestSim = -1;
  for (const e of sameArea) {
    const sim = dot(c.vector, e.vector);
    if (sim > bestSim) {
      bestSim = sim;
      best = e;
    }
  }
  if (!best) return null;
  if (bestSim >= MERGE_SIMILARITY) return { id: best.id, why: `similarity ${bestSim.toFixed(3)}` };
  if (bestSim >= MERGE_BAND_LOW && jaccard(c.key, best.key) >= MERGE_NAME_OVERLAP) {
    return { id: best.id, why: `similarity ${bestSim.toFixed(3)} and shared name` };
  }
  return null;
}

const TREATMENT_RANK: Record<Treatment, number> = { mention: 0, treatment: 1, extended: 2 };

export interface EvidenceLike {
  bookId: string;
  treatment: Treatment;
  critique: boolean;
  pageLabelStart: string;
  pageLabelEnd: string;
  year?: number;
  level?: string;
}

const pageSpan = (e: EvidenceLike) => {
  const a = parseInt(e.pageLabelStart, 10);
  const b = parseInt(e.pageLabelEnd, 10);
  return Number.isFinite(a) && Number.isFinite(b) && b >= a ? b - a + 1 : 1;
};

/**
 * Roles for a concept's evidence (design section 11): the deepest, longest treatment is the
 * primary teaching source; the best treatment in up to two other books is supplementary;
 * a passage that criticises or qualifies the concept is critical; the rest are additional.
 * "Students don't need four nearly identical introductory readings."
 */
export function assignRoles<T extends EvidenceLike>(evidence: T[]): (T & { role: EvidenceRole })[] {
  const score = (e: T) =>
    TREATMENT_RANK[e.treatment] * 1000 + pageSpan(e) * 10 + (e.year || 0) / 1000;
  const order = evidence.map((e, i) => ({ e, i })).sort((a, b) => score(b.e) - score(a.e));
  const roles = new Array<EvidenceRole>(evidence.length).fill('additional');
  const primary = order.find((o) => !o.e.critique) || order[0];
  if (primary) roles[primary.i] = 'primary';
  const usedBooks = new Set(primary ? [primary.e.bookId] : []);
  let supplementary = 0;
  for (const o of order) {
    if (roles[o.i] !== 'additional') continue;
    if (o.e.critique) roles[o.i] = 'critical';
    else if (supplementary < 2 && !usedBooks.has(o.e.bookId) && o.e.treatment !== 'mention') {
      roles[o.i] = 'supplementary';
      usedBooks.add(o.e.bookId);
      supplementary++;
    }
  }
  return evidence.map((e, i) => ({ ...e, role: roles[i] }));
}

/**
 * How important a concept is to its domain (design section 10): prevalence is the share of
 * the domain's teaching books that treat it beyond a mention, "but I would not blindly equate
 * frequency with importance", so depth and level count too. Programme relevance and SME
 * judgement are applied later, per programme.
 */
export function classifyImportance(input: {
  booksTreating: number;
  domainBooks: number;
  deepest: Treatment;
  level: string;
}): { prevalence: number; importance: Importance } {
  const prevalence = input.domainBooks > 0 ? input.booksTreating / input.domainBooks : 0;
  const deep = TREATMENT_RANK[input.deepest] >= 1;
  let importance: Importance;
  if (input.level === 'advanced')
    importance = prevalence >= 0.5 && deep ? 'supporting' : 'advanced';
  else if (deep && (prevalence >= 0.5 || (input.booksTreating >= 2 && prevalence >= 0.34)))
    importance = 'core';
  else if (deep || prevalence >= 0.25) importance = 'supporting';
  else importance = 'optional';
  return { prevalence: Math.round(prevalence * 1000) / 1000, importance };
}

export function deepestTreatment(ts: Treatment[]): Treatment {
  return ts.reduce<Treatment>((a, t) => (TREATMENT_RANK[t] > TREATMENT_RANK[a] ? t : a), 'mention');
}

const DEPTH: Record<string, number> = { mention: 0, treatment: 1, extended: 2 };
/** Treatments of one concept a book may keep: the deepest few, not every passing mention. */
const MAX_EVIDENCE_PER_BOOK = 4;

/**
 * A concept's evidence with one more treatment added. A mention is kept only while its book has
 * nothing better; a book keeps at most its four deepest treatments. Without this a concept
 * named in every section of a book (on the test book, "asymptotic notation") carried a hundred
 * entries of "mentioned here".
 */
export function tidyEvidence(current: any[], incoming: any, sectionKey: string): any[] {
  const book = String(incoming.bookId);
  const others = current.filter((e) => String(e.bookId) !== book);
  const mine = current.filter((e) => String(e.bookId) === book);
  const same = mine.find((e) => e.sectionKey === sectionKey);
  if (same) {
    same.pageLabelEnd = incoming.pageLabelEnd;
    if (DEPTH[incoming.treatment] > DEPTH[same.treatment]) same.treatment = incoming.treatment;
  } else {
    mine.push(incoming);
  }
  const best = Math.max(...mine.map((e) => DEPTH[e.treatment] ?? 0));
  const kept = mine
    .filter((e) => best === 0 || e.treatment !== 'mention')
    .sort((a, b) => (DEPTH[b.treatment] ?? 0) - (DEPTH[a.treatment] ?? 0))
    .slice(0, best === 0 ? 1 : MAX_EVIDENCE_PER_BOOK);
  return [...others, ...kept];
}
