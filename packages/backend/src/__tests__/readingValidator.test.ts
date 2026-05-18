import { sanitizeReadingPayload } from '../services/readingValidator';

describe('sanitizeReadingPayload', () => {
  const minimalValid = {
    title: 'Retailing Management',
    authors: ['Levy, M.', 'Weitz, B.'],
    year: 2023,
    moduleId: 'mod1',
    category: 'core',
  };

  it('rejects non-object input', () => {
    expect(() => sanitizeReadingPayload(null as any)).toThrow(/JSON object/);
    expect(() => sanitizeReadingPayload('nope' as any)).toThrow(/JSON object/);
  });

  it('requires a non-empty title', () => {
    expect(() => sanitizeReadingPayload({ ...minimalValid, title: '' })).toThrow(/title/);
    expect(() => sanitizeReadingPayload({ ...minimalValid, title: '   ' })).toThrow(/title/);
  });

  it('requires a non-empty authors array', () => {
    expect(() => sanitizeReadingPayload({ ...minimalValid, authors: [] })).toThrow(/authors/);
    expect(() => sanitizeReadingPayload({ ...minimalValid, authors: 'nope' as any })).toThrow(
      /authors/
    );
  });

  it('requires a numeric year in range', () => {
    expect(() => sanitizeReadingPayload({ ...minimalValid, year: 'old' as any })).toThrow(/year/);
    expect(() => sanitizeReadingPayload({ ...minimalValid, year: 1500 })).toThrow(/year/);
    expect(() => sanitizeReadingPayload({ ...minimalValid, year: 3000 })).toThrow(/year/);
  });

  it('coerces year from a string', () => {
    const out = sanitizeReadingPayload({ ...minimalValid, year: '2023' });
    expect(out.year).toBe(2023);
  });

  it('requires moduleId', () => {
    expect(() => sanitizeReadingPayload({ ...minimalValid, moduleId: '' })).toThrow(/moduleId/);
  });

  it('requires category to be core or supplementary', () => {
    expect(() => sanitizeReadingPayload({ ...minimalValid, category: 'maybe' })).toThrow(
      /category/
    );
  });

  it('builds a default citation when one is not provided', () => {
    const out = sanitizeReadingPayload(minimalValid);
    expect(out.citation).toBe('Levy, M., Weitz, B. (2023). Retailing Management.');
  });

  it('preserves a provided citation verbatim (after sanitize)', () => {
    const out = sanitizeReadingPayload({
      ...minimalValid,
      citation: 'Levy & Weitz (2023). Retailing Management. McGraw-Hill.',
    });
    expect(out.citation).toBe('Levy & Weitz (2023). Retailing Management. McGraw-Hill.');
  });

  it('falls back to sensible defaults for contentType / readingType / complexity', () => {
    const out = sanitizeReadingPayload(minimalValid);
    expect(out.contentType).toBe('other');
    expect(out.readingType).toBe('academic');
    expect(out.complexity).toBe('intermediate');
    expect(out.assessmentRelevance).toBe('medium');
    expect(out.estimatedReadingMinutes).toBe(60);
    expect(out.linkedMLOs).toEqual([]);
  });

  it('clamps estimatedReadingMinutes to [0, 600]', () => {
    expect(
      sanitizeReadingPayload({ ...minimalValid, estimatedReadingMinutes: -10 })
        .estimatedReadingMinutes
    ).toBe(0);
    expect(
      sanitizeReadingPayload({ ...minimalValid, estimatedReadingMinutes: 9999 })
        .estimatedReadingMinutes
    ).toBe(600);
    expect(
      sanitizeReadingPayload({ ...minimalValid, estimatedReadingMinutes: 45 })
        .estimatedReadingMinutes
    ).toBe(45);
  });

  it('strips HTML/control chars from string fields', () => {
    const out = sanitizeReadingPayload({
      ...minimalValid,
      title: '<script>alert(1)</script>Real Title',
      notes: 'Has\x01control\x07chars',
    });
    expect(out.title).toBe('alert(1)Real Title');
    expect(out.notes).toBe('Hascontrolchars');
  });

  it('drops invalid linkedMLOs entries and caps the array', () => {
    const big = Array.from({ length: 40 }, (_, i) => `MLO${i}`);
    const out = sanitizeReadingPayload({
      ...minimalValid,
      linkedMLOs: ['MLO1.1', '', null, 'MLO1.2', ...big],
    });
    expect(out.linkedMLOs[0]).toBe('MLO1.1');
    expect(out.linkedMLOs[1]).toBe('MLO1.2');
    expect(out.linkedMLOs.length).toBeLessThanOrEqual(30);
  });

  it('round-trips a Logan-style realistic payload', () => {
    const payload = {
      title: 'The 22 Immutable Laws of Branding',
      authors: ['Ries, A.', 'Ries, L.'],
      year: 2002,
      moduleId: 'mod3',
      category: 'supplementary',
      contentType: 'textbook_chapter',
      readingType: 'applied',
      complexity: 'introductory',
      estimatedReadingMinutes: 90,
      url: 'https://example.com/22-laws',
      specificChapters: 'Chapters 1-4',
      pageRange: 'pp. 1-58',
      notes: 'Useful for the rebranding discussion in Week 5',
      linkedMLOs: ['MLO3.1', 'MLO3.2'],
      assessmentRelevance: 'medium',
    };
    const out = sanitizeReadingPayload(payload);
    expect(out.title).toBe(payload.title);
    expect(out.authors).toEqual(payload.authors);
    expect(out.year).toBe(2002);
    expect(out.category).toBe('supplementary');
    expect(out.contentType).toBe('textbook_chapter');
    expect(out.readingType).toBe('applied');
    expect(out.complexity).toBe('introductory');
    expect(out.estimatedReadingMinutes).toBe(90);
    expect(out.url).toBe(payload.url);
    expect(out.specificChapters).toBe(payload.specificChapters);
    expect(out.linkedMLOs).toEqual(['MLO3.1', 'MLO3.2']);
  });
});
