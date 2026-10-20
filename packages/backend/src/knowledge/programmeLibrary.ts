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
  opts: { importance?: Importance[]; limit?: number; heading?: string; definition?: number } = {}
): Promise<{ block: string; concepts: number }> {
  const lib = await libraryFor(workflowId);
  if (!lib) return { block: '', concepts: 0 };
  const concepts = (
    await bodyOfKnowledge({
      domainKeys: lib.domainKeys,
      areas: lib.areas,
      importance: opts.importance,
      limit: (opts.limit ?? 150) * 2,
    })
  )
    .filter((c) => inChosenBooks(lib, c))
    .slice(0, opts.limit ?? 150);
  return {
    block: formatBodyOfKnowledge(concepts, {
      heading: opts.heading,
      definition: opts.definition ?? 140,
      sources: 1,
    }),
    concepts: concepts.length,
  };
}

/** Library concepts by code, in the order given; unknown codes are dropped. */
export async function conceptsByCodes(codes: string[]): Promise<any[]> {
  const unique = Array.from(new Set(codes.filter(Boolean)));
  if (!unique.length) return [];
  const { KbConcept } = await import('./models');
  const rows: any[] = await KbConcept.find({ code: { $in: unique } })
    .select('-embedding')
    .lean();
  const byCode = new Map(rows.map((r) => [r.code, r]));
  return unique.map((c) => byCode.get(c)).filter(Boolean);
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
