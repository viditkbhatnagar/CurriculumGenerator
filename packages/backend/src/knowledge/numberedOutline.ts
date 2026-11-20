/**
 * Bookmarks that carry their own numbers ("1: Introduction", "1.1: Course Objectives").
 *
 * Anjali Pai added six LibreTexts-style open textbooks on 19 November 2026 (Introduction to
 * Social Media, Project Management from Simple to Complex, A Primer on Sustainable Business,
 * Sustainability, Innovation, and Entrepreneurship, The Sustainable Business Case Book and
 * Watt's Project Management). Their PDFs list every chapter AND every section at the same
 * bookmark depth, with the numbers in the title. Read by depth, every entry became a chapter,
 * the chapter numbers became a running counter, and citations said "ch. 87".
 *
 * This reads the structure from the numbers instead: "N: Title" is chapter N, "N.M: Title" a
 * section of it. Watt's book hangs its real chapters under one wrapper ("1: Chapters"), so
 * "1.1", "1.2" ... there are chapters 1, 2 ... Front and back matter (licensing, contents,
 * about the authors) is matter, not a chapter. A book without this numbering is returned
 * unchanged, so Murphy, Principles of Data Science and every other book read as before.
 *
 * Pure, so it can be tested; the result is an ordinary outline (chapters at depth 0, sections
 * at depth 1, the numbers kept in the titles).
 */
import type { PdfOutlineItem } from './pdf/readPdf';

const NUMBERED = /^(\d+(?:\.\d+)*)\s*:\s*(.*)$/;
const WRAPPER = /^(?:chapters?|main body|body)$/i;
const MATTER_WRAPPER = /^(?:front matter|back matter)$/i;
const MATTER_EXACT =
  /^(?:table of contents|contents|licensing|detailed licensing|about the authors?|acknowledg(?:e?ments?)|dedication|preface|versioning history|accessibility statement|index|glossary|references|infopage|info page|title ?page|front matter|back matter)$/i;

/** Front or back matter named exactly (not a chapter that merely begins with such a word). */
export function isMatterTitle(title: string): boolean {
  return MATTER_EXACT.test(title.replace(/\s+/g, ' ').trim());
}

interface Entry {
  item: PdfOutlineItem;
  nums: number[];
  title: string;
}

function parse(item: PdfOutlineItem): Entry {
  const m = NUMBERED.exec(item.title.replace(/\s+/g, ' ').trim());
  return m
    ? { item, nums: m[1].split('.').map(Number), title: m[2].trim() || item.title }
    : { item, nums: [], title: item.title.replace(/\s+/g, ' ').trim() };
}

const chapterItem = (e: Entry, n: number): PdfOutlineItem => ({
  title: `${n} ${e.title}`,
  page: e.item.page,
  depth: 0,
});
const sectionItem = (e: Entry, n: number, m: number): PdfOutlineItem => ({
  title: `${n}.${m} ${e.title}`,
  page: e.item.page,
  depth: 1,
});
const matterItem = (e: Entry): PdfOutlineItem => ({ title: e.title, page: e.item.page, depth: 0 });

/**
 * Entries with a resolvable page, minus whatever sits under a matter bookmark. A LibreTexts
 * "Table of Contents" bookmark lists every chapter again beneath it, and "Index" lists its
 * letters; both would count the chapters twice.
 */
function usableEntries(outline: PdfOutlineItem[]): Entry[] {
  const kept: Entry[] = [];
  let skipBelow: number | null = null;
  for (const item of outline) {
    if (item.page === null) continue;
    if (skipBelow !== null && item.depth > skipBelow) continue;
    skipBelow = null;
    const e = parse(item);
    if (MATTER_WRAPPER.test(e.title) || isMatterTitle(e.title)) skipBelow = item.depth;
    // Only top-level matter is kept; one nested in a chapter is just one of its sections.
    if (isMatterTitle(e.title) && item.depth > 0) continue;
    kept.push(e);
  }
  return kept;
}

/**
 * The outline rebuilt from its printed numbers, or null when the book is not numbered this
 * way (and must be read by depth as before).
 */
export function numberedOutline(outline: PdfOutlineItem[]): PdfOutlineItem[] | null {
  const entries = usableEntries(outline);
  const numbered = entries.filter((e) => e.nums.length > 0 && !isMatterTitle(e.title));
  const chapters = numbered.filter((e) => e.nums.length === 1);
  const sections = numbered.filter((e) => e.nums.length >= 2);
  // The "N:" form must dominate: books whose sections are "1.1 Title" are left alone.
  const topLevel = entries.filter((e) => e.item.depth === 0 && !isMatterTitle(e.title));
  const unnumberedTop = topLevel.filter((e) => e.nums.length === 0).length;
  if (numbered.length < 5 || unnumberedTop > numbered.length) return null;
  if (!chapters.length || !sections.length) return null;

  const wrapper =
    chapters.length === 1 && WRAPPER.test(chapters[0].title) ? chapters[0].nums[0] : null;
  const result: PdfOutlineItem[] = [];

  if (wrapper !== null) {
    if (sections.filter((e) => e.nums.length === 2 && e.nums[0] === wrapper).length < 2)
      return null;
    let chapter = 0;
    for (const e of entries) {
      if (isMatterTitle(e.title)) result.push(matterItem(e));
      else if (e.nums.length === 2 && e.nums[0] === wrapper) {
        chapter += 1;
        result.push(chapterItem(e, chapter));
      } else if (e.nums.length === 3 && e.nums[0] === wrapper && chapter > 0) {
        result.push(sectionItem(e, chapter, e.nums[2]));
      }
    }
    return result;
  }

  for (const e of entries) {
    if (isMatterTitle(e.title)) result.push(matterItem(e));
    else if (e.nums.length === 1) result.push(chapterItem(e, e.nums[0]));
    else if (e.nums.length === 2) result.push(sectionItem(e, e.nums[0], e.nums[1]));
    // N.M.K sub-sections stay inside their section's pages.
  }
  return result;
}
