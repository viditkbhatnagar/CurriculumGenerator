/**
 * A book's chapters and sections read from its pages, for a PDF without bookmarks.
 *
 * Publishers' PDFs often carry no outline. The first fallback took the largest type on the
 * page as chapter headings, which in a commercial textbook is decoration: Elliott & Elliott's
 * Financial Accounting and Reporting (961 pages) came out as 3 chapters. Textbooks mark their
 * structure in one of two ways a reader can see, and these are tried first:
 *
 * - numbered section headings, "1.1 Introduction", "2.3 Accrual basis of accounting";
 * - a running head naming the chapter, "CHAPTER 1 | INTRODUCTION TO MANAGEMENT" (Robbins,
 *   Mullins), with the sections in the book's usual heading size.
 */
import type { PdfOutlineItem, PdfText } from './pdf/readPdf';

const MIN_NUMBERED_SECTIONS = 15;
const MIN_CHAPTERS = 3;
const MAX_HEADING_CHARS = 100;
/** How far a numbered sequence may skip: sections an extraction missed, or a chapter with none. */
const MAX_SECTION_GAP = 4;
const MAX_CHAPTER_GAP = 2;
/** Pages before a chapter's first running head searched for its opening page. */
const OPENER_LOOKBACK = 3;
/** A chapter's running head must appear this often, and recur within this many pages. */
const MIN_RUNNING_HEADS = 3;
const RUN_GAP = 6;

/** The size of body text: the median over characters, so headings and captions barely count. */
export function bodySize(pdf: PdfText): number {
  const weighted: number[] = [];
  for (const page of pdf.pages) {
    for (const p of page.paragraphs) {
      const n = Math.min(20, Math.ceil(p.text.length / 80));
      for (let i = 0; i < n; i++) weighted.push(Math.round(p.size * 10) / 10);
    }
  }
  if (!weighted.length) return 0;
  weighted.sort((a, b) => a - b);
  return weighted[Math.floor(weighted.length / 2)];
}

const titleCase = (s: string) =>
  s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s(-])([a-z])/g, (m) => m.toUpperCase()) : s;
const tight = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const PART_LINE = /^part\s+(\d+|[ivxlc]+|one|two|three|four|five|six|seven|eight|nine|ten)$/i;

/**
 * A chapter's title on its opening pages: the lines after its own "CHAPTER 3" if printed,
 * else the largest short line. Pages opening a part are skipped: Elliott & Elliott's part
 * titles are larger than its chapter titles and two pages earlier.
 */
export function displayTitle(
  pdf: PdfText,
  from: number,
  to: number,
  minSize: number,
  chapterNumber?: number
): { title: string; page: number } | null {
  const pages = pdf.pages.filter((p) => p.number >= from && p.number <= to);
  if (chapterNumber !== undefined) {
    const own = new RegExp(`^chapter\\s*${chapterNumber}$`, 'i');
    for (const page of [...pages].reverse()) {
      const ps = page.paragraphs;
      const at = ps.findIndex((q) => own.test(q.text.trim()));
      if (at < 0 || at + 1 >= ps.length) continue;
      const size = ps[at + 1].size;
      if (size < minSize * 0.75) continue;
      const parts: string[] = [];
      for (let j = at + 1; j < ps.length && Math.abs(ps[j].size - size) <= 1; j++) {
        parts.push(ps[j].text.trim());
        if (parts.join(' ').length >= MAX_HEADING_CHARS) break;
      }
      return { title: parts.join(' ').slice(0, MAX_HEADING_CHARS), page: page.number };
    }
  }
  let best: { title: string; page: number; size: number } | null = null;
  for (const page of pages) {
    if (page.paragraphs.some((q) => PART_LINE.test(q.text.trim()))) continue;
    for (const p of page.paragraphs) {
      const t = p.text.trim();
      if (p.size < minSize || t.length < 4 || t.length > MAX_HEADING_CHARS) continue;
      if (/^(chapter|part|unit)\b|^\d+$/i.test(t)) continue;
      if (!best || p.size > best.size) best = { title: t, page: page.number, size: p.size };
    }
  }
  return best && { title: best.title, page: best.page };
}

/** Numbered section headings ("2.3 Accrual basis of accounting"), read in sequence. */
export function headingsFromNumbers(pdf: PdfText): PdfOutlineItem[] {
  const body = bodySize(pdf);
  const found: { chapter: number; section: number; title: string; page: number }[] = [];
  for (const page of pdf.pages) {
    for (const p of page.paragraphs) {
      const t = p.text.trim().replace(/\s+/g, ' ');
      const m = /^(\d{1,2})\.(\d{1,2})\s+([A-Z].*)$/.exec(t);
      // A contents line ends with its page number; a sentence does not make a heading.
      if (!m || t.length > MAX_HEADING_CHARS || /\s\d{1,4}$/.test(t) || /[.;,]$/.test(t)) continue;
      if (p.size < body) continue;
      const chapter = Number(m[1]);
      const section = Number(m[2]);
      const last = found[found.length - 1];
      const next = last
        ? (chapter === last.chapter &&
            section > last.section &&
            section <= last.section + MAX_SECTION_GAP) ||
          (chapter > last.chapter && chapter <= last.chapter + MAX_CHAPTER_GAP && section <= 3)
        : chapter <= 3 && section <= 3;
      if (next) found.push({ chapter, section, title: t, page: page.number });
    }
  }
  const chapters = new Set(found.map((f) => f.chapter));
  if (found.length < MIN_NUMBERED_SECTIONS || chapters.size < MIN_CHAPTERS) return [];

  const items: PdfOutlineItem[] = [];
  let previousPage = 0;
  for (const f of found) {
    if (!items.length || f.chapter !== found[found.indexOf(f) - 1]?.chapter) {
      // The chapter's title is the largest line between the last section and this one.
      const opener = displayTitle(
        pdf,
        Math.max(previousPage + 1, f.page - OPENER_LOOKBACK),
        f.page,
        body * 1.6,
        f.chapter
      );
      items.push({
        title: `${f.chapter} ${opener?.title || `Chapter ${f.chapter}`}`,
        page: opener?.page ?? f.page,
        depth: 0,
      });
    }
    items.push({ title: f.title, page: f.page, depth: 1 });
    previousPage = f.page;
  }
  return items;
}

/** "CHAPTER 3 | DECISION MAKING", "Chapter 3 Decision Making": the chapter a page belongs to. */
export function chapterRunningHead(text: string): { number: number; title: string } | null {
  const t = text.trim().replace(/\s+/g, ' ');
  if (t.length > 140) return null;
  const m = /^chapter\s+(\d{1,2})\b\s*[|:•–—-]?\s*(.*)$/i.exec(t);
  if (!m) return null;
  const title = m[2]
    .replace(/\s*[|•]\s*\d+$/, '')
    .replace(/\s+\d{1,4}$/, '')
    .trim();
  return { number: Number(m[1]), title };
}

/** Chapters from running heads; sections in the book's most common heading size. */
export function headingsFromRunningHeads(pdf: PdfText): PdfOutlineItem[] {
  const body = bodySize(pdf);
  const pagesOf = new Map<number, number[]>();
  const titles = new Map<number, Map<string, number>>();
  for (const page of pdf.pages) {
    // A page naming several chapters is a contents or list page, not one inside a chapter.
    const named = new Set(
      page.paragraphs.map((p) => chapterRunningHead(p.text)?.number).filter((n) => n !== undefined)
    );
    if (named.size > 1) continue;
    const edges = [...page.paragraphs.slice(0, 2), ...page.paragraphs.slice(-2)];
    for (const p of edges) {
      const head = chapterRunningHead(p.text);
      // Running heads are small, though often a little larger than body text (Robbins: 13 on 10).
      if (!head || p.size > body * 1.6) continue;
      pagesOf.set(head.number, [...(pagesOf.get(head.number) || []), page.number]);
      const counts = titles.get(head.number) || new Map<string, number>();
      if (head.title) counts.set(head.title, (counts.get(head.title) || 0) + 1);
      titles.set(head.number, counts);
      break;
    }
  }
  // A chapter starts where its running head starts repeating; a contents page that lists
  // "Chapter 1 ..." once is not its start (Mullins lists every chapter before page 20).
  const firstPage = new Map<number, number>();
  for (const [number, pages] of pagesOf) {
    if (pages.length < MIN_RUNNING_HEADS) continue;
    const start = pages.find((p, i) => pages[i + 1] !== undefined && pages[i + 1] - p <= RUN_GAP);
    if (start !== undefined) firstPage.set(number, start);
  }
  // Chapters in reading order: each must start after the one before.
  const chapters: { number: number; page: number; title: string }[] = [];
  for (const [number, page] of Array.from(firstPage.entries()).sort((a, b) => a[1] - b[1])) {
    const last = chapters[chapters.length - 1];
    if (last && (number <= last.number || page <= last.page)) continue;
    const counts = Array.from((titles.get(number) || new Map()).entries()).sort(
      (a, b) => b[1] - a[1]
    );
    chapters.push({ number, page, title: counts[0]?.[0] || '' });
  }
  if (chapters.length < MIN_CHAPTERS) return [];

  // Each chapter opens on a page without the running head, with its title in display type.
  for (let i = 0; i < chapters.length; i++) {
    const c = chapters[i];
    const floor = i ? chapters[i - 1].page + 1 : 1;
    const opener = displayTitle(
      pdf,
      Math.max(floor, c.page - OPENER_LOOKBACK),
      c.page - 1,
      body * 1.6,
      c.number
    );
    if (
      opener &&
      (!c.title ||
        tight(opener.title).startsWith(tight(c.title).slice(0, 12)) ||
        tight(c.title).startsWith(tight(opener.title).slice(0, 12)))
    ) {
      c.page = opener.page;
      c.title = opener.title;
    } else if (opener && !c.title) {
      c.page = opener.page;
    }
    c.title = titleCase(c.title || `Chapter ${c.number}`);
  }

  // Section headings: short lines in the most used size above body text, inside chapters.
  // A line printed at the edge of many pages is a running head ("PART 1 | DEFINING THE
  // MANAGER'S TERRAIN"), not a heading.
  const edgeCounts = new Map<string, number>();
  const edgeKey = (text: string) => tight(text.replace(/\d+/g, ''));
  for (const page of pdf.pages) {
    for (const p of [...page.paragraphs.slice(0, 2), ...page.paragraphs.slice(-2)]) {
      edgeCounts.set(edgeKey(p.text), (edgeCounts.get(edgeKey(p.text)) || 0) + 1);
    }
  }
  const start = chapters[0].page;
  const candidates: { title: string; page: number; size: number }[] = [];
  for (const page of pdf.pages) {
    if (page.number < start) continue;
    for (const p of page.paragraphs) {
      const t = p.text.trim().replace(/\s+/g, ' ');
      if (p.size < body * 1.15 || p.size > body * 2.4 || t.length < 4 || t.length > 90) continue;
      if ((edgeCounts.get(edgeKey(t)) || 0) >= MIN_RUNNING_HEADS) continue;
      if (
        /[.,;:]$/.test(t) ||
        /^(figure|table|exhibit|source|chapter|part)\b/i.test(t) ||
        chapterRunningHead(t)
      )
        continue;
      candidates.push({ title: t, page: page.number, size: Math.round(p.size) });
    }
  }
  const bySize = new Map<number, number>();
  for (const c of candidates) bySize.set(c.size, (bySize.get(c.size) || 0) + 1);
  const sectionSize = Array.from(bySize.entries()).sort((a, b) => b[1] - a[1])[0]?.[0];

  const items: PdfOutlineItem[] = [];
  chapters.forEach((c, i) => {
    const end = chapters[i + 1]?.page ?? Infinity;
    items.push({ title: `${c.number} ${c.title}`, page: c.page, depth: 0 });
    for (const s of candidates) {
      if (s.size !== sectionSize || s.page < c.page || s.page >= end) continue;
      if (tight(s.title) === tight(c.title)) continue;
      items.push({ title: titleCase(s.title), page: s.page, depth: 1 });
    }
  });
  return items;
}

/**
 * Bookmarks that name a chapter only by number ("Chapter 1", as in Fraser & Ormiston's
 * Understanding Financial Statements) take the title printed on the chapter's first page.
 */
export function titledOutline(pdf: PdfText, outline: PdfOutlineItem[]): PdfOutlineItem[] {
  const body = bodySize(pdf);
  return outline.map((item) => {
    const m = /^(?:chapter|unit)\s+(\d{1,2})$/i.exec(item.title.trim());
    if (!m || item.page === null) return item;
    const opener = displayTitle(pdf, item.page, item.page, body * 1.4, Number(m[1]));
    // A scanned book's text layer can garble a title ("Financial Staten1ents"); keep the number.
    if (!opener || /[a-z][0-9_]|[0-9_][a-z]/i.test(opener.title)) return item;
    return { ...item, title: `${m[1]} ${opener.title}` };
  });
}
