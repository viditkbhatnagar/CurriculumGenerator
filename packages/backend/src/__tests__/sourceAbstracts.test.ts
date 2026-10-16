/**
 * Step 5 read each OpenAlex paper's abstract and threw it away; the lesson writer needs it
 * (services/lessonSources). Sources stored without one get it by DOI.
 */
import { abstractsByDoi, normaliseDoi } from '../services/academicSourceService';

describe('abstracts by DOI', () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it('normalises a DOI however it is written', () => {
    expect(normaliseDoi('https://doi.org/10.1000/ABC.1')).toBe('10.1000/abc.1');
    expect(normaliseDoi('doi: 10.1000/x')).toBe('10.1000/x');
    expect(normaliseDoi(undefined)).toBe('');
  });

  it('asks for fifty at a time and rebuilds each abstract', async () => {
    const urls: string[] = [];
    global.fetch = jest.fn(async (url: string) => {
      urls.push(url);
      return {
        status: 200,
        ok: true,
        headers: { get: () => null },
        json: async () => ({
          results: [
            {
              doi: 'https://doi.org/10.1000/a1',
              abstract_inverted_index: { Prices: [0], rise: [1], 'today.': [2] },
            },
            { doi: 'https://doi.org/10.1000/a2', abstract_inverted_index: null },
          ],
        }),
      };
    }) as never;
    const dois = Array.from({ length: 51 }, (_, i) => `10.1000/a${i + 1}`);
    const found = await abstractsByDoi(dois);
    expect(urls).toHaveLength(2);
    expect(decodeURIComponent(urls[0])).toContain('filter=doi:10.1000/a1|10.1000/a2|');
    expect(found.get('10.1000/a1')).toBe('Prices rise today.');
    expect(found.has('10.1000/a2')).toBe(false);
  }, 20000);
});
