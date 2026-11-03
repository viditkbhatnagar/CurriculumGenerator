import { conceptCodesFromHits, moduleSearchQueries } from '../knowledge/programmeLibrary';

const concept = (code: string, bookId: string) => ({ code, evidence: [{ bookId }] });

describe('moduleSearchQueries', () => {
  it('uses the title, then topics and outcomes, as plain text', () => {
    const q = moduleSearchQueries({
      title: 'Data Analytics',
      topics: [{ title: 'Regression' }, 'Visualisation', ''],
      mlos: [{ statement: 'Apply regression to sales data' }],
    });
    expect(q).toEqual([
      'Data Analytics',
      'Regression',
      'Visualisation',
      'Apply regression to sales data',
    ]);
  });

  it('caps topics and outcomes so the search stays small', () => {
    const q = moduleSearchQueries({
      title: 'T',
      topics: Array.from({ length: 20 }, (_, i) => `t${i}`),
      mlos: Array.from({ length: 20 }, (_, i) => ({ statement: `m${i}` })),
    });
    expect(q).toHaveLength(1 + 6 + 4);
  });

  it('is empty for a module with nothing to search on', () => {
    expect(moduleSearchQueries({})).toEqual([]);
  });
});

describe('conceptCodesFromHits', () => {
  const hits = [concept('K1', 'a'), concept('K2', 'hidden'), concept('K3', 'b')].map((c) => ({
    concept: c,
  }));

  it('drops concepts taught only in books the programme may not use', () => {
    expect(conceptCodesFromHits({ hiddenBookIds: ['hidden'] }, hits)).toEqual(['K1', 'K3']);
  });

  it('keeps the best-first order and caps at k', () => {
    expect(conceptCodesFromHits({}, hits, 2)).toEqual(['K1', 'K2']);
  });
});
