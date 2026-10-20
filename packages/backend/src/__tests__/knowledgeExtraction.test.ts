import {
  parseExtraction,
  MAX_CONCEPTS_PER_WINDOW,
  normaliseSubArea,
} from '../knowledge/extraction';

const areas = ['Strategy', 'Finance'];
const labels = ['112', '113', '114'];

describe('parseExtraction', () => {
  it('keeps a well-formed knowledge object', () => {
    const [c] = parseExtraction(
      {
        concepts: [
          {
            name: "Porter's Five Forces",
            aliases: ['Five forces'],
            conceptType: 'framework',
            area: 'strategy',
            level: 'intermediate',
            definition: 'Five competitive forces determine industry profitability.',
            treatment: 'extended',
            pageStart: '112',
            pageEnd: '114',
          },
        ],
      },
      labels,
      areas
    );
    expect(c).toMatchObject({
      name: "Porter's Five Forces",
      area: 'Strategy',
      conceptType: 'framework',
      pageStart: '112',
      pageEnd: '114',
      pagesVerified: true,
    });
  });

  it('replaces pages the text does not contain with the section span', () => {
    const [c] = parseExtraction(
      { concepts: [{ name: 'Value chain', area: 'Strategy', pageStart: '67', pageEnd: '78' }] },
      labels,
      areas
    );
    expect([c.pageStart, c.pageEnd, c.pagesVerified]).toEqual(['112', '114', false]);
  });

  it('files an unknown area as Other and normalises bad enums', () => {
    const [c] = parseExtraction(
      {
        concepts: [
          { name: 'X', area: 'Astrology', conceptType: 'vibe', level: 'expert', treatment: 'deep' },
        ],
      },
      labels,
      areas
    );
    expect([c.area, c.conceptType, c.level, c.treatment]).toEqual([
      'Other',
      'definition',
      'intermediate',
      'treatment',
    ]);
  });

  it('drops sentences posing as names, duplicates, and unparseable replies', () => {
    const out = parseExtraction(
      {
        concepts: [
          { name: 'NPV', area: 'Finance' },
          { name: 'npv', area: 'Finance' },
          {
            name: 'This section explains how managers should think about the value of future cash flows today',
            area: 'Finance',
          },
        ],
      },
      labels,
      areas
    );
    expect(out.map((c) => c.name)).toEqual(['NPV']);
    expect(parseExtraction('not json', labels, areas)).toEqual([]);
  });

  it('caps the number of concepts per window', () => {
    const many = {
      concepts: Array.from({ length: 40 }, (_, i) => ({ name: `Concept ${i}`, area: 'Finance' })),
    };
    expect(parseExtraction(many, labels, areas)).toHaveLength(MAX_CONCEPTS_PER_WINDOW);
  });

  it('accepts pages given as numbers, with a "p." prefix, or as a range', () => {
    const out = parseExtraction(
      {
        concepts: [
          { name: 'A', area: 'Finance', pageStart: 112, pageEnd: 113 },
          { name: 'B', area: 'Finance', pageStart: 'p. 113', pageEnd: 'pp. 114' },
          { name: 'C', area: 'Finance', pageStart: '112-114' },
        ],
      },
      labels,
      areas
    );
    expect(out.map((c) => [c.pageStart, c.pageEnd, c.pagesVerified])).toEqual([
      ['112', '113', true],
      ['113', '114', true],
      ['112', '114', true],
    ]);
  });
});

describe('normaliseSubArea', () => {
  it('folds case so one sub-area is not filed under three spellings', () => {
    expect(normaliseSubArea('Array-Based Lists')).toBe('Array-based lists');
    expect(normaliseSubArea('array-based lists')).toBe('Array-based lists');
    expect(normaliseSubArea('SQL and NoSQL')).toBe('SQL and nosql');
  });
});
