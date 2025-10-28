import { DocumentSource, IngestionResult, SourceMetadata } from '../types/knowledgeBase';
import { documentIngestionService } from './documentIngestionService';
import { embeddingService } from './embeddingService';
import { vectorSearchService } from './vectorSearchService';
import { sourceValidationService } from './sourceValidationService';

/**
 * Knowledge Base Service
 * Orchestrates the complete document ingestion pipeline:
 * validation → extraction → chunking → embedding → storage
 * Uses MongoDB Atlas Vector Search instead of Pinecone
 */
export class KnowledgeBaseService {
  constructor() {
    // No longer needs database pool - uses Mongoose models
  }

  /**
   * Initialize the knowledge base (create indexes, etc.)
   */
  async initialize(): Promise<void> {
    // MongoDB indexes are created via Mongoose schema
    // Vector search index must be created in MongoDB Atlas
    console.log('Knowledge base initialized - ensure vector search index exists in MongoDB Atlas');
  }

  /**
   * Ingest a document into the knowledge base
   * Complete pipeline: validate → extract → chunk → embed → store in MongoDB
   * Implements Requirements 2.1, 2.5
   */
  async ingestDocument(source: DocumentSource): Promise<IngestionResult> {
    try {
      // Step 1: Validate source
      const validation = sourceValidationService.validateSource(source.metadata);
      
      if (!validation.isValid) {
        return {
          success: false,
          error: `Source validation failed: ${validation.errors.join(', ')}`,
        };
      }

      // Update credibility score from validation
      source.metadata.credibilityScore = validation.credibilityScore;

      // Step 2: Extract and clean text
      const processedDoc = await documentIngestionService.processDocument(source);

      // Step 3: Chunk document
      const chunks = await embeddingService.chunkDocument(processedDoc);

      if (chunks.length === 0) {
        return {
          success: false,
          error: 'No content chunks generated from document',
        };
      }

      // Step 4: Generate embeddings
      const embeddings = await embeddingService.generateEmbeddings(chunks);

      // Step 5: Store embeddings directly in MongoDB
      const embeddingIds: string[] = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddings[i];

        const id = await vectorSearchService.storeEmbedding({
          content: chunk.content,
          sourceUrl: source.type === 'url' ? (source.content as string) : '',
          sourceType: source.type,
          publicationDate: source.metadata.publicationDate,
          domain: source.metadata.domain,
          credibilityScore: source.metadata.credibilityScore,
          metadata: {
            title: source.metadata.title,
            author: source.metadata.author,
            tags: source.metadata.tags,
            chunkIndex: chunk.metadata.chunkIndex,
            totalChunks: chunk.metadata.totalChunks,
            isFoundational: source.metadata.isFoundational,
          },
          embedding: embedding.embedding,
        });

        embeddingIds.push(id);
      }

      return {
        success: true,
        sourceId: embeddingIds[0], // Return first chunk ID as primary source ID
        embeddingIds,
        chunksProcessed: chunks.length,
      };
    } catch (error) {
      console.error('Document ingestion failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Batch ingest multiple documents
   */
  async ingestDocuments(sources: DocumentSource[]): Promise<IngestionResult[]> {
    const results: IngestionResult[] = [];

    for (const source of sources) {
      const result = await this.ingestDocument(source);
      results.push(result);
    }

    return results;
  }

  /**
   * Search the knowledge base using MongoDB vector search
   * Implements Requirements 2.2, 2.3, 2.4
   */
  async search(
    query: string,
    options: {
      domains?: string[];
      maxResults?: number;
      minSimilarity?: number;
      recencyWeight?: number;
    } = {}
  ): Promise<Array<{
    content: string;
    source: SourceMetadata;
    similarityScore: number;
    relevanceRank: number;
  }>> {
    try {
      // Use vector search service
      const results = await vectorSearchService.search(query, {
        domain: options.domains?.[0],
        limit: options.maxResults || 10,
        minSimilarity: options.minSimilarity || 0.75,
        recencyWeight: options.recencyWeight || 0,
      });

      // Transform results
      return results.map((result, index) => ({
        content: result.content,
        source: {
          title: result.metadata.title || 'Untitled',
          author: result.metadata.author,
          publicationDate: result.publicationDate || new Date(),
          domain: result.domain,
          credibilityScore: result.credibilityScore,
          tags: result.metadata.tags || [],
          isFoundational: (result.metadata as any).isFoundational,
        },
        similarityScore: result.similarityScore,
        relevanceRank: index + 1,
      }));
    } catch (error) {
      console.error('Knowledge base search failed:', error);
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get knowledge base statistics from MongoDB
   */
  async getStats(): Promise<{
    totalSources: number;
    totalVectors: number;
    averageCredibility: number;
    domainDistribution: Record<string, number>;
  }> {
    try {
      const stats = await vectorSearchService.getStats();

      return {
        totalSources: stats.totalDocuments,
        totalVectors: stats.totalDocuments, // Same as total documents in MongoDB
        averageCredibility: stats.averageCredibility,
        domainDistribution: stats.domainDistribution,
      };
    } catch (error) {
      console.error('Failed to get stats:', error);
      throw new Error(`Failed to get stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a source from the knowledge base (MongoDB)
   */
  async deleteSource(sourceId: string): Promise<void> {
    try {
      await vectorSearchService.deleteEmbeddings([sourceId]);
    } catch (error) {
      console.error('Failed to delete source:', error);
      throw new Error(`Failed to delete source: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
