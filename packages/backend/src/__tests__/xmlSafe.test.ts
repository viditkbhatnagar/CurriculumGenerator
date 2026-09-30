import {
  cleanModelOutput,
  stripEscapedControls,
  stripXmlInvalid,
  xmlSafeDeep,
} from '../utils/xmlSafe';

describe('stripXmlInvalid', () => {
  it('removes the control character that broke the BBA M42 downloads', () => {
    // Stored in an Excel instruction where a dash was meant.
    expect(stripXmlInvalid('[@NPS],"\u0014"); add conditional')).toBe(
      '[@NPS],""); add conditional'
    );
  });

  it('keeps tabs, line breaks and ordinary Unicode', () => {
    const text = 'Line 1\n\tLine 2\r\n≥ 0 — “quoted” 😀';
    expect(stripXmlInvalid(text)).toBe(text);
  });

  it('removes unpaired surrogates but keeps paired ones', () => {
    expect(stripXmlInvalid('a\uD83Db')).toBe('ab');
    expect(stripXmlInvalid('a\uD83D\uDE00b')).toBe('a\uD83D\uDE00b');
  });
});

describe('stripEscapedControls', () => {
  it('drops JSON escapes that decode to forbidden characters', () => {
    const json = '{"a":"x\\u0014y","b":"u\\u001fv","c":"p\\bq\\fr"}';
    expect(JSON.parse(stripEscapedControls(json))).toEqual({ a: 'xy', b: 'uv', c: 'pqr' });
  });

  it('keeps allowed escapes and escaped backslashes', () => {
    const json = '{"a":"tab\\tnl\\ncr\\r","b":"C:\\\\files","c":"literal \\\\u0014 text"}';
    expect(JSON.parse(stripEscapedControls(json))).toEqual({
      a: 'tab\tnl\ncr\r',
      b: 'C:\\files',
      c: 'literal \\u0014 text',
    });
  });
});

describe('cleanModelOutput', () => {
  it('leaves backslashes in plain text alone', () => {
    expect(cleanModelOutput('Save to C:\\files\\budget.xlsx', false)).toBe(
      'Save to C:\\files\\budget.xlsx'
    );
  });

  it('cleans both raw and escaped control characters in JSON', () => {
    expect(JSON.parse(cleanModelOutput('{"a":"x\u0014\\u001fy"}', true))).toEqual({ a: 'xy' });
  });
});

describe('xmlSafeDeep', () => {
  it('returns the same object when there is nothing to clean', () => {
    const data = { a: 'fine', b: [1, 'ok', { c: 'also fine' }] };
    expect(xmlSafeDeep(data)).toBe(data);
  });

  it('copies only the branch that changes, and never mutates the input', () => {
    const untouched = { c: 'fine' };
    const data = { a: 'x\u0014y', b: untouched, d: ['ok', 'p\u001fq'] };
    const out = xmlSafeDeep(data);
    expect(out).toEqual({ a: 'xy', b: { c: 'fine' }, d: ['ok', 'pq'] });
    expect(out.b).toBe(untouched);
    expect(data.a).toBe('x\u0014y');
  });

  it('leaves dates, buffers and class instances as they are', () => {
    const when = new Date('2026-09-30T00:00:00Z');
    const buf = Buffer.from('a\u0014b');
    class Id {
      constructor(public v: string) {}
    }
    const id = new Id('x\u0014');
    const out = xmlSafeDeep({ when, buf, id });
    expect(out.when).toBe(when);
    expect(out.buf).toBe(buf);
    expect(out.id).toBe(id);
  });

  it('reads documents through toObject()', () => {
    const doc = Object.create({ toObject: () => ({ title: 'T\u0014' }) });
    expect(xmlSafeDeep({ doc })).toEqual({ doc: { title: 'T' } });
  });

  it('survives a cycle', () => {
    const a: any = { name: 'a\u0014' };
    a.self = a;
    const out: any = xmlSafeDeep(a);
    expect(out.name).toBe('a');
  });
});
