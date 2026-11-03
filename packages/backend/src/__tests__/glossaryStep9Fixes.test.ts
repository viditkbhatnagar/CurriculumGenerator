import {
  GlossaryTermLike,
  circularDefinitions,
  filterCrossReferences,
  mergeAcronymEntries,
} from '../services/glossaryValidation';
import { attachTextbookSources, bestConceptFor } from '../services/glossaryTextbookSources';

describe('circularDefinitions (genus-differentia is not circular)', () => {
  const ordinary = [
    ['Outlier', 'An outlier is a value that lies far from the other values in a data set.'],
    ['Dashboard', 'A dashboard is a visual display of the key measures a team monitors.'],
    ['Median', 'The median is the middle value when observations are put in order.'],
    ['Cohort', 'Cohorts are groups of customers who share a starting period.'],
    ['Variance', 'Variance refers to the average squared distance from the mean.'],
    ['Regression', 'Regression: a method of estimating how one variable depends on others.'],
  ].map(([term, definition]) => ({ term, definition }));

  it('passes ordinary definitions that name the term only as the subject', () => {
    expect(circularDefinitions(ordinary)).toEqual([]);
  });

  it('flags "X means X"', () => {
    expect(
      circularDefinitions([{ term: 'Churn', definition: 'Churn means the churn of customers.' }])
    ).toEqual(['Churn']);
  });

  it('flags an acronym and its expansion that define each other', () => {
    const pair = [
      { term: 'KPI', isAcronym: true, definition: 'A KPI is a key performance indicator.' },
      {
        term: 'Key performance indicator',
        definition: 'A key performance indicator is a KPI that tracks progress.',
      },
    ];
    expect(circularDefinitions(pair)).toEqual(['KPI', 'Key performance indicator']);
  });

  it('does not flag two entries that merely mention each other later on', () => {
    const terms = [
      { term: 'Mean', definition: 'The mean is the sum of values divided by their count.' },
      {
        term: 'Median',
        definition:
          'The median is the middle value of an ordered set, unlike the mean, which is pulled by extremes.',
      },
    ];
    expect(circularDefinitions(terms)).toEqual([]);
  });
});

describe('mergeAcronymEntries', () => {
  it('folds an acronym into its expansion and keeps the full form', () => {
    const merged = mergeAcronymEntries<GlossaryTermLike>([
      {
        term: 'KPI',
        isAcronym: true,
        acronymExpansion: 'Key performance indicator',
        sourceModules: ['M1'],
        sources: ['mlos'],
        relatedTerms: ['Dashboard'],
      },
      {
        term: 'Key performance indicator',
        sourceModules: ['M2'],
        sources: ['assessment'],
        relatedTerms: ['Metric'],
      },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].term).toBe('Key performance indicator');
    expect(merged[0].acronym).toBe('KPI');
    expect(merged[0].sourceModules).toEqual(['M2', 'M1']);
    expect(merged[0].sources).toEqual(['assessment', 'mlos']);
    expect(merged[0].relatedTerms).toEqual(['Metric', 'Dashboard']);
  });

  it('leaves an acronym whose expansion has no entry of its own', () => {
    const terms = [{ term: 'ROI', isAcronym: true, acronymExpansion: 'Return on investment' }];
    expect(mergeAcronymEntries(terms)).toHaveLength(1);
  });
});

describe('filterCrossReferences', () => {
  it('keeps only references to existing entries, written as the entry, and counts the rest', () => {
    const { terms, dropped } = filterCrossReferences([
      {
        term: 'Dashboard',
        relatedTerms: ['kpi', 'Pie chart', 'Dashboard'],
        broaderTerms: ['Visualisation'],
        synonyms: ['Scorecard'],
      },
      { term: 'Key performance indicator', acronym: 'KPI' },
    ]);
    expect(terms[0].relatedTerms).toEqual(['Key performance indicator']);
    expect(terms[0].broaderTerms).toEqual([]);
    expect(terms[0].synonyms).toEqual(['Scorecard']);
    expect(dropped).toBe(3);
  });
});

describe('textbook sources', () => {
  const concept = {
    code: 'C1',
    name: 'Outlier',
    evidence: [
      { bookId: 'b2', bookTitle: 'Other', role: 'supplementary', pageLabelStart: '5' },
      {
        bookId: 'b1',
        bookTitle: 'Statistics Done Wrong',
        authors: ['Reinhart'],
        role: 'primary',
        chapter: { number: 3, title: 'Data' },
        pageLabelStart: '40',
        pageLabelEnd: '44',
      },
    ],
  };

  it('prefers a concept with the same name over a closer-scoring one', () => {
    const other = { code: 'C2', name: 'Anomaly', evidence: [] };
    const picked = bestConceptFor({ term: 'Outlier' }, [
      { concept: other, similarity: 0.9 },
      { concept, similarity: 0.4 },
    ]);
    expect(picked?.concept.code).toBe('C1');
    expect(picked?.match).toBe('name');
  });

  it('ignores a different-named concept below the similarity floor', () => {
    expect(bestConceptFor({ term: 'Zebra' }, [{ concept, similarity: 0.5 }])).toBeNull();
  });

  it('attaches book, authors, chapter and pages and counts the terms covered', async () => {
    const lookup = jest.fn(async (t: { term?: string }) =>
      t.term === 'Outlier' ? [{ concept, similarity: 0.8 }] : []
    );
    const { terms, withTextbookSource } = await attachTextbookSources(
      [{ term: 'Outlier' }, { term: 'Zebra' }],
      lookup
    );
    expect(withTextbookSource).toBe(1);
    expect((terms[0] as any).textbookSources[0]).toMatchObject({
      book: 'Statistics Done Wrong',
      authors: ['Reinhart'],
      chapter: 'Ch. 3 Data',
      pages: '40-44',
    });
    expect((terms[1] as any).textbookSources).toBeUndefined();
  });

  it('leaves a term alone when the lookup fails', async () => {
    const onError = jest.fn();
    const { terms, withTextbookSource } = await attachTextbookSources(
      [{ term: 'A' }],
      async () => {
        throw new Error('down');
      },
      onError
    );
    expect(withTextbookSource).toBe(0);
    expect(terms).toEqual([{ term: 'A' }]);
    expect(onError).toHaveBeenCalled();
  });
});
