/**
 * Whether a library textbook is the newest edition the library holds.
 *
 * Logan Pacey, 12 November 2026: a core textbook counts as current when it is the latest edition
 * available (services/sourceRecency). The library is the only record of editions, so a book is
 * the latest unless another teaching book with the same work key has a later year.
 */

export interface EditionBook {
  _id: unknown;
  workKey?: string;
  year?: number;
}

/** Book ids (as strings) for which a newer edition of the same work is held. */
export function booksWithNewerEdition(
  books: EditionBook[],
  allEditions: EditionBook[]
): Set<string> {
  const superseded = new Set<string>();
  for (const b of books) {
    if (!b.workKey || !b.year) continue;
    const newer = allEditions.some(
      (o) => o.workKey === b.workKey && !!o.year && o.year > (b.year as number)
    );
    if (newer) superseded.add(String(b._id));
  }
  return superseded;
}

/** Sources with `isLatestEdition` set from the library; sources without a bookId are untouched. */
export async function withLatestEditionFlags<T extends { bookId?: string }>(
  sources: T[]
): Promise<(T & { isLatestEdition?: boolean })[]> {
  const ids = Array.from(new Set(sources.map((s) => s.bookId).filter((x): x is string => !!x)));
  if (!ids.length) return sources;
  const { KbBook } = await import('./models');
  const books: EditionBook[] = await KbBook.find({ _id: { $in: ids } })
    .select('workKey year')
    .lean();
  const keys = Array.from(new Set(books.map((b) => b.workKey).filter((k): k is string => !!k)));
  const all: EditionBook[] = keys.length
    ? await KbBook.find({ workKey: { $in: keys }, accessTier: 'teaching' })
        .select('workKey year')
        .lean()
    : [];
  const superseded = booksWithNewerEdition(books, all);
  const known = new Set(books.map((b) => String(b._id)));
  return sources.map((s) =>
    s.bookId && known.has(s.bookId) ? { ...s, isLatestEdition: !superseded.has(s.bookId) } : s
  );
}
