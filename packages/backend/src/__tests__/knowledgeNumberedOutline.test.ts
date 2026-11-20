/**
 * Books added on 19 November 2026 for Anjali Pai: LibreTexts-style PDFs whose chapters and
 * sections share one bookmark depth, with the numbers in the titles. These tests use outlines
 * shaped like those books, and check that an ordinary outline is read exactly as before.
 */
import { numberedOutline, isMatterTitle } from '../knowledge/numberedOutline';
import { structureBook } from '../knowledge/structure';
import type { PdfOutlineItem, PdfText } from '../knowledge/pdf/readPdf';

const o = (title: string, page: number, depth = 0): PdfOutlineItem => ({ title, page, depth });

/** Pages of filler text, one paragraph each, so every bookmark has something to hold. */
function pdfOf(outline: PdfOutlineItem[], pages = 60): PdfText {
  return {
    info: {},
    outline,
    pages: Array.from({ length: pages }, (_, i) => ({
      number: i + 1,
      label: String(i + 1),
      paragraphs: [{ text: `Body text of page ${i + 1}.`, size: 10 }],
    })),
  };
}

const socialMedia = [
  o('Table of Contents', 4),
  o('Licensing', 7),
  o('1: Introduction to Social Media', 8),
  o('1.1: Course Objectives', 9),
  o('1.2: Introduction to Social Media', 10),
  o('1.3: Social Media Platforms', 14),
  o('2: Social Media Collaboration', 22),
  o('2.1: Course Objectives', 23),
  o('2.2: Collaboration Tools', 24),
  o('3: Social Media Strategy', 40),
  o('3.1: Course Objectives', 41),
];

const watt = [
  o('Front Matter', 1),
  o('1: TitlePage', 1, 1),
  o('2: InfoPage', 2, 1),
  o('Table of Contents', 5),
  o('1: Chapters', 13),
  o('1.1: Project Management - Past and Present', 14, 1),
  o('1.1.1: History', 15, 2),
  o('1.2: Project Management Overview', 22, 1),
  o('1.3: Project Life Cycles', 32, 1),
  o('1.4: Project Initiation', 44, 1),
  o('Back Matter', 55),
  o('Index', 56, 1),
];

describe('numberedOutline', () => {
  it('reads flat "N:" and "N.M:" titles as chapters and their sections', () => {
    const out = numberedOutline(socialMedia)!;
    expect(out.filter((i) => i.depth === 0).map((i) => i.title)).toEqual([
      'Table of Contents',
      'Licensing',
      '1 Introduction to Social Media',
      '2 Social Media Collaboration',
      '3 Social Media Strategy',
    ]);
    expect(out.find((i) => i.title === '2.2 Collaboration Tools')?.depth).toBe(1);
  });

  it('treats a single "1: Chapters" wrapper as nothing and its children as chapters 1..n', () => {
    const out = numberedOutline(watt)!;
    const chapters = out.filter((i) => i.depth === 0 && /^\d/.test(i.title));
    expect(chapters.map((i) => i.title)).toEqual([
      '1 Project Management - Past and Present',
      '2 Project Management Overview',
      '3 Project Life Cycles',
      '4 Project Initiation',
    ]);
    // "1.1.1" becomes a section of chapter 1; the front matter's own numbered children vanish.
    expect(out.map((i) => i.title)).toContain('1.1 History');
    expect(out.map((i) => i.title)).not.toContain('1 TitlePage');
  });

  it('recognises front and back matter titles', () => {
    for (const t of ['Licensing', 'About the Authors', 'Versioning History', 'InfoPage', 'Index'])
      expect(isMatterTitle(t)).toBe(true);
    expect(isMatterTitle('Licensing Agreements in Practice')).toBe(false);
  });

  it('returns null for an outline without the numbering', () => {
    expect(
      numberedOutline([
        o('Preface', 1),
        o('Introduction to Strategy', 2),
        o('What Strategy Is', 2, 1),
        o('The Five Forces', 3, 1),
        o('Internal Analysis', 5),
        o('The Value Chain', 5, 1),
      ])
    ).toBeNull();
    // Sections numbered without a colon are the ordinary form and stay by depth.
    expect(
      numberedOutline([
        o('1 A', 1),
        o('1.1 B', 2, 1),
        o('1.2 C', 3, 1),
        o('2 D', 4),
        o('2.1 E', 5, 1),
        o('2.2 F', 6, 1),
      ])
    ).toBeNull();
  });
});

describe('structureBook with a numbered outline', () => {
  it('numbers chapters by their printed number, not a running count', () => {
    const { sections } = structureBook(pdfOf(socialMedia));
    const chapters = new Map(sections.map((s) => [s.chapter.number, s.chapter.title]));
    expect(Array.from(chapters.keys()).filter(Boolean)).toEqual(['1', '2', '3']);
    const s = sections.find((x) => x.section.number === '2.2')!;
    expect(s.chapter.number).toBe('2');
    expect(s.pdfPageStart).toBe(24);
    expect(s.pdfPageEnd).toBe(39);
  });

  it('marks contents and licensing as matter', () => {
    const { sections } = structureBook(pdfOf(socialMedia));
    expect(sections.filter((s) => s.kind === 'matter').map((s) => s.chapter.title)).toEqual(
      expect.arrayContaining(['Table of Contents', 'Licensing'])
    );
    expect(sections.find((s) => s.chapter.number === '1')?.kind).not.toBe('matter');
  });

  it('turns Watt wrapper children into chapters with page ranges', () => {
    const { sections } = structureBook(pdfOf(watt));
    const ch2 = sections.filter((s) => s.chapter.number === '2');
    expect(ch2[0].chapter.title).toBe('Project Management Overview');
    expect(Math.min(...ch2.map((s) => s.pdfPageStart))).toBe(22);
    expect(Math.max(...ch2.map((s) => s.pdfPageEnd))).toBe(31);
    expect(sections.some((s) => s.chapter.number === '5')).toBe(false);
  });

  it('leaves an ordinary outline as it was', () => {
    const outline = [
      o('Preface', 1),
      o('Introduction to Strategy', 2),
      o('What Strategy Is', 2, 1),
      o('The Five Forces', 3, 1),
      o('Internal Analysis', 5),
      o('The Value Chain', 5, 1),
    ];
    const { sections } = structureBook(pdfOf(outline, 8));
    expect(sections.filter((s) => s.kind !== 'matter').map((s) => s.chapter.number)).toEqual([
      '1',
      '1',
      '2',
    ]);
  });
});
