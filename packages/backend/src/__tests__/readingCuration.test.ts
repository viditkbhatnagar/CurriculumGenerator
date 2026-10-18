import {
  moduleReadingSummary,
  readingBudgetFor,
  tidyModuleReadings,
} from '../services/readingCuration';

describe('readingBudgetFor', () => {
  it('uses the reading hours Step 4 already allocated', () => {
    const module = {
      independentHours: 30,
      independentActivities: [
        { type: 'reading', hours: 6 },
        { type: 'practice', hours: 10 },
        { type: 'reading', hours: 2 },
      ],
    };
    expect(readingBudgetFor(module)).toEqual({
      minutes: 480,
      basis: expect.stringMatching(/8 hours of reading Step 4 allocated/),
    });
  });

  it('falls back to half of independent study, and says so', () => {
    expect(readingBudgetFor({ independentHours: 20, independentActivities: [] })).toEqual({
      minutes: 600,
      basis: expect.stringMatching(/Step 4 allocated no reading time/),
    });
  });
});

const sources = [
  {
    id: 's1',
    moduleId: 'm1',
    title: 'Real Title',
    authors: ['Smith, A.'],
    year: 2021,
    citation: 'Smith, A. (2021). Real Title.',
    complianceBadges: { peerReviewed: true },
    agiCompliant: true,
  },
  { id: 's2', moduleId: 'm1', title: 'Open Textbook', chapters: ['1 Markets', '2 Demand'] },
];

describe('tidyModuleReadings', () => {
  const out = tidyModuleReadings(
    [
      {
        sourceId: 's1',
        category: 'core',
        title: 'Re-typed title',
        specificChapters: 'Chapter 3: Strategic Analysis',
        pageRange: 'pp. 45-92',
        estimatedReadingMinutes: 60,
        linkedMLOs: ['M1-LO1'],
        sequence: 'foundation',
        mloRelevance: 'high',
      },
      { sourceId: 's1', category: 'supplementary', linkedMLOs: ['M1-LO2'] },
      { sourceId: 's9', category: 'core' },
      { sourceId: 's2', category: 'supplementary', estimatedReadingMinutes: 40 },
    ],
    sources
  );

  it('keeps one reading per source and drops sources the module was never given', () => {
    expect(out.map((r) => r.sourceId)).toEqual(['s1', 's2']);
    expect(out[0].linkedMLOs).toEqual(['M1-LO1', 'M1-LO2']);
    expect(out[0].category).toBe('core');
  });

  it('takes bibliographic and compliance facts from the Step 5 record', () => {
    expect(out[0]).toMatchObject({
      title: 'Real Title',
      citation: 'Smith, A. (2021). Real Title.',
      complianceBadges: { peerReviewed: true },
      agiCompliant: true,
    });
  });

  it('never keeps a chapter or page range the source record does not hold', () => {
    expect(out[0]).toMatchObject({
      specificChapters: '',
      pageRange: '',
      sectionsKnown: false,
      focusAreas: 'Chapter 3: Strategic Analysis',
    });
    expect(out[1]).toMatchObject({ specificChapters: '1 Markets; 2 Demand', sectionsKnown: true });
  });

  it('labels the reading time as an estimate and carries no week or assessment relevance', () => {
    expect(out[0].readingTimeBasis).toMatch(/estimate/);
    expect(out[0]).not.toHaveProperty('suggestedWeek');
    expect(out[0]).not.toHaveProperty('assessmentRelevance');
    expect(out[0].sequence).toBe('foundation');
  });
});

describe('moduleReadingSummary', () => {
  it('counts the summary rather than taking the model’s', () => {
    const readings = tidyModuleReadings(
      [
        { sourceId: 's1', category: 'core', estimatedReadingMinutes: 60, linkedMLOs: ['A'] },
        { sourceId: 's2', category: 'supplementary', estimatedReadingMinutes: 40 },
      ],
      sources
    );
    expect(moduleReadingSummary('m1', readings, { minutes: 90, basis: 'x' })).toMatchObject({
      coreCount: 1,
      supplementaryCount: 1,
      totalReadingMinutes: 100,
      withinBudget: false,
      mlosCovered: ['A'],
      computedBy: 'code',
    });
  });
});
