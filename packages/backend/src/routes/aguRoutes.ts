/**
 * The AGU module engine API, mounted at /api/agu.
 *
 * A faculty member picks an AGU catalogue course, the engine drafts its four-week module
 * package from verified sources, and every change is re-checked against the catalogue, AGU's
 * course shape and the US/Utah rule pack. Status always comes from the stored findings: a
 * draft is accepted only when it has no blocking finding.
 *
 * Express 4 never answers a rejected async handler, and index.ts raises a critical alert for
 * the unhandled rejection, so every handler here ends in respondToFailure.
 */
import { Router, Request, Response } from 'express';
import { validateJWT, loadUser } from '../middleware/auth';
import { loggingService } from '../services/loggingService';
import { AGU_CATALOGUE_V1_4, catalogueCourse } from '../agu/catalogue/catalogueV1_4';
import { AguCourseDraft, IAguCourseDraft } from '../agu/model/AguCourseDraft';
import { generateOutline } from '../agu/generation/generateOutline';
import { facultyInputsFrom } from '../agu/generation/facultyInputs';
import {
  claimGenerationStart,
  DraftActivity,
  generationRefusal,
  isGenerationInFlight,
  isGenerationStale,
  lastActivityAt,
  releaseGenerationStart,
} from '../agu/generation/generationGuard';
import { checkDraftShape } from '../agu/validation/draftShape';
import { reviewStatus, validateDraft } from '../agu/validation/validateDraft';
import { CourseDraft } from '../agu/draft/types';
import { coursePackageBuffer } from '../agu/export/coursePackageDocx';

const router = Router();

const userOf = (req: Request): string | undefined =>
  (req as any).user?.id || (req as any).user?.userId || (req as any).user?.sub;

/** Mongoose rejects an id that cannot be an ObjectId with a CastError: the caller's mistake. */
const isCastError = (error: unknown): boolean =>
  (error as { name?: string } | null | undefined)?.name === 'CastError';

/**
 * Answer a handler that threw. A malformed id is a 400; anything else is ours, so it is logged
 * with its context and answered with a 500 that does not leak internals. Reporting every error
 * as a bad id hid real failures (a database outage looked like a typo in the address).
 */
function respondToFailure(
  res: Response,
  error: unknown,
  what: string,
  context: Record<string, unknown>,
  message: string
): void {
  if (res.headersSent) return;
  if (isCastError(error)) {
    res.status(400).json({ success: false, error: 'Invalid draft id' });
    return;
  }
  loggingService.error(what, { ...context, error: String(error) });
  res.status(500).json({ success: false, error: message });
}

const GENERATING_MESSAGE =
  'A generation is still running for this draft. Wait for it to finish: anything saved now would be overwritten by its result.';

/**
 * A draft left "generating" by a restart is recorded as failed, with the reason, so faculty can
 * regenerate instead of waiting on nothing. "Left" is judged by the heartbeat the generation
 * records after every stage (falling back to the last save), so a long run that is still
 * reporting in is not swept. Every handler that depends on the status calls this first, so a
 * dead generation cannot block an edit, an acceptance or a regeneration.
 */
async function failIfInterrupted(doc: IAguCourseDraft): Promise<void> {
  if (!isGenerationStale(doc)) return;
  doc.status = 'failed';
  doc.stageRuns = [
    ...(doc.stageRuns || []),
    {
      stage: 'outline',
      status: 'failed',
      startedAt: new Date(lastActivityAt(doc)),
      finishedAt: new Date(),
      error:
        'Generation was interrupted (the server restarted before it finished). Regenerate to try again.',
    },
  ];
  await doc.save();
}

/** Start an outline generation without holding the request open for the model call. */
function startGeneration(draftId: string): void {
  generateOutline(draftId).catch((error) =>
    loggingService.error('AGU outline generation crashed', { draftId, error: String(error) })
  );
}

/**
 * Run `start` only if the course may begin another generation: one at a time, and within the
 * daily cap (see generationGuard). Answers 409 or 429 itself when it may not. The start-up slot
 * is held from the check until `start` has written, so parallel requests cannot all pass the
 * check before any of them has created a draft. `exceptId` is the draft being regenerated.
 */
async function startIfAllowed(
  res: Response,
  courseCode: string,
  start: () => Promise<void>,
  exceptId?: string
): Promise<void> {
  if (!claimGenerationStart(courseCode)) {
    res.status(409).json({
      success: false,
      error: 'Another generation for this course is being started. Try again in a moment.',
    });
    return;
  }
  try {
    const drafts = await AguCourseDraft.find(
      { courseCode },
      {
        status: 1,
        createdAt: 1,
        updatedAt: 1,
        heartbeatAt: 1,
        'stageRuns.stage': 1,
        'stageRuns.startedAt': 1,
      }
    ).lean();
    const refusal = generationRefusal(drafts as DraftActivity[], Date.now(), exceptId);
    if (refusal) {
      res.status(refusal.status).json({ success: false, error: refusal.error });
      return;
    }
    await start();
  } finally {
    releaseGenerationStart(courseCode);
  }
}

/** GET /api/agu/catalogue — the locked catalogue record. */
router.get('/catalogue', (_req: Request, res: Response) => {
  res.json({ success: true, data: AGU_CATALOGUE_V1_4 });
});

/** GET /api/agu/courses/:code — one catalogue course and its drafts, newest first. */
router.get('/courses/:code', async (req: Request, res: Response) => {
  const course = catalogueCourse(req.params.code);
  if (!course)
    return res.status(404).json({ success: false, error: 'Not a course in the AGU catalogue' });
  try {
    const drafts = await AguCourseDraft.find(
      { courseCode: course.code },
      { courseCode: 1, version: 1, status: 1, createdAt: 1, updatedAt: 1, acceptedAt: 1 }
    )
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: { course, drafts } });
  } catch (error) {
    loggingService.error('AGU course lookup failed', {
      code: req.params.code,
      error: String(error),
    });
    res.status(500).json({ success: false, error: 'Could not load the course drafts' });
  }
});

/** POST /api/agu/courses/:code/drafts — create a draft and start generating its outline. */
router.post('/courses/:code/drafts', validateJWT, loadUser, async (req: Request, res: Response) => {
  const course = catalogueCourse(req.params.code);
  if (!course)
    return res.status(404).json({ success: false, error: 'Not a course in the AGU catalogue' });
  try {
    await startIfAllowed(res, course.code, async () => {
      const previous = await AguCourseDraft.findOne({ courseCode: course.code }, { version: 1 })
        .sort({ version: -1 })
        .lean();
      const doc = await AguCourseDraft.create({
        courseCode: course.code,
        catalogueVersion: AGU_CATALOGUE_V1_4.edition.version,
        version: (previous?.version || 0) + 1,
        status: 'created',
        facultyInputs: facultyInputsFrom(req.body?.facultyInputs),
        createdBy: userOf(req),
      });
      startGeneration(String(doc._id));
      res.status(202).json({ success: true, data: { draftId: doc._id, status: 'generating' } });
    });
  } catch (error) {
    respondToFailure(
      res,
      error,
      'AGU draft creation failed',
      { code: req.params.code },
      'Could not create the draft'
    );
  }
});

/** GET /api/agu/drafts/:id — the full draft with its findings and stage history. */
router.get('/drafts/:id', async (req: Request, res: Response) => {
  try {
    const doc = await AguCourseDraft.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, error: 'Draft not found' });
    await failIfInterrupted(doc);
    res.json({ success: true, data: doc.toObject() });
  } catch (error) {
    respondToFailure(
      res,
      error,
      'AGU draft lookup failed',
      { id: req.params.id },
      'Could not load the draft'
    );
  }
});

/** POST /api/agu/drafts/:id/regenerate — generate the outline again. */
router.post(
  '/drafts/:id/regenerate',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const doc = await AguCourseDraft.findById(req.params.id);
      if (!doc) return res.status(404).json({ success: false, error: 'Draft not found' });
      await failIfInterrupted(doc);
      if (isGenerationInFlight(doc))
        return res.status(409).json({ success: false, error: 'Already generating' });
      if (doc.status === 'faculty_accepted') {
        return res.status(409).json({
          success: false,
          error: 'This draft has been accepted; create a new version instead',
        });
      }
      await startIfAllowed(
        res,
        doc.courseCode,
        async () => {
          doc.facultyInputs = facultyInputsFrom(req.body?.facultyInputs, doc.facultyInputs);
          // Marked generating here, not only when the job begins, so the response below is true
          // and a second request sees the run (the UI polls only while a run is in progress).
          doc.status = 'generating';
          doc.heartbeatAt = new Date();
          await doc.save();
          startGeneration(String(doc._id));
          res.status(202).json({ success: true, data: { draftId: doc._id, status: 'generating' } });
        },
        String(doc._id)
      );
    } catch (error) {
      respondToFailure(
        res,
        error,
        'AGU regeneration failed',
        { id: req.params.id },
        'Could not start the regeneration'
      );
    }
  }
);

/**
 * PATCH /api/agu/drafts/:id — save faculty edits and re-check them.
 * Locked catalogue fields are restored from the catalogue whatever the edit says, and the
 * status is derived from the findings: nothing the client sends can set it.
 */
router.patch('/drafts/:id', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const doc = await AguCourseDraft.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, error: 'Draft not found' });
    await failIfInterrupted(doc);
    // A running generation saves its own result when it ends, which would overwrite this edit.
    // One that has been created and is about to start counts: it would do the same.
    if (isGenerationInFlight(doc)) {
      return res.status(409).json({ success: false, error: GENERATING_MESSAGE });
    }
    if (doc.status === 'faculty_accepted') {
      return res.status(409).json({
        success: false,
        error: 'This draft has been accepted; create a new version to change it',
      });
    }
    const course = catalogueCourse(doc.courseCode);
    if (!course)
      return res.status(404).json({ success: false, error: 'Not a course in the AGU catalogue' });
    const problems = checkDraftShape(req.body);
    if (problems.length) {
      const more = problems.length > 1 ? ` (and ${problems.length - 1} more)` : '';
      return res.status(400).json({
        success: false,
        error: `The draft cannot be saved: ${problems[0]}${more}`,
        problems,
      });
    }
    const draft: CourseDraft = {
      ...(req.body.draft as CourseDraft),
      courseCode: course.code,
      catalogueVersion: AGU_CATALOGUE_V1_4.edition.version,
      locked: {
        title: course.title,
        semesterCredits: course.semesterCredits,
        hours: { ...course.hours },
        description: course.description,
      },
    };
    const findings = validateDraft(draft, AGU_CATALOGUE_V1_4);
    doc.draft = draft;
    doc.findings = findings;
    doc.status = reviewStatus(findings);
    doc.stageRuns = [
      ...(doc.stageRuns || []),
      {
        stage: 'faculty_edit',
        status: 'succeeded',
        startedAt: new Date(),
        finishedAt: new Date(),
        blockingFindings: findings.filter((f) => f.severity === 'blocking').length,
      },
    ];
    doc.markModified('draft');
    doc.markModified('findings');
    await doc.save();
    res.json({ success: true, data: doc });
  } catch (error) {
    respondToFailure(
      res,
      error,
      'AGU draft save failed',
      { id: req.params.id },
      'Could not save the draft'
    );
  }
});

/** POST /api/agu/drafts/:id/accept — faculty accepts a draft with no blocking finding. */
router.post('/drafts/:id/accept', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const doc = await AguCourseDraft.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, error: 'Draft not found' });
    await failIfInterrupted(doc);
    // Accepting while a generation runs would record acceptance of content about to be replaced.
    if (isGenerationInFlight(doc)) {
      return res.status(409).json({ success: false, error: GENERATING_MESSAGE });
    }
    if (!doc.draft) return res.status(404).json({ success: false, error: 'Draft not found' });
    // Re-checked now, not trusted from the stored status.
    const findings = validateDraft(doc.draft, AGU_CATALOGUE_V1_4);
    const blocking = findings.filter((f) => f.severity === 'blocking');
    if (blocking.length) {
      return res.status(400).json({
        success: false,
        error: 'Resolve the blocking findings before accepting',
        data: { blocking },
      });
    }
    doc.findings = findings;
    doc.status = 'faculty_accepted';
    doc.acceptedBy = userOf(req);
    doc.acceptedAt = new Date();
    doc.markModified('findings');
    await doc.save();
    res.json({ success: true, data: doc });
  } catch (error) {
    respondToFailure(
      res,
      error,
      'AGU draft acceptance failed',
      { id: req.params.id },
      'Could not accept the draft'
    );
  }
});

/** GET /api/agu/drafts/:id/export — the draft rendered into AGU's templates as Word. */
router.get('/drafts/:id/export', async (req: Request, res: Response) => {
  try {
    const doc = await AguCourseDraft.findById(req.params.id).lean();
    const course = doc && catalogueCourse(doc.courseCode);
    if (!doc || !doc.draft || !course) {
      return res.status(404).json({ success: false, error: 'No drafted content to export yet' });
    }
    const buffer = await coursePackageBuffer({
      draft: doc.draft,
      course,
      catalogue: AGU_CATALOGUE_V1_4,
      findings: doc.findings || [],
      status: doc.status,
      version: doc.version,
      tools: doc.facultyInputs?.tools,
      sourcesOffered: (doc.sourcesOffered || []).length,
      stageRuns: doc.stageRuns || [],
    });
    const name = `${course.code}-Course-Package-v${doc.version}.docx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.send(buffer);
  } catch (error) {
    loggingService.error('AGU course package export failed', {
      id: req.params.id,
      error: String(error),
    });
    res.status(500).json({ success: false, error: 'Could not build the course package' });
  }
});

export default router;
