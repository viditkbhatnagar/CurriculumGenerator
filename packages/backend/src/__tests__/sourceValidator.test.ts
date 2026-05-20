import { sanitizeSourcePayload } from '../services/sourceValidator';

describe('sanitizeSourcePayload', () => {
  const minimalValid = {
    title: 'Designing Brand Identity',
    authors: ['Wheeler, A.'],
    year: 2017,
    moduleId: 'mod2',
    resourceType: 'book',
  };

  it('rejects non-object input', () => {
    expect(() => sanitizeSourcePayload(null as any)).toThrow(/JSON object/);
    expect(() => sanitizeSourcePayload('nope' as any)).toThrow(/JSON object/);
  });

  it('requires a non-empty title', () => {
    expect(() => sanitizeSourcePayload({ ...minimalValid, title: '' })).toThrow(/title/);
    expect(() => sanitizeSourcePayload({ ...minimalValid, title: '  ' })).toThrow(/title/);
  });

  it('requires a non-empty authors array', () => {
    expect(() => sanitizeSourcePayload({ ...minimalValid, authors: [] })).toThrow(/authors/);
    expect(() => sanitizeSourcePayload({ ...minimalValid, authors: 'x' as any })).toThrow(
      /authors/
    );
  });

  it('requires a numeric year in range', () => {
    expect(() => sanitizeSourcePayload({ ...minimalValid, year: 'old' as any })).toThrow(/year/);
    expect(() => sanitizeSourcePayload({ ...minimalValid, year: 1700 })).toThrow(/year/);
    expect(() => sanitizeSourcePayload({ ...minimalValid, year: 2200 })).toThrow(/year/);
  });

  it('coerces year from a string', () => {
    expect(sanitizeSourcePayload({ ...minimalValid, year: '2017' }).year).toBe(2017);
  });

  it('requires moduleId', () => {
    expect(() => sanitizeSourcePayload({ ...minimalValid, moduleId: '' })).toThrow(/moduleId/);
  });

  it('requires a valid resourceType', () => {
    expect(() => sanitizeSourcePayload({ ...minimalValid, resourceType: 'podcast' })).toThrow(
      /resourceType/
    );
    expect(() => sanitizeSourcePayload({ ...minimalValid, resourceType: undefined })).toThrow(
      /resourceType/
    );
  });

  it('accepts every supported resourceType', () => {
    for (const rt of ['document', 'video', 'ebook', 'article', 'book', 'webpage', 'other']) {
      expect(sanitizeSourcePayload({ ...minimalValid, resourceType: rt }).resourceType).toBe(rt);
    }
  });

  it('builds a default citation when none provided (with publisher)', () => {
    const out = sanitizeSourcePayload({ ...minimalValid, publisher: 'Wiley' });
    expect(out.citation).toBe('Wheeler, A. (2017). Designing Brand Identity. Wiley.');
  });

  it('builds a default citation without publisher', () => {
    const out = sanitizeSourcePayload(minimalValid);
    expect(out.citation).toBe('Wheeler, A. (2017). Designing Brand Identity.');
  });

  it('defaults type to applied and complexity to intermediate', () => {
    const out = sanitizeSourcePayload(minimalValid);
    expect(out.type).toBe('applied');
    expect(out.complexityLevel).toBe('intermediate');
  });

  it('strips HTML / control chars from string fields', () => {
    const out = sanitizeSourcePayload({
      ...minimalValid,
      title: '<b>Brand</b> Identity\x07',
      complianceNotes: 'SME\x01 note',
    });
    expect(out.title).toBe('Brand Identity');
    expect(out.complianceNotes).toBe('SME note');
  });

  it('round-trips a YouTube-video resource (Athira example)', () => {
    const payload = {
      title: 'How a fashion collection comes together',
      authors: ['Vogue'],
      year: 2024,
      moduleId: 'mod1',
      resourceType: 'video',
      url: 'https://www.youtube.com/watch?v=abc123',
      type: 'industry',
    };
    const out = sanitizeSourcePayload(payload);
    expect(out.resourceType).toBe('video');
    expect(out.url).toBe(payload.url);
    expect(out.type).toBe('industry');
    expect(out.title).toBe(payload.title);
    expect(out.year).toBe(2024);
  });

  it('round-trips a physical book with ISBN', () => {
    const out = sanitizeSourcePayload({
      ...minimalValid,
      publisher: 'Wiley',
      isbn: '978-1118980828',
      complexityLevel: 'advanced',
    });
    expect(out.isbn).toBe('978-1118980828');
    expect(out.publisher).toBe('Wiley');
    expect(out.complexityLevel).toBe('advanced');
  });

  it('omits uploadedFile when not provided', () => {
    expect(sanitizeSourcePayload(minimalValid).uploadedFile).toBeUndefined();
  });

  it('accepts a well-formed uploadedFile reference', () => {
    const out = sanitizeSourcePayload({
      ...minimalValid,
      uploadedFile: {
        fileId: '665f1a2b3c4d5e6f70819203',
        filename: 'brand-guidelines.pdf',
        mimeType: 'application/pdf',
        size: 482311,
      },
    });
    expect(out.uploadedFile).toEqual({
      fileId: '665f1a2b3c4d5e6f70819203',
      filename: 'brand-guidelines.pdf',
      mimeType: 'application/pdf',
      size: 482311,
    });
  });

  it('defaults mimeType + size when the uploadedFile omits them', () => {
    const out = sanitizeSourcePayload({
      ...minimalValid,
      uploadedFile: { fileId: 'abc123', filename: 'notes.docx' },
    });
    expect(out.uploadedFile?.mimeType).toBe('application/octet-stream');
    expect(out.uploadedFile?.size).toBe(0);
  });

  it('rejects an uploadedFile missing fileId or filename', () => {
    expect(() =>
      sanitizeSourcePayload({ ...minimalValid, uploadedFile: { filename: 'x.pdf' } })
    ).toThrow(/uploadedFile/);
    expect(() =>
      sanitizeSourcePayload({ ...minimalValid, uploadedFile: { fileId: 'abc' } })
    ).toThrow(/uploadedFile/);
  });

  it('rejects a non-object uploadedFile', () => {
    expect(() => sanitizeSourcePayload({ ...minimalValid, uploadedFile: 'a-file' })).toThrow(
      /uploadedFile/
    );
  });
});
