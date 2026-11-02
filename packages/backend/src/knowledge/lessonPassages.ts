/**
 * Textbook passages for a lesson, read from the knowledge library.
 *
 * Logan Pacey's re-test of 2 November 2026 (Certificate in Business Analytics, 61 lessons): every
 * lesson recorded 0 book passages. Step 10 asked for passages from the legacy Step 5.5 collection
 * (BookIntelligence), which holds nothing for a programme that uses the textbook library, so it
 * returned an empty list and the lessons were written from each reading's details and abstract.
 *
 * A lesson's library-backed sources (Step 5 `lib-*` chapters, and the Step 6 readings that cite
 * them) name the concepts the chapter teaches. Each concept records the section it is taught in,
 * and every section holds its passages (kbpassages). Passages are found by book + section, kept
 * to the books the programme may use, chosen across books where the lesson has several, and
 * labelled with the book, chapter and printed pages.
 *
 * The selection is pure, so it can be tested; `libraryPassagesFor` does the reading.
 */
import { BookScope } from './bookAccess';

export const MAX_LESSON_PASSAGES = 4;
export const LESSON_PASSAGE_CHARS = 900;
/** A heading or caption is not a passage worth teaching from. */
const MIN_PASSAGE_CHARS = 120;
const MAX_SECTIONS = 12;

export interface LibrarySourceRef {
  id?: string;
  moduleId?: string;
  bookId?: string;
  chapter?: { number?: string; title?: string };
  libraryConcepts?: string[];
  linkedMLOs?: string[];
}

export interface SectionRef {
  bookId: string;
  sectionKey: string;
  /** How many of the lesson's concepts are taught in this section. */
  weight: number;
}

export interface PassageRow {
  bookId: string;
  sectionKey: string;
  order: number;
  text: string;
  chapter?: { number?: string; title?: string };
  pageLabelStart?: string;
  pageLabelEnd?: string;
}

export interface BookRef {
  title: string;
  authors?: string[];
}

export interface LessonPassage {
  source: string;
  content: string;
  bookId: string;
}

export const isLibrarySource = (s: any): boolean =>
  !!s && (String(s.id || '').startsWith('lib-') || Array.isArray(s.libraryConcepts));

/**
 * The library-backed sources a lesson may draw on: the ones its readings cite; failing that, the
 * module's own library sources that serve the lesson's outcomes; failing that, all the module's.
 */
export function librarySourcesForLesson(
  topicSources: any[],
  citedSourceIds: string[],
  mloIds: string[],
  moduleId?: string
): LibrarySourceRef[] {
  const lib = (topicSources || []).filter(isLibrarySource);
  const cited = new Set(citedSourceIds.filter(Boolean).map(String));
  const byCitation = lib.filter((s) => cited.has(String(s.id)));
  if (byCitation.length) return byCitation;
  const ofModule = moduleId ? lib.filter((s) => s.moduleId === moduleId) : lib;
  const wanted = new Set(mloIds);
  const serving = ofModule.filter((s) => (s.linkedMLOs || []).some((m: string) => wanted.has(m)));
  return serving.length ? serving : ofModule;
}

/**
 * The sections that teach a source's concepts in the source's own chapter (and book, where the
 * source records one), most concepts first, spread across books.
 */
export function sectionRefsFor(
  sources: LibrarySourceRef[],
  conceptsByCode: Map<string, any>,
  max = MAX_SECTIONS
): SectionRef[] {
  const found = new Map<string, SectionRef>();
  for (const s of sources) {
    for (const code of s.libraryConcepts || []) {
      for (const e of conceptsByCode.get(code)?.evidence || []) {
        if (!e.sectionKey) continue;
        if (s.bookId && String(e.bookId) !== String(s.bookId)) continue;
        if (s.chapter?.number && String(e.chapter?.number) !== String(s.chapter.number)) continue;
        const key = `${e.bookId}|${e.sectionKey}`;
        const row = found.get(key) || {
          bookId: String(e.bookId),
          sectionKey: e.sectionKey,
          weight: 0,
        };
        found.set(key, { ...row, weight: row.weight + 1 });
      }
    }
  }
  return roundRobinByBook(
    Array.from(found.values()).sort((a, b) => b.weight - a.weight),
    (r) => r.bookId
  ).slice(0, max);
}

/** Interleave items by group so no group runs ahead; each group keeps its own order. */
function roundRobinByBook<T>(items: T[], groupOf: (t: T) => string): T[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const g = groupOf(item);
    groups.set(g, [...(groups.get(g) || []), item]);
  }
  const lists = Array.from(groups.values());
  const out: T[] = [];
  for (let i = 0; out.length < items.length; i++) {
    for (const l of lists) if (i < l.length) out.push(l[i]);
  }
  return out;
}

const words = (text: string): Set<string> =>
  new Set((text.toLowerCase().match(/[a-z]{4,}/g) || []).filter(Boolean));

/** Words of the focus found in the passage: a plain measure of how well it serves the lesson. */
export function overlapScore(passageText: string, focus: Set<string>): number {
  if (!focus.size) return 0;
  let n = 0;
  for (const w of words(passageText)) if (focus.has(w)) n += 1;
  return n;
}

export function passageLabel(book: BookRef, p: PassageRow): string {
  const ch = p.chapter?.number ? `ch. ${p.chapter.number}` : '';
  const a = p.pageLabelStart;
  const b = p.pageLabelEnd;
  const pages = a && b && a !== b ? `pp. ${a}–${b}` : a || b ? `p. ${a || b}` : '';
  return [book.title, ch, pages].filter(Boolean).join(', ');
}

function clip(text: string, chars: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= chars) return flat;
  const cut = flat.slice(0, chars);
  const space = cut.lastIndexOf(' ');
  return `${cut.slice(0, space > chars * 0.6 ? space : chars)}…`;
}

/**
 * At most `max` passages: the best-matching ones to the lesson's focus, taken alternately from
 * each book so a lesson with several books is not written from one.
 */
export function selectLessonPassages(
  rows: PassageRow[],
  books: Map<string, BookRef>,
  focusText: string,
  opts: { max?: number; chars?: number } = {}
): LessonPassage[] {
  const max = opts.max ?? MAX_LESSON_PASSAGES;
  const chars = opts.chars ?? LESSON_PASSAGE_CHARS;
  const focus = words(focusText);
  const scored = rows
    .filter((r) => books.has(String(r.bookId)) && (r.text || '').trim().length >= MIN_PASSAGE_CHARS)
    .map((r) => ({ r, score: overlapScore(r.text, focus) }))
    .sort((a, b) => b.score - a.score || a.r.order - b.r.order);
  // Alternate books, each book's best first; a book's own passages never repeat a section until
  // its other sections have had a turn.
  const perBook = roundRobinByBook(scored, (x) => String(x.r.bookId));
  const seenSections = new Set<string>();
  const picked: typeof scored = [];
  for (const pass of [true, false]) {
    for (const x of perBook) {
      if (picked.length >= max) break;
      if (picked.includes(x)) continue;
      const sec = `${x.r.bookId}|${x.r.sectionKey}`;
      if (pass && seenSections.has(sec)) continue;
      seenSections.add(sec);
      picked.push(x);
    }
  }
  return picked.map(({ r }) => ({
    bookId: String(r.bookId),
    source: passageLabel(books.get(String(r.bookId))!, r),
    content: clip(r.text, chars),
  }));
}

export interface LessonPassageResult {
  passages: LessonPassage[];
  /** Why there are none, in words a reviewer can read; absent when there are some. */
  note?: string;
}

/**
 * Passages from the programme's textbook library for a lesson. Never throws on missing data:
 * the reason for an empty result is returned so the lesson can record it.
 */
export async function libraryPassagesFor(
  scope: BookScope | null,
  sources: LibrarySourceRef[],
  focusText: string
): Promise<LessonPassageResult> {
  if (!scope) return { passages: [], note: 'The programme does not use the textbook library.' };
  if (!sources.length) {
    return { passages: [], note: 'No library chapter is linked to this lesson.' };
  }
  const { conceptsByCodes } = await import('./programmeLibrary');
  const { visibleConcepts } = await import('./bookAccess');
  const { KbBook, KbPassage } = await import('./models');
  const codes = sources.flatMap((s) => s.libraryConcepts || []);
  const concepts = visibleConcepts(scope, await conceptsByCodes(codes));
  const byCode = new Map<string, any>();
  for (const c of concepts)
    for (const code of [c.code, ...(c.aliasCodes || [])]) byCode.set(code, c);
  const sections = sectionRefsFor(sources, byCode);
  if (!sections.length) {
    return { passages: [], note: 'The linked chapters record no sections to read passages from.' };
  }
  const bookIds = Array.from(new Set(sections.map((s) => s.bookId)));
  const bookDocs: any[] = await KbBook.find({ _id: { $in: bookIds }, accessTier: 'teaching' })
    .select('title authors')
    .lean();
  const books = new Map<string, BookRef>(
    bookDocs.map((b) => [String(b._id), { title: b.title, authors: b.authors }])
  );
  const rows: PassageRow[] = [];
  for (const id of bookIds.filter((b) => books.has(b))) {
    const keys = sections.filter((s) => s.bookId === id).map((s) => s.sectionKey);
    const found: any[] = await KbPassage.find({
      bookId: id,
      sectionKey: { $in: keys },
      restricted: { $ne: true },
    })
      .select('bookId sectionKey order text chapter pageLabelStart pageLabelEnd')
      .lean();
    rows.push(...found.map((f) => ({ ...f, bookId: String(f.bookId) })));
  }
  const passages = selectLessonPassages(rows, books, focusText);
  return passages.length
    ? { passages }
    : { passages: [], note: 'The linked chapters hold no readable passages.' };
}
