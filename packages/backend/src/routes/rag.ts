import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { RAGEngine, RetrievalOptions } from '../services/ragEngine';

export const createRAGRouter = () => {
  // TODO: Update RAGEngine to use MongoDB models
  const db: any = null; // Temporary placeholder during migration
  const router = Router();
  const ragEngine = new RAGEngine(db);

  /**
   * POST /api/rag/search
   * Perform semantic search on the knowledge base
   */
  router.post('/search', async (req: Request, res: Response) => {
    try {
      const { query, options } = req.body;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          error: {
            code: 'INVALID_QUERY',
            message: 'Query parameter is required and must be a string',
          },
        });
      }

      const retrievalOptions: RetrievalOptions = {
        maxSources: options?.maxSources || 10,
        minSimilarity: options?.minSimilarity || 0.75,
        recencyWeight: options?.recencyWeight || 0.3,
        domains: options?.domains,
      };

      const results = await ragEngine.semanticSearch(query, retrievalOptions);

      res.json({
        query,
        results,
        count: results.length,
      });
    } catch (error) {
      console.error('Semantic search error:', error);
      res.status(500).json({
        error: {
          code: 'SEARCH_FAILED',
          message: error instanceof Error ? error.message : 'Search failed',
        },
      });
    }
  });

  /**
   * POST /api/rag/multi-query-search
   * Perform multi-query retrieval with query variations
   */
  router.post('/multi-query-search', async (req: Request, res: Response) => {
    try {
      const { query, options } = req.body;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          error: {
            code: 'INVALID_QUERY',
            message: 'Query parameter is required and must be a string',
          },
        });
      }

      const retrievalOptions: RetrievalOptions = {
        maxSources: options?.maxSources || 10,
        minSimilarity: options?.minSimilarity || 0.75,
        recencyWeight: options?.recencyWeight || 0.3,
        domains: options?.domains,
      };

      const results = await ragEngine.multiQueryRetrieval(query, retrievalOptions);

      res.json({
        query,
        results,
        count: results.length,
      });
    } catch (error) {
      console.error('Multi-query search error:', error);
      res.status(500).json({
        error: {
          code: 'MULTI_QUERY_SEARCH_FAILED',
          message: error instanceof Error ? error.message : 'Multi-query search failed',
        },
      });
    }
  });

  /**
   * POST /api/rag/hybrid-search
   * Perform hybrid search combining semantic and keyword search
   */
  router.post('/hybrid-search', async (req: Request, res: Response) => {
    try {
      const { query, options } = req.body;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          error: {
            code: 'INVALID_QUERY',
            message: 'Query parameter is required and must be a string',
          },
        });
      }

      const retrievalOptions: RetrievalOptions = {
        maxSources: options?.maxSources || 10,
        minSimilarity: options?.minSimilarity || 0.75,
        recencyWeight: options?.recencyWeight || 0.3,
        domains: options?.domains,
      };

      const results = await ragEngine.hybridSearch(query, retrievalOptions);

      res.json({
        query,
        results,
        count: results.length,
      });
    } catch (error) {
      console.error('Hybrid search error:', error);
      res.status(500).json({
        error: {
          code: 'HYBRID_SEARCH_FAILED',
          message: error instanceof Error ? error.message : 'Hybrid search failed',
        },
      });
    }
  });

  /**
   * POST /api/rag/retrieve-context
   * Retrieve context for content generation
   */
  router.post('/retrieve-context', async (req: Request, res: Response) => {
    try {
      const { query, options } = req.body;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          error: {
            code: 'INVALID_QUERY',
            message: 'Query parameter is required and must be a string',
          },
        });
      }

      const retrievalOptions: RetrievalOptions = {
        maxSources: options?.maxSources || 10,
        minSimilarity: options?.minSimilarity || 0.75,
        recencyWeight: options?.recencyWeight || 0.3,
        domains: options?.domains,
      };

      const contexts = await ragEngine.retrieveContext(query, retrievalOptions);

      res.json({
        query,
        contexts,
        count: contexts.length,
      });
    } catch (error) {
      console.error('Context retrieval error:', error);
      res.status(500).json({
        error: {
          code: 'CONTEXT_RETRIEVAL_FAILED',
          message: error instanceof Error ? error.message : 'Context retrieval failed',
        },
      });
    }
  });

  /**
   * POST /api/rag/generate-with-attribution
   * Generate content with source attribution
   */
  router.post('/generate-with-attribution', async (req: Request, res: Response) => {
    try {
      const { query, options } = req.body;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          error: {
            code: 'INVALID_QUERY',
            message: 'Query parameter is required and must be a string',
          },
        });
      }

      const retrievalOptions: RetrievalOptions = {
        maxSources: options?.maxSources || 10,
        minSimilarity: options?.minSimilarity || 0.75,
        recencyWeight: options?.recencyWeight || 0.3,
        domains: options?.domains,
      };

      const result = await ragEngine.generateContentWithAttribution(query, retrievalOptions);

      res.json(result);
    } catch (error) {
      console.error('Content generation error:', error);
      res.status(500).json({
        error: {
          code: 'CONTENT_GENERATION_FAILED',
          message: error instanceof Error ? error.message : 'Content generation failed',
        },
      });
    }
  });

  /**
   * GET /api/rag/content-sources/:contentId
   * Get sources used for a specific piece of generated content
   */
  router.get('/content-sources/:contentId', async (req: Request, res: Response) => {
    try {
      const { contentId } = req.params;

      if (!contentId) {
        return res.status(400).json({
          error: {
            code: 'INVALID_CONTENT_ID',
            message: 'Content ID is required',
          },
        });
      }

      const sources = await ragEngine.getContentSources(contentId);

      res.json({
        contentId,
        sources,
        count: sources.length,
      });
    } catch (error) {
      console.error('Get content sources error:', error);
      res.status(500).json({
        error: {
          code: 'GET_SOURCES_FAILED',
          message: error instanceof Error ? error.message : 'Failed to get content sources',
        },
      });
    }
  });

  /**
   * POST /api/rag/track-source-usage
   * Track which sources were used for generated content
   */
  router.post('/track-source-usage', async (req: Request, res: Response) => {
    try {
      const { contentId, sourceIds, contentType } = req.body;

      if (!contentId || !sourceIds || !Array.isArray(sourceIds) || !contentType) {
        return res.status(400).json({
          error: {
            code: 'INVALID_PARAMETERS',
            message: 'contentId, sourceIds (array), and contentType are required',
          },
        });
      }

      await ragEngine.trackSourceUsage(contentId, sourceIds, contentType);

      res.json({
        success: true,
        message: 'Source usage tracked successfully',
        contentId,
        trackedSources: sourceIds.length,
      });
    } catch (error) {
      console.error('Track source usage error:', error);
      res.status(500).json({
        error: {
          code: 'TRACK_USAGE_FAILED',
          message: error instanceof Error ? error.message : 'Failed to track source usage',
        },
      });
    }
  });

  return router;
};
