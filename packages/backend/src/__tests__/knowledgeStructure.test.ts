import {
  classifySection,
  passagesOf,
  sectionWindows,
  pageLabelsIn,
  splitNumber,
  structureBook,
} from '../knowledge/structure';
import type { PdfText } from '../knowledge/pdf/readPdf';

const para = (text: string, size = 10) => ({ text, size });
const page = (number: number, label: string, texts: (string | [string, number])[]) => ({
  number,
  label,
  paragraphs: texts.map((t) => (Array.isArray(t) ? para(t[0], t[1]) : para(t))),
});

/** A small book: preface, two chapters with sections, an answer key. */
function book(): PdfText {
  return {
    info: {},
    outline: [
      { title: 'Preface', page: 1, depth: 0 },
      { title: 'Introduction to Strategy', page: 2, depth: 0 },
      { title: 'What Strategy Is', page: 2, depth: 1 },
      { title: 'The Five Forces', page: 3, depth: 1 },
      { title: 'Exercises', page: 4, depth: 1 },
      { title: 'Internal Analysis', page: 5, depth: 0 },
      { title: 'The Value Chain', page: 5, depth: 1 },
      { title: 'Answers to Exercises', page: 6, depth: 0 },
    ],
    pages: [
      page(1, 'ix', ['This book is for managers.']),
      page(2, '1', [
        ['Chapter 1', 14],
        ['Introduction to Strategy', 17],
        'Strategy is about choices.',
        ['1.1 What Strategy Is', 12],
        'A strategy is a set of integrated choices.',
      ]),
      page(3, '2', [
        ['Introduction to Strategy 2', 9],
        'Choices continue here.',
        ['1.2 The Five Forces', 12],
        "Porter's five forces shape industry profitability.",
      ]),
      page(4, '3', [['1.3 Exercises', 12], 'Explain the five forces.']),
      page(5, '4', [
        ['Chapter 2', 14],
        ['Internal Analysis', 17],
        ['2.1 The Value Chain', 12],
        'The value chain disaggregates a firm into activities.',
      ]),
      page(6, '5', [['Answers to Exercises', 14], 'Answer 1: rivalry, entry, buyers.']),
    ],
  };
}

describe('splitNumber', () => {
  it('reads chapter and section numbers', () => {
    expect(splitNumber('Chapter 3: Strategy')).toEqual({ number: '3', title: 'Strategy' });
    expect(splitNumber('2.1 Interfaces')).toEqual({ number: '2.1', title: 'Interfaces' });
    expect(splitNumber('Interfaces')).toEqual({ number: '', title: 'Interfaces' });
  });
});

describe('classifySection', () => {
  it('restricts answer keys and instructor material', () => {
    expect(classifySection('Answers to Exercises')).toBe('restricted');
    expect(classifySection('Solutions Manual')).toBe('restricted');
    expect(classifySection('Anything', "Instructor's Guide")).toBe('restricted');
  });
  it('keeps exercises as teaching material, not restricted', () => {
    expect(classifySection('Discussion and Exercises')).toBe('exercise');
  });
  it('marks front and back matter', () => {
    expect(classifySection('Acknowledgments')).toBe('matter');
    expect(classifySection('Index')).toBe('matter');
    expect(classifySection('The Value Chain')).toBe('body');
  });
});

describe('structureBook', () => {
  const { sections } = structureBook(book());
  const byTitle = (t: string) => sections.find((s) => s.section.title === t)!;

  it('gives each section the chapter, number and printed pages of the book', () => {
    const forces = byTitle('The Five Forces');
    expect(forces.chapter).toMatchObject({ number: '1', title: 'Introduction to Strategy' });
    expect(forces.section.number).toBe('1.2');
    expect([forces.pageLabelStart, forces.pageLabelEnd]).toEqual(['2', '2']);
  });

  it('splits a page at the heading, so earlier text stays with the previous section', () => {
    const what = byTitle('What Strategy Is');
    expect(what.blocks.map((b) => b.text)).toContain('Choices continue here.');
    expect(byTitle('The Five Forces').blocks.map((b) => b.text)).not.toContain(
      'Choices continue here.'
    );
  });

  it('drops a running head that repeats the chapter title', () => {
    const what = byTitle('What Strategy Is');
    expect(what.blocks.map((b) => b.text)).not.toContain('Introduction to Strategy 2');
  });

  it('marks the answer key restricted and the preface as matter', () => {
    const kinds = Object.fromEntries(
      sections.map((s) => [s.chapter.title + '/' + s.section.title, s.kind])
    );
    expect(kinds['Answers to Exercises/Introduction']).toBe('restricted');
    expect(kinds['Preface/Introduction']).toBe('matter');
    expect(kinds['Introduction to Strategy/Exercises']).toBe('exercise');
  });
});

describe('passages and windows', () => {
  const { sections } = structureBook(book());
  const vc = sections.find((s) => s.section.title === 'The Value Chain')!;

  it('keeps each passage inside one section with its page labels', () => {
    const [p] = passagesOf(vc);
    expect(p.sectionKey).toBe(vc.key);
    expect(p.pageLabelStart).toBe('4');
    expect(p.text).toContain('value chain');
  });

  it('never makes a passage longer than the limit unless one sentence is', () => {
    const long = {
      ...vc,
      blocks: [{ page: 5, label: '4', text: 'A sentence here. '.repeat(400) }],
    };
    expect(Math.max(...passagesOf(long, 500).map((p) => p.text.length))).toBeLessThanOrEqual(520);
  });

  it('marks printed pages in extraction windows', () => {
    const forces = sections.find((s) => s.section.title === 'What Strategy Is')!;
    expect(pageLabelsIn(sectionWindows(forces)[0])).toEqual(['1', '2']);
  });
});
