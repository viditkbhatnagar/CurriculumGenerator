import express, { Request, Response } from 'express';
import { pptGenerationService } from '../services/pptGenerationService';
import { CurriculumWorkflow } from '../models/CurriculumWorkflow';
import { withLessons } from '../services/step10Store';
import { loggingService } from '../services/loggingService';
import { validateJWT, loadUser } from '../middleware/auth';
import JSZip from 'jszip';
import { moduleCodeOf, moduleFileSlugOf } from '../utils/moduleIdentity';
import { hydrateModuleDecks } from '../services/pptDeckStore';
import { StoredDeck, storedDeckFor } from '../services/pptLessonContent';

/** The AI-written decks Step 11 holds for a module, with their slides restored from S3. */
async function storedDecksFor(workflow: any, modulePlan: any): Promise<StoredDeck[]> {
  const entry = (workflow.step11?.modulePPTDecks || []).find(
    (m: any) =>
      (m?.moduleId && m.moduleId === modulePlan.moduleId) ||
      (m?.moduleCode && m.moduleCode === modulePlan.moduleCode)
  );
  if (!entry) return [];
  return (await hydrateModuleDecks(entry)).pptDecks || [];
}

/**
 * Add a module's lessons to a zip: each lesson's AI-written Step 11 deck where one exists, and
 * otherwise an outline built from the lesson plan, named _OUTLINE so it cannot pass for teaching
 * slides. Downloads used to build every deck from the outline template, so the teaching slides
 * Step 11 wrote were never served (Dr Sherin, 12 October 2026). Returns the outline count.
 */
async function addModuleDecks(
  zip: JSZip,
  workflow: any,
  modulePlan: any,
  context: any,
  folder = ''
): Promise<number> {
  const decks = await storedDecksFor(workflow, modulePlan);
  let outlines = 0;
  for (const lesson of modulePlan.lessons || []) {
    try {
      const stored = storedDeckFor(lesson, decks);
      const deck: any = stored || pptGenerationService.generateLessonPPTFallback(lesson, context);
      if (!stored) outlines++;
      const pptxBuffer = await pptGenerationService.exportPPTX(deck);
      const name = `${folder}Lesson${lesson.lessonNumber}_${String(lesson.lessonTitle || '')
        .replace(/[^a-zA-Z0-9]/g, '_')
        .substring(0, 50)}${stored ? '' : '_OUTLINE'}.pptx`;
      zip.file(name, pptxBuffer);
    } catch (error: any) {
      loggingService.error('Failed to build PPT for lesson', {
        error: error.message,
        moduleCode: modulePlan.moduleCode,
        lessonNumber: lesson.lessonNumber,
      });
    }
  }
  return outlines;
}

const OUTLINE_NOTE =
  'Files ending _OUTLINE are outlines built from the lesson plan: Step 11 has not yet written ' +
  'teaching slides for those lessons. Generate Step 11 for their module, then download again.\n';

/** Load a workflow with Step 10 lesson bodies attached, or null when there is no such workflow. */
async function loadWorkflowWithLessons(workflowId: string): Promise<any | null> {
  const workflow = await CurriculumWorkflow.findById(workflowId);
  return workflow ? withLessons(workflow) : null;
}

const router = express.Router();

// Apply auth middleware to all routes
router.use(validateJWT);
router.use(loadUser);

/**
 * PPT Generation Routes
 * Phase 2: Separate routes for PowerPoint generation
 * All routes are under /api/v3/ppt
 */

// ============================================================================
// VALIDATION ENDPOINTS
// ============================================================================

/**
 * GET /api/v3/ppt/validate/:workflowId
 * Check if workflow has all 9 steps completed and is ready for PPT generation
 */
router.get('/validate/:workflowId', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;

    // Slides are built from the lesson bodies, which live in their own collection — the
    // workflow document carries only per-module stubs. See step10Store.
    const workflow = await loadWorkflowWithLessons(workflowId);

    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: 'Workflow not found',
      });
    }

    // Validate workflow completion
    const validation = pptGenerationService.validateWorkflowCompletion(workflow);

    res.json({
      success: true,
      data: {
        isComplete: validation.isComplete,
        missingSteps: validation.missingSteps,
        canGeneratePPT: validation.isComplete,
        moduleCount: workflow.step4?.modules?.length || 0,
        modules:
          workflow.step4?.modules?.map((m: any) => ({
            id: m.id,
            moduleCode: m.moduleCode || m.code || `MOD-${m.sequenceOrder || '?'}`,
            title: m.title,
            sequenceOrder: m.sequenceOrder,
          })) || [],
      },
    });
  } catch (error: any) {
    loggingService.error('Failed to validate workflow for PPT generation', {
      error: error.message,
      workflowId: req.params.workflowId,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to validate workflow',
      error: error.message,
    });
  }
});

// ============================================================================
// SINGLE MODULE PPT GENERATION
// ============================================================================

/**
 * POST /api/v3/ppt/generate/module/:workflowId/:moduleId
 * Generate PPT for a single module
 */
router.post('/generate/module/:workflowId/:moduleId', async (req: Request, res: Response) => {
  try {
    const { workflowId, moduleId } = req.params;

    // Slides are built from the lesson bodies, which live in their own collection — the
    // workflow document carries only per-module stubs. See step10Store.
    const workflow = await loadWorkflowWithLessons(workflowId);

    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: 'Workflow not found',
      });
    }

    // Validate workflow completion
    const validation = pptGenerationService.validateWorkflowCompletion(workflow);

    if (!validation.isComplete) {
      return res.status(400).json({
        success: false,
        message: 'Cannot generate PPT. Please complete all 9 steps first.',
        missingSteps: validation.missingSteps,
      });
    }

    // Find module
    const module = workflow.step4?.modules?.find((m: any) => m.id === moduleId);

    if (!module) {
      return res.status(404).json({
        success: false,
        message: 'Module not found',
      });
    }

    loggingService.info('Starting PPT generation for single module', {
      workflowId,
      moduleId,
      moduleCode: moduleCodeOf(module),
    });

    // Generate PPT
    const pptBuffer = await pptGenerationService.generateModulePPT(moduleId, workflow);

    // Set headers for download
    const filename = `${moduleFileSlugOf(module)}.pptx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pptBuffer.length);

    res.send(pptBuffer);

    loggingService.info('PPT generated successfully for module', {
      workflowId,
      moduleId,
      moduleCode: module.moduleCode,
      fileSize: pptBuffer.length,
    });
  } catch (error: any) {
    loggingService.error('Failed to generate module PPT', {
      error: error.message,
      stack: error.stack,
      workflowId: req.params.workflowId,
      moduleId: req.params.moduleId,
    });

    console.error('PPT Generation Error Stack:', error.stack);

    res.status(500).json({
      success: false,
      message: 'Failed to generate PowerPoint',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// ============================================================================
// BULK PPT GENERATION (ALL MODULES)
// ============================================================================

/**
 * POST /api/v3/ppt/generate/all/:workflowId
 * Generate PPTs for all modules and return as ZIP
 */
router.post('/generate/all/:workflowId', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;

    // Slides are built from the lesson bodies, which live in their own collection — the
    // workflow document carries only per-module stubs. See step10Store.
    const workflow = await loadWorkflowWithLessons(workflowId);

    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: 'Workflow not found',
      });
    }

    // Check if Step 10 is complete
    if (
      !workflow.step10 ||
      !workflow.step10.moduleLessonPlans ||
      workflow.step10.moduleLessonPlans.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Cannot generate PPTs. Please complete Step 10 (Lesson Plans) first.',
      });
    }

    const moduleLessonPlans = workflow.step10.moduleLessonPlans;

    loggingService.info('Starting bulk PPT generation from Step 10', {
      workflowId,
      moduleCount: moduleLessonPlans.length,
      totalLessons: workflow.step10.summary?.totalLessons || 0,
    });

    // Create ZIP file
    const zip = new JSZip();

    let outlines = 0;
    for (const modulePlan of moduleLessonPlans) {
      const context = {
        programTitle: workflow.step1?.programTitle || 'Program',
        academicLevel: workflow.step1?.academicLevel || '',
        deliveryMode: workflow.step1?.deliveryMode || 'in-person',
        moduleCode: modulePlan.moduleCode,
        moduleTitle: modulePlan.moduleTitle,
        sources: workflow.step5?.sources || [],
        glossaryEntries: workflow.step9?.entries || [],
      };
      outlines += await addModuleDecks(
        zip,
        workflow,
        modulePlan,
        context,
        `${modulePlan.moduleCode}_`
      );
    }
    if (outlines) zip.file('README.txt', OUTLINE_NOTE);

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // Set headers for download
    const programTitle =
      workflow.step1?.programTitle?.replace(/[^a-zA-Z0-9]/g, '_') || 'Curriculum';
    const zipFilename = `${programTitle}_All_Lessons_PPT.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
    res.setHeader('Content-Length', zipBuffer.length);

    res.send(zipBuffer);

    loggingService.info('Bulk PPT generation completed successfully', {
      workflowId,
      moduleCount: moduleLessonPlans.length,
      totalLessons: workflow.step10.summary?.totalLessons || 0,
      zipSize: zipBuffer.length,
    });
  } catch (error: any) {
    loggingService.error('Failed to generate bulk PPTs', {
      error: error.message,
      stack: error.stack,
      workflowId: req.params.workflowId,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to generate PowerPoints',
      error: error.message,
    });
  }
});

// ============================================================================
// STEP 11 MODULE PPT DOWNLOAD
// ============================================================================

/**
 * POST /api/v3/ppt/download/module/:workflowId/:moduleIndex
 * Download PPTs for a specific module from Step 10/11 data
 * Uses moduleIndex (0-based) to find the module in step10.moduleLessonPlans
 */
router.post('/download/module/:workflowId/:moduleIndex', async (req: Request, res: Response) => {
  try {
    const { workflowId, moduleIndex } = req.params;
    const moduleIdx = parseInt(moduleIndex, 10);

    // Slides are built from the lesson bodies, which live in their own collection — the
    // workflow document carries only per-module stubs. See step10Store.
    const workflow = await loadWorkflowWithLessons(workflowId);

    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: 'Workflow not found',
      });
    }

    if (!workflow.step10?.moduleLessonPlans || workflow.step10.moduleLessonPlans.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Step 10 (Lesson Plans) not completed',
      });
    }

    const moduleLessonPlans = workflow.step10.moduleLessonPlans;

    if (moduleIdx < 0 || moduleIdx >= moduleLessonPlans.length) {
      return res.status(404).json({
        success: false,
        message: `Module at index ${moduleIdx} not found. Valid range: 0-${moduleLessonPlans.length - 1}`,
      });
    }

    const modulePlan = moduleLessonPlans[moduleIdx];

    loggingService.info('Downloading PPTs for module', {
      workflowId,
      moduleIndex: moduleIdx,
      moduleCode: modulePlan.moduleCode,
      lessonCount: modulePlan.lessons.length,
    });

    const zip = new JSZip();

    const context = {
      programTitle: workflow.step1?.programTitle || 'Program',
      academicLevel: workflow.step1?.academicLevel || '',
      deliveryMode: workflow.step1?.deliveryMode || 'in-person',
      moduleCode: modulePlan.moduleCode,
      moduleTitle: modulePlan.moduleTitle,
      sources: workflow.step5?.sources || [],
      glossaryEntries: workflow.step9?.entries || [],
    };
    if (await addModuleDecks(zip, workflow, modulePlan, context)) {
      zip.file('README.txt', OUTLINE_NOTE);
    }

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // Set headers for download
    const zipFilename = `${modulePlan.moduleCode}_PPTs.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
    res.setHeader('Content-Length', zipBuffer.length);

    res.send(zipBuffer);

    loggingService.info('Module PPT download completed', {
      workflowId,
      moduleCode: modulePlan.moduleCode,
      lessonCount: modulePlan.lessons.length,
      zipSize: zipBuffer.length,
    });
  } catch (error: any) {
    loggingService.error('Failed to generate module PPT download', {
      error: error.message,
      stack: error.stack,
      workflowId: req.params.workflowId,
      moduleIndex: req.params.moduleIndex,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to generate PowerPoints',
      error: error.message,
    });
  }
});

// ============================================================================
// PROGRESS TRACKING (for future WebSocket implementation)
// ============================================================================

/**
 * POST /api/v3/ppt/generate/all-async/:workflowId
 * Generate PPTs asynchronously with progress tracking
 * (Future enhancement with WebSocket)
 */
router.post('/generate/all-async/:workflowId', async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;

    // Slides are built from the lesson bodies, which live in their own collection — the
    // workflow document carries only per-module stubs. See step10Store.
    const workflow = await loadWorkflowWithLessons(workflowId);

    if (!workflow) {
      return res.status(404).json({
        success: false,
        message: 'Workflow not found',
      });
    }

    // Validate workflow completion
    const validation = pptGenerationService.validateWorkflowCompletion(workflow);

    if (!validation.isComplete) {
      return res.status(400).json({
        success: false,
        message: 'Cannot generate PPTs. Please complete all 9 steps first.',
        missingSteps: validation.missingSteps,
      });
    }

    const modules = workflow.step4?.modules || [];

    // Return immediately and process in background
    res.json({
      success: true,
      message: 'PPT generation started',
      data: {
        moduleCount: modules.length,
        estimatedTimeSeconds: modules.length * 30, // Rough estimate: 30 seconds per module
      },
    });

    // Process in background (for now, just log - future: use job queue)
    loggingService.info('Async PPT generation started (not yet implemented)', {
      workflowId,
      moduleCount: modules.length,
    });

    // TODO: Implement job queue and WebSocket progress updates
  } catch (error: any) {
    loggingService.error('Failed to start async PPT generation', {
      error: error.message,
      workflowId: req.params.workflowId,
    });

    res.status(500).json({
      success: false,
      message: 'Failed to start PPT generation',
      error: error.message,
    });
  }
});

export default router;
