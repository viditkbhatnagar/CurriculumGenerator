/**
 * Retrieving from the knowledge library: concepts, not passages.
 *
 * Rejin's design (section 3): "the generator retrieves the concept, and behind the concept sit
 * multiple authoritative textbook treatments." Search runs over the knowledge objects, each
 * held once whatever the number of books teaching it, so ten books explaining the Five Forces
 * cannot fill the context and crowd out everything else. Each result carries its citations:
 * book, edition, chapter, section and printed pages, read from the book itself.
 *
 * The index is the concepts' 512-dimension vectors held in memory (a few thousand concepts
 * are a few MB), reloaded when an ingest bumps the library version.
 */
import { openaiService } from '../services/openaiService';
import { shorten } from '../services/occupations/occupationIndex';
import { dot } from './clustering';
import { KbConcept, KbMeta, Importance } from './models';

interface Indexed {
  id: string;
  domainKey: string;
  area: string;
  importance: Importance;
  vector: Float32Array;
}

let cache: { version: number; checkedAt: number; items: Indexed[] } | null = null;
const RECHECK_MS = 60_000;

async function libraryVersion(): Promise<number> {
  const meta: any = await KbMeta.findById('concepts').lean();
  return meta?.version || 0;
}

async function index(): Promise<Indexed[]> {
  const now = Date.now();
  if (cache && now - cache.checkedAt < RECHECK_MS) return cache.items;
  const version = await libraryVersion();
  if (cache && cache.version === version) {
    cache.checkedAt = now;
    return cache.items;
  }
  const rows: any[] = await KbConcept.find({ 'embedding.0': { $exists: true } })
    .select('domainKey area importance embedding')
    .lean();
  const items = rows.map((r) => ({
    id: String(r._id),
    domainKey: r.domainKey,
    area: r.area,
    importance: r.importance,
    vector: Float32Array.from(r.embedding),
  }));
  cache = { version, checkedAt: now, items };
  return items;
}

/** Forget the index (after an ingest in this process). */
export function invalidateConceptIndex(): void {
  cache = null;
}

/**
 * Similarity below which a concept is not returned for a query. Provisional until calibrated
 * on production with the first books loaded (see knowledge/routes POST /calibrate).
 */
export const CONCEPT_FLOOR = 0.3;

const IMPORTANCE_WEIGHT: Record<Importance, number> = {
  core: 0.04,
  supporting: 0.02,
  advanced: 0.01,
  optional: 0,
};

export interface ConceptHit {
  concept: any;
  similarity: number;
}

export interface SearchOptions {
  domainKeys?: string[];
  areas?: string[];
  k?: number;
  floor?: number;
}

/** The concepts closest to any of the queries, best first, each at most once. */
export async function searchConcepts(
  queries: string[],
  opts: SearchOptions = {}
): Promise<ConceptHit[]> {
  const items = (await index()).filter(
    (c) =>
      (!opts.domainKeys?.length || opts.domainKeys.includes(c.domainKey)) &&
      (!opts.areas?.length || opts.areas.includes(c.area))
  );
  const texts = queries.map((q) => q.trim()).filter(Boolean);
  if (!items.length || !texts.length) return [];
  const vectors = (await openaiService.generateEmbeddingsBatch(texts)).map((v) => shorten(v));
  const floor = opts.floor ?? CONCEPT_FLOOR;
  const best = new Map<string, number>();
  for (const q of vectors) {
    for (const c of items) {
      const s = dot(q, c.vector);
      if (s >= floor && s > (best.get(c.id) ?? -1)) best.set(c.id, s);
    }
  }
  const byId = new Map(items.map((c) => [c.id, c]));
  const ranked = Array.from(best.entries())
    .sort(
      (a, b) =>
        b[1] +
        IMPORTANCE_WEIGHT[byId.get(b[0])!.importance] -
        (a[1] + IMPORTANCE_WEIGHT[byId.get(a[0])!.importance])
    )
    .slice(0, opts.k ?? 12);
  const docs: any[] = await KbConcept.find({ _id: { $in: ranked.map(([id]) => id) } })
    .select('-embedding')
    .lean();
  const docById = new Map(docs.map((d) => [String(d._id), d]));
  return ranked
    .map(([id, similarity]) => ({
      concept: docById.get(id),
      similarity: Math.round(similarity * 1000) / 1000,
    }))
    .filter((h) => h.concept);
}

/**
 * The library's body of knowledge for some domains or areas, most important first: what a
 * programme built on these books would have to teach (design section 9, modules that "emerge
 * from clusters of related knowledge").
 */
export async function bodyOfKnowledge(opts: {
  domainKeys?: string[];
  areas?: string[];
  importance?: Importance[];
  limit?: number;
}): Promise<any[]> {
  const filter: any = {};
  if (opts.domainKeys?.length) filter.domainKey = { $in: opts.domainKeys };
  if (opts.areas?.length) filter.area = { $in: opts.areas };
  if (opts.importance?.length) filter.importance = { $in: opts.importance };
  const order: Record<string, number> = { core: 0, supporting: 1, advanced: 2, optional: 3 };
  const rows: any[] = await KbConcept.find(filter).select('-embedding').lean();
  return rows
    .sort(
      (a, b) =>
        a.area.localeCompare(b.area) ||
        order[a.importance] - order[b.importance] ||
        b.bookCount - a.bookCount ||
        a.name.localeCompare(b.name)
    )
    .slice(0, opts.limit ?? 400);
}

const surnames = (authors: string[]) => {
  const names = (authors || []).map((a) => a.trim().split(/\s+/).pop()).filter(Boolean);
  if (!names.length) return '';
  return names.length > 2 ? `${names[0]} et al.` : names.join(' & ');
};

/** "Morin, Open Data Structures (Python ed., 2023), Ch. 1 §1.3, pp. 9-18". */
export function citation(e: any): string {
  const who = surnames(e.authors);
  const ed = [e.edition, e.year].filter(Boolean).join(', ');
  const where = [
    e.chapter?.number ? `Ch. ${e.chapter.number}` : e.chapter?.title ? `"${e.chapter.title}"` : '',
    e.section?.number && !/\.0$/.test(e.section.number) ? `§${e.section.number}` : '',
  ]
    .filter(Boolean)
    .join(' ');
  const pages =
    e.pageLabelStart && e.pageLabelEnd && e.pageLabelStart !== e.pageLabelEnd
      ? `pp. ${e.pageLabelStart}-${e.pageLabelEnd}`
      : e.pageLabelStart
        ? `p. ${e.pageLabelStart}`
        : '';
  return [`${who ? who + ', ' : ''}${e.bookTitle}${ed ? ` (${ed})` : ''}`, where, pages]
    .filter(Boolean)
    .join(', ');
}

/** A concept's teaching sources in role order: primary, supplementary, critical. */
export function sourcesOf(concept: any, max = 3): string[] {
  const rank: Record<string, number> = { primary: 0, supplementary: 1, critical: 2, additional: 3 };
  return [...(concept.evidence || [])]
    .sort((a, b) => (rank[a.role] ?? 3) - (rank[b.role] ?? 3))
    .slice(0, max)
    .map((e) => `${citation(e)}${e.role && e.role !== 'additional' ? ` [${e.role}]` : ''}`);
}

export function formatConcept(
  c: any,
  opts: { definition?: number; sources?: number } = {}
): string {
  const head = `${c.code} ${c.name} (${c.conceptType}; ${c.importance}; ${c.bookCount} book${c.bookCount === 1 ? '' : 's'}${c.level ? `; ${c.level}` : ''})`;
  const def = c.definition ? ` — ${String(c.definition).slice(0, opts.definition ?? 220)}` : '';
  const src = sourcesOf(c, opts.sources ?? 2);
  return `- ${head}${def}${src.length ? `\n    Taught in: ${src.join('; ')}` : ''}`;
}

/**
 * The prompt block for a step: concepts grouped by area with their codes and sources. The model
 * is told to cite only what is listed, never a chapter or page of its own.
 */
export function formatBodyOfKnowledge(
  concepts: any[],
  opts: { heading?: string; definition?: number; sources?: number } = {}
): string {
  if (!concepts.length) return '';
  const byArea = new Map<string, any[]>();
  for (const c of concepts) {
    const key = c.subArea ? `${c.area} › ${c.subArea}` : c.area;
    if (!byArea.has(c.area)) byArea.set(c.area, []);
    byArea.get(c.area)!.push({ ...c, _group: key });
  }
  const body = Array.from(byArea.entries())
    .map(([area, list]) => `${area}\n${list.map((c) => formatConcept(c, opts)).join('\n')}`)
    .join('\n\n');
  return `
=== ${opts.heading || 'BODY OF KNOWLEDGE FROM THE TEXTBOOK LIBRARY'} ===
Each entry is a concept taught in the textbooks loaded for this programme, held once however many
books teach it. "core" = most of the domain's books treat it in depth; "supporting", "advanced" and
"optional" follow from how many books teach it, how deeply, and at what level (computed, not
judged). Ground the content in these concepts and refer to them by code (e.g. ${concepts[0].code}).
When citing a textbook, use only the books, chapters and pages listed here; never invent any.

${body}

=== END BODY OF KNOWLEDGE ===
`;
}
