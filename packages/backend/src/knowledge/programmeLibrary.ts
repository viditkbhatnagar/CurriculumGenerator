/**
 * Which part of the textbook library a programme draws on, and what the generator receives
 * from it.
 *
 * A programme opts in by domain (e.g. "ai-data" and "business" for a Master of AI in Business),
 * optionally narrowed to areas or to particular books. Off by default: a programme generated
 * before the library existed is not changed by it.
 */
import mongoose from 'mongoose';
import { CurriculumWorkflow } from '../models/CurriculumWorkflow';
import { bodyOfKnowledge, formatBodyOfKnowledge, formatConcept, searchConcepts } from './retrieval';
import type { Importance } from './models';
import { pickAcrossAreas } from './selection';
import { chapterApa, groupByChapter } from './chapterSources';

export interface ProgrammeLibrary {
  enabled: boolean;
  domainKeys: string[];
  areas?: string[];
  bookIds?: string[];
  enabledAt?: Date;
}

export async function libraryFor(workflowId?: string): Promise<ProgrammeLibrary | null> {
  if (!workflowId || !mongoose.isValidObjectId(workflowId)) return null;
  const wf: any = await CurriculumWorkflow.findById(workflowId).select('knowledgeLibrary').lean();
  const lib = wf?.knowledgeLibrary;
  return lib?.enabled ? lib : null;
}

/** Concepts limited to the programme's chosen books, if it chose any. */
function inChosenBooks(lib: ProgrammeLibrary, concept: any): boolean {
  if (!lib.bookIds?.length) return true;
  return (concept.evidence || []).some((e: any) => lib.bookIds!.includes(String(e.bookId)));
}

/**
 * Library concepts matching a step's searches, shaped like knowledge-base passages so the
 * existing prompt formatting carries them, each with its textbook citations.
 */
export async function libraryContextFor(
  workflowId: string | undefined,
  queries: string[],
  k = 12
): Promise<{ content: string; source: string; relevance: number }[]> {
  const lib = await libraryFor(workflowId);
  if (!lib) return [];
  const hits = await searchConcepts(queries, {
    domainKeys: lib.domainKeys,
    areas: lib.areas,
    k: k * 2,
  });
  return hits
    .filter((h) => inChosenBooks(lib, h.concept))
    .slice(0, k)
    .map((h) => ({
      content: formatConcept(h.concept, { definition: 500, sources: 3 }).replace(/^- /, ''),
      source: `Textbook library ${h.concept.code}`,
      relevance: h.similarity,
    }));
}

/**
 * The programme's body of knowledge as a prompt block: what the loaded textbooks teach, by
 * area and importance. Empty when the programme has no library.
 */
export async function bodyOfKnowledgeBlockFor(
  workflowId: string | undefined,
  opts: {
    importance?: Importance[];
    limit?: number;
    heading?: string;
    definition?: number;
    sources?: number;
  } = {}
): Promise<{ block: string; concepts: number }> {
  const lib = await libraryFor(workflowId);
  if (!lib) return { block: '', concepts: 0 };
  // Every concept that qualifies, narrowed to the chosen books, then a budget taken across areas.
  const concepts = pickAcrossAreas(
    (
      await bodyOfKnowledge({
        domainKeys: lib.domainKeys,
        areas: lib.areas,
        importance: opts.importance,
        limit: 100000,
      })
    ).filter((c) => inChosenBooks(lib, c)),
    opts.limit ?? 150
  );
  return {
    block: formatBodyOfKnowledge(concepts, {
      heading: opts.heading,
      definition: opts.definition ?? 140,
      sources: opts.sources ?? 1,
    }),
    concepts: concepts.length,
  };
}

/** Library concepts by code, in the order given; unknown codes are dropped. */
export async function conceptsByCodes(codes: string[]): Promise<any[]> {
  const unique = Array.from(new Set(codes.filter(Boolean)));
  if (!unique.length) return [];
  const { KbConcept } = await import('./models');
  // A code merged into another concept by consolidation resolves to that concept.
  const rows: any[] = await KbConcept.find({
    $or: [{ code: { $in: unique } }, { aliasCodes: { $in: unique } }],
  })
    .select('-embedding')
    .lean();
  const byCode = new Map<string, any>();
  for (const r of rows) for (const c of [r.code, ...(r.aliasCodes || [])]) byCode.set(c, r);
  const seen = new Set<string>();
  return unique.map((c) => byCode.get(c)).filter((r) => r && !seen.has(r.code) && seen.add(r.code));
}

/**
 * For Step 4's detail batches: each module's assigned concepts with their sources, so its topics
 * and outcomes are written from what the textbooks teach (design sections 9 and 15).
 */
export async function moduleConceptsBlock(
  modules: { code: string; title: string; knowledgeObjects?: string[] }[]
): Promise<{ block: string; known: Map<string, string[]> }> {
  const known = new Map<string, string[]>();
  const parts: string[] = [];
  for (const m of modules) {
    const concepts = await conceptsByCodes(m.knowledgeObjects || []);
    known.set(
      m.code,
      concepts.map((c) => c.code)
    );
    if (!concepts.length) continue;
    parts.push(
      `${m.code} ${m.title}\n${concepts.map((c) => formatConcept(c, { definition: 160, sources: 1 })).join('\n')}`
    );
  }
  if (!parts.length) return { block: '', known };
  return {
    block: `
=== CONCEPTS EACH MODULE TEACHES (from the textbook library) ===
Write each module's topics and outcomes from its concepts below. Cite a textbook only as listed.

${parts.join('\n\n')}

=== END CONCEPTS ===
`,
    known,
  };
}

/**
 * Step 5 sources for one module from the programme's textbook library: the chapters that teach
 * its concepts, each with its pages and an APA citation. The module's own concept codes (from
 * Step 4) are used when it has them; otherwise its title and topics are searched. Empty when
 * the programme has no library.
 */
export async function libraryChapterSources(
  workflowId: string | undefined,
  module: any
): Promise<any[]> {
  const lib = await libraryFor(workflowId);
  if (!lib) return [];
  const codes: string[] = module.knowledgeObjects || [];
  let concepts = codes.length ? await conceptsByCodes(codes) : [];
  if (!concepts.length) {
    const topics = (module.topics || []).map((t: any) => t?.title || t).slice(0, 6);
    concepts = (
      await searchConcepts([module.title, ...topics].filter(Boolean), {
        domainKeys: lib.domainKeys,
        areas: lib.areas,
        k: 15,
      })
    ).map((h) => h.concept);
  }
  concepts = concepts.filter((c) => inChosenBooks(lib, c));
  const groups = groupByChapter(concepts, 3);
  if (!groups.length) return [];
  const conceptByCode = new Map(concepts.map((c: any) => [c.code, c]));
  const { KbBook } = await import('./models');
  const books: any[] = await KbBook.find({
    _id: { $in: groups.map((g) => g.bookId) },
    accessTier: 'teaching',
  }).lean();
  const byId = new Map(books.map((b) => [String(b._id), b]));
  const year = new Date().getFullYear();
  return groups
    .filter((g) => byId.has(g.bookId))
    .map((g, i) => {
      const b = byId.get(g.bookId);
      const open = String(b.licence).startsWith('cc-');
      const book = {
        id: g.bookId,
        title: b.title,
        authors: b.authors,
        edition: b.edition,
        year: b.year,
        publisher: b.publisher,
        url: b.sourceUrl || b.licenceUrl,
        licence: b.licence,
      };
      const pages =
        g.pageStart === g.pageEnd ? `p. ${g.pageStart}` : `pp. ${g.pageStart}-${g.pageEnd}`;
      const span = Number(g.pageEnd) - Number(g.pageStart) + 1;
      return {
        id: `lib-${module.code || module.id}-${i + 1}`,
        title: `${b.title}${g.chapterNumber ? `, Chapter ${g.chapterNumber}` : ''}${g.chapterTitle ? `: ${g.chapterTitle}` : ''}`,
        authors: b.authors,
        year: b.year,
        publisher: b.publisher,
        citation: chapterApa(book, g),
        url: book.url,
        category: 'academic_textbook',
        type: 'academic',
        accessStatus: open ? 'free_full_text' : 'institution_licensed',
        accessNote: open
          ? `Open textbook (${b.licence.toUpperCase()})`
          : 'Licensed to the institution',
        complianceBadges: {
          peerReviewed: false,
          openAccess: open,
          fullTextAvailable: open,
          verifiedVia: 'Textbook library',
        },
        moduleId: module.id,
        linkedMLOs: [] as string[],
        relevantTopics: (module.topics || []).slice(0, 3),
        // What the chapter teaches, from the library's concepts: matched to the module's
        // outcomes like a paper's abstract, and given to the lesson writer (lessonSources).
        abstract: g.concepts
          .map((c) => {
            const def = conceptByCode.get(c.code)?.definition;
            return def ? `${c.name}: ${def}` : c.name;
          })
          .join(' ')
          .slice(0, 1500),
        // The book's own location for the reading, read from the PDF, not written by a model.
        chapter: { number: g.chapterNumber, title: g.chapterTitle },
        pages,
        libraryConcepts: g.concepts.map((c) => c.code),
        isRecent: !!b.year && b.year >= year - 5,
        estimatedReadingHours:
          Number.isFinite(span) && span > 0 ? Math.max(0.5, Math.round(span / 12)) : 1.5,
      };
    });
}
