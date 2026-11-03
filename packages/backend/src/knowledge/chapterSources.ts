/**
 * Textbook chapters as Step 5 sources, from the knowledge library.
 *
 * Rejin's design (section 2): with book structure kept, "the system would no longer need GPT to
 * invent page numbers". A module's concepts are grouped by the book and chapter of their primary
 * treatment; each chapter becomes one source with the page span its concepts occupy, cited in
 * APA 7 from the book's own metadata. Recognised textbooks are the core source at every level
 * (Dr Sherin Thomas's rule), so these come first.
 *
 * Pure, so it can be tested; the lookups are in workflowService.
 */

export interface ChapterBook {
  id: string;
  title: string;
  authors: string[];
  edition?: string;
  year?: number;
  publisher?: string;
  url?: string;
  licence?: string;
}

export interface ChapterGroup {
  bookId: string;
  chapterNumber: string;
  chapterTitle: string;
  pageStart: string;
  pageEnd: string;
  concepts: { code: string; name: string }[];
}

const num = (p: string) => (/^\d+$/.test(p) ? Number(p) : NaN);

/** Each concept's primary treatment, grouped by book and chapter, largest groups first. */
export function groupByChapter(concepts: any[], maxChapters = Infinity): ChapterGroup[] {
  const groups = new Map<string, ChapterGroup>();
  for (const c of concepts) {
    const ev = (c.evidence || []).find((e: any) => e.role === 'primary') || (c.evidence || [])[0];
    if (!ev) continue;
    const key = `${ev.bookId}|${ev.chapter?.number || ev.chapter?.title || ''}`;
    if (!groups.has(key)) {
      groups.set(key, {
        bookId: String(ev.bookId),
        chapterNumber: ev.chapter?.number || '',
        chapterTitle: ev.chapter?.title || '',
        pageStart: ev.pageLabelStart,
        pageEnd: ev.pageLabelEnd,
        concepts: [],
      });
    }
    const g = groups.get(key)!;
    g.concepts.push({ code: c.code, name: c.name });
    if (num(ev.pageLabelStart) < num(g.pageStart)) g.pageStart = ev.pageLabelStart;
    if (num(ev.pageLabelEnd) > num(g.pageEnd)) g.pageEnd = ev.pageLabelEnd;
  }
  return Array.from(groups.values())
    .sort((a, b) => b.concepts.length - a.concepts.length)
    .slice(0, maxChapters);
}

/** Step 5's recency rule: a source this many years old or newer counts as recent. */
export const RECENT_YEARS = 5;
/** A chapter from a book not yet used in the module is worth this many concepts. */
const NEW_BOOK_BONUS = 1.5;
/** A chapter from a recent edition is worth this many concepts, to settle comparable choices. */
const RECENT_BONUS = 0.5;
/** Each chapter already taken from the book in earlier modules costs this many concepts. */
const USED_BOOK_PENALTY = 1;

export interface SelectOptions {
  /** Most chapters one book may supply to the module. */
  perBookCap?: number;
  /** Chapters already taken from each book in earlier modules of the programme. */
  usage?: Map<string, number>;
  bookYears?: Map<string, number | undefined>;
  currentYear?: number;
}

/**
 * Pick a module's chapters. On 2 Nov 2026 the top three by concept count gave 10 of 12 chapters
 * of a four-module programme to one book (Principles of Data Science). Here one book supplies at
 * most `perBookCap` of the module's chapters, a book not yet used in the module scores higher, a
 * book already used by earlier modules scores lower, and a recent edition breaks ties. An older
 * or over-used book is still taken when nothing else covers the module.
 */
export function selectChapters(
  groups: ChapterGroup[],
  maxChapters = 3,
  opts: SelectOptions = {}
): ChapterGroup[] {
  const cap = opts.perBookCap ?? 2;
  const year = opts.currentYear ?? new Date().getFullYear();
  const picked: ChapterGroup[] = [];
  const perBook = new Map<string, number>();
  const pool = [...groups];
  while (picked.length < maxChapters && pool.length) {
    const eligible = pool.filter((g) => (perBook.get(g.bookId) || 0) < cap);
    if (!eligible.length) break;
    const scored = eligible
      .map((g) => {
        const y = opts.bookYears?.get(g.bookId);
        const score =
          g.concepts.length +
          (perBook.has(g.bookId) ? 0 : NEW_BOOK_BONUS) +
          (y && y >= year - RECENT_YEARS ? RECENT_BONUS : 0) -
          USED_BOOK_PENALTY * (opts.usage?.get(g.bookId) || 0);
        return { g, score };
      })
      .sort((a, b) => b.score - a.score);
    const best = scored[0].g;
    picked.push(best);
    perBook.set(best.bookId, (perBook.get(best.bookId) || 0) + 1);
    pool.splice(pool.indexOf(best), 1);
  }
  return picked;
}

/** "Simon J. D. Prince" -> "Prince, S. J. D."; joined APA-style. */
export function apaAuthors(authors: string[]): string {
  const one = (name: string) => {
    const parts = name.replace(/\s+/g, ' ').trim().split(' ');
    if (parts.length === 1) return parts[0];
    const surname = parts.pop()!;
    const initials = parts.map((p) => `${p.replace(/\./g, '')[0]}.`).join(' ');
    return `${surname}, ${initials}`;
  };
  const list = authors.filter(Boolean).map(one);
  if (list.length <= 1) return list[0] || '';
  return `${list.slice(0, -1).join(', ')}, & ${list[list.length - 1]}`;
}

export function chapterApa(book: ChapterBook, g: ChapterGroup): string {
  const pages = g.pageStart === g.pageEnd ? `p. ${g.pageStart}` : `pp. ${g.pageStart}–${g.pageEnd}`;
  const chapter = g.chapterNumber ? `Chapter ${g.chapterNumber}, ${pages}` : pages;
  const edition = book.edition ? ` (${book.edition})` : '';
  return `${apaAuthors(book.authors)} (${book.year || 'n.d.'}). ${book.title}${edition} (${chapter}). ${book.publisher || ''}.${book.url ? ` ${book.url}` : ''}`
    .replace(/\s+\./g, '.')
    .trim();
}
