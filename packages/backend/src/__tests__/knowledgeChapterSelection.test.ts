import { selectChapters, ChapterGroup } from '../knowledge/chapterSources';

const g = (bookId: string, ch: string, n: number): ChapterGroup => ({
  bookId,
  chapterNumber: ch,
  chapterTitle: `Chapter ${ch}`,
  pageStart: '1',
  pageEnd: '2',
  concepts: Array.from({ length: n }, (_, i) => ({ code: `K${bookId}${ch}${i}`, name: 'c' })),
});

describe('selectChapters', () => {
  it('caps one book at two of three chapters even when it has the biggest groups', () => {
    const out = selectChapters([g('a', '1', 9), g('a', '2', 8), g('a', '3', 7), g('b', '1', 2)]);
    expect(out.map((x) => x.bookId).sort()).toEqual(['a', 'a', 'b']);
  });

  it('takes a third chapter from the only book when the cap is lifted', () => {
    const out = selectChapters([g('a', '1', 3), g('a', '2', 3), g('a', '3', 3)], 3, {
      perBookCap: 3,
    });
    expect(out).toHaveLength(3);
  });

  it('does not drop the only book when there is no alternative', () => {
    expect(selectChapters([g('a', '1', 3), g('a', '2', 3)])).toHaveLength(2);
  });

  it('prefers a different book when coverage is comparable', () => {
    const out = selectChapters([g('a', '1', 4), g('a', '2', 4), g('b', '1', 3)], 2);
    expect(out.map((x) => x.bookId).sort()).toEqual(['a', 'b']);
  });

  it('prefers the more recent edition when otherwise comparable', () => {
    const out = selectChapters([g('old', '1', 4), g('new', '1', 4)], 1, {
      currentYear: 2026,
      bookYears: new Map([
        ['old', 2012],
        ['new', 2024],
      ]),
    });
    expect(out[0].bookId).toBe('new');
  });

  it('spreads across the programme by penalising books used in earlier modules', () => {
    const out = selectChapters([g('a', '1', 4), g('b', '1', 3)], 1, {
      usage: new Map([['a', 3]]),
    });
    expect(out[0].bookId).toBe('b');
  });
});
