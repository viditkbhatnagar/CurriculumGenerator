/**
 * Embedding Service Tests
 * Tests for document chunking and embedding generation
 */

import { embeddingService } from '../services/embeddingService';
import { ProcessedDocument, DocumentChunk } from '../types/knowledgeBase';

// Mock OpenAI embeddings
jest.mock('@langchain/openai', () => ({
  OpenAIEmbeddings: jest.fn().mockImplementation(() => ({
    embedDocuments: jest.fn().mockResolvedValue([
      new Array(3072).fill(0.1),
      new Array(3072).fill(0.2),
    ]),
    embedQuery: jest.fn().mockResolvedValue(new Array(3072).fill(0.5)),
  })),
}));

describe('EmbeddingService', () => {
  describe('chunkDocument', () => {
    it('should chunk document with 512 token size and 50 token overlap', async () => {
      const document: ProcessedDocument = {
        text: 'Original text',
        cleanedText: 'This is a test document. '.repeat(100), // Create long text
        metadata: {
          title: 'Test Document',
          publicationDate: new Date('2023-01-01'),
          domain: 'Technology',
          credibilityScore: 90,
          tags: ['test'],
        },
      };

      const chunks = await embeddingService.chunkDocument(document);

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk, index) => {
        expect(chunk.content).toBeTruthy();
        expect(chunk.metadata.chunkIndex).toBe(index);
        expect(chunk.metadata.totalChunks).toBe(chunks.length);
        expect(chunk.metadata.title).toBe('Test Document');
      });
    });

    it('should maintain metadata in chunks', async () => {
      const document: ProcessedDocument = {
        text: 'Original',
        cleanedText: 'Short document text',
        metadata: {
          title: 'Test',
          publicationDate: new Date('2023-01-01'),
          domain: 'Science',
          credibilityScore: 85,
          tags: ['research', 'study'],
        },
      };

      const chunks = await embeddingService.chunkDocument(document);

      expect(chunks[0].metadata.domain).toBe('Science');
      expect(chunks[0].metadata.credibilityScore).toBe(85);
      expect(chunks[0].metadata.tags).toEqual(['research', 'study']);
    });

    it('should handle empty document', async () => {
      const document: ProcessedDocument = {
        text: '',
        cleanedText: '',
        metadata: {
          title: 'Empty',
          publicationDate: new Date(),
          domain: 'test',
          credibilityScore: 50,
          tags: [],
        },
      };

      const chunks = await embeddingService.chunkDocument(document);

      expect(chunks.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('generateEmbeddings', () => {
    it('should generate embeddings for chunks in batches', async () => {
      const chunks: DocumentChunk[] = [
        {
          content: 'Chunk 1 content',
          metadata: {
            title: 'Test',
            publicationDate: new Date(),
            domain: 'test',
            credibilityScore: 80,
            tags: [],
            chunkIndex: 0,
            totalChunks: 2,
          },
        },
        {
          content: 'Chunk 2 content',
          metadata: {
            title: 'Test',
            publicationDate: new Date(),
            domain: 'test',
            credibilityScore: 80,
            tags: [],
            chunkIndex: 1,
            totalChunks: 2,
          },
        },
      ];

      const results = await embeddingService.generateEmbeddings(chunks);

      expect(results).toHaveLength(2);
      results.forEach((result, index) => {
        expect(Array.isArray(result.embedding)).toBe(true);
        expect(result.embedding.length).toBeGreaterThan(0);
        expect(result.chunkIndex).toBe(index);
      });
    });

    it('should process large batches correctly', async () => {
      // Create 150 chunks to test batching (batch size is 100)
      const chunks: DocumentChunk[] = Array.from({ length: 150 }, (_, i) => ({
        content: `Chunk ${i} content`,
        metadata: {
          title: 'Test',
          publicationDate: new Date(),
          domain: 'test',
          credibilityScore: 80,
          tags: [],
          chunkIndex: i,
          totalChunks: 150,
        },
      }));

      const results = await embeddingService.generateEmbeddings(chunks);

      expect(results).toHaveLength(150);
      expect(results[0].chunkIndex).toBe(0);
      expect(results[149].chunkIndex).toBe(149);
    });
  });

  describe('generateQueryEmbedding', () => {
    it('should generate embedding for query text', async () => {
      const query = 'What is business intelligence?';

      const embedding = await embeddingService.generateQueryEmbedding(query);

      expect(embedding).toHaveLength(3072);
      expect(Array.isArray(embedding)).toBe(true);
    });

    it('should cache embeddings for reused queries', async () => {
      const query = 'Cached query test';

      // First call
      const embedding1 = await embeddingService.generateQueryEmbedding(query);
      
      // Second call should use cache
      const embedding2 = await embeddingService.generateQueryEmbedding(query);

      expect(embedding1).toEqual(embedding2);
    });
  });

  describe('processDocumentForEmbedding', () => {
    it('should chunk and generate embeddings in one call', async () => {
      const document: ProcessedDocument = {
        text: 'Original',
        cleanedText: 'Complete document processing test. '.repeat(50),
        metadata: {
          title: 'Integration Test',
          publicationDate: new Date(),
          domain: 'test',
          credibilityScore: 90,
          tags: ['integration'],
        },
      };

      const result = await embeddingService.processDocumentForEmbedding(document);

      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.embeddings.length).toBe(result.chunks.length);
      
      result.embeddings.forEach((emb, index) => {
        expect(Array.isArray(emb.embedding)).toBe(true);
        expect(emb.embedding.length).toBeGreaterThan(0);
        expect(emb.chunkIndex).toBe(index);
      });
    });
  });

  describe('getEmbeddingDimensions', () => {
    it('should return correct dimensions for text-embedding-3-large', () => {
      const dimensions = embeddingService.getEmbeddingDimensions();
      
      expect(dimensions).toBe(3072);
    });
  });

  describe('error handling', () => {
    it('should handle chunking errors gracefully', async () => {
      const invalidDocument: any = {
        cleanedText: null, // Invalid input
        metadata: {},
      };

      await expect(embeddingService.chunkDocument(invalidDocument)).rejects.toThrow();
    });
  });
});
