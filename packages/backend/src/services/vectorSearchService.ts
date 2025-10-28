import { KnowledgeBase, IKnowledgeBase } from '../models/KnowledgeBase';
import { embeddingService } from './embeddingService';
import { cacheService, CacheNamespace } from './cacheService';
import crypto from 'crypto';

/**
 * Vector Search Service
 * Handles MongoDB Atlas Vector Search operations using aggregation pipeline
 * Replaces Pinecone for vector similarity search
 */

export interface VectorSearchOptions {
  domain?: string;
  minSimilarity?: number;
  limit?: number;
  recencyWeight?: number;
  minCredibilityScore?: number;
}

export interface VectorSearchResult {
  content: string;
  sourceUrl?: string;
  sourceType: string;
  publicationDate?: Date;
  domain: string;
  credibilityScore: number;
  metadata: {
    title?: string;
    author?: string;
    tags: string[];
    chunkIndex: number;
    totalChunks: number;
  };
  similarityScore: number;
  id: string;
}

export class VectorSearchService {
  private readonly vectorIndexName = 'knowledge_base_vector_index';

  /**
   * Generate cache key for search queries
   */
  private generateSearchCacheKey(query: string, options: VectorSearchOptions): string {
    const keyData = { query, options };
    const keyString = JSON.stringify(keyData);
    return crypto.createHash('md5').update(keyString).digest('hex');
  }

  /**
   * Perform semantic search using MongoDB Atlas Vector Search
   * Implements Requirements 2.1, 2.2, 2.3, 2.4
   */
  async search(query: string, options: VectorSearchOptions = {}): Promise<VectorSearchResult[]> {
    const {
      domain,
      minSimilarity = 0.75,
      limit = 10,
      recencyWeight = 0.3,
      minCredibilityScore = 0,
    } = options;

    // Check cache first
    const cacheKey = this.generateSearchCacheKey(query, options);
    const cached = await cacheService.get<VectorSearchResult[]>(cacheKey, {
      namespace: CacheNamespace.KNOWLEDGE_BASE,
    });

    if (cached) {
      return cached;
    }

    try {
      // Generate query embedding
      const queryEmbedding = await embeddingService.generateQueryEmbedding(query);

      // Build aggregation pipeline
      const pipeline: any[] = [
        {
          $vectorSearch: {
            index: this.vectorIndexName,
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: 100, // Number of candidates to consider
            limit: limit * 2, // Get more results for filtering
          },
        },
        {
          $addFields: {
            similarityScore: { $meta: 'vectorSearchScore' },
          },
        },
      ];

      // Build match stage for filters
      const matchStage: any = {
        similarityScore: { $gte: minSimilarity },
      };

      // Filter by domain if specified
      if (domain) {
        matchStage.domain = domain;
      }

      // Filter by credibility score
      if (minCredibilityScore > 0) {
        matchStage.credibilityScore = { $gte: minCredibilityScore };
      }

      // Filter by recency (within 5 years for non-foundational sources)
      const fiveYearsAgo = new Date();
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
      matchStage.$or = [
        { publicationDate: { $gte: fiveYearsAgo } },
        { 'metadata.isFoundational': true },
      ];

      pipeline.push({ $match: matchStage });

      // Sort by credibility and similarity
      pipeline.push({
        $sort: { credibilityScore: -1, similarityScore: -1 },
      });

      // Limit results
      pipeline.push({ $limit: limit });

      // Execute search
      const results = await KnowledgeBase.aggregate(pipeline);

      // Transform results
      const searchResults: VectorSearchResult[] = results.map((doc) => ({
        content: doc.content,
        sourceUrl: doc.sourceUrl,
        sourceType: doc.sourceType,
        publicationDate: doc.publicationDate,
        domain: doc.domain,
        credibilityScore: doc.credibilityScore,
        metadata: doc.metadata,
        similarityScore: doc.similarityScore,
        id: doc._id.toString(),
      }));

      // Apply recency weighting if specified
      const weightedResults =
        recencyWeight > 0
          ? this.applyRecencyWeighting(searchResults, recencyWeight)
          : searchResults;

      // Cache the results
      await cacheService.set(cacheKey, weightedResults, {
        namespace: CacheNamespace.KNOWLEDGE_BASE,
      });

      return weightedResults;
    } catch (error) {
      console.error('Vector search failed:', error);
      throw new Error(
        `Vector search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Multi-query search with deduplication
   * Generates multiple query variations and combines results
   * Implements Requirement 2.4
   */
  async multiQuerySearch(
    queries: string[],
    options: VectorSearchOptions = {}
  ): Promise<VectorSearchResult[]> {
    try {
      // Perform search for each query
      const allResults = await Promise.all(
        queries.map((q) =>
          this.search(q, {
            ...options,
            limit: (options.limit || 10) * 2, // Get more results for deduplication
          })
        )
      );

      // Deduplicate by document ID
      const seen = new Set<string>();
      const merged: VectorSearchResult[] = [];

      for (const results of allResults) {
        for (const result of results) {
          if (!seen.has(result.id)) {
            seen.add(result.id);
            merged.push(result);
          }
        }
      }

      // Sort by similarity score
      merged.sort((a, b) => b.similarityScore - a.similarityScore);

      // Limit to requested number
      return merged.slice(0, options.limit || 10);
    } catch (error) {
      console.error('Multi-query search failed:', error);
      throw new Error(
        `Multi-query search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Search with similarity score filtering and ranking
   * Implements Requirements 2.3, 2.4
   */
  async searchWithRanking(
    query: string,
    options: VectorSearchOptions = {}
  ): Promise<VectorSearchResult[]> {
    const results = await this.search(query, options);

    // Apply additional ranking based on multiple factors
    const rankedResults = results.map((result) => {
      // Calculate composite score
      // 60% similarity, 30% credibility, 10% recency
      const recencyScore = this.calculateRecencyScore(result.publicationDate);
      const compositeScore =
        result.similarityScore * 0.6 +
        (result.credibilityScore / 100) * 0.3 +
        recencyScore * 0.1;

      return {
        ...result,
        similarityScore: compositeScore,
      };
    });

    // Re-sort by composite score
    rankedResults.sort((a, b) => b.similarityScore - a.similarityScore);

    return rankedResults;
  }

  /**
   * Apply recency weighting to search results
   */
  private applyRecencyWeighting(
    results: VectorSearchResult[],
    recencyWeight: number
  ): VectorSearchResult[] {
    const now = new Date();

    const weighted = results.map((result) => {
      if (!result.publicationDate) {
        return result;
      }

      const age = now.getTime() - result.publicationDate.getTime();
      const ageInYears = age / (365 * 24 * 60 * 60 * 1000);

      // Recency factor: 1.0 for current year, decreasing linearly
      const recencyFactor = Math.max(0, 1 - ageInYears / 5);

      // Combine similarity and recency
      const weightedScore =
        result.similarityScore * (1 - recencyWeight) + recencyFactor * recencyWeight;

      return {
        ...result,
        similarityScore: weightedScore,
      };
    });

    // Re-sort by weighted score
    return weighted.sort((a, b) => b.similarityScore - a.similarityScore);
  }

  /**
   * Calculate recency score (0-1) based on publication date
   */
  private calculateRecencyScore(publicationDate?: Date): number {
    if (!publicationDate) {
      return 0.5; // Neutral score for unknown dates
    }

    const now = new Date();
    const age = now.getTime() - publicationDate.getTime();
    const ageInYears = age / (365 * 24 * 60 * 60 * 1000);

    // Score decreases linearly over 5 years
    return Math.max(0, 1 - ageInYears / 5);
  }

  /**
   * Store embeddings directly in MongoDB
   * Implements Requirement 2.1
   */
  async storeEmbedding(data: {
    content: string;
    sourceUrl?: string;
    sourceType: 'pdf' | 'docx' | 'url' | 'manual';
    publicationDate?: Date;
    domain: string;
    credibilityScore: number;
    metadata: {
      title?: string;
      author?: string;
      tags: string[];
      chunkIndex: number;
      totalChunks: number;
      isFoundational?: boolean;
    };
    embedding: number[];
  }): Promise<string> {
    try {
      const knowledgeBase = new KnowledgeBase(data);
      await knowledgeBase.save();
      return knowledgeBase._id.toString();
    } catch (error) {
      console.error('Failed to store embedding:', error);
      throw new Error(
        `Failed to store embedding: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Batch store embeddings
   */
  async storeEmbeddingsBatch(
    data: Array<{
      content: string;
      sourceUrl?: string;
      sourceType: 'pdf' | 'docx' | 'url' | 'manual';
      publicationDate?: Date;
      domain: string;
      credibilityScore: number;
      metadata: {
        title?: string;
        author?: string;
        tags: string[];
        chunkIndex: number;
        totalChunks: number;
        isFoundational?: boolean;
      };
      embedding: number[];
    }>
  ): Promise<string[]> {
    try {
      const documents = await KnowledgeBase.insertMany(data);
      return documents.map((doc) => doc._id.toString());
    } catch (error) {
      console.error('Failed to batch store embeddings:', error);
      throw new Error(
        `Failed to batch store embeddings: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Delete embeddings by ID
   */
  async deleteEmbeddings(ids: string[]): Promise<void> {
    try {
      await KnowledgeBase.deleteMany({ _id: { $in: ids } });
    } catch (error) {
      console.error('Failed to delete embeddings:', error);
      throw new Error(
        `Failed to delete embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get statistics about the vector database
   */
  async getStats(): Promise<{
    totalDocuments: number;
    averageCredibility: number;
    domainDistribution: Record<string, number>;
  }> {
    try {
      const stats = await KnowledgeBase.aggregate([
        {
          $group: {
            _id: null,
            totalDocuments: { $sum: 1 },
            averageCredibility: { $avg: '$credibilityScore' },
          },
        },
      ]);

      const domainStats = await KnowledgeBase.aggregate([
        {
          $group: {
            _id: '$domain',
            count: { $sum: 1 },
          },
        },
      ]);

      const domainDistribution: Record<string, number> = {};
      domainStats.forEach((stat) => {
        domainDistribution[stat._id] = stat.count;
      });

      return {
        totalDocuments: stats[0]?.totalDocuments || 0,
        averageCredibility: Math.round(stats[0]?.averageCredibility || 0),
        domainDistribution,
      };
    } catch (error) {
      console.error('Failed to get stats:', error);
      throw new Error(
        `Failed to get stats: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

export const vectorSearchService = new VectorSearchService();
