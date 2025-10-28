import { Pinecone } from '@pinecone-database/pinecone';
import { DocumentChunk, EmbeddingResult, PineconeMetadata } from '../types/knowledgeBase';
import { Pool } from 'pg';

/**
 * Vector Database Service
 * Handles Pinecone vector database operations and PostgreSQL reference management
 */
export class VectorDatabaseService {
  private pinecone: Pinecone;
  private indexName: string;
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
    this.indexName = process.env.PINECONE_INDEX_NAME || 'curriculum-knowledge-base';
    
    const apiKey = process.env.PINECONE_API_KEY || '';
    
    // Only initialize Pinecone if we have a valid API key
    if (!apiKey || apiKey === 'dummy-key-for-dev' || apiKey === 'your-pinecone-api-key') {
      console.warn('Pinecone API key not configured - vector search will be disabled');
      // Create a dummy Pinecone instance that won't be used
      this.pinecone = {} as Pinecone;
    } else {
      // Initialize Pinecone client
      this.pinecone = new Pinecone({
        apiKey,
      });
    }
  }

  /**
   * Initialize Pinecone index with appropriate dimensions
   */
  async initializeIndex(dimensions: number = 3072): Promise<void> {
    try {
      const existingIndexes = await this.pinecone.listIndexes();
      const indexExists = existingIndexes.indexes?.some(index => index.name === this.indexName);

      if (!indexExists) {
        console.log(`Creating Pinecone index: ${this.indexName}`);
        await this.pinecone.createIndex({
          name: this.indexName,
          dimension: dimensions,
          metric: 'cosine',
          spec: {
            serverless: {
              cloud: 'aws',
              region: 'us-east-1',
            },
          },
        });
        
        // Wait for index to be ready
        await this.waitForIndexReady();
      } else {
        console.log(`Pinecone index ${this.indexName} already exists`);
      }
    } catch (error) {
      throw new Error(`Failed to initialize Pinecone index: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Wait for index to be ready
   */
  private async waitForIndexReady(maxWaitTime: number = 60000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        const index = this.pinecone.index(this.indexName);
        const stats = await index.describeIndexStats();
        
        if (stats) {
          console.log('Pinecone index is ready');
          return;
        }
      } catch (error) {
        // Index not ready yet, continue waiting
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    throw new Error('Timeout waiting for Pinecone index to be ready');
  }

  /**
   * Store embeddings in Pinecone with metadata
   * Uses namespace structure: {domain}/{source_type}
   */
  async storeEmbeddings(
    chunks: DocumentChunk[],
    embeddings: EmbeddingResult[],
    sourceId: string
  ): Promise<string[]> {
    try {
      const index = this.pinecone.index(this.indexName);
      const embeddingIds: string[] = [];

      // Group by namespace
      const namespaceGroups = this.groupByNamespace(chunks);

      for (const [namespace, namespaceChunks] of Object.entries(namespaceGroups)) {
        const vectors = namespaceChunks.map((chunk, idx) => {
          const embedding = embeddings.find(e => e.chunkIndex === chunk.metadata.chunkIndex);
          
          if (!embedding) {
            throw new Error(`Embedding not found for chunk ${chunk.metadata.chunkIndex}`);
          }

          const vectorId = `${sourceId}_chunk_${chunk.metadata.chunkIndex}`;
          embeddingIds.push(vectorId);

          const metadata: Record<string, any> = {
            content: chunk.content,
            source_url: '', // Will be set from source metadata
            source_type: chunk.metadata.domain,
            publication_date: chunk.metadata.publicationDate.toISOString(),
            domain: chunk.metadata.domain,
            credibility_score: chunk.metadata.credibilityScore,
            tags: chunk.metadata.tags,
            chunk_index: chunk.metadata.chunkIndex,
            total_chunks: chunk.metadata.totalChunks,
            title: chunk.metadata.title,
            author: chunk.metadata.author || '',
          };

          return {
            id: vectorId,
            values: embedding.embedding,
            metadata,
          };
        });

        // Upsert vectors to Pinecone in batches
        const batchSize = 100;
        for (let i = 0; i < vectors.length; i += batchSize) {
          const batch = vectors.slice(i, i + batchSize);
          await index.namespace(namespace).upsert(batch);
        }
      }

      return embeddingIds;
    } catch (error) {
      throw new Error(`Failed to store embeddings in Pinecone: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create reference links between PostgreSQL and Pinecone
   */
  async createKnowledgeBaseReference(
    sourceMetadata: {
      content: string;
      sourceUrl: string;
      sourceType: string;
      publicationDate: Date;
      domain: string;
      credibilityScore: number;
      metadata: any;
    },
    embeddingIds: string[]
  ): Promise<string> {
    const client = await this.db.connect();
    
    try {
      const result = await client.query(
        `INSERT INTO knowledge_base (
          content, source_url, source_type, publication_date, 
          domain, credibility_score, metadata, embedding_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id`,
        [
          sourceMetadata.content,
          sourceMetadata.sourceUrl,
          sourceMetadata.sourceType,
          sourceMetadata.publicationDate,
          sourceMetadata.domain,
          sourceMetadata.credibilityScore,
          JSON.stringify(sourceMetadata.metadata),
          embeddingIds[0], // Store first embedding ID as primary reference
        ]
      );

      return result.rows[0].id;
    } catch (error) {
      throw new Error(`Failed to create knowledge base reference: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      client.release();
    }
  }

  /**
   * Query Pinecone for similar vectors
   */
  async querySimilar(
    queryEmbedding: number[],
    options: {
      namespace?: string;
      topK?: number;
      minScore?: number;
      filter?: Record<string, any>;
    } = {}
  ): Promise<Array<{ id: string; score: number; metadata: PineconeMetadata }>> {
    try {
      const index = this.pinecone.index(this.indexName);
      const namespace = options.namespace || '';
      
      const queryResponse = await index.namespace(namespace).query({
        vector: queryEmbedding,
        topK: options.topK || 10,
        includeMetadata: true,
        filter: options.filter,
      });

      const results = queryResponse.matches
        .filter(match => match.score && match.score >= (options.minScore || 0.75))
        .map(match => ({
          id: match.id,
          score: match.score || 0,
          metadata: match.metadata as any as PineconeMetadata,
        }));

      return results;
    } catch (error) {
      throw new Error(`Failed to query Pinecone: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete embeddings from Pinecone
   */
  async deleteEmbeddings(embeddingIds: string[], namespace?: string): Promise<void> {
    try {
      const index = this.pinecone.index(this.indexName);
      const ns = namespace || '';
      
      await index.namespace(ns).deleteMany(embeddingIds);
    } catch (error) {
      throw new Error(`Failed to delete embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get index statistics
   */
  async getIndexStats(): Promise<any> {
    try {
      const index = this.pinecone.index(this.indexName);
      const stats = await index.describeIndexStats();
      return stats;
    } catch (error) {
      throw new Error(`Failed to get index stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Group chunks by namespace (domain/source_type)
   */
  private groupByNamespace(chunks: DocumentChunk[]): Record<string, DocumentChunk[]> {
    const groups: Record<string, DocumentChunk[]> = {};

    for (const chunk of chunks) {
      const namespace = this.buildNamespace(chunk.metadata.domain, chunk.metadata.domain);
      
      if (!groups[namespace]) {
        groups[namespace] = [];
      }
      
      groups[namespace].push(chunk);
    }

    return groups;
  }

  /**
   * Build namespace string from domain and source type
   */
  private buildNamespace(domain: string, sourceType: string): string {
    // Sanitize namespace (Pinecone has restrictions on namespace format)
    const sanitizedDomain = domain.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const sanitizedType = sourceType.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    return `${sanitizedDomain}/${sanitizedType}`;
  }
}
