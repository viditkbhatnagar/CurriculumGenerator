/**
 * Textbook sources for glossary terms.
 *
 * Step 9 terms carried only internal tags ("mlos", "assessment") as sources: a reader could not
 * tell which textbook defines a term, although the programme's library holds definitions with
 * page-cited evidence (Logan Pacey, re-test of 2 November 2026, 29 terms, none with a textbook).
 * Each term is now matched to the best visible library concept, by name first and by closeness
 * second, and carries that concept's cited evidence. The lookup is passed in so this stays pure
 * and testable; workflowService wires it to the library's concept search.
 */

export interface TextbookSource {
  book: string;
  authors: string[];
  chapter: string;
  pages: string;
  conceptCode?: string;
  match: 'name' | 'similar';
}

export interface ConceptMatch {
  concept: any;
  similarity: number;
}

/** Below this closeness a concept that does not share the term's name is not taken for it. */
export const SIMILAR_CONCEPT_FLOOR = 0.6;
const MAX_TEXTBOOK_SOURCES = 2;

const norm = (s: unknown): string =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** The concept for a term: one with the same name (or acronym) first, else the closest enough. */
export function bestConceptFor(
  term: { term?: string; acronym?: string; acronymForm?: string },
  hits: ConceptMatch[]
): { concept: any; match: 'name' | 'similar' } | null {
  const names = [term.term, term.acronym, term.acronymForm].map(norm).filter(Boolean);
  const named = hits.find((h) => {
    const own = [h.concept?.name, ...(h.concept?.aliases || [])].map(norm);
    return names.some((n) => own.includes(n));
  });
  if (named) return { concept: named.concept, match: 'name' };
  const top = [...hits].sort((a, b) => b.similarity - a.similarity)[0];
  return top && top.similarity >= SIMILAR_CONCEPT_FLOOR
    ? { concept: top.concept, match: 'similar' }
    : null;
}

const pagesOf = (e: any): string =>
  e.pageLabelStart && e.pageLabelEnd && e.pageLabelStart !== e.pageLabelEnd
    ? `${e.pageLabelStart}-${e.pageLabelEnd}`
    : String(e.pageLabelStart || '');

const chapterOf = (e: any): string =>
  [e.chapter?.number ? `Ch. ${e.chapter.number}` : '', e.chapter?.title || '']
    .filter(Boolean)
    .join(' ');

const ROLE_RANK: Record<string, number> = { primary: 0, supplementary: 1, critical: 2 };

/** The concept's best cited evidence, primary treatment first, one per book. */
export function textbookSourcesOf(
  concept: any,
  match: 'name' | 'similar',
  max = MAX_TEXTBOOK_SOURCES
): TextbookSource[] {
  const sorted = [...(concept?.evidence || [])]
    .filter((e) => e?.bookTitle)
    .sort((a, b) => (ROLE_RANK[a.role] ?? 3) - (ROLE_RANK[b.role] ?? 3));
  const seen = new Set<string>();
  const out: TextbookSource[] = [];
  for (const e of sorted) {
    const key = String(e.bookId || e.bookTitle);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      book: String(e.bookTitle),
      authors: Array.isArray(e.authors) ? e.authors.map(String) : [],
      chapter: chapterOf(e),
      pages: pagesOf(e),
      conceptCode: concept.code,
      match,
    });
    if (out.length >= max) break;
  }
  return out;
}

export interface TextbookAttachment<T> {
  terms: T[];
  /** Terms that now carry at least one textbook source. */
  withTextbookSource: number;
}

/**
 * Attach `textbookSources` to each term from `lookup`, which returns the library concepts near a
 * term (already filtered to what the programme may see). A lookup that throws leaves that term
 * as it was: the glossary is still valid without textbooks.
 */
export async function attachTextbookSources<T extends { term?: string }>(
  terms: T[],
  lookup: (term: T) => Promise<ConceptMatch[]>,
  onError: (term: T, error: unknown) => void = () => {}
): Promise<TextbookAttachment<T>> {
  const out: T[] = [];
  let withTextbookSource = 0;
  for (const term of terms) {
    try {
      const picked = bestConceptFor(term as any, await lookup(term));
      const sources = picked ? textbookSourcesOf(picked.concept, picked.match) : [];
      if (sources.length) {
        withTextbookSource += 1;
        out.push({ ...term, textbookSources: sources });
        continue;
      }
    } catch (error) {
      onError(term, error);
    }
    out.push(term);
  }
  return { terms: out, withTextbookSource };
}
