import {
  XSS_PATTERNS,
  containsXSS,
  preventXSS,
  rejectOperatorKeys,
  sanitizeObject,
  securityValidation,
} from '../middleware/security';

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

describe('operator-key check', () => {
  // MongoDB reads a key starting with "$" as an operator: on production ?status[$ne]=zzz listed
  // all 46 programmes where ?status=zzz listed none.
  const run = (where: 'body' | 'query' | 'params', value: unknown): boolean => {
    let passed = false;
    const req: any = {
      path: '/api/v3/workflow',
      method: 'GET',
      body: {},
      query: {},
      params: {},
      headers: {},
    };
    req[where] = value;
    const res: any = { status: () => res, json: () => res };
    rejectOperatorKeys(req, res, () => {
      passed = true;
    });
    return passed;
  };

  it('refuses a "$" key anywhere in the body, query or params', () => {
    expect(run('query', { status: { $ne: 'zzz' } })).toBe(false);
    expect(run('query', { status: { $regex: '^step10' } })).toBe(false);
    expect(run('body', { filter: [{ name: 'x' }, { $where: 'sleep(1000)' }] })).toBe(false);
    expect(run('body', { a: { b: { c: { $gt: '' } } } })).toBe(false);
    expect(run('params', { $id: 'x' })).toBe(false);
  });

  it('lets ordinary input through, including "$" inside values', () => {
    expect(run('query', { status: 'step10_complete', step: '10' })).toBe(true);
    expect(run('body', { text: 'Price is $20; EV = 0.35×$20 − $5', tags: ['$'] })).toBe(true);
  });

  it('copes with deeply nested input without recursion', () => {
    let deep: any = { leaf: 'x' };
    for (let i = 0; i < 20000; i++) deep = { next: deep };
    expect(run('body', deep)).toBe(true);
  });

  it('runs in the app-wide chain in place of the SQL keyword filter', () => {
    expect(securityValidation[1]).toBe(rejectOperatorKeys);
  });
});

describe('sanitizeObject', () => {
  it('drops __proto__, constructor and prototype keys', () => {
    const body = JSON.parse(
      '{"__proto__":{"role":"administrator"},"constructor":1,"prototype":2,"name":"x"}'
    );
    const clean = sanitizeObject(body);
    expect(clean.role).toBeUndefined();
    expect(Object.keys(clean)).toEqual(['name']);
  });
});
