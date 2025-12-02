import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { KnowledgeBaseService } from '../services/knowledgeBaseService';
import { DocumentSource, SourceMetadata } from '../types/knowledgeBase';
import { validateJWT, loadUser } from '../middleware/auth';
import { KnowledgeBase } from '../models/KnowledgeBase';

// Domain mapping for bulk ingestion
const DOMAIN_MAPPING: Record<string, string> = {
  Accreditations: 'accreditation_standards',
  'Competency-Framework': 'competency_frameworks',
  'Curriculum-Design': 'curriculum_design',
  Standards: 'education_standards',
  'Subject Books': 'subject_knowledge',
  typeOfOutputs: 'output_templates',
  'UK-Diploma-Programs': 'uk_diploma_programs',
};

const CREDIBILITY_SCORES: Record<string, number> = {
  Accreditations: 95,
  'Competency-Framework': 90,
  'Curriculum-Design': 85,
  Standards: 95,
  'Subject Books': 80,
  typeOfOutputs: 75,
  'UK-Diploma-Programs': 90,
};

const TAGS_MAPPING: Record<string, string[]> = {
  Accreditations: ['accreditation', 'standards', 'quality-assurance', 'compliance'],
  'Competency-Framework': ['competencies', 'skills', 'framework', 'professional-development'],
  'Curriculum-Design': ['curriculum', 'instructional-design', 'learning-outcomes', 'pedagogy'],
  Standards: ['standards', 'quality', 'assessment', 'rubrics'],
  'Subject Books': ['reference', 'textbook', 'domain-knowledge'],
  typeOfOutputs: ['templates', 'examples', 'output-formats'],
  'UK-Diploma-Programs': ['uk-education', 'diploma', 'qualifications', 'nvq'],
};

export function createKnowledgeBaseRouter(): Router {
  const router = Router();
  const knowledgeBaseService = new KnowledgeBaseService();

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
   * List all sources in the knowledge base (using MongoDB)
   */
  router.get('/sources', validateJWT, loadUser, async (req: Request, res: Response) => {
    try {
      const { domain, limit = 50, offset = 0 } = req.query;

      // Build MongoDB query
      const query: Record<string, any> = {};
      if (domain) {
        query.domain = domain;
      }

      const sources = await KnowledgeBase.find(query)
        .sort({ createdAt: -1 })
        .skip(Number(offset))
        .limit(Number(limit))
        .select('-embedding'); // Exclude embedding from response

      const total = await KnowledgeBase.countDocuments(query);

      res.json({
        sources,
        count: sources.length,
        total,
        limit: Number(limit),
        offset: Number(offset),
      });
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

  /**
   * POST /api/knowledge-base/bulk-ingest
   * Bulk ingest documents from the Curriculum-Generator-KB folder
   * This processes all PDF and DOCX files and creates embeddings for RAG
   */
  router.post('/bulk-ingest', validateJWT, loadUser, async (req: Request, res: Response) => {
    try {
      const { targetFolder, dryRun = false } = req.body;

      // Determine knowledge base path
      const kbPath = path.resolve(__dirname, '../../../../Curriculum-Generator-KB');

      if (!fs.existsSync(kbPath)) {
        return res.status(404).json({
          error: {
            code: 'KB_NOT_FOUND',
            message: `Knowledge base folder not found: ${kbPath}`,
          },
        });
      }

      // Helper function to scan for documents
      const getAllDocuments = (rootDir: string, folder?: string): string[] => {
        const documents: string[] = [];

        const scanDirectory = (dir: string) => {
          const entries = fs.readdirSync(dir, { withFileTypes: true });

          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory() && !entry.name.startsWith('.')) {
              scanDirectory(fullPath);
            } else if (entry.isFile()) {
              const ext = path.extname(entry.name).toLowerCase();
              if (ext === '.pdf' || ext === '.docx') {
                documents.push(fullPath);
              }
            }
          }
        };

        if (folder) {
          const targetPath = path.join(rootDir, folder);
          if (fs.existsSync(targetPath)) {
            scanDirectory(targetPath);
          }
        } else {
          scanDirectory(rootDir);
        }

        return documents;
      };

      // Get all documents
      const documents = getAllDocuments(kbPath, targetFolder);

      if (documents.length === 0) {
        return res.json({
          success: true,
          message: 'No documents found to process',
          stats: { totalFiles: 0, processed: 0, succeeded: 0, failed: 0 },
        });
      }

      if (dryRun) {
        // Return what would be processed
        const docInfo = documents.map((doc) => {
          const relativePath = path.relative(kbPath, doc);
          const folder = relativePath.split(path.sep)[0];
          return {
            file: relativePath,
            domain: DOMAIN_MAPPING[folder] || 'general',
            credibility: CREDIBILITY_SCORES[folder] || 70,
          };
        });

        return res.json({
          success: true,
          dryRun: true,
          message: `Found ${documents.length} documents to process`,
          documents: docInfo,
        });
      }

      // Process documents
      const stats = {
        totalFiles: documents.length,
        processed: 0,
        succeeded: 0,
        failed: 0,
        totalChunks: 0,
        errors: [] as Array<{ file: string; error: string }>,
      };

      for (const docPath of documents) {
        const relativePath = path.relative(kbPath, docPath);
        const parts = relativePath.split(path.sep);
        const folder = parts[0];
        const ext = path.extname(docPath).toLowerCase();
        const type = ext === '.pdf' ? 'pdf' : 'docx';

        const title = path.basename(docPath, ext).replace(/[-_]/g, ' ').trim();

        try {
          const content = fs.readFileSync(docPath);

          const metadata: SourceMetadata = {
            title,
            author: 'Curriculum Generator Knowledge Base',
            publicationDate: new Date(),
            domain: DOMAIN_MAPPING[folder] || 'general',
            credibilityScore: CREDIBILITY_SCORES[folder] || 70,
            tags: TAGS_MAPPING[folder] || ['curriculum', 'education'],
            isFoundational: (CREDIBILITY_SCORES[folder] || 70) >= 90,
          };

          const source: DocumentSource = {
            type,
            content,
            metadata,
          };

          const result = await knowledgeBaseService.ingestDocument(source);
          stats.processed++;

          if (result.success) {
            stats.succeeded++;
            stats.totalChunks += result.chunksProcessed || 0;
          } else {
            stats.failed++;
            stats.errors.push({ file: relativePath, error: result.error || 'Unknown error' });
          }
        } catch (error) {
          stats.processed++;
          stats.failed++;
          stats.errors.push({
            file: relativePath,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      res.json({
        success: true,
        message: `Bulk ingestion completed: ${stats.succeeded}/${stats.totalFiles} documents processed`,
        stats,
      });
    } catch (error) {
      console.error('Bulk ingestion error:', error);
      res.status(500).json({
        error: {
          code: 'BULK_INGESTION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to perform bulk ingestion',
        },
      });
    }
  });

  /**
   * DELETE /api/knowledge-base/clear
   * Clear all documents from the knowledge base (use with caution!)
   */
  router.delete('/clear', validateJWT, loadUser, async (req: Request, res: Response) => {
    try {
      const { confirm } = req.body;

      if (confirm !== 'DELETE_ALL_KNOWLEDGE_BASE') {
        return res.status(400).json({
          error: {
            code: 'CONFIRMATION_REQUIRED',
            message:
              'Please provide confirm: "DELETE_ALL_KNOWLEDGE_BASE" to clear the knowledge base',
          },
        });
      }

      const result = await KnowledgeBase.deleteMany({});

      res.json({
        success: true,
        message: `Cleared ${result.deletedCount} documents from knowledge base`,
        deletedCount: result.deletedCount,
      });
    } catch (error) {
      console.error('Failed to clear knowledge base:', error);
      res.status(500).json({
        error: {
          code: 'CLEAR_FAILED',
          message: 'Failed to clear knowledge base',
        },
      });
    }
  });

  return router;
}
