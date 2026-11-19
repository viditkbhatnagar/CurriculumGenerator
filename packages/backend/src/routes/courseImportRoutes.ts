/**
 * Start from an existing course document.
 *
 * Athira Hari at India Learns asked on 19 November 2026 to develop courses already drafted in
 * ChatGPT here. Mounted at /api/v3/workflow. `parse` reads a document and returns what was
 * found for the author to review; nothing is saved. `apply` saves the confirmed modules as the
 * Step 4 blueprint. The Step 1 values are applied by the form itself, which the author submits.
 */
import express, { Request, Response } from 'express';
import multer from 'multer';
import { validateJWT, loadUser } from '../middleware/auth';
import { loggingService } from '../services/loggingService';
import { CurriculumWorkflow } from '../models/CurriculumWorkflow';
import { COURSE_DOCUMENT_MAX_BYTES, importCourseDocument } from '../services/courseDocumentImport';
import { applyProgrammeHours } from '../services/moduleBlueprintService';
import { toBlueprint } from '../services/courseDocumentMapping';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: COURSE_DOCUMENT_MAX_BYTES, files: 1 },
});

const fail = (res: Response, status: number, error: string) =>
  res.status(status).json({ success: false, error });

/** POST /:id/import-course/parse — a file (field "file") or JSON { text }. Saves nothing. */
router.post('/:id/import-course/parse', validateJWT, loadUser, (req: Request, res: Response) => {
  upload.single('file')(req, res, async (err: unknown) => {
    if (err) {
      const tooBig = (err as { code?: string }).code === 'LIMIT_FILE_SIZE';
      return fail(res, 400, tooBig ? 'That file is over 10 MB.' : 'Upload failed');
    }
    try {
      const file = (req as Request & { file?: Express.Multer.File }).file;
      const text = typeof req.body?.text === 'string' ? req.body.text : '';
      if (!file && !text.trim()) return fail(res, 400, 'Upload a document or paste its text.');

      const workflow = await CurriculumWorkflow.findById(req.params.id).select('_id');
      if (!workflow) return fail(res, 404, 'Workflow not found');

      const result = await importCourseDocument({
        buffer: file?.buffer,
        filename: file?.originalname,
        text,
        workflowId: req.params.id,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      loggingService.error('Error reading course document', { error });
      fail(res, 422, error instanceof Error ? error.message : 'Could not read that document');
    }
  });
});

/** POST /:id/import-course/apply — save the reviewed modules as the Step 4 blueprint. */
router.post(
  '/:id/import-course/apply',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const { modules, filename, credits, totalHours } = req.body as {
        modules?: Array<Record<string, unknown>>;
        filename?: string;
        credits?: number;
        totalHours?: number;
      };
      if (!Array.isArray(modules) || modules.length === 0) {
        return fail(res, 400, 'Provide at least one module');
      }
      const workflow = await CurriculumWorkflow.findById(req.params.id);
      if (!workflow) return fail(res, 404, 'Workflow not found');

      const asNumber = (v: unknown): number | null =>
        v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) || Number(v) <= 0
          ? null
          : Number(v);
      const list = (v: unknown): string[] =>
        Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];

      const cleaned = toBlueprint(
        modules.map((m, i) => ({
          sequenceOrder: i + 1,
          code: String(m.code || ''),
          title: String(m.title || ''),
          credits: asNumber(m.credits),
          contactHours: asNumber(m.contactHours),
          independentHours: asNumber(m.independentHours),
          totalHours: asNumber(m.totalHours),
          topics: list(m.sourceTopics ?? m.topics),
          outcomes: list(m.sourceOutcomes ?? m.outcomes),
          group: String(m.group || ''),
          isElective: !!m.isElective,
        }))
      );
      const untitled = modules.length - cleaned.length;
      if (untitled) return fail(res, 400, `${untitled} module(s) have no title`);

      // Hours come from the document where it gave them; where it gave only credits, from the
      // programme figures the author has confirmed (hours per credit), never from a guess.
      const withHours = applyProgrammeHours(cleaned, {
        credits: asNumber(credits) ?? undefined,
        totalHours: asNumber(totalHours) ?? undefined,
      });

      (workflow as any).step4 = {
        ...((workflow as any).step4 || {}),
        moduleBlueprint: withHours,
        blueprintSource: {
          filename: filename || 'imported course document',
          uploadedAt: new Date(),
          totalCredits: withHours.reduce((sum, m) => sum + (m.credits || 0), 0),
          origin: 'course-document',
        },
      };
      workflow.markModified('step4');
      await workflow.save();

      loggingService.info('Course document blueprint saved', {
        workflowId: req.params.id,
        modules: withHours.length,
      });
      res.json({
        success: true,
        data: { moduleBlueprint: withHours },
        message: `Structure saved — Step 4 will generate ${withHours.length} modules from it.`,
      });
    } catch (error) {
      loggingService.error('Error saving course document blueprint', { error });
      fail(res, 500, 'Failed to save the structure');
    }
  }
);

export default router;
