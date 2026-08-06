/**
 * Helpers for rendering citation data that is not guaranteed to be well-shaped.
 *
 * Steps 5, 6 and 10 store sources and reading lists as free-form documents, so
 * an `authors` value arrives as an array from generation, as a plain string from
 * an SME edit or an older document, and occasionally missing entirely. Every
 * view rendered it with `authors.join(', ')`, which throws on a string — and
 * because a thrown error during render has no boundary above it, the whole
 * workflow page went blank instead of one card degrading.
 */

/** Render an author list for display, whatever shape it arrived in. */
export function formatAuthorList(authors: unknown): string {
  if (Array.isArray(authors)) {
    const names = authors.filter((a): a is string => typeof a === 'string' && a.trim().length > 0);
    return names.length > 0 ? names.join(', ') : 'Unknown';
  }
  if (typeof authors === 'string' && authors.trim()) return authors.trim();
  return 'Unknown';
}

/**
 * Coerce an author value into the array form the edit forms work with, so
 * opening an editor on a string-valued record does not crash it.
 */
export function toAuthorArray(authors: unknown): string[] {
  if (Array.isArray(authors)) {
    return authors.filter((a): a is string => typeof a === 'string' && a.trim().length > 0);
  }
  if (typeof authors === 'string' && authors.trim()) {
    return authors
      .split(/\s*(?:,|;|\band\b|&)\s*/)
      .map((a) => a.trim())
      .filter(Boolean);
  }
  return [];
}
