import {
  chapterApa,
  chapterSpan,
  withChapterSpan,
  ChapterGroup,
} from '../knowledge/chapterSources';

const toc = [
  { chapter: '9', title: 'Nine', pages: '421-470' },
  { chapter: '10', title: 'Ten', pages: '471–504' },
  { chapter: '11', title: 'Eleven', pages: 'xii' },
];

describe('chapterSpan', () => {
  it('reads the whole chapter from the table of contents', () => {
    expect(chapterSpan(toc, '9')).toEqual({ start: '421', end: '470' });
    expect(chapterSpan(toc, '10')).toEqual({ start: '471', end: '504' });
  });
  it('returns null for an unknown chapter, an unusable span or no toc', () => {
    expect(chapterSpan(toc, '11')).toBeNull();
    expect(chapterSpan(toc, '99')).toBeNull();
    expect(chapterSpan(undefined, '9')).toBeNull();
    expect(chapterSpan(toc, '')).toBeNull();
  });
});

describe('withChapterSpan', () => {
  const g: ChapterGroup = {
    bookId: 'b',
    chapterNumber: '10',
    chapterTitle: 'Ten',
    pageStart: '471',
    pageEnd: '471',
    concepts: [],
  };
  it('widens to the chapter and keeps the concept pages as key pages', () => {
    const out = withChapterSpan(g, toc);
    expect(out).toMatchObject({
      pageStart: '471',
      pageEnd: '504',
      keyPageStart: '471',
      keyPageEnd: '471',
    });
    expect(g.pageEnd).toBe('471');
  });
  it('leaves the group alone when the book lists no span', () => {
    expect(withChapterSpan(g, [])).toBe(g);
  });
  it('feeds the APA citation the full span', () => {
    const apa = chapterApa(
      { id: 'b', title: 'T', authors: ['A B'], year: 2020 },
      withChapterSpan(g, toc)
    );
    expect(apa).toContain('Chapter 10, pp. 471–504');
  });
});
