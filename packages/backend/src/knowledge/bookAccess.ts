/**
 * Which books a programme may be taught from and cite.
 *
 * Open textbooks serve every programme. An institution's own licensed books (SSM's, taken from
 * its LMS with Dr Sherin's login on 20 October 2026) list the programmes they belong to on the
 * book (`programmes`), and no other programme may draw on them: not their concepts, not their
 * citations. Until then the field was stored and never read, so a book marked for one programme
 * would have been used by all.
 *
 * A concept taught by an open book and a restricted one is still shown to other programmes, with
 * only the open book's evidence; a concept found only in restricted books is not shown at all.
 */
export interface BookScope {
  /** The programme chose particular books; only these count. */
  bookIds?: string[];
  /** Books licensed to other programmes. */
  hiddenBookIds?: string[];
}

export function visibleConcept<T extends { evidence?: any[] }>(
  scope: BookScope,
  concept: T
): T | null {
  const hidden = new Set(scope.hiddenBookIds || []);
  const chosen = scope.bookIds?.length ? new Set(scope.bookIds) : null;
  const all = concept.evidence || [];
  const evidence = all.filter((e) => {
    const id = String(e.bookId);
    return !hidden.has(id) && (!chosen || chosen.has(id));
  });
  if (!evidence.length) return null;
  return evidence.length === all.length ? concept : { ...concept, evidence };
}

export function visibleConcepts<T extends { evidence?: any[] }>(
  scope: BookScope,
  concepts: T[]
): T[] {
  return concepts.map((c) => visibleConcept(scope, c)).filter((c): c is T => c !== null);
}

/**
 * Whether a book is kept from a programme. Only an institution's licensed book can be: its
 * `programmes` lists the programmes it belongs to. An open-licence book serves every programme
 * whatever that field says. On 21 October 2026 the field was first enforced for every book, and
 * the 20 open textbooks, labelled "MAIB" when they were loaded, vanished from every programme
 * until 31 October: Logan's test run on 28 October drew on no textbook at all.
 */
export function restrictedFrom(
  book: { licence?: string; programmes?: string[] },
  workflowId: string
): boolean {
  const programmes = book.programmes || [];
  return (
    book.licence === 'institution-licensed' &&
    programmes.length > 0 &&
    !programmes.includes(workflowId)
  );
}
