/**
 * docx → PDF conversion that runs entirely in-process — no headless
 * browser.
 *
 * The earlier Puppeteer/Chromium approach OOM-killed the API on Render
 * (Chromium needs far more memory than the instance can spare alongside
 * the Node server). This renderer instead converts the generated Word
 * document to HTML with `mammoth`, walks that HTML, and emits a PDF with
 * `pdfmake` — both pure-JS, a few tens of MB of memory, no native deps.
 *
 * mammoth emits a small, predictable tag set (h1-h6, p, ul/ol/li,
 * table/tr/td, strong/em/u/a, br, img); the walker below maps exactly
 * those onto pdfmake's document model.
 */
import mammoth from 'mammoth';
import { parse } from 'node-html-parser';
import { loggingService } from './loggingService';

// pdfmake's server-side printer is a CommonJS class export with no
// ergonomic ESM typing — require it directly.
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const PdfPrinter = require('pdfmake');

// The 14 standard PDF fonts are built into pdfkit, so PDF generation
// needs no .ttf files shipped with the app.
const printer = new PdfPrinter({
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
});

const TABLE_LAYOUT = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => '#c9c9c9',
  vLineColor: () => '#c9c9c9',
  paddingLeft: () => 5,
  paddingRight: () => 5,
  paddingTop: () => 3,
  paddingBottom: () => 3,
};

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntitiesOnce(input: string): string {
  return input.replace(/&(#?[a-zA-Z0-9]+);/g, (match, entity: string) => {
    if (NAMED_ENTITIES[entity] !== undefined) return NAMED_ENTITIES[entity];
    if (entity[0] === '#') {
      const code =
        entity[1] === 'x' || entity[1] === 'X'
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return match;
  });
}

/**
 * Decode HTML entities, repeating until stable — some source content is
 * double-encoded (e.g. `&amp;#x2F;`), which one pass leaves as `&#x2F;`.
 */
function decodeEntities(input: string): string {
  let current = input;
  for (let pass = 0; pass < 4; pass++) {
    const next = decodeEntitiesOnce(current);
    if (next === current) break;
    current = next;
  }
  return current;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyNode = any;
interface RunStyle {
  bold?: boolean;
  italics?: boolean;
  decoration?: string;
  color?: string;
  link?: string;
}
interface TextRun extends RunStyle {
  text: string;
}

const tagOf = (node: AnyNode): string => (node.rawTagName || '').toLowerCase();
const isElement = (node: AnyNode): boolean => node.nodeType === 1;
const isText = (node: AnyNode): boolean => node.nodeType === 3;

/** Flatten inline content (text, strong, em, a, br) into pdfmake runs. */
function collectRuns(node: AnyNode, style: RunStyle, out: TextRun[]): void {
  if (isText(node)) {
    const text = decodeEntities(node.rawText || node.text || '');
    if (text) out.push({ text, ...style });
    return;
  }
  if (!isElement(node)) return;

  const tag = tagOf(node);
  if (tag === 'br') {
    out.push({ text: '\n' });
    return;
  }
  const next: RunStyle = { ...style };
  if (tag === 'strong' || tag === 'b') next.bold = true;
  else if (tag === 'em' || tag === 'i') next.italics = true;
  else if (tag === 'u') next.decoration = 'underline';
  else if (tag === 'a') {
    const href = node.getAttribute && node.getAttribute('href');
    if (href) next.link = href;
    next.color = '#1F4788';
    next.decoration = 'underline';
  }
  for (const child of node.childNodes || []) collectRuns(child, next, out);
}

/** All descendant text of a node, decoded — used for headings. */
function textContent(node: AnyNode): string {
  const runs: TextRun[] = [];
  for (const child of node.childNodes || []) collectRuns(child, {}, runs);
  return runs
    .map((r) => r.text)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Build pdfmake list items, including nested ul/ol. */
function listItems(listNode: AnyNode): AnyNode[] {
  const items: AnyNode[] = [];
  for (const li of listNode.childNodes || []) {
    if (!isElement(li) || tagOf(li) !== 'li') continue;
    const runs: TextRun[] = [];
    const nested: AnyNode[] = [];
    for (const child of li.childNodes || []) {
      const childTag = isElement(child) ? tagOf(child) : '';
      if (childTag === 'ul' || childTag === 'ol') nested.push(child);
      else collectRuns(child, {}, runs);
    }
    items.push(runs.some((r) => r.text.trim()) ? { text: runs } : ' ');
    for (const sub of nested) {
      items.push(tagOf(sub) === 'ol' ? { ol: listItems(sub) } : { ul: listItems(sub) });
    }
  }
  return items.length ? items : [' '];
}

/** Render the contents of a table cell as pdfmake block content. */
function cellContent(cell: AnyNode): AnyNode {
  const blocks: AnyNode[] = [];
  walkBlocks(cell.childNodes || [], blocks);
  if (blocks.length === 0) return { text: '' };
  if (blocks.length === 1) return blocks[0];
  return { stack: blocks };
}

/** Convert a <table> into a pdfmake table, padding ragged rows. */
function buildTable(tableNode: AnyNode): AnyNode | null {
  const rows = tableNode.querySelectorAll('tr');
  if (!rows || rows.length === 0) return null;

  const body: AnyNode[][] = [];
  let columns = 0;
  for (const tr of rows) {
    const cells = tr.querySelectorAll('th,td');
    if (!cells || cells.length === 0) continue;
    const row: AnyNode[] = [];
    for (const cell of cells) {
      const content = cellContent(cell);
      if (tagOf(cell) === 'th') {
        row.push({ ...content, fillColor: '#f0f3f8', bold: true });
      } else {
        row.push(content);
      }
    }
    body.push(row);
    columns = Math.max(columns, row.length);
  }
  if (body.length === 0 || columns === 0) return null;

  for (const row of body) {
    while (row.length < columns) row.push({ text: '' });
  }
  return {
    table: { headerRows: 0, widths: new Array(columns).fill('*'), body },
    layout: TABLE_LAYOUT,
    style: 'para',
  };
}

/** Walk block-level HTML nodes, appending pdfmake content to `out`. */
function walkBlocks(nodes: AnyNode[], out: AnyNode[]): void {
  for (const node of nodes || []) {
    if (isText(node)) {
      const text = decodeEntities(node.rawText || node.text || '').trim();
      if (text) out.push({ text, style: 'para' });
      continue;
    }
    if (!isElement(node)) continue;

    const tag = tagOf(node);
    switch (tag) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6': {
        const text = textContent(node);
        if (text) out.push({ text, style: tag });
        break;
      }
      case 'p': {
        const runs: TextRun[] = [];
        for (const child of node.childNodes || []) collectRuns(child, {}, runs);
        if (runs.some((r) => r.text.trim())) out.push({ text: runs, style: 'para' });
        break;
      }
      case 'ul':
        out.push({ ul: listItems(node), style: 'para' });
        break;
      case 'ol':
        out.push({ ol: listItems(node), style: 'para' });
        break;
      case 'table': {
        const table = buildTable(node);
        if (table) out.push(table);
        break;
      }
      case 'img':
      case 'br':
        break;
      default:
        // div, section, body, etc. — descend into children.
        walkBlocks(node.childNodes || [], out);
    }
  }
}

/** Stream a pdfmake document definition to a Buffer. */
function renderDocDefinition(docDefinition: AnyNode): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const chunks: Buffer[] = [];
      pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', reject);
      pdfDoc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Convert a .docx buffer to a PDF buffer (A4, sensible print margins).
 */
export async function docxBufferToPdf(docxBuffer: Buffer): Promise<Buffer> {
  let html: string;
  try {
    const result = await mammoth.convertToHtml({ buffer: docxBuffer });
    html = result.value || '';
    if (result.messages && result.messages.length) {
      loggingService.info('mammoth docx→html conversion notes', { count: result.messages.length });
    }
  } catch (err) {
    loggingService.error('PDF export failed at mammoth docx→html stage', { err });
    throw err;
  }

  const root = parse(html);
  const content: AnyNode[] = [];
  walkBlocks(root.childNodes || [], content);
  if (content.length === 0) {
    content.push({ text: 'This curriculum has no content to export yet.', style: 'para' });
  }

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [50, 50, 50, 55] as [number, number, number, number],
    defaultStyle: { font: 'Helvetica', fontSize: 10, color: '#1f2937', lineHeight: 1.3 },
    styles: {
      h1: { fontSize: 20, bold: true, color: '#1F4788', margin: [0, 4, 0, 10] },
      h2: { fontSize: 15, bold: true, color: '#1F4788', margin: [0, 16, 0, 8] },
      h3: { fontSize: 12.5, bold: true, color: '#2c3e50', margin: [0, 12, 0, 5] },
      h4: { fontSize: 11, bold: true, color: '#2c3e50', margin: [0, 9, 0, 4] },
      h5: { fontSize: 10.5, bold: true, color: '#2c3e50', margin: [0, 7, 0, 3] },
      h6: { fontSize: 10, bold: true, color: '#2c3e50', margin: [0, 7, 0, 3] },
      para: { fontSize: 10, margin: [0, 0, 0, 6] },
    },
    content,
    footer: (currentPage: number, pageCount: number) => ({
      text: `${currentPage} / ${pageCount}`,
      alignment: 'center',
      fontSize: 8,
      color: '#9aa0a6',
      margin: [0, 8, 0, 0],
    }),
  };

  try {
    const pdf = await renderDocDefinition(docDefinition);
    loggingService.info('PDF export rendered (browserless)', { bytes: pdf.length });
    return pdf;
  } catch (err) {
    loggingService.error('PDF export failed during pdfmake render', { err });
    throw err;
  }
}
