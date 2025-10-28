import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { KnowledgeBaseService } from '../services/knowledgeBaseService';
import { DocumentSource } from '../types/knowledgeBase';
import { validateJWT, loadUser } from '../middleware/auth';

export function createKnowledgeBaseRouter(): Router {
  // TODO: Update KnowledgeBaseService to use MongoDB models
  const db: any = null; // Temporary placeholder during migration
  const router = Router();
  const knowledgeBaseService = new KnowledgeBaseService(db);

  /**
   * POST /api/knowledge-base/ingest
   * Ingest a new document into the knowledge base
   */
  router.post('/ingest', validateJWT, loadUser, async (req: Request, res: Response) => {
    try {
      const { type, content, metadata } = req.body;

      if (!type || !content || !metadata) {
        return res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: 'Missing required fields: type, content, metadata',
          },
        });
      }

      // Validate document type
      if (!['pdf', 'docx', 'url'].includes(type)) {
        return res.status(400).json({
          error: {
            code: 'INVALID_TYPE',
            message: 'Document type must be pdf, docx, or url',
          },
        });
      }

      // Parse metadata
      const sourceMetadata = {
        ...metadata,
        publicationDate: new Date(metadata.publicationDate),
        credibilityScore: metadata.credibilityScore || 0,
        tags: metadata.tags || [],
      };

      const source: DocumentSource = {
        type,
        content: type === 'url' ? content : Buffer.from(content, 'base64'),
        metadata: sourceMetadata,
      };

      const result = await knowledgeBaseService.ingestDocument(source);

      if (!result.success) {
        return res.status(422).json({
          error: {
            code: 'INGESTION_FAILED',
            message: result.error || 'Failed to ingest document',
          },
        });
      }

      res.status(201).json({
        success: true,
        sourceId: result.sourceId,
        chunksProcessed: result.chunksProcessed,
      });
    } catch (error) {
      console.error('Knowledge base ingestion error:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to ingest document',
        },
      });
    }
  });

  /**
   * POST /api/knowledge-base/search
   * Search the knowledge base using semantic search
   */
  router.post('/search', validateJWT, loadUser, async (req: Request, res: Response) => {
    try {
      const { query, domains, maxResults, minSimilarity, recencyWeight } = req.body;

      if (!query) {
        return res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: 'Query is required',
          },
        });
      }

      const results = await knowledgeBaseService.search(query, {
        domains,
        maxResults: maxResults || 10,
        minSimilarity: minSimilarity || 0.75,
        recencyWeight: recencyWeight || 0,
      });

      res.json({
        query,
        results,
        count: results.length,
      });
    } catch (error) {
      console.error('Knowledge base search error:', error);
      res.status(500).json({
        error: {
          code: 'SEARCH_FAILED',
          message: 'Failed to search knowledge base',
        },
      });
    }
  });

  /**
   * GET /api/knowledge-base/sources
   * List all sources in the knowledge base
   */
  router.get('/sources', validateJWT, loadUser, async (req: Request, res: Response) => {
    try {
      const { domain, limit = 50, offset = 0 } = req.query;

      const client = await db.connect();
      try {
        let query = 'SELECT * FROM knowledge_base';
        const params: any[] = [];

        if (domain) {
          query += ' WHERE domain = $1';
          params.push(domain);
        }

        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await client.query(query, params);

        res.json({
          sources: result.rows,
          count: result.rows.length,
          limit: Number(limit),
          offset: Number(offset),
        });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Failed to list sources:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to list sources',
        },
      });
    }
  });

  /**
   * DELETE /api/knowledge-base/sources/:id
   * Remove a source from the knowledge base
   */
  router.delete('/sources/:id', validateJWT, loadUser, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      await knowledgeBaseService.deleteSource(id);

      res.json({
        success: true,
        message: 'Source deleted successfully',
      });
    } catch (error) {
      console.error('Failed to delete source:', error);
      res.status(500).json({
        error: {
          code: 'DELETE_FAILED',
          message: error instanceof Error ? error.message : 'Failed to delete source',
        },
      });
    }
  });

  /**
   * GET /api/knowledge-base/stats
   * Get knowledge base statistics
   */
  router.get('/stats', validateJWT, loadUser, async (req: Request, res: Response) => {
    try {
      const stats = await knowledgeBaseService.getStats();

      res.json(stats);
    } catch (error) {
      console.error('Failed to get stats:', error);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to get knowledge base statistics',
        },
      });
    }
  });

  /**
   * POST /api/knowledge-base/initialize
   * Initialize the knowledge base (create indexes)
   */
  router.post('/initialize', validateJWT, loadUser, async (req: Request, res: Response) => {
    try {
      await knowledgeBaseService.initialize();

      res.json({
        success: true,
        message: 'Knowledge base initialized successfully',
      });
    } catch (error) {
      console.error('Failed to initialize knowledge base:', error);
      res.status(500).json({
        error: {
          code: 'INITIALIZATION_FAILED',
          message: 'Failed to initialize knowledge base',
        },
      });
    }
  });

  return router;
}
