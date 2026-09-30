/**
 * Whether the Atlas vector index that knowledge-base retrieval depends on actually answers.
 *
 * Retrieval queries `knowledge_base_vector_index` with `$vectorSearch`. On 2026-09-30 that
 * index did not exist: a search using a stored document's own embedding returned nothing,
 * `retrieveKBContext` caught the empty result and carried on, and no step had ever been given
 * knowledge-base context although 20,225 embedded chunks were stored. Nothing reported it.
 *
 * The probe asks the index for a document using that document's own embedding. A working
 * index returns it first with a score near 1; anything else means retrieval is not running.
 */

export const KNOWLEDGE_BASE_COLLECTION = 'knowledgeBase';
export const KNOWLEDGE_BASE_VECTOR_INDEX = 'knowledge_base_vector_index';
const SELF_MATCH_MIN_SCORE = 0.99;

export interface ProbeCollection {
  findOne(filter: object, options?: object): Promise<any>;
  aggregate(pipeline: object[]): { toArray(): Promise<any[]> };
}

export interface VectorIndexProbeResult {
  status: 'healthy' | 'unhealthy';
  message: string;
}

export async function probeVectorIndex(
  collection: ProbeCollection,
  indexName: string = KNOWLEDGE_BASE_VECTOR_INDEX
): Promise<VectorIndexProbeResult> {
  try {
    const sample = await collection.findOne(
      { embedding: { $exists: true } },
      { projection: { embedding: 1 } }
    );
    if (!sample?.embedding?.length) {
      return { status: 'unhealthy', message: 'The knowledge base holds no embedded documents.' };
    }

    const results = await collection
      .aggregate([
        {
          $vectorSearch: {
            index: indexName,
            path: 'embedding',
            queryVector: sample.embedding,
            numCandidates: 10,
            limit: 1,
          },
        },
        { $project: { _id: 1, score: { $meta: 'vectorSearchScore' } } },
      ])
      .toArray();

    if (results.length === 0) {
      return {
        status: 'unhealthy',
        message:
          `Vector index "${indexName}" returned nothing for a stored document's own ` +
          'embedding: it is missing or not built, so knowledge-base retrieval returns no context.',
      };
    }

    const top = results[0];
    const selfMatch = String(top._id) === String(sample._id) || top.score >= SELF_MATCH_MIN_SCORE;
    if (!selfMatch) {
      return {
        status: 'unhealthy',
        message: `Vector index "${indexName}" answers but does not find a stored document by its own embedding.`,
      };
    }
    return { status: 'healthy', message: `Vector index "${indexName}" is answering.` };
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : String(error);
    return { status: 'unhealthy', message: `Vector index "${indexName}" query failed: ${reason}` };
  }
}
