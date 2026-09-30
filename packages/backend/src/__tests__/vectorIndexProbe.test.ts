import { probeVectorIndex } from '../services/vectorIndexProbe';

const collection = (sample: any, results: any[] | Error) => ({
  findOne: async () => sample,
  aggregate: () => ({
    toArray: async () => {
      if (results instanceof Error) throw results;
      return results;
    },
  }),
});

describe('probeVectorIndex', () => {
  const sample = { _id: 'doc-1', embedding: [0.1, 0.2] };

  it('reports the index missing when a stored embedding finds nothing', async () => {
    // What production returned on 2026-09-30: the index did not exist, so every
    // knowledge-base lookup came back empty and generation carried on without context.
    const result = await probeVectorIndex(collection(sample, []));
    expect(result.status).toBe('unhealthy');
    expect(result.message).toMatch(/missing or not built/);
  });

  it('reports healthy when the stored document finds itself', async () => {
    const result = await probeVectorIndex(collection(sample, [{ _id: 'doc-1', score: 1 }]));
    expect(result.status).toBe('healthy');
  });

  it('reports an empty knowledge base as unhealthy', async () => {
    const result = await probeVectorIndex(collection(null, []));
    expect(result.status).toBe('unhealthy');
    expect(result.message).toMatch(/no embedded documents/);
  });

  it('reports a failing query as unhealthy instead of throwing', async () => {
    const result = await probeVectorIndex(collection(sample, new Error('index not found')));
    expect(result.status).toBe('unhealthy');
    expect(result.message).toMatch(/index not found/);
  });
});
