/**
 * A PDF as pages of paragraphs, with printed page labels and the bookmark outline.
 *
 * Uses the pdf.js build that ships inside pdf-parse, so no new dependency. Book ingestion
 * needs what pdf-parse's own API throws away: which page each line is on, the page's printed
 * label ("xiv", "112"), and the bookmarks that give chapters and sections their pages. That
 * is what lets a knowledge object cite "Ch. 4, §4.2, pp. 112-118" from the book itself rather
 * than from a model that guesses page numbers.
 */

// No type declarations ship for this build; it is the pdf.js inside pdf-parse.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfjs = require('pdf-parse/lib/pdf.js/v2.0.550/build/pdf.js');

/** The longest MAIB textbook is about 1,200 pages; this leaves room without inviting abuse. */
const MAX_PAGES = 3000;

export interface PdfParagraph {
  text: string;
  /** Font height of the paragraph's first line, for heading detection when there is no outline. */
  size: number;
}

export interface PdfPage {
  /** 1-based position in the file. */
  number: number;
  /** The printed page label if the PDF defines one, else the position. */
  label: string;
  paragraphs: PdfParagraph[];
}

export interface PdfOutlineItem {
  title: string;
  /** 1-based page the bookmark points at, or null when it cannot be resolved. */
  page: number | null;
  depth: number;
}

export interface PdfText {
  pages: PdfPage[];
  outline: PdfOutlineItem[];
  info: { title?: string; author?: string };
}

interface Line {
  text: string;
  y: number;
  size: number;
}

/** Lines in reading order: pdf.js items joined until the baseline moves. */
function linesOf(items: any[]): Line[] {
  const lines: Line[] = [];
  let current: Line | null = null;
  for (const item of items) {
    const str = String(item.str ?? '');
    const y = item.transform?.[5] ?? 0;
    const size = Math.abs(item.transform?.[3] ?? 0) || item.height || 0;
    if (current && Math.abs(y - current.y) <= 2) {
      const glue = current.text.endsWith(' ') || str.startsWith(' ') || !str ? '' : ' ';
      current.text += glue + str;
      current.size = Math.max(current.size, size);
    } else {
      if (current && current.text.trim()) lines.push(current);
      current = { text: str, y, size };
    }
  }
  if (current && current.text.trim()) lines.push(current);
  return lines.map((l) => ({ ...l, text: l.text.replace(/\s+/g, ' ').trim() }));
}

/** Text with digits and roman numerals removed, for spotting running headers and footers. */
const shape = (text: string) =>
  text
    .toLowerCase()
    .replace(/\b[ivxlcdm]+\b/g, '')
    .replace(/\d+/g, '')
    .replace(/[^a-z]+/g, ' ')
    .trim();

/**
 * Lines repeated at the top or bottom of many pages (running heads, footers, page numbers).
 * They would otherwise sit inside every passage and pull its embedding towards the book title.
 */
function boilerplate(pages: Line[][]): Set<string> {
  const counts = new Map<string, number>();
  for (const lines of pages) {
    const edge = [...lines.slice(0, 2), ...lines.slice(-2)];
    for (const key of new Set(edge.map((l) => shape(l.text)))) {
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  const threshold = Math.max(5, pages.length * 0.15);
  return new Set(
    Array.from(counts.entries())
      .filter(([, n]) => n >= threshold)
      .map(([k]) => k)
  );
}

const isPageNumber = (text: string) => /^(page\s*)?[\divxlcdm]{1,6}$/i.test(text.trim());

/** Lines into paragraphs: a larger gap or a heading-sized line starts a new one. */
function paragraphsOf(lines: Line[]): PdfParagraph[] {
  if (!lines.length) return [];
  const gaps = lines
    .slice(1)
    .map((l, i) => Math.abs(lines[i].y - l.y))
    .filter((g) => g > 0)
    .sort((a, b) => a - b);
  const typical = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 12;
  const paragraphs: PdfParagraph[] = [];
  let text = '';
  let size = lines[0].size;
  let prev: Line | null = null;
  for (const line of lines) {
    // A superscript or subscript ("10" then "6") is a short line in smaller type just off
    // the baseline: it belongs inside the sentence, not in a paragraph of its own.
    if (prev && line.text.length <= 4 && line.size < prev.size * 0.85) {
      text += line.text;
      continue;
    }
    const gap = prev ? Math.abs(prev.y - line.y) : 0;
    const sizeJump = prev ? Math.abs(line.size - prev.size) > 1.5 : false;
    if (prev && gap <= 2) {
      text += ' ' + line.text;
      continue;
    }
    if (prev && (gap > typical * 1.45 || sizeJump)) {
      if (text.trim()) paragraphs.push({ text: text.trim(), size });
      text = '';
      size = line.size;
    }
    if (text.endsWith('-') && /^[a-z]/.test(line.text)) text = text.slice(0, -1) + line.text;
    else text += (text ? ' ' : '') + line.text;
    prev = line;
  }
  if (text.trim()) paragraphs.push({ text: text.trim(), size });
  return paragraphs;
}

async function outlineOf(doc: any): Promise<PdfOutlineItem[]> {
  const out: PdfOutlineItem[] = [];
  const outline = await doc.getOutline().catch(() => null);
  async function pageOf(dest: any): Promise<number | null> {
    try {
      const d = typeof dest === 'string' ? await doc.getDestination(dest) : dest;
      if (!d || !d[0]) return null;
      return (await doc.getPageIndex(d[0])) + 1;
    } catch {
      return null;
    }
  }
  async function walk(items: any[], depth: number) {
    for (const item of items || []) {
      const title = String(item.title || '')
        .replace(/\s+/g, ' ')
        .trim();
      if (title) out.push({ title, page: await pageOf(item.dest), depth });
      await walk(item.items, depth + 1);
    }
  }
  if (outline) await walk(outline, 0);
  return out;
}

export async function readPdf(buffer: Buffer): Promise<PdfText> {
  // Untrusted input: no evaluated font code, no system fonts.
  const task = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    disableFontFace: true,
  });
  const doc = await (task.promise || task);
  try {
    const labels: string[] | null = await doc.getPageLabels().catch(() => null);
    const meta = await doc.getMetadata().catch(() => null);
    const rawPages: Line[][] = [];
    if (doc.numPages > MAX_PAGES) {
      throw new Error(`The PDF has ${doc.numPages} pages; the limit is ${MAX_PAGES}`);
    }
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      rawPages.push(linesOf(content.items));
      page.cleanup?.();
    }
    const repeated = boilerplate(rawPages);
    const pages: PdfPage[] = rawPages.map((lines, i) => {
      const body = lines.filter((l, j) => {
        const atEdge = j < 2 || j >= lines.length - 2;
        return !(atEdge && (repeated.has(shape(l.text)) || isPageNumber(l.text)));
      });
      return {
        number: i + 1,
        label: (labels && labels[i]) || String(i + 1),
        paragraphs: paragraphsOf(body),
      };
    });
    return {
      pages,
      outline: await outlineOf(doc),
      info: { title: meta?.info?.Title || undefined, author: meta?.info?.Author || undefined },
    };
  } finally {
    await doc.destroy?.();
  }
}
