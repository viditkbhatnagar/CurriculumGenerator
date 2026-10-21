/**
 * Step feedback (/api/v3/feedback): reviewers log, per programme and step, what changed and
 * whether the output is satisfactory (models/StepFeedback). Listed for everyone reviewing the
 * generator, and exported as CSV.
 */
import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { validateJWT, loadUser } from '../middleware/auth';
import { loggingService } from '../services/loggingService';
import { CurriculumWorkflow } from '../models/CurriculumWorkflow';
import { StepFeedback } from '../models/StepFeedback';
import { csvField, parseFeedback } from '../services/stepFeedbackInput';

const router = Router();
const MAX_LISTED = 1000;

const fail = (res: Response, error: unknown, what: string) => {
  loggingService.error(`Step feedback: ${what} failed`, { error: String(error) });
  res.status(500).json({ success: false, error: `Could not ${what}` });
};

/** Entries newest first, each with its programme's name, optionally for one programme/step. */
async function listEntries(query: any): Promise<any[]> {
  const filter: any = {};
  if (query.workflowId && mongoose.isValidObjectId(query.workflowId)) {
    filter.workflowId = query.workflowId;
  }
  const step = Number(query.step);
  if (Number.isInteger(step) && step > 0) filter.stepNumber = step;
  const rows: any[] = await StepFeedback.find(filter)
    .sort({ createdAt: -1 })
    .limit(MAX_LISTED)
    .lean();
  const ids = Array.from(new Set(rows.map((r) => String(r.workflowId))));
  const programmes: any[] = await CurriculumWorkflow.find({ _id: { $in: ids } })
    .select('projectName')
    .lean();
  const names = new Map(programmes.map((p) => [String(p._id), p.projectName || 'Untitled']));
  return rows.map((r) => ({
    id: String(r._id),
    workflowId: String(r.workflowId),
    programme: names.get(String(r.workflowId)) || 'Deleted programme',
    stepNumber: r.stepNumber,
    reviewerName: r.reviewerName,
    satisfactory: r.satisfactory,
    whatChanged: r.whatChanged,
    comments: r.comments,
    createdAt: r.createdAt,
  }));
}

router.post('/', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const workflowId = String(req.body?.workflowId || '');
    if (
      !mongoose.isValidObjectId(workflowId) ||
      !(await CurriculumWorkflow.exists({ _id: workflowId }))
    ) {
      return res.status(404).json({ success: false, error: 'Programme not found' });
    }
    const { value, error } = parseFeedback(req.body);
    if (!value) return res.status(400).json({ success: false, error });
    const entry = await StepFeedback.create({ workflowId, ...value });
    res.status(201).json({ success: true, data: { id: String(entry._id) } });
  } catch (error) {
    fail(res, error, 'save the feedback');
  }
});

router.get('/', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await listEntries(req.query) });
  } catch (error) {
    fail(res, error, 'list the feedback');
  }
});

router.get('/export.csv', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const rows = await listEntries(req.query);
    const head = [
      'Date',
      'Programme',
      'Step',
      'Reviewer',
      'Satisfactory',
      'What changed',
      'Comments',
    ];
    const lines = rows.map((r) =>
      [
        new Date(r.createdAt).toISOString().slice(0, 16).replace('T', ' '),
        r.programme,
        r.stepNumber,
        r.reviewerName,
        r.satisfactory,
        r.whatChanged,
        r.comments,
      ]
        .map(csvField)
        .join(',')
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="step-feedback.csv"');
    res.send([head.map(csvField).join(','), ...lines].join('\n'));
  } catch (error) {
    fail(res, error, 'export the feedback');
  }
});

export default router;
