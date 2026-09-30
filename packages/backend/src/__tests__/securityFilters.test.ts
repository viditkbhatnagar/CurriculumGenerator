import { XSS_PATTERNS, containsXSS, preventSQLInjection, preventXSS } from '../middleware/security';

jest.mock('../services/loggingService', () => ({
  loggingService: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

/** Run a middleware against a request; true when it let the request through. */
function passes(mw: any, path: string, body: unknown): boolean {
  let passed = false;
  const res: any = { status: () => res, json: () => res };
  mw({ path, method: 'POST', body, query: {}, params: {}, headers: {}, ip: '::1' }, res, () => {
    passed = true;
  });
  return passed;
}

describe('XSS check', () => {
  it('lets ordinary formulas and prose through', () => {
    // Real text from the CR08 draft's rationales and marking guide.
    for (const text of [
      'Incremental conversions = (7% − 4%) × 1,000 = 30',
      'Region B: Orders=800; Cancellations=72',
      'Expected responders = 5,000 × 0.06 = 300',
      'Contribution = Revenue − Variable costs',
    ]) {
      expect(containsXSS(text)).toBe(false);
    }
  });

  it('still refuses markup and script URLs', () => {
    for (const text of [
      '<img src=x onerror=alert(1)>',
      '<div onclick="steal()">',
      '<script>alert(1)</script>',
      '<SCRIPT>\nalert(1)\n</SCRIPT>',
      'javascript:alert(1)',
      '<iframe src="https://evil.example">',
    ]) {
      expect(containsXSS(text)).toBe(true);
    }
  });

  it('catches handlers separated by a slash or a closing quote', () => {
    // Shapes a whitespace-only rule missed, found in the security review.
    for (const text of [
      '<svg/onload=alert(1)>',
      '<img src="x"onerror=alert(1)>',
      '<img src="x"/onerror=alert(1)>',
      '<a/onmouseover=alert(1)>',
      '<script src=//evil.example/x.js>',
    ]) {
      expect(containsXSS(text)).toBe(true);
    }
  });

  it('does not refuse words that merely start like a tag', () => {
    expect(containsXSS('Set an <objective> for each week')).toBe(false);
    expect(containsXSS('Revenue <embedded in the model> grows')).toBe(false);
  });

  it('catches the same attack twice in a row (no stateful global pattern)', () => {
    expect(containsXSS('<iframe src=a>')).toBe(true);
    expect(containsXSS('<iframe src=b>')).toBe(true);
    for (const pattern of XSS_PATTERNS) {
      expect(pattern.flags).not.toMatch(/[gy]/);
    }
    expect(Object.isFrozen(XSS_PATTERNS)).toBe(true);
  });

  it('checks a large hostile string in linear time', () => {
    // The check runs on every request before routing; a quadratic pattern let one
    // 200,000-character "<a<a<a..." body stall the API for 9.5 s.
    for (const hostile of ['<a'.repeat(100_000), '<script'.repeat(30_000), 'on'.repeat(100_000)]) {
      const started = Date.now();
      containsXSS(hostile);
      expect(Date.now() - started).toBeLessThan(1000);
    }
  });

  it('refuses a request carrying markup and passes one carrying formulas', () => {
    expect(passes(preventXSS, '/api/agu/drafts/1', { draft: { note: 'Conversion = 3%' } })).toBe(
      true
    );
    expect(passes(preventXSS, '/api/agu/drafts/1', { link: '<img src=x onerror=alert(1)>' })).toBe(
      false
    );
  });
});

describe('SQL check', () => {
  it('lets curriculum content with SQL examples through on the AGU routes', () => {
    const lesson = { text: 'Students write INSERT INTO sales and a UNION ALL query; see sp_help.' };
    expect(passes(preventSQLInjection, '/api/agu/drafts/1', lesson)).toBe(true);
    expect(passes(preventSQLInjection, '/api/v3/workflow/1/apply-edit', lesson)).toBe(true);
  });

  it('exempts whole path segments only', () => {
    const lesson = { text: 'UNION ALL' };
    expect(passes(preventSQLInjection, '/api/agu', lesson)).toBe(true);
    expect(passes(preventSQLInjection, '/api/aguXYZ/anything', lesson)).toBe(false);
  });

  it('still refuses SQL keywords on other routes', () => {
    expect(passes(preventSQLInjection, '/api/users', { q: "x'; DROP TABLE users;--" })).toBe(false);
  });
});
