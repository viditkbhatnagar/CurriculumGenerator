import { apaAuthors, chapterApa, groupByChapter } from '../knowledge/chapterSources';

const ev = (bookId: string, ch: string, start: string, end: string, role = 'primary') => ({
  bookId,
  role,
  chapter: { number: ch, title: `Chapter ${ch}` },
  pageLabelStart: start,
  pageLabelEnd: end,
});

describe('groupByChapter', () => {
  it('groups concepts by the chapter that teaches them and spans their pages', () => {
    const groups = groupByChapter([
      { code: 'K1', name: 'Gradient descent', evidence: [ev('b1', '6', '77', '84')] },
      { code: 'K2', name: 'SGD', evidence: [ev('b1', '6', '85', '90')] },
      { code: 'K3', name: 'Attention', evidence: [ev('b2', '12', '207', '233')] },
    ]);
    expect(groups[0]).toMatchObject({
      bookId: 'b1',
      chapterNumber: '6',
      pageStart: '77',
      pageEnd: '90',
    });
    expect(groups[0].concepts.map((c) => c.code)).toEqual(['K1', 'K2']);
    expect(groups).toHaveLength(2);
  });

  it('uses the primary treatment, not the first one listed', () => {
    const [g] = groupByChapter([
      {
        code: 'K1',
        name: 'x',
        evidence: [ev('b9', '1', '1', '2', 'supplementary'), ev('b1', '3', '40', '45')],
      },
    ]);
    expect(g.bookId).toBe('b1');
  });
});

describe('APA', () => {
  it('formats authors and a chapter citation', () => {
    expect(apaAuthors(['Simon J. D. Prince'])).toBe('Prince, S. J. D.');
    expect(apaAuthors(['Aston Zhang', 'Zachary C. Lipton', 'Mu Li'])).toBe(
      'Zhang, A., Lipton, Z. C., & Li, M.'
    );
    expect(
      chapterApa(
        {
          id: 'b',
          title: 'Understanding deep learning',
          authors: ['Simon J. D. Prince'],
          year: 2023,
          publisher: 'MIT Press',
          url: 'https://udlbook.github.io/',
        },
        {
          bookId: 'b',
          chapterNumber: '12',
          chapterTitle: 'Transformers',
          pageStart: '207',
          pageEnd: '233',
          concepts: [],
        }
      )
    ).toBe(
      'Prince, S. J. D. (2023). Understanding deep learning (Chapter 12, pp. 207–233). MIT Press. https://udlbook.github.io/'
    );
  });
});
