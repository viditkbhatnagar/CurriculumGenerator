/** A 429 from OpenAlex must surface as SourceLookupUnavailable and never be cached or read as "no sources". */
import { searchAcademicSources, SourceLookupUnavailable } from '../services/academicSourceService';

describe('OpenAlex daily allowance', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('throws SourceLookupUnavailable with the reset time on 429', async () => {
    global.fetch = jest.fn(async () => ({
      status: 429,
      ok: false,
      headers: { get: (h: string) => (h === 'x-ratelimit-reset' ? '7200' : null) },
      json: async () => ({}),
    })) as any;
    await expect(searchAcademicSources('logistics')).rejects.toThrow(SourceLookupUnavailable);
    await expect(searchAcademicSources('logistics')).rejects.toThrow(/daily request allowance.*2h/);
  });
});
