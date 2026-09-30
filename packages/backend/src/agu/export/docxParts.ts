/**
 * The Word building blocks the AGU course package is made of: text runs, headings, bullets,
 * tables with a real column grid, and safe links. Shared by the package's sections so every
 * template renders the same way.
 */
import {
  ExternalHyperlink,
  HeadingLevel,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';

export const FONT = 'Arial';
export const BODY = 20;
// The text width of the default A4 page with one-inch margins, in twentieths of a point.
const TEXT_WIDTH_DXA = 11906 - 2 * 1440;

export const t = (text: string, opts: { bold?: boolean; italics?: boolean } = {}) =>
  new TextRun({ text, font: FONT, size: BODY, ...opts });
export const p = (text: string, opts: { bold?: boolean; italics?: boolean } = {}) =>
  new Paragraph({ children: [t(text, opts)], spacing: { after: 100 } });
export const h = (text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) =>
  new Paragraph({ text, heading: level, spacing: { before: 240, after: 100 } });
export const bullet = (text: string) =>
  new Paragraph({ children: [t(text)], bullet: { level: 0 } });

/** A cell holds text, one paragraph, or several (options under a question, say). */
export type CellContent = string | Paragraph | Paragraph[];

/**
 * A table with header row and, optionally, column widths in percent. Equal widths squeezed a
 * six-column weekly plan into columns a few words wide, so a lecture's topics ran down the
 * page one word per line.
 */
export function table(header: string[], rows: CellContent[][], widths?: number[]): Table {
  // Word and LibreOffice lay a table out from its column grid, not from per-cell percentages,
  // so the widths are given as a fixed grid in twips.
  const columns = widths?.map((pct) => Math.round((TEXT_WIDTH_DXA * pct) / 100));
  const paragraphs = (content: CellContent, bold: boolean): Paragraph[] => {
    if (typeof content === 'string') return [new Paragraph({ children: [t(content, { bold })] })];
    return Array.isArray(content) ? (content.length ? content : [new Paragraph({})]) : [content];
  };
  const cell = (content: CellContent, column: number, bold = false) =>
    new TableCell({
      children: paragraphs(content, bold),
      ...(columns?.[column] ? { width: { size: columns[column], type: WidthType.DXA } } : {}),
    });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    ...(columns ? { columnWidths: columns, layout: TableLayoutType.FIXED } : {}),
    rows: [
      new TableRow({ tableHeader: true, children: header.map((x, i) => cell(x, i, true)) }),
      ...rows.map((r) => new TableRow({ children: r.map((x, i) => cell(x, i)) })),
    ],
  });
}

/** Lines as separate paragraphs in one cell. */
export const lines = (...texts: string[]): Paragraph[] =>
  texts.filter(Boolean).map((text) => new Paragraph({ children: [t(text)] }));

/** A clickable link for http(s) addresses; anything else is printed as text, never linked. */
export function linkParagraph(url: string | undefined): Paragraph {
  if (!url || !/^https?:\/\//i.test(url)) return new Paragraph({ children: [t(url || '—')] });
  return new Paragraph({
    children: [
      new ExternalHyperlink({
        link: url,
        children: [
          new TextRun({ text: url, font: FONT, size: BODY, color: '0563C1', underline: {} }),
        ],
      }),
    ],
  });
}

export const sum = (xs: number[]) => Math.round(xs.reduce((n, x) => n + (x || 0), 0) * 100) / 100;
