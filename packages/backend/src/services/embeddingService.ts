import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { DocumentChunk, ChunkMetadata, EmbeddingResult, ProcessedDocument } from '../types/knowledgeBase';
import { cacheService, CacheNamespace } from './cacheService';
import { openaiService } from './openaiService';
import crypto from 'crypto';

/**
 * Embedding Service
 * Handles document chunking and embedding generation using unified OpenAI service
 * Implements caching for reused content embeddings (Requirement 12.1)
 */
export class EmbeddingService {
  private textSplitter: RecursiveCharacterTextSplitter;
  private readonly batchSize = 100;

  constructor() {
    // Initialize text splitter with 512 token chunks and 50 token overlap
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 512,
      chunkOverlap: 50,
      separators: ['\n\n', '\n', '. ', ' ', ''],
    });
  }

  /**
   * Generate cache key for text content
   */
  private generateEmbeddingCacheKey(text: string): string {
    return crypto.createHash('md5').update(text).digest('hex');
  }

  /**
   * Chunk a processed document into smaller pieces
   */
  async chunkDocument(document: ProcessedDocument): Promise<DocumentChunk[]> {
    try {
      const chunks = await this.textSplitter.createDocuments([document.cleanedText]);
      
      const documentChunks: DocumentChunk[] = chunks.map((chunk, index) => ({
        content: chunk.pageContent,
        metadata: {
          ...document.metadata,
          chunkIndex: index,
          totalChunks: chunks.length,
        },
      }));

      return documentChunks;
    } catch (error) {
      throw new Error(`Failed to chunk document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate embeddings for document chunks with batching
   */
  async generateEmbeddings(chunks: DocumentChunk[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];
    
    // Process chunks in batches
    for (let i = 0; i < chunks.length; i += this.batchSize) {
      const batch = chunks.slice(i, i + this.batchSize);
      const batchTexts = batch.map(chunk => chunk.content);
      
      try {
        // Use unified OpenAI service for batch embedding generation
        const embeddings = await openaiService.generateEmbeddingsBatch(batchTexts);
        
        // Map embeddings back to chunks
        batch.forEach((chunk, batchIndex) => {
          results.push({
            embedding: embeddings[batchIndex],
            chunkIndex: chunk.metadata.chunkIndex,
          });
        });
      } catch (error) {
        console.error(`Failed to generate embeddings for batch ${i / this.batchSize}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        throw error;
      }
    }

    return results;
  }

  /**
   * Generate embedding for a single query text with caching
   * Implements Requirement 12.1 (cache embeddings for reused content)
   */
  async generateQueryEmbedding(query: string): Promise<number[]> {
    // Check cache first
    const cacheKey = this.generateEmbeddingCacheKey(query);
    const cached = await cacheService.get<number[]>(cacheKey, {
      namespace: CacheNamespace.EMBEDDINGS,
    });

    if (cached) {
      return cached;
    }

    try {
      // Use unified OpenAI service for single embedding generation
      const embedding = await openaiService.generateEmbedding(query);
      
      // Cache the embedding
      await cacheService.set(cacheKey, embedding, {
        namespace: CacheNamespace.EMBEDDINGS,
      });

      return embedding;
    } catch (error) {
      throw new Error(`Failed to generate query embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process a complete document: chunk and generate embeddings
   */
  async processDocumentForEmbedding(document: ProcessedDocument): Promise<{
    chunks: DocumentChunk[];
    embeddings: EmbeddingResult[];
  }> {
    const chunks = await this.chunkDocument(document);
    const embeddings = await this.generateEmbeddings(chunks);

    return {
      chunks,
      embeddings,
    };
  }

  /**
   * Get embedding dimensions for the current model
   */
  getEmbeddingDimensions(): number {
    return openaiService.getEmbeddingDimensions();
  }
}

export const embeddingService = new EmbeddingService();
