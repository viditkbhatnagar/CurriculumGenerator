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
  ArtefactActivity,
  artefactRunRefusal,
  claimGenerationStart,
  DraftActivity,
  isArtefactRunInFlight,
  isArtefactRunStale,
  generationRefusal,
  isGenerationInFlight,
  isGenerationStale,
  lastActivityAt,
  releaseGenerationStart,
} from '../agu/generation/generationGuard';
import { checkDraftShape } from '../agu/validation/draftShape';
import { reviewStatus, validateDraft } from '../agu/validation/validateDraft';
import { validateArtefacts } from '../agu/validation/validateArtefacts';
import { currentOutline } from '../agu/validation/currentFindings';
import { CourseDraft, Finding } from '../agu/draft/types';
import { coursePackageBuffer } from '../agu/export/coursePackageDocx';
import { generateArtefacts } from '../agu/generation/generateArtefacts';
import { pathwayStatuses, sharedTopics } from '../agu/pathways/mbaPathways';
import { repeatedTopics } from '../services/step4Validation';
import { pathwayDocxBuffer } from '../agu/pathways/pathwayDocx';
import { CurriculumWorkflow } from '../models/CurriculumWorkflow';

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

const ARTEFACTS_RUNNING_MESSAGE =
  'Assessments and the tutor pack are being drafted from this outline. Wait for that to finish before changing the outline.';

/**
 * Findings made while drafting (dropped items, parts that could not be drafted) are kept from
 * the stored run. Everything else is recomputed on read.
 */
const ARTEFACT_PARSE_CODES = new Set([
  'RUBRIC_OUTCOME_UNKNOWN',
  'QUIZ_ITEM_UNTRACEABLE',
  'EXAM_QUESTION_UNTRACEABLE',
  'ARTEFACT_PART_FAILED',
]);

/**
 * The artefacts' findings against the outline as it stands now, so artefacts drafted before an
 * outline edit or regeneration are reported stale rather than shown with their old verdict.
 */
function currentArtefactFindings(
  doc: Pick<IAguCourseDraft, 'artefacts' | 'draft' | 'artefactFindings'>
): Finding[] {
  if (!doc.artefacts || !doc.draft) return doc.artefactFindings || [];
  return [
    ...(doc.artefactFindings || []).filter((f) => ARTEFACT_PARSE_CODES.has(f.code)),
    ...validateArtefacts(doc.artefacts, doc.draft),
  ];
}

/** What the artefact status says now: a review verdict follows the current findings. */
function currentArtefactStatus(doc: IAguCourseDraft, findings: Finding[]): string {
  const stored = doc.artefactStatus || 'not_started';
  return stored === 'ready_for_review' || stored === 'needs_faculty'
    ? reviewStatus(findings)
    : stored;
}

/** An artefact run left "generating" by a restart is recorded as failed, as outlines are. */
async function failArtefactsIfInterrupted(doc: IAguCourseDraft): Promise<void> {
  if (!isArtefactRunStale(doc as unknown as ArtefactActivity)) return;
  doc.artefactStatus = 'failed';
  doc.stageRuns = [
    ...(doc.stageRuns || []),
    {
      stage: 'artefacts',
      status: 'failed',
      startedAt: new Date(doc.artefactHeartbeatAt || doc.updatedAt),
      finishedAt: new Date(),
      error:
        'Drafting the assessments was interrupted (the server restarted before it finished). Draft them again.',
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

/** Programmes as the pathways need them: title, position, status and publication. */
async function programmeSummaries() {
  return CurriculumWorkflow.find({})
    .select('projectName step1.programTitle currentStep status publication')
    .lean();
}

/**
 * GET /api/agu/pathways
 * The three MBA pathways and the state of each of their 16 courses (agu/pathways).
 */
router.get('/pathways', async (_req: Request, res: Response) => {
  try {
    const statuses = pathwayStatuses(
      AGU_CATALOGUE_V1_4.courses,
      (await programmeSummaries()) as any
    );
    res.json({ success: true, data: statuses });
  } catch (error) {
    loggingService.error('Error listing pathways', { error });
    res.status(500).json({ success: false, error: 'Failed to list the pathways' });
  }
});

/**
 * GET /api/agu/pathways/:pathwayId/export
 * One pathway as a Word document; a draft while any course is unpublished.
 */
router.get('/pathways/:pathwayId/export', async (req: Request, res: Response) => {
  try {
    const statuses = pathwayStatuses(
      AGU_CATALOGUE_V1_4.courses,
      (await programmeSummaries()) as any
    );
    const pathway = statuses.find((s) => s.id === req.params.pathwayId);
    if (!pathway) return res.status(404).json({ success: false, error: 'No such pathway' });
    // Every course with a programme, for the shared-topics check; published ones are also
    // printed in full.
    const ids = pathway.courses.filter((c) => c.programmeId).map((c) => c.programmeId as string);
    const full = await CurriculumWorkflow.find({ _id: { $in: ids } })
      .select('step1.programDescription step3.outcomes step4.modules')
      .lean();
    const byCode = new Map<string, any>();
    for (const course of pathway.courses) {
      const found = full.find((f: any) => String(f._id) === course.programmeId);
      if (found) byCode.set(course.code, found);
    }
    const overlaps = sharedTopics(
      [...byCode.entries()].map(([code, prog]) => ({ code, modules: prog?.step4?.modules || [] })),
      repeatedTopics
    );
    const published = new Map(
      [...byCode.entries()].filter(([code]) =>
        pathway.courses.some((c) => c.code === code && c.state === 'published')
      )
    );
    const mba = AGU_CATALOGUE_V1_4.credentials.find((c) => c.id === 'mba');
    const buffer = await pathwayDocxBuffer(pathway, published, mba?.composition || '', overlaps);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="AGU-MBA-${pathway.id}${pathway.ready ? '' : '-DRAFT'}.docx"`
    );
    res.send(buffer);
  } catch (error) {
    loggingService.error('Error exporting pathway', { error });
    res.status(500).json({ success: false, error: 'Failed to export the pathway' });
  }
});

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
    await failArtefactsIfInterrupted(doc);
    const artefactFindings = currentArtefactFindings(doc);
    // Outline findings re-checked against today's validator, as artefact findings are.
    const outline = currentOutline(doc, AGU_CATALOGUE_V1_4);
    res.json({
      success: true,
      data: {
        ...doc.toObject(),
        findings: outline.findings,
        status: outline.status,
        ...(outline.recheck ? { findingsRecheck: outline.recheck } : {}),
        artefactFindings,
        artefactStatus: currentArtefactStatus(doc, artefactFindings),
      },
    });
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
      await failArtefactsIfInterrupted(doc);
      if (isGenerationInFlight(doc))
        return res.status(409).json({ success: false, error: 'Already generating' });
      if (isArtefactRunInFlight(doc as unknown as ArtefactActivity))
        return res.status(409).json({ success: false, error: ARTEFACTS_RUNNING_MESSAGE });
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
    await failArtefactsIfInterrupted(doc);
    if (isArtefactRunInFlight(doc as unknown as ArtefactActivity)) {
      return res.status(409).json({ success: false, error: ARTEFACTS_RUNNING_MESSAGE });
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

/**
 * POST /api/agu/drafts/:id/artefacts — draft T07-T11 (rubric, quiz and practice bank, final
 * exam, discussion prompts, AI tutor pack) from the outline. The outline must have no blocking
 * finding: artefacts written against a broken outline would inherit its gaps.
 */
router.post('/drafts/:id/artefacts', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const doc = await AguCourseDraft.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, error: 'Draft not found' });
    await failIfInterrupted(doc);
    await failArtefactsIfInterrupted(doc);
    if (isGenerationInFlight(doc)) {
      return res.status(409).json({ success: false, error: GENERATING_MESSAGE });
    }
    if (!doc.draft) {
      return res.status(400).json({ success: false, error: 'Draft the course outline first' });
    }
    const outlineBlocking = validateDraft(doc.draft, AGU_CATALOGUE_V1_4).filter(
      (f) => f.severity === 'blocking'
    );
    if (outlineBlocking.length) {
      return res.status(400).json({
        success: false,
        error: "Resolve the outline's blocking findings before drafting the assessments",
        data: { blocking: outlineBlocking },
      });
    }
    if (doc.artefactStatus === 'faculty_accepted') {
      return res.status(409).json({
        success: false,
        error: 'These artefacts have been accepted; create a new version to redraft them',
      });
    }
    const slot = `${doc.courseCode}:artefacts`;
    if (!claimGenerationStart(slot)) {
      return res.status(409).json({
        success: false,
        error: 'Assessments for this course are being started. Try again in a moment.',
      });
    }
    try {
      const drafts = await AguCourseDraft.find(
        { courseCode: doc.courseCode },
        {
          artefactStatus: 1,
          artefactHeartbeatAt: 1,
          createdAt: 1,
          updatedAt: 1,
          'stageRuns.stage': 1,
          'stageRuns.startedAt': 1,
        }
      ).lean();
      const refusal = artefactRunRefusal(drafts as ArtefactActivity[], Date.now());
      if (refusal) return res.status(refusal.status).json({ success: false, error: refusal.error });
      await AguCourseDraft.updateOne(
        { _id: doc._id },
        { $set: { artefactStatus: 'generating', artefactHeartbeatAt: new Date() } }
      );
      generateArtefacts(String(doc._id)).catch((error) =>
        loggingService.error('AGU artefact generation crashed', {
          draftId: String(doc._id),
          error: String(error),
        })
      );
      res
        .status(202)
        .json({ success: true, data: { draftId: doc._id, artefactStatus: 'generating' } });
    } finally {
      releaseGenerationStart(slot);
    }
  } catch (error) {
    respondToFailure(
      res,
      error,
      'AGU artefact start failed',
      { id: req.params.id },
      'Could not start drafting the assessments'
    );
  }
});

/**
 * POST /api/agu/drafts/:id/artefacts/accept — faculty accepts the artefacts. The outline must be
 * accepted first, since the artefacts are checked against it; an accepted outline cannot be
 * edited, so accepted artefacts cannot go stale.
 */
router.post(
  '/drafts/:id/artefacts/accept',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const doc = await AguCourseDraft.findById(req.params.id);
      if (!doc) return res.status(404).json({ success: false, error: 'Draft not found' });
      await failArtefactsIfInterrupted(doc);
      if (isArtefactRunInFlight(doc as unknown as ArtefactActivity)) {
        return res.status(409).json({ success: false, error: ARTEFACTS_RUNNING_MESSAGE });
      }
      if (!doc.artefacts) {
        return res.status(404).json({ success: false, error: 'No artefacts have been drafted' });
      }
      if (doc.status !== 'faculty_accepted') {
        return res.status(400).json({
          success: false,
          error: 'Accept the outline first: the assessments are checked against it',
        });
      }
      const findings = currentArtefactFindings(doc);
      const blocking = findings.filter((f) => f.severity === 'blocking');
      if (blocking.length) {
        return res.status(400).json({
          success: false,
          error: 'Resolve the blocking findings in the assessments before accepting them',
          data: { blocking },
        });
      }
      doc.artefactFindings = findings;
      doc.artefactStatus = 'faculty_accepted';
      doc.artefactsAcceptedBy = userOf(req);
      doc.artefactsAcceptedAt = new Date();
      doc.markModified('artefactFindings');
      await doc.save();
      res.json({ success: true, data: doc });
    } catch (error) {
      respondToFailure(
        res,
        error,
        'AGU artefact acceptance failed',
        { id: req.params.id },
        'Could not accept the assessments'
      );
    }
  }
);

/** GET /api/agu/drafts/:id/export — the draft rendered into AGU's templates as Word. */
router.get('/drafts/:id/export', async (req: Request, res: Response) => {
  try {
    const doc = await AguCourseDraft.findById(req.params.id).lean();
    const course = doc && catalogueCourse(doc.courseCode);
    if (!doc || !doc.draft || !course) {
      return res.status(404).json({ success: false, error: 'No drafted content to export yet' });
    }
    const artefactFindings = currentArtefactFindings(doc);
    const outline = currentOutline(doc, AGU_CATALOGUE_V1_4);
    const buffer = await coursePackageBuffer({
      draft: doc.draft,
      course,
      catalogue: AGU_CATALOGUE_V1_4,
      findings: outline.findings,
      status: outline.status,
      version: doc.version,
      tools: doc.facultyInputs?.tools,
      sourcesOffered: (doc.sourcesOffered || []).length,
      stageRuns: doc.stageRuns || [],
      artefacts: doc.artefacts,
      artefactFindings,
      artefactStatus: currentArtefactStatus(doc as unknown as IAguCourseDraft, artefactFindings),
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
