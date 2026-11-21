/**
 * Athira Hari's fashion library (21 November 2026): two journal articles, text-recognised from
 * scans, were refused as "No readable text" with 4,502 and 264 words in them. They have no
 * chapter headings and no bookmarks, so no section was found, and a document without sections
 * was reported as unreadable. A headed document must read exactly as before.
 */
import { structureBook } from '../knowledge/structure';
import type { PdfText } from '../knowledge/pdf/readPdf';

const page = (n: number, paragraphs: { text: string; size: number }[]) => ({
  number: n,
  label: String(n),
  paragraphs,
});

describe('a document with text but no headings', () => {
  const article: PdfText = {
    info: {},
    outline: [],
    pages: [
      page(1, [
        { text: 'ADRRI Journal of Arts and Social Sciences, Vol. 15', size: 10 },
        { text: 'Exploring Digital Techniques for Fashion Illustration', size: 16 },
        { text: 'Abstract: fashion illustration communicates design ideas to clients.', size: 10 },
      ]),
      page(2, [
        { text: 'Digital tools such as Photoshop speed up rendering of fabric.', size: 10 },
      ]),
    ],
  };

  it('is read as one section titled from its largest line, not refused', () => {
    const { sections } = structureBook(article);
    expect(sections).toHaveLength(1);
    expect(sections[0].chapter.title).toBe('Exploring Digital Techniques for Fashion Illustration');
    expect(sections[0].kind).toBe('body');
    const text = sections[0].blocks.map((b) => b.text).join(' ');
    expect(text).toContain('Abstract: fashion illustration');
    expect(text).toContain('Photoshop');
    expect(sections[0].pdfPageEnd).toBe(2);
  });

  it('still finds nothing in a document with no text at all', () => {
    const empty: PdfText = { info: {}, outline: [], pages: [page(1, []), page(2, [])] };
    expect(structureBook(empty).sections).toEqual([]);
  });
});
