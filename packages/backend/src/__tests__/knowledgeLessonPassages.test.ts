import {
  librarySourcesForLesson,
  passageLabel,
  sectionRefsFor,
  selectLessonPassages,
  PassageRow,
} from '../knowledge/lessonPassages';

const long = (word: string) => `${word} `.repeat(40);
const row = (bookId: string, sectionKey: string, order: number, text: string): PassageRow => ({
  bookId,
  sectionKey,
  order,
  text,
  chapter: { number: '4', title: 'x' },
  pageLabelStart: '10',
  pageLabelEnd: '12',
});
const books = new Map([
  ['a', { title: 'Book A' }],
  ['b', { title: 'Book B' }],
]);

describe('sectionRefsFor', () => {
  const concepts = new Map<string, any>([
    [
      'K1',
      {
        evidence: [
          { bookId: 'a', sectionKey: 's1', chapter: { number: '4' } },
          { bookId: 'a', sectionKey: 's9', chapter: { number: '7' } },
        ],
      },
    ],
    ['K2', { evidence: [{ bookId: 'a', sectionKey: 's1', chapter: { number: '4' } }] }],
    ['K3', { evidence: [{ bookId: 'b', sectionKey: 't1', chapter: { number: '4' } }] }],
  ]);

  it('keeps only the source chapter and ranks sections by concepts taught', () => {
    const refs = sectionRefsFor(
      [{ chapter: { number: '4' }, libraryConcepts: ['K1', 'K2', 'K3'] }],
      concepts
    );
    expect(refs.map((r) => r.sectionKey)).toEqual(['s1', 't1']);
    expect(refs[0].weight).toBe(2);
  });

  it('respects a recorded book id', () => {
    const refs = sectionRefsFor([{ bookId: 'b', libraryConcepts: ['K1', 'K3'] }], concepts);
    expect(refs.map((r) => r.bookId)).toEqual(['b']);
  });
});

describe('librarySourcesForLesson', () => {
  const ts = [
    { id: 'lib-M1-1', moduleId: 'm1', libraryConcepts: ['K1'], linkedMLOs: ['L1'] },
    { id: 'lib-M1-2', moduleId: 'm1', libraryConcepts: ['K2'], linkedMLOs: ['L2'] },
    { id: 'src-M1-1', moduleId: 'm1' },
  ];
  it('prefers the sources the readings cite', () => {
    expect(librarySourcesForLesson(ts, ['lib-M1-2'], ['L1'], 'm1').map((s) => s.id)).toEqual([
      'lib-M1-2',
    ]);
  });
  it('falls back to library sources serving the outcomes, then the module', () => {
    expect(librarySourcesForLesson(ts, [], ['L1'], 'm1').map((s) => s.id)).toEqual(['lib-M1-1']);
    expect(librarySourcesForLesson(ts, [], ['LX'], 'm1')).toHaveLength(2);
  });
});

describe('selectLessonPassages', () => {
  it('takes passages from more than one book and caps at four', () => {
    const rows = [
      ...[1, 2, 3, 4].map((i) => row('a', `s${i}`, i, long('alpha'))),
      row('b', 't1', 1, long('beta')),
    ];
    const out = selectLessonPassages(rows, books, 'alpha');
    expect(out).toHaveLength(4);
    expect(new Set(out.map((p) => p.bookId))).toEqual(new Set(['a', 'b']));
  });

  it('prefers passages matching the lesson focus, and skips headings and unknown books', () => {
    const rows = [
      row('a', 's1', 1, long('banana')),
      row('a', 's2', 2, long('regression')),
      row('a', 's3', 3, 'Short heading'),
      row('z', 's4', 4, long('regression')),
    ];
    const out = selectLessonPassages(rows, books, 'regression analysis', { max: 1 });
    expect(out).toHaveLength(1);
    expect(out[0].content).toContain('regression');
  });

  it('clips long passages to the character budget', () => {
    const [p] = selectLessonPassages([row('a', 's1', 1, long('word').repeat(10))], books, '', {
      chars: 100,
    });
    expect(p.content.length).toBeLessThanOrEqual(101);
  });

  it('labels with book, chapter and pages', () => {
    expect(passageLabel({ title: 'Book A' }, row('a', 's', 1, ''))).toBe(
      'Book A, ch. 4, pp. 10–12'
    );
  });
});
