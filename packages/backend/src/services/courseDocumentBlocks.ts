/**
 * A course document as a flat list of blocks: headings, paragraphs, list items and table rows.
 *
 * Athira Hari at India Learns asked on 19 November 2026 whether courses already drafted in
 * ChatGPT could be developed further here, starting from the structure they already have.
 * Those documents arrive as Word files, PDFs, markdown or pasted text, each with its own
 * markup. Reading them into one plain shape first means the parser that finds the programme
 * and its modules is written once and tested without any file in sight.
 */
import * as cheerio from 'cheerio';

export type CourseBlock =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'para'; text: string }
  | { kind: 'item'; text: string; depth: number }
  | { kind: 'row'; cells: string[]; isHeader: boolean };

/** Markdown emphasis and escapes removed, whitespace collapsed. */
export const plain = (value: string): string =>
  value
    .replace(/\*\*|__/g, '')
    .replace(/(^|\s)[*_]([^*_]+)[*_](?=\s|$|[.,;:])/g, '$1$2')
    .replace(/`/g, '')
    .replace(/\\([|*_#])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

const TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split(/(?<!\\)\|/).map((c) => plain(c));
}

/** Markdown (or plain text that follows its conventions) to blocks. */
export function blocksFromMarkdown(source: string): CourseBlock[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: CourseBlock[] = [];
  let paragraph: string[] = [];

  const flush = () => {
    if (paragraph.length) blocks.push({ kind: 'para', text: plain(paragraph.join(' ')) });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    if (/^\s*(---+|\*\*\*+|___+)\s*$/.test(line)) {
      flush();
      continue;
    }

    const heading = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ kind: 'heading', level: heading[1].length, text: plain(heading[2]) });
      continue;
    }

    if (line.includes('|') && /^\s*\|/.test(line)) {
      flush();
      const next = lines[i + 1] || '';
      if (TABLE_SEPARATOR.test(next)) {
        blocks.push({ kind: 'row', cells: splitRow(line), isHeader: true });
        i += 1;
      } else if (!TABLE_SEPARATOR.test(line)) {
        blocks.push({ kind: 'row', cells: splitRow(line), isHeader: false });
      }
      continue;
    }

    const item = /^(\s*)(?:[-*•–]|\d{1,3}[.)]|[a-z][.)])\s+(.+)$/.exec(line);
    if (item) {
      flush();
      const indent = item[1].replace(/\t/g, '    ').length;
      blocks.push({ kind: 'item', text: plain(item[2]), depth: Math.floor(indent / 2) });
      continue;
    }

    // "Credits: 10" on consecutive lines are separate fields, not one sentence.
    if (/^\*{0,2}[A-Za-z][A-Za-z /&-]{1,40}?\*{0,2}\s*:/.test(line.trim())) {
      flush();
      blocks.push({ kind: 'para', text: plain(line) });
      continue;
    }
    paragraph.push(line.trim());
  }
  flush();
  return blocks;
}

/** HTML (from mammoth) to blocks, in document order. */
export function blocksFromHtml(html: string): CourseBlock[] {
  const $ = cheerio.load(`<div id="root">${html}</div>`);
  const blocks: CourseBlock[] = [];

  const walk = (el: any, depth: number) => {
    $(el)
      .children()
      .each((_, child) => {
        const tag = (child as any).tagName?.toLowerCase();
        const text = plain($(child).text());
        if (/^h[1-6]$/.test(tag)) {
          if (text) blocks.push({ kind: 'heading', level: Number(tag[1]), text });
        } else if (tag === 'p') {
          if (!text) return;
          // Word often carries a bold-only paragraph as a heading.
          const onlyStrong =
            $(child).children('strong').length > 0 &&
            plain($(child).children('strong').text()) === text;
          if (onlyStrong && text.length < 100 && !/[.:]$/.test(text)) {
            blocks.push({ kind: 'heading', level: 4, text });
          } else {
            blocks.push({ kind: 'para', text });
          }
        } else if (tag === 'ul' || tag === 'ol') {
          $(child)
            .children('li')
            .each((__, li) => {
              const own = plain(
                $(li)
                  .contents()
                  .filter(
                    (___, n) =>
                      (n as any).tagName?.toLowerCase() !== 'ul' &&
                      (n as any).tagName?.toLowerCase() !== 'ol'
                  )
                  .text()
              );
              if (own) blocks.push({ kind: 'item', text: own, depth });
              walk(li, depth + 1);
            });
        } else if (tag === 'table') {
          $(child)
            .find('tr')
            .each((__, tr) => {
              const cells = $(tr)
                .children('th,td')
                .toArray()
                .map((c) => plain($(c).text()));
              if (cells.some(Boolean)) {
                blocks.push({
                  kind: 'row',
                  cells,
                  isHeader: $(tr).children('th').length > 0,
                });
              }
            });
        } else if (tag === 'div' || tag === 'section') {
          walk(child, depth);
        }
      });
  };
  walk($('#root').first(), 0);
  return blocks;
}

/**
 * Text lifted from a PDF has lost its markup. Numbered lines and short capitalised lines
 * without a full stop are the best signal left for headings.
 */
export function blocksFromPdfText(source: string): CourseBlock[] {
  const out: CourseBlock[] = [];
  for (const block of blocksFromMarkdown(source)) {
    if (block.kind === 'para') {
      for (const line of block.text.split(/(?<=[.!?])\s{2,}/)) {
        if (line.trim()) out.push({ kind: 'para', text: line.trim() });
      }
    } else out.push(block);
  }
  return out;
}

export const blocksToText = (blocks: CourseBlock[]): string =>
  blocks
    .map((b) => {
      if (b.kind === 'heading') return `${'#'.repeat(b.level)} ${b.text}`;
      if (b.kind === 'item') return `${'  '.repeat(b.depth)}- ${b.text}`;
      if (b.kind === 'row') return `| ${b.cells.join(' | ')} |`;
      return b.text;
    })
    .join('\n');
