import { sectionForPages } from '../knowledge/bookStructure';
import type { BookSection } from '../knowledge/structure';

const section = (key: string, chapter: string, number: string, from: number, to: number) =>
  ({
    key,
    chapter: { index: Number(key.split('.')[0]), number: chapter, title: `Chapter ${chapter}` },
    section: { index: Number(key.split('.')[1]), number, title: `Section ${number}` },
    kind: 'body',
    pdfPageStart: from,
    pdfPageEnd: to,
    pageLabelStart: String(from - 10),
    pageLabelEnd: String(to - 10),
    blocks: [],
  }) as unknown as BookSection;

// Printed page n is file page n + 10 (ten pages of front matter).
const pageOfLabel = new Map(Array.from({ length: 200 }, (_, i) => [String(i + 1), i + 11]));
const sections = [
  section('13.0', '13', '13', 100, 101),
  section('13.1', '13', '13.1', 101, 110),
  section('13.2', '13', '13.2', 110, 120),
  section('14.0', '14', '14', 121, 125),
];

describe('sectionForPages', () => {
  it('places a citation in the section covering its pages', () => {
    expect(sectionForPages(sections, pageOfLabel, '93', '97')?.key).toBe('13.1');
  });

  it('on a page two sections share, prefers the one that also holds the last page', () => {
    // Page 100 (file 110) ends 13.1 and starts 13.2; the citation runs on to 105.
    expect(sectionForPages(sections, pageOfLabel, '100', '105')?.key).toBe('13.2');
    // A citation of that page alone belongs to the section that begins there.
    expect(sectionForPages(sections, pageOfLabel, '100', '100')?.key).toBe('13.2');
  });

  it('keeps the section a citation was filed under when its pages allow it', () => {
    expect(sectionForPages(sections, pageOfLabel, '100', '100', '13.1')?.key).toBe('13.1');
    // A section the pages rule out is not kept: 13.1 ends before page 105.
    expect(sectionForPages(sections, pageOfLabel, '100', '105', '13.1')?.key).toBe('13.2');
  });

  it('keeps the chapter when a citation runs past its first section', () => {
    expect(sectionForPages(sections, pageOfLabel, '92', '108')?.chapter.number).toBe('13');
  });

  it('returns null for a page the book does not have', () => {
    expect(sectionForPages(sections, pageOfLabel, 'xiv', 'xv')).toBeNull();
    expect(sectionForPages(sections, pageOfLabel, '150', '151')).toBeNull();
  });
});
