/**
 * Knowledge Base API Integration Tests
 * Tests for knowledge base ingestion and search
 */

import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';
import { createKnowledgeBaseRouter } from '../../routes/knowledgeBase';
import { KnowledgeBaseService } from '../../services/knowledgeBaseService';

// Mock the knowledge base service
jest.mock('../../services/knowledgeBaseService');
jest.mock('../../middleware/auth', () => ({
  validateJWT: (req: any, res: any, next: any) => {
    req.user = { id: 'test-user-123', role: 'administrator' };
    next();
  },
  loadUser: (req: any, res: any, next: any) => next(),
}));

describe('Knowledge Base API Integration Tests', () => {
  let app: express.Application;
  let mockDb: Pool;
  let mockKnowledgeBaseService: jest.Mocked<KnowledgeBaseService>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    mockDb = {} as Pool;
    const router = createKnowledgeBaseRouter(mockDb);
    app.use('/api/knowledge-base', router);

    mockKnowledgeBaseService = new KnowledgeBaseService(mockDb) as jest.Mocked<KnowledgeBaseService>;
    jest.clearAllMocks();
  });

  describe('POST /api/knowledge-base/ingest', () => {
    it('should ingest a document successfully', async () => {
      (KnowledgeBaseService as jest.Mock).mockImplementation(() => ({
        ingestDocument: jest.fn().mockResolvedValue({
          success: true,
          sourceId: 'source-123',
          chunksProcessed: 5,
        }),
      }));

      const response = await request(app)
        .post('/api/knowledge-base/ingest')
        .send({
          type: 'url',
          content: 'https://example.com/article',
          metadata: {
            title: 'Test Article',
            publicationDate: '2023-01-01',
            domain: 'Technology',
            credibilityScore: 85,
            tags: ['AI', 'ML'],
          },
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.sourceId).toBe('source-123');
      expect(response.body.chunksProcessed).toBe(5);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/knowledge-base/ingest')
        .send({
          type: 'url',
          // Missing content and metadata
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_INPUT');
    });

    it('should return 400 for invalid document type', async () => {
      const response = await request(app)
        .post('/api/knowledge-base/ingest')
        .send({
          type: 'invalid',
          content: 'test',
          metadata: {
            title: 'Test',
            publicationDate: '2023-01-01',
            domain: 'test',
            credibilityScore: 80,
            tags: [],
          },
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_TYPE');
    });

    it('should return 422 when ingestion fails', async () => {
      (KnowledgeBaseService as jest.Mock).mockImplementation(() => ({
        ingestDocument: jest.fn().mockResolvedValue({
          success: false,
          error: 'Source validation failed',
        }),
      }));

      const response = await request(app)
        .post('/api/knowledge-base/ingest')
        .send({
          type: 'url',
          content: 'https://example.com/old-article',
          metadata: {
            title: 'Old Article',
            publicationDate: '2015-01-01', // Too old
            domain: 'Technology',
            credibilityScore: 50,
            tags: [],
          },
        });

      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('INGESTION_FAILED');
    });
  });

  describe('POST /api/knowledge-base/search', () => {
    it('should search knowledge base successfully', async () => {
      const mockResults = [
        {
          content: 'Relevant content about AI',
          source: {
            title: 'AI Article',
            publicationDate: new Date('2023-01-01'),
            domain: 'Technology',
            credibilityScore: 90,
            tags: ['AI'],
          },
          similarityScore: 0.92,
          relevanceRank: 1,
        },
        {
          content: 'Another relevant piece',
          source: {
            title: 'ML Article',
            publicationDate: new Date('2023-02-01'),
            domain: 'Technology',
            credibilityScore: 85,
            tags: ['ML'],
          },
          similarityScore: 0.88,
          relevanceRank: 2,
        },
      ];

      (KnowledgeBaseService as jest.Mock).mockImplementation(() => ({
        search: jest.fn().mockResolvedValue(mockResults),
      }));

      const response = await request(app)
        .post('/api/knowledge-base/search')
        .send({
          query: 'artificial intelligence',
          domains: ['Technology'],
          maxResults: 10,
          minSimilarity: 0.75,
        });

      expect(response.status).toBe(200);
      expect(response.body.results).toHaveLength(2);
      expect(response.body.results[0].similarityScore).toBe(0.92);
      expect(response.body.count).toBe(2);
    });

    it('should return 400 for missing query', async () => {
      const response = await request(app)
        .post('/api/knowledge-base/search')
        .send({
          domains: ['Technology'],
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_INPUT');
    });

    it('should use default parameters when not provided', async () => {
      (KnowledgeBaseService as jest.Mock).mockImplementation(() => ({
        search: jest.fn().mockResolvedValue([]),
      }));

      const response = await request(app)
        .post('/api/knowledge-base/search')
        .send({
          query: 'test query',
        });

      expect(response.status).toBe(200);
      expect(response.body.results).toEqual([]);
    });
  });

  describe('GET /api/knowledge-base/sources', () => {
    it('should list all sources', async () => {
      const mockSources = [
        {
          id: 'source-1',
          content: 'Content 1',
          source_url: 'https://example.com/1',
          domain: 'Technology',
          credibility_score: 90,
          created_at: new Date(),
        },
        {
          id: 'source-2',
          content: 'Content 2',
          source_url: 'https://example.com/2',
          domain: 'Business',
          credibility_score: 85,
          created_at: new Date(),
        },
      ];

      mockDb.connect = jest.fn().mockResolvedValue({
        query: jest.fn().mockResolvedValue({ rows: mockSources }),
        release: jest.fn(),
      });

      const response = await request(app).get('/api/knowledge-base/sources');

      expect(response.status).toBe(200);
      expect(response.body.sources).toHaveLength(2);
      expect(response.body.count).toBe(2);
    });

    it('should filter sources by domain', async () => {
      const mockSources = [
        {
          id: 'source-1',
          content: 'Content 1',
          domain: 'Technology',
          credibility_score: 90,
          created_at: new Date(),
        },
      ];

      mockDb.connect = jest.fn().mockResolvedValue({
        query: jest.fn().mockResolvedValue({ rows: mockSources }),
        release: jest.fn(),
      });

      const response = await request(app).get('/api/knowledge-base/sources?domain=Technology');

      expect(response.status).toBe(200);
      expect(response.body.sources).toHaveLength(1);
    });
  });

  describe('DELETE /api/knowledge-base/sources/:id', () => {
    it('should delete a source successfully', async () => {
      (KnowledgeBaseService as jest.Mock).mockImplementation(() => ({
        deleteSource: jest.fn().mockResolvedValue(undefined),
      }));

      const response = await request(app).delete('/api/knowledge-base/sources/source-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Source deleted successfully');
    });

    it('should handle deletion errors', async () => {
      (KnowledgeBaseService as jest.Mock).mockImplementation(() => ({
        deleteSource: jest.fn().mockRejectedValue(new Error('Source not found')),
      }));

      const response = await request(app).delete('/api/knowledge-base/sources/non-existent');

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe('DELETE_FAILED');
    });
  });

  describe('GET /api/knowledge-base/stats', () => {
    it('should return knowledge base statistics', async () => {
      const mockStats = {
        totalSources: 150,
        totalChunks: 3000,
        domainBreakdown: {
          Technology: 80,
          Business: 50,
          Science: 20,
        },
        averageCredibilityScore: 85,
      };

      (KnowledgeBaseService as jest.Mock).mockImplementation(() => ({
        getStats: jest.fn().mockResolvedValue(mockStats),
      }));

      const response = await request(app).get('/api/knowledge-base/stats');

      expect(response.status).toBe(200);
      expect(response.body.totalSources).toBe(150);
      expect(response.body.averageCredibilityScore).toBe(85);
    });
  });

  describe('POST /api/knowledge-base/initialize', () => {
    it('should initialize knowledge base successfully', async () => {
      (KnowledgeBaseService as jest.Mock).mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue(undefined),
      }));

      const response = await request(app).post('/api/knowledge-base/initialize');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Knowledge base initialized successfully');
    });
  });
});
