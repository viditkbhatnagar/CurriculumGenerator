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
export function groupByChapter(concepts: any[], maxChapters = 3): ChapterGroup[] {
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
