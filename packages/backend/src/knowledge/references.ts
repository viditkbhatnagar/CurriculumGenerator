/**
 * Readable references for library concepts.
 *
 * Logan Pacey's re-test of 2 November 2026: Steps 1 to 4 showed no readable book references.
 * Step 2 cited internal concept codes ("K-MKT-0440", or K1 "(K-DBS-0001, K-DBS-0003, ...)")
 * because the prompt listed concepts by code and asked the model to name the codes. A reviewer
 * cannot look a code up in a book. A concept's evidence already holds the book, authors, chapter
 * and printed pages, so a code resolves to "Kotler et al., Principles of Marketing, ch. 6".
 *
 * Pure, so it can be tested; the lookups are in routes (GET /api/v3/knowledge/references).
 */

export interface ConceptReference {
  code: string;
  bookTitle: string;
  authors: string[];
  chapter: string;
  pages: string;
  /** "Kotler et al., Principles of Marketing, ch. 6, p. 235" */
  reference: string;
}

const surnames = (authors: string[] = []): string => {
  const names = authors.map((a) => String(a).trim().split(/\s+/).pop()).filter(Boolean);
  if (!names.length) return '';
  return names.length > 2 ? `${names[0]} et al.` : names.join(' & ');
};

const pagesOf = (e: any): string => {
  const a = e?.pageLabelStart;
  const b = e?.pageLabelEnd;
  if (a && b && a !== b) return `pp. ${a}–${b}`;
  return a || b ? `p. ${a || b}` : '';
};

/** "Ault et al., Principles of Data Science, ch. 1": what a prompt asks the model to write. */
export function shortReference(e: any): string {
  const who = surnames(e?.authors);
  const ch = e?.chapter?.number ? `ch. ${e.chapter.number}` : '';
  return [who, e?.bookTitle, ch].filter(Boolean).join(', ');
}

/** The concept's primary treatment as a reference, or null when it has no evidence. */
export function conceptReference(concept: any): ConceptReference | null {
  const evidence: any[] = concept?.evidence || [];
  const e = evidence.find((x) => x.role === 'primary') || evidence[0];
  if (!e) return null;
  const pages = pagesOf(e);
  return {
    code: concept.code,
    bookTitle: e.bookTitle,
    authors: e.authors || [],
    chapter: e.chapter?.number ? String(e.chapter.number) : e.chapter?.title || '',
    pages,
    reference: [shortReference(e), pages].filter(Boolean).join(', '),
  };
}

/**
 * References for the codes asked, one per code. A code merged into another concept resolves to
 * that concept's reference under the code that was asked for. Unknown codes are left out.
 */
export function referencesForCodes(codes: string[], concepts: any[]): ConceptReference[] {
  const byCode = new Map<string, any>();
  for (const c of concepts)
    for (const code of [c.code, ...(c.aliasCodes || [])]) byCode.set(code, c);
  const out: ConceptReference[] = [];
  for (const code of Array.from(new Set(codes))) {
    const ref = conceptReference(byCode.get(code));
    if (ref) out.push({ ...ref, code });
  }
  return out;
}
