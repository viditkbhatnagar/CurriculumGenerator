import {
  chapterRunningHead,
  headingsFromNumbers,
  headingsFromRunningHeads,
  titledOutline,
} from '../knowledge/pageHeadings';
import { classifySection, structureBook } from '../knowledge/structure';
import type { PdfText } from '../knowledge/pdf/readPdf';

const para = (text: string, size = 10) => ({ text, size });
const body = (n = 6) =>
  Array.from({ length: n }, (_, i) =>
    para(`Body sentence number ${i} explains the idea at length.`)
  );
const page = (number: number, paragraphs: { text: string; size: number }[]) => ({
  number,
  label: String(number),
  paragraphs,
});

/** A book with numbered sections, a contents page, and a part opener before chapter 1. */
function numberedBook(): PdfText {
  const pages = [
    page(1, [
      para('Contents', 20),
      para('1 Accounting on a cash basis 3 1.1 Introduction 3 1.2 Users 5'),
    ]),
    page(2, [para('PART 1', 36), para('Income and asset value measurement', 26)]),
  ];
  let n = 3;
  for (let ch = 1; ch <= 4; ch++) {
    pages.push(
      page(n++, [
        para(`${ch}.1 Introduction`, 12),
        ...body(),
        para(`CHAPTER ${ch}`, 30),
        para(`Chapter ${ch} title line`, 22),
      ])
    );
    for (let s = 2; s <= 5; s++)
      pages.push(page(n++, [para(`${ch}.${s} Topic ${ch}-${s}`, 12), ...body()]));
  }
  return { info: {}, outline: [], pages };
}

/** A book whose chapters show only in running heads, with a contents page listing them. */
function runningHeadBook(): PdfText {
  const pages = [
    page(1, [
      para('Contents', 20),
      para('Chapter 1 Introduction to Management', 7),
      para('Chapter 2 Planning', 7),
    ]),
  ];
  let n = 2;
  const titles = ['Introduction to Management', 'Planning', 'Decision Making', 'Leadership'];
  titles.forEach((title, i) => {
    pages.push(page(n++, [para(title, 42), para('CHAPTER', 36), para(String(i + 1), 150)]));
    for (let k = 0; k < 6; k++) {
      pages.push(
        page(n++, [
          para(
            k % 2
              ? `CHAPTER ${i + 1} | ${title.toUpperCase()}`
              : `${n} PART 1 | THE MANAGER'S TERRAIN`,
            13
          ),
          ...(k % 3 === 0
            ? [para(`${k ? 'APPLYING' : 'WHAT IS'} ${title.toUpperCase()}?`, 14)]
            : []),
          ...body(),
        ])
      );
    }
  });
  return { info: {}, outline: [], pages };
}

describe('headingsFromNumbers', () => {
  it('reads chapters from numbered sections and titles them from their own CHAPTER line', () => {
    const items = headingsFromNumbers(numberedBook());
    const chapters = items.filter((i) => i.depth === 0);
    expect(chapters.map((c) => c.title)).toEqual([
      '1 Chapter 1 title line',
      '2 Chapter 2 title line',
      '3 Chapter 3 title line',
      '4 Chapter 4 title line',
    ]);
    expect(items.filter((i) => i.depth === 1)).toHaveLength(20);
  });

  it('ignores contents lines and stray numbers out of sequence', () => {
    const items = headingsFromNumbers(numberedBook());
    expect(items.find((i) => i.depth === 1)?.page).toBe(3);
  });

  it('gives nothing for a book without numbered sections', () => {
    expect(headingsFromNumbers(runningHeadBook())).toEqual([]);
  });
});

describe('chapterRunningHead', () => {
  it('reads the chapter number and title', () => {
    expect(chapterRunningHead('CHAPTER 3 | DECISION MAKING')).toEqual({
      number: 3,
      title: 'DECISION MAKING',
    });
    expect(chapterRunningHead('Chapter 12 Managing Change 315')).toEqual({
      number: 12,
      title: 'Managing Change',
    });
    expect(chapterRunningHead('Chapters 2 and 3 cover regulation')).toBeNull();
  });
});

describe('headingsFromRunningHeads', () => {
  const items = headingsFromRunningHeads(runningHeadBook());
  const chapters = items.filter((i) => i.depth === 0);

  it('starts each chapter at its opening page, not at a contents page that lists it', () => {
    expect(chapters.map((c) => c.title)).toEqual([
      '1 Introduction to Management',
      '2 Planning',
      '3 Decision Making',
      '4 Leadership',
    ]);
    expect(chapters[0].page).toBe(2);
  });

  it('takes sections in the usual heading size, never the part running head', () => {
    const sections = items.filter((i) => i.depth === 1).map((i) => i.title);
    expect(sections.length).toBeGreaterThan(0);
    expect(sections.some((t) => /part 1/i.test(t))).toBe(false);
  });

  it('keeps the printed chapter numbers, so no chapter is filed as front matter', () => {
    const { sections } = structureBook(runningHeadBook());
    const numbers = Array.from(new Set(sections.map((s) => s.chapter.number)));
    expect(numbers).toEqual(['1', '2', '3', '4']);
    expect(sections.every((s) => s.kind !== 'matter')).toBe(true);
  });
});

describe('titledOutline', () => {
  const pdf = (title: string): PdfText => ({
    info: {},
    outline: [{ title: 'Chapter 1', page: 1, depth: 0 }],
    pages: [page(1, [para(title, 20), ...body()])],
  });

  it('replaces a bookmark that is only a number with the printed title', () => {
    expect(titledOutline(pdf('The Balance Sheet'), pdf('x').outline)[0].title).toBe(
      '1 The Balance Sheet'
    );
  });

  it('keeps the number when the printed title is garbled by a scan', () => {
    expect(titledOutline(pdf('Financial Staten1ents'), pdf('x').outline)[0].title).toBe(
      'Chapter 1'
    );
  });
});

it('files an index letter as matter', () => {
  expect(classifySection('Introduction', 'X')).toBe('matter');
  expect(classifySection('Endnotes', 'Leadership')).toBe('matter');
});
