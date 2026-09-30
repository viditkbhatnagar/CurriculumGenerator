/**
 * The AGU module engine API, mounted at /api/agu.
 *
 * A faculty member picks an AGU catalogue course, the engine drafts its four-week module
 * package from verified sources, and every change is re-checked against the catalogue, AGU's
 * course shape and the US/Utah rule pack. Status always comes from the stored findings: a
 * draft is accepted only when it has no blocking finding.
 */
import { Router, Request, Response } from 'express';
import { validateJWT, loadUser } from '../middleware/auth';
import { loggingService } from '../services/loggingService';
import { AGU_CATALOGUE_V1_4, catalogueCourse } from '../agu/catalogue/catalogueV1_4';
import { AguCourseDraft } from '../agu/model/AguCourseDraft';
import { generateOutline } from '../agu/generation/generateOutline';
import { isReviewReady, validateDraft } from '../agu/validation/validateDraft';
import { CourseDraft } from '../agu/draft/types';
import { coursePackageBuffer } from '../agu/export/coursePackageDocx';

const router = Router();

const userOf = (req: Request): string | undefined =>
  (req as any).user?.id || (req as any).user?.userId || (req as any).user?.sub;

/**
 * A generation runs in the web process, so a deploy or restart kills it mid-flight and its
 * draft would say "generating" forever. After this long with no update it is recorded as
 * failed, with the reason, so faculty can regenerate instead of waiting on nothing.
 */
const GENERATION_STALE_MS = 15 * 60 * 1000;

async function failIfInterrupted(doc: any): Promise<void> {
  const last = new Date(doc.updatedAt || doc.createdAt).getTime();
  if (doc.status !== 'generating' || Date.now() - last < GENERATION_STALE_MS) return;
  doc.status = 'failed';
  doc.stageRuns = [
    ...(doc.stageRuns || []),
    {
      stage: 'outline',
      status: 'failed',
      startedAt: new Date(last),
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
    const previous = await AguCourseDraft.findOne({ courseCode: course.code }, { version: 1 })
      .sort({ version: -1 })
      .lean();
    const inputs = req.body?.facultyInputs || {};
    const doc = await AguCourseDraft.create({
      courseCode: course.code,
      catalogueVersion: AGU_CATALOGUE_V1_4.edition.version,
      version: (previous?.version || 0) + 1,
      status: 'created',
      facultyInputs: {
        emphasis: String(inputs.emphasis || ''),
        learners: String(inputs.learners || ''),
        tools: String(inputs.tools || ''),
        context: String(inputs.context || ''),
        notes: String(inputs.notes || ''),
      },
      createdBy: userOf(req),
    });
    startGeneration(String(doc._id));
    res.status(202).json({ success: true, data: { draftId: doc._id, status: 'generating' } });
  } catch (error) {
    loggingService.error('AGU draft creation failed', {
      code: req.params.code,
      error: String(error),
    });
    res.status(500).json({ success: false, error: 'Could not create the draft' });
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
    res.status(400).json({ success: false, error: 'Invalid draft id' });
  }
});

/** POST /api/agu/drafts/:id/regenerate — generate the outline again. */
router.post(
  '/drafts/:id/regenerate',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    const doc = await AguCourseDraft.findById(req.params.id).catch(() => null);
    if (!doc) return res.status(404).json({ success: false, error: 'Draft not found' });
    if (doc.status === 'generating')
      return res.status(409).json({ success: false, error: 'Already generating' });
    if (doc.status === 'faculty_accepted') {
      return res.status(409).json({
        success: false,
        error: 'This draft has been accepted; create a new version instead',
      });
    }
    if (req.body?.facultyInputs)
      doc.facultyInputs = { ...doc.facultyInputs, ...req.body.facultyInputs };
    await doc.save();
    startGeneration(String(doc._id));
    res.status(202).json({ success: true, data: { draftId: doc._id, status: 'generating' } });
  }
);

/**
 * PATCH /api/agu/drafts/:id — save faculty edits and re-check them.
 * Locked catalogue fields are restored from the catalogue whatever the edit says.
 */
router.patch('/drafts/:id', validateJWT, loadUser, async (req: Request, res: Response) => {
  const doc = await AguCourseDraft.findById(req.params.id).catch(() => null);
  if (!doc) return res.status(404).json({ success: false, error: 'Draft not found' });
  if (doc.status === 'faculty_accepted') {
    return res.status(409).json({
      success: false,
      error: 'This draft has been accepted; create a new version to change it',
    });
  }
  const course = catalogueCourse(doc.courseCode);
  const edited = req.body?.draft as CourseDraft | undefined;
  if (!course || !edited || !Array.isArray(edited.outcomes) || !Array.isArray(edited.weeks)) {
    return res.status(400).json({ success: false, error: 'Send the whole draft to save' });
  }
  const draft: CourseDraft = {
    ...edited,
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
  doc.status = isReviewReady(findings) ? 'ready_for_review' : 'needs_faculty';
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
});

/** POST /api/agu/drafts/:id/accept — faculty accepts a draft with no blocking finding. */
router.post('/drafts/:id/accept', validateJWT, loadUser, async (req: Request, res: Response) => {
  const doc = await AguCourseDraft.findById(req.params.id).catch(() => null);
  if (!doc || !doc.draft) return res.status(404).json({ success: false, error: 'Draft not found' });
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
