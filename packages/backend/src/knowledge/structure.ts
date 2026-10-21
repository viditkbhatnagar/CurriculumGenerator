/**
 * A book's structure: Book -> Chapter -> Section -> Page -> Passage.
 *
 * Rejin's knowledge-base design (20 Oct 2026) asks that every piece of content keep where it
 * came from, "so later, if the generator uses Porter's Five Forces, it knows: Textbook A ->
 * Chapter 4 -> Section 4.2 -> pp. 112-118", and that text is not "broken into arbitrary
 * 1,000-token chunks". Chapters and sections come from the PDF's bookmarks (or, without
 * bookmarks, from heading-sized lines); passages never cross a section; pages are the
 * book's printed labels.
 *
 * It also separates what must not reach generation (point 20 of the design): answer keys,
 * solutions and instructor material are marked restricted, so assessment generation cannot
 * retrieve an existing answer and reproduce it.
 *
 * Pure, so it can be tested; reading the PDF is in pdf/readPdf.
 */
import type { PdfOutlineItem, PdfText } from './pdf/readPdf';
import {
  bodySize,
  headingsFromNumbers,
  headingsFromRunningHeads,
  titledOutline,
} from './pageHeadings';

export type SectionKind = 'body' | 'exercise' | 'summary' | 'matter' | 'restricted';

export interface Block {
  page: number;
  label: string;
  text: string;
}

export interface BookSection {
  key: string;
  chapter: { index: number; number: string; title: string };
  section: { index: number; number: string; title: string };
  kind: SectionKind;
  pdfPageStart: number;
  pdfPageEnd: number;
  pageLabelStart: string;
  pageLabelEnd: string;
  blocks: Block[];
}

export interface Passage {
  sectionKey: string;
  order: number;
  text: string;
  pdfPageStart: number;
  pdfPageEnd: number;
  pageLabelStart: string;
  pageLabelEnd: string;
}

const RESTRICTED =
  /\b(answer key|answers to|answers? for|solutions? (manual|to)|selected (answers|solutions)|test bank|instructor'?s? (manual|guide|resources?|notes?))\b|^(answers?|solutions?)\b/i;
const MATTER =
  /^(?:(?:contents|table of contents|brief contents|detailed contents|preface|foreword|about (?:the|this) (?:authors?|book)|copyright|dedication|index|subject index|author index|bibliography|references|works cited|further reading|glossary|endnotes|key terms index|list of (?:figures|tables|abbreviations)|notation|errata|title page|cover)\b|acknowledg)/i;
const EXERCISE =
  /\b(exercises?|problems|review questions|discussion questions|check your understanding|practice questions|self[- ]assessment|end[- ]of[- ]chapter questions|critical thinking questions|assessment questions)\b/i;
const SUMMARY = /^(summary|chapter summary|key terms|key concepts|conclusion|chapter review)\b/i;

/** What a section is, from its own title and its chapter's. */
export function classifySection(sectionTitle: string, chapterTitle = ''): SectionKind {
  const s = stripNumber(sectionTitle);
  const c = stripNumber(chapterTitle);
  if (RESTRICTED.test(s) || RESTRICTED.test(c)) return 'restricted';
  if (MATTER.test(c) || MATTER.test(s)) return 'matter';
  // An index's letter headings ("X", "Y", "Z" in Sloman's bookmarks).
  if (/^[A-Z]$/.test(c.trim())) return 'matter';
  // An index's letter headings ("X", "Y", "Z" in Sloman's bookmarks).
  if (/^[A-Z]$/.test(c.trim())) return 'matter';
  if (EXERCISE.test(s)) return 'exercise';
  if (SUMMARY.test(s)) return 'summary';
  return 'body';
}

/** "Chapter 3: Strategy" -> { number: '3', title: 'Strategy' }; "2.1 Interfaces" -> 2.1. */
export function splitNumber(title: string): { number: string; title: string } {
  const t = title.replace(/\s+/g, ' ').trim();
  const m =
    /^(?:chapter|unit|module|lesson|part)\s+([0-9]+|[ivxlc]+)\b[\s.:\-–—]*(.*)$/i.exec(t) ||
    /^([0-9]+(?:\.[0-9]+)*)\.?\s+(.*)$/.exec(t);
  return m ? { number: m[1], title: (m[2] || t).trim() || t } : { number: '', title: t };
}

const stripNumber = (title: string) => splitNumber(title).title;

const norm = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Letters and digits only: PDF text splits ligatures ("E ffi ciency"), so spaces cannot count. */
const tight = (text: string) => norm(text).replace(/ /g, '');

/**
 * A running head or foot: a page's first or last line repeating the chapter or section title
 * ("§1.1 Introduction", "Chapter 3 | Strategy  57"). Heads that repeat on most pages are
 * removed when the PDF is read; these change with every chapter, so they are not.
 */
function isRunningHead(text: string, titles: string[]): boolean {
  if (text.length > 90) return false;
  const bare = tight(
    stripNumber(text.replace(/^[§\s\d.|:–—-]+/, '').replace(/[\s\d.§|:–—-]+$/, ''))
  );
  return !!bare && titles.some((t) => tight(stripNumber(t)) === bare);
}

/** Bookmark depth that holds chapters: 1 when the top level is "Part I", "Part II"... */
export function chapterDepth(outline: PdfOutlineItem[]): number {
  const top = outline.filter((o) => o.depth === 0);
  const parts = top.filter((o) => /^part\b/i.test(o.title)).length;
  const second = outline.filter((o) => o.depth === 1).length;
  // Parts hold the chapters only when there is a level below them: Harzing's International
  // HRM lists "Part I" and "Chapter 1" side by side, and was read as having no chapters at all.
  return (parts >= 2 && second >= parts) || (top.length > 0 && top.length < 4 && second >= 8)
    ? 1
    : 0;
}

/**
 * Headings from type size, for a PDF without bookmarks: lines clearly larger than body text,
 * short and not ending like a sentence. The largest size used as a heading is a chapter, the
 * next a section.
 */
export function headingsFromSizes(pdf: PdfText): PdfOutlineItem[] {
  const body = bodySize(pdf);
  if (!body) return [];
  const candidates: { title: string; page: number; size: number }[] = [];
  for (const page of pdf.pages) {
    for (const p of page.paragraphs) {
      const t = p.text.trim();
      if (p.size >= body * 1.25 && t.length >= 3 && t.length <= 100 && !/[.,;:]$/.test(t)) {
        candidates.push({ title: t, page: page.number, size: Math.round(p.size) });
      }
    }
  }
  const sizes = Array.from(new Set(candidates.map((c) => c.size))).sort((a, b) => b - a);
  const chapterSize = sizes.find((s) => candidates.filter((c) => c.size === s).length >= 3);
  if (chapterSize === undefined) return [];
  const sectionSize = sizes.find((s) => s < chapterSize);
  return candidates
    .filter((c) => c.size === chapterSize || c.size === sectionSize)
    .map((c) => ({ title: c.title, page: c.page, depth: c.size === chapterSize ? 0 : 1 }));
}

/**
 * Chapters and sections for a PDF without bookmarks: numbered sections if the book has them,
 * else chapter running heads, else type size (knowledge/pageHeadings).
 */
export function headingsWithoutBookmarks(pdf: PdfText): PdfOutlineItem[] {
  for (const read of [headingsFromNumbers, headingsFromRunningHeads, headingsFromSizes]) {
    const items = read(pdf);
    if (items.length) return items;
  }
  return [];
}

interface Node {
  chapterIndex: number;
  chapterNumber: string;
  /** The number was counted, not printed in the title: such a chapter may be front matter. */
  chapterCounted: boolean;
  chapterTitle: string;
  sectionIndex: number;
  sectionNumber: string;
  sectionTitle: string;
  page: number;
}

/**
 * A bookmark that groups chapters rather than being one: "Part II", or a roman numeral and a
 * title ("III Deep Neural Networks", as in Murphy's Probabilistic Machine Learning).
 */
export function isPartTitle(title: string): boolean {
  const t = title.replace(/\s+/g, ' ').trim();
  return (
    /^part\s+([ivxlc]+|\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(t) ||
    /^[IVXLC]+[.:]?\s+[A-Z]/.test(t)
  );
}

function nodesFrom(outline: PdfOutlineItem[]): Node[] {
  const globalDepth = chapterDepth(outline);
  const nodes: Node[] = [];
  let chapter: { index: number; number: string; title: string } | null = null;
  let sectionIndex = 0;
  let chapterCount = 0;
  // Chapters sit one level below a part and at the top level elsewhere, so a book that opens
  // with a plain chapter and then groups the rest into parts reads correctly.
  let depth = globalDepth;
  for (const item of outline) {
    if (item.depth === 0 && globalDepth === 0) {
      depth = isPartTitle(item.title) ? 1 : 0;
      if (depth === 1) continue;
    }
    if (item.page === null || item.depth < depth || item.depth > depth + 1) continue;
    const { number, title } = splitNumber(item.title);
    if (item.depth === depth) {
      const isMatter = classifySection(item.title) === 'matter';
      if (!isMatter) chapterCount += 1;
      chapter = {
        index: nodes.length ? nodes[nodes.length - 1].chapterIndex + 1 : 0,
        number: number || (isMatter ? '' : String(chapterCount)),
        title,
      };
      sectionIndex = 0;
      nodes.push({
        chapterIndex: chapter.index,
        chapterNumber: chapter.number,
        chapterCounted: !number,
        chapterTitle: chapter.title,
        sectionIndex: 0,
        sectionNumber: chapter.number ? `${chapter.number}.0` : '',
        sectionTitle: 'Introduction',
        page: item.page,
      });
    } else if (chapter) {
      sectionIndex += 1;
      nodes.push({
        chapterIndex: chapter.index,
        chapterNumber: chapter.number,
        chapterCounted: nodes[nodes.length - 1]?.chapterCounted ?? false,
        chapterTitle: chapter.title,
        sectionIndex,
        sectionNumber: number || (chapter.number ? `${chapter.number}.${sectionIndex}` : ''),
        sectionTitle: title,
        page: item.page,
      });
    }
  }
  return nodes;
}

/** Where on its page a section's heading is, so the page's earlier text stays with the last section. */
function headingAt(blocks: Block[], from: number, title: string): number {
  const want = tight(stripNumber(title));
  if (!want) return -1;
  for (let i = from; i < blocks.length; i++) {
    const head = tight(stripNumber(blocks[i].text.slice(0, want.length * 2 + 40)));
    if (head.startsWith(want) || (want.length > 12 && head.includes(want))) return i;
  }
  return -1;
}

export function structureBook(pdf: PdfText): { sections: BookSection[]; usedOutline: boolean } {
  const usedOutline = pdf.outline.filter((o) => o.page !== null).length >= 3;
  const outline = usedOutline ? titledOutline(pdf, pdf.outline) : headingsWithoutBookmarks(pdf);
  const nodes = nodesFrom(outline).sort((a, b) => a.page - b.page);
  const sections: BookSection[] = nodes.map((n) => {
    const kind = classifySection(n.sectionTitle, n.chapterTitle);
    return {
      key: `${n.chapterIndex}.${n.sectionIndex}`,
      chapter: { index: n.chapterIndex, number: n.chapterNumber, title: n.chapterTitle },
      section: { index: n.sectionIndex, number: n.sectionNumber, title: n.sectionTitle },
      kind:
        n.sectionIndex === 0 && kind === 'body' && n.sectionTitle === 'Introduction'
          ? classifySection(n.chapterTitle)
          : kind,
      pdfPageStart: n.page,
      pdfPageEnd: n.page,
      pageLabelStart: '',
      pageLabelEnd: '',
      blocks: [],
    };
  });
  if (!sections.length) return { sections: [], usedOutline };

  let current = -1;
  for (const page of pdf.pages) {
    const titles =
      current >= 0 ? [sections[current].chapter.title, sections[current].section.title] : [];
    const upcoming = sections.filter((s) => s.pdfPageStart === page.number);
    for (const s of upcoming) titles.push(s.chapter.title, s.section.title);
    const all: Block[] = page.paragraphs.map((p) => ({
      page: page.number,
      label: page.label,
      text: p.text,
    }));
    const blocks = all.filter(
      (b, i) =>
        !((i === 0 || i === all.length - 1) && all.length > 1 && isRunningHead(b.text, titles))
    );
    let cursor = 0;
    while (current + 1 < sections.length && sections[current + 1].pdfPageStart === page.number) {
      const next = sections[current + 1];
      const title = next.section.index === 0 ? next.chapter.title : next.section.title;
      const at = headingAt(blocks, cursor, title);
      const split = at === -1 ? cursor : at;
      if (current >= 0) sections[current].blocks.push(...blocks.slice(cursor, split));
      cursor = split;
      current += 1;
    }
    if (current >= 0) sections[current].blocks.push(...blocks.slice(cursor));
  }

  renumberFromText(
    sections,
    new Set(nodes.filter((n) => n.chapterCounted).map((n) => n.chapterIndex))
  );

  for (const s of sections) {
    const pages = s.blocks.map((b) => b.page);
    if (pages.length) {
      s.pdfPageStart = Math.min(...pages);
      s.pdfPageEnd = Math.max(...pages);
    }
    s.pageLabelStart = s.blocks[0]?.label || String(s.pdfPageStart);
    s.pageLabelEnd = s.blocks[s.blocks.length - 1]?.label || String(s.pdfPageEnd);
  }
  // A chapter heading with nothing before its first section leaves an empty introduction.
  return { sections: sections.filter((s) => s.blocks.some((b) => b.text.trim())), usedOutline };
}

/**
 * The number in a chapter heading ("Chapter 3", "Chapter 3: Shallow Networks", "Unit IV
 * Marketing"), or null for prose that merely begins with one: Prince's Understanding Deep
 * Learning opens chapter 3 with "Chapter 2 introduced supervised learning...", and the whole
 * chapter was filed as a second chapter 2.
 */
export function chapterHeading(line: string): string | null {
  const m = /^(?:chapter|unit)\s+([0-9]+|[ivxlc]+)\b(.*)$/i.exec(line.trim());
  if (!m) return null;
  const rest = m[2].trim();
  if (!rest || /^[:.\-–—]/.test(rest)) return m[1];
  // A title on the same line: short, and not a sentence.
  return rest.length <= 60 && !/[.,;]$|[,;]/.test(rest) && /^[A-Z]/.test(rest) ? m[1] : null;
}

/**
 * Chapter and section numbers printed in the text ("Chapter 1", "1.1 The Need for...") when
 * the bookmarks carry none. Chapters before the first numbered one are front matter (a
 * preface such as "Why This Book?").
 */
function renumberFromText(sections: BookSection[], counted: Set<number>): void {
  const fromHeading = new Map<number, string>();
  const fromSections = new Map<number, string>();
  const printedNumber = new Set<string>();
  for (const s of sections) {
    const head = s.blocks.slice(0, 3).map((b) => b.text.trim());
    if (s.section.index === 0) {
      const m = head.map(chapterHeading).find(Boolean);
      if (m) fromHeading.set(s.chapter.index, m);
    } else {
      // Only a number followed by this section's own title: a numbered equation or list
      // item can open a section too.
      const printed = head
        .map((t) => splitNumber(t))
        .find((h) => tight(h.title).startsWith(tight(s.section.title).slice(0, 12)));
      const n = printed?.number || '';
      if (/^[0-9]+(\.[0-9]+)+$/.test(n)) {
        s.section.number = n;
        printedNumber.add(s.key);
        if (!fromSections.has(s.chapter.index)) fromSections.set(s.chapter.index, n.split('.')[0]);
      }
    }
  }
  // The sections' own printed numbers outrank a "Chapter N" line, which can be prose.
  const explicit = new Map([...fromHeading, ...fromSections]);
  if (!explicit.size) return;
  const firstNumbered = Math.min(...Array.from(explicit.keys()));
  for (const s of sections) {
    const n = explicit.get(s.chapter.index);
    if (n) {
      s.chapter.number = n;
      if (s.section.index === 0) s.section.number = `${n}.0`;
      else if (!printedNumber.has(s.key)) s.section.number = `${n}.${s.section.index}`;
    } else if (
      s.chapter.index < firstNumbered &&
      s.kind === 'body' &&
      // Only a chapter we numbered ourselves: Mullins prints its numbers in running heads, and
      // its first eight chapters were filed as front matter and never read.
      counted.has(s.chapter.index)
    ) {
      s.kind = 'matter';
      s.chapter.number = '';
      s.section.number = '';
    }
  }
}

/** Sentences of an over-long paragraph, so a passage boundary falls between sentences. */
function sentences(text: string): string[] {
  return (
    text
      .match(/[^.!?]+(?:[.!?]+["')\]]*\s*|$)/g)
      ?.map((s) => s.trim())
      .filter(Boolean) || [text]
  );
}

/** A section's text in passages of about `maxChars`, split on paragraph or sentence boundaries. */
export function passagesOf(section: BookSection, maxChars = 1800): Passage[] {
  const units: Block[] = [];
  for (const b of section.blocks) {
    if (b.text.length <= maxChars) units.push(b);
    else for (const s of sentences(b.text)) units.push({ ...b, text: s });
  }
  const passages: Passage[] = [];
  let buf: Block[] = [];
  const flush = () => {
    const text = buf
      .map((b) => b.text)
      .join('\n\n')
      .trim();
    if (text) {
      passages.push({
        sectionKey: section.key,
        order: passages.length,
        text,
        pdfPageStart: buf[0].page,
        pdfPageEnd: buf[buf.length - 1].page,
        pageLabelStart: buf[0].label,
        pageLabelEnd: buf[buf.length - 1].label,
      });
    }
    buf = [];
  };
  let size = 0;
  for (const u of units) {
    if (buf.length && size + u.text.length > maxChars) {
      flush();
      size = 0;
    }
    buf.push(u);
    size += u.text.length + 2;
  }
  flush();
  return passages;
}

/**
 * A section's text with "[p. 112]" markers where each printed page begins, cut into windows
 * of at most `maxChars` for concept extraction. The markers are the only page numbers the
 * extractor may cite, and its citations are checked against them.
 */
export function sectionWindows(section: BookSection, maxChars = 24000): string[] {
  const windows: string[] = [];
  let text = '';
  let lastLabel = '';
  for (const b of section.blocks) {
    let piece = '';
    if (b.label !== lastLabel) {
      piece += `[p. ${b.label}]\n`;
      lastLabel = b.label;
    }
    piece += b.text + '\n\n';
    if (text && text.length + piece.length > maxChars) {
      windows.push(text.trim());
      text = `[p. ${b.label}]\n` + b.text + '\n\n';
    } else {
      text += piece;
    }
  }
  if (text.trim()) windows.push(text.trim());
  return windows;
}

/** Page labels a window cites, in order. */
export function pageLabelsIn(window: string): string[] {
  return Array.from(window.matchAll(/\[p\. ([^\]]+)\]/g)).map((m) => m[1]);
}
