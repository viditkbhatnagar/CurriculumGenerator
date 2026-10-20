/**
 * The concept index is read once however many callers find it stale at the same moment.
 * Parallel reads of 16,000 vectors took the 2 GB production container down on 20 October 2026.
 */
const cursorCalls = { count: 0 };
const concepts = [
  { _id: 'a', domainKey: 'business', area: 'STR', importance: 'core', embedding: [1, 0] },
  { _id: 'b', domainKey: 'business', area: 'MKT', importance: 'supporting', embedding: [0, 1] },
];

jest.mock('../knowledge/models', () => ({
  KbMeta: { findById: () => ({ lean: async () => ({ version: 1 }) }) },
  KbConcept: {
    find: (filter: any) => {
      const chain: any = {
        select: () => chain,
        lean: () =>
          Object.assign(Promise.resolve(concepts.filter((c) => filter._id?.$in.includes(c._id))), {
            cursor: () => {
              cursorCalls.count += 1;
              return (async function* () {
                for (const c of concepts) {
                  await new Promise((r) => setTimeout(r, 5));
                  yield c;
                }
              })();
            },
          }),
      };
      return chain;
    },
  },
}));
jest.mock('../services/openaiService', () => ({
  openaiService: { generateEmbeddingsBatch: async (texts: string[]) => texts.map(() => [1, 0]) },
}));
jest.mock('../services/occupations/occupationIndex', () => ({ shorten: (v: number[]) => v }));

import { invalidateConceptIndex, searchConcepts } from '../knowledge/retrieval';

describe('concept index', () => {
  beforeEach(() => {
    invalidateConceptIndex();
    cursorCalls.count = 0;
  });

  it('reads the library once for callers that arrive together', async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () => searchConcepts(['strategy'], { floor: 0.5 }))
    );
    expect(cursorCalls.count).toBe(1);
    for (const hits of results) expect(hits.map((h) => h.concept._id)).toEqual(['a']);
  });

  it('serves later callers from memory', async () => {
    await searchConcepts(['strategy']);
    await searchConcepts(['marketing']);
    expect(cursorCalls.count).toBe(1);
  });

  it('reads again after an ingest invalidates it', async () => {
    await searchConcepts(['strategy']);
    invalidateConceptIndex();
    await searchConcepts(['strategy']);
    expect(cursorCalls.count).toBe(2);
  });
});
