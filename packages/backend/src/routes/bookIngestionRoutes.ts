/**
 * Step 5.5 — Book Ingestion routes.
 *
 * Mounted at /api/v3/workflow (alongside workflowRoutes). Lets an SME opt a
 * sourced textbook in for decomposition, upload the book file, and poll status.
 * See docs/book-ingestion/.
 */

import express, { Request, Response } from 'express';
import multer from 'multer';
import { validateJWT, loadUser } from '../middleware/auth';
import { loggingService } from '../services/loggingService';
import { CurriculumWorkflow } from '../models/CurriculumWorkflow';
import { BookIntelligence } from '../models/BookIntelligence';
import { enqueueBookIngestion } from '../queues/bookIngestionQueue';
import * as sourceFileStore from '../services/sourceFileStore';

const router = express.Router();

// Books can be large (full textbooks) — allow up to 50 MB.
const bookUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
});

/** Flatten Step 5 sources, keeping only ingestable textbooks. */
function ingestableSources(workflow: any): Array<{
  id: string;
  title: string;
  authors: string;
  publisher?: string;
  year?: number;
  mloIds: string[];
}> {
  const topics: any[] = workflow.step5?.topicSources || [];
  const seen = new Set<string>();
  const out: any[] = [];
  for (const t of topics) {
    for (const s of t.sources || []) {
      // Only full texts we could decompose — not single articles / abstracts.
      if (s.sourceType !== 'academic_text') continue;
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      out.push({
        id: s.id,
        title: s.title,
        authors: s.authors,
        publisher: s.publisher,
        year: s.year,
        mloIds: s.mloIds || [],
      });
    }
  }
  return out;
}

/** GET /:id/book-ingestion/candidates — sourced textbooks eligible for ingestion. */
router.get(
  '/:id/book-ingestion/candidates',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const workflow = await CurriculumWorkflow.findById(req.params.id);
      if (!workflow || !workflow.step5) {
        return res.status(404).json({ success: false, error: 'Workflow or Step 5 not found' });
      }
      const candidates = ingestableSources(workflow);
      const existing = await BookIntelligence.find({ workflowId: workflow._id }).select(
        'step5SourceId status'
      );
      const byId = new Map(existing.map((b) => [b.step5SourceId, b.status]));
      res.json({
        success: true,
        data: candidates.map((c) => ({ ...c, ingestionStatus: byId.get(c.id) || null })),
      });
    } catch (error) {
      loggingService.error('Failed to list book-ingestion candidates', {
        error: error instanceof Error ? error.message : String(error),
        workflowId: req.params.id,
      });
      res.status(500).json({ success: false, error: 'Failed to list candidates' });
    }
  }
);

/** POST /:id/book-ingestion/ingest — opt a source in + upload its file; enqueue. */
router.post('/:id/book-ingestion/ingest', validateJWT, loadUser, (req: Request, res: Response) => {
  bookUpload.single('file')(req, res, async (err: unknown) => {
    if (err) {
      return res
        .status(400)
        .json({ success: false, error: err instanceof Error ? err.message : 'Upload failed' });
    }
    try {
      const { id } = req.params;
      const sourceId = String(req.body?.sourceId || '');
      const depth = ['essential', 'standard', 'comprehensive', 'forensic'].includes(req.body?.depth)
        ? req.body.depth
        : 'standard';
      const fileBuf = (req as Request & { file?: Express.Multer.File }).file?.buffer;
      if (!sourceId) return res.status(400).json({ success: false, error: 'sourceId is required' });
      if (!fileBuf) return res.status(400).json({ success: false, error: 'No book file uploaded' });

      const workflow = await CurriculumWorkflow.findById(id);
      if (!workflow || !workflow.step5) {
        return res.status(404).json({ success: false, error: 'Workflow or Step 5 not found' });
      }
      const source = ingestableSources(workflow).find((s) => s.id === sourceId);
      if (!source) {
        return res
          .status(400)
          .json({ success: false, error: 'Source is not an ingestable Step 5 textbook' });
      }

      const filename =
        (req as Request & { file?: Express.Multer.File }).file?.originalname || 'book';
      const stored = await sourceFileStore.uploadBuffer(
        fileBuf,
        `book-${id}-${sourceId}-${filename}`,
        'application/octet-stream'
      );

      // Upsert one decomposition per (workflow, source) — re-ingest replaces it.
      const book = await BookIntelligence.findOneAndUpdate(
        { workflowId: workflow._id, step5SourceId: sourceId },
        {
          workflowId: workflow._id,
          step5SourceId: sourceId,
          bookTitle: source.title,
          authors: source.authors,
          publisher: source.publisher,
          year: source.year,
          depth,
          mappedMloIds: source.mloIds,
          bookFileId: stored.fileId,
          status: 'queued',
          lastError: null,
          nodes: [],
          edges: [],
          reviewQueue: [],
          ingestDraft: undefined,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      await enqueueBookIngestion(String(book._id));
      loggingService.info('Book ingestion queued', { workflowId: id, sourceId, bookId: book._id });
      res.status(202).json({
        success: true,
        data: { bookId: String(book._id), status: 'queued' },
        message: 'Book queued for ingestion',
      });
    } catch (error) {
      loggingService.error('Failed to start book ingestion', {
        error: error instanceof Error ? error.message : String(error),
        workflowId: req.params.id,
      });
      res.status(500).json({ success: false, error: 'Failed to start ingestion' });
    }
  });
});

/** GET /:id/book-ingestion/status — decomposition state for this workflow's books. */
router.get(
  '/:id/book-ingestion/status',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const books = await BookIntelligence.find({ workflowId: req.params.id }).select(
        'step5SourceId bookTitle status depth mappedMloIds qualityReport lastError updatedAt nodes'
      );
      res.json({
        success: true,
        data: books.map((b) => ({
          bookId: String(b._id),
          sourceId: b.step5SourceId,
          bookTitle: b.bookTitle,
          status: b.status,
          depth: b.depth,
          nodeCount: b.nodes?.length || 0,
          qualityReport: b.qualityReport || null,
          lastError: b.lastError || null,
          updatedAt: b.updatedAt,
        })),
      });
    } catch (error) {
      loggingService.error('Failed to get book-ingestion status', {
        error: error instanceof Error ? error.message : String(error),
        workflowId: req.params.id,
      });
      res.status(500).json({ success: false, error: 'Failed to get status' });
    }
  }
);

export default router;
