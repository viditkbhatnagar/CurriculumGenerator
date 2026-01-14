import express, { Request, Response } from 'express';
import { pptGenerationService } from '../services/pptGenerationService';
import { CurriculumWorkflow } from '../models/CurriculumWorkflow';
import { loggingService } from '../services/loggingService';
import { validateJWT, loadUser } from '../middleware/auth';
import JSZip from 'jszip';

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

    const workflow = await CurriculumWorkflow.findById(workflowId);

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

    const workflow = await CurriculumWorkflow.findById(workflowId);

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
      moduleCode: module.moduleCode,
    });

    // Generate PPT
    const pptBuffer = await pptGenerationService.generateModulePPT(moduleId, workflow);

    // Set headers for download
    const filename = `${module.moduleCode}_${module.title.replace(/[^a-zA-Z0-9]/g, '_')}.pptx`;

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

    const workflow = await CurriculumWorkflow.findById(workflowId);

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

    // Generate PPTs for each module's lessons
    for (const modulePlan of moduleLessonPlans) {
      loggingService.info('Generating PPTs for module', {
        moduleCode: modulePlan.moduleCode,
        lessonCount: modulePlan.lessons.length,
      });

      // Build context for PPT generation
      const context = {
        programTitle: workflow.step1?.programTitle || 'Program',
        academicLevel: workflow.step1?.academicLevel || '',
        deliveryMode: workflow.step1?.deliveryMode || 'in-person',
        moduleCode: modulePlan.moduleCode,
        moduleTitle: modulePlan.moduleTitle,
        sources: workflow.step5?.sources || [],
        glossaryEntries: workflow.step9?.entries || [],
      };

      // Generate PPT for each lesson
      for (const lesson of modulePlan.lessons) {
        try {
          const deck = await pptGenerationService.generateLessonPPT(lesson, context);

          // Export to PPTX buffer
          const pptxBuffer = await pptGenerationService.exportPPTX(deck);

          // Add to ZIP with descriptive filename
          const filename = `${modulePlan.moduleCode}_Lesson${lesson.lessonNumber}_${lesson.lessonTitle.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)}.pptx`;
          zip.file(filename, pptxBuffer);

          loggingService.info('PPT generated for lesson', {
            moduleCode: modulePlan.moduleCode,
            lessonNumber: lesson.lessonNumber,
            slideCount: deck.slideCount,
          });
        } catch (error: any) {
          loggingService.error('Failed to generate PPT for lesson', {
            error: error.message,
            moduleCode: modulePlan.moduleCode,
            lessonNumber: lesson.lessonNumber,
          });
          // Continue with other lessons
        }
      }
    }

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

    const workflow = await CurriculumWorkflow.findById(workflowId);

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

    loggingService.info('Generating PPTs for module download', {
      workflowId,
      moduleIndex: moduleIdx,
      moduleCode: modulePlan.moduleCode,
      lessonCount: modulePlan.lessons.length,
    });

    // Build context for PPT generation
    const context = {
      programTitle: workflow.step1?.programTitle || 'Program',
      academicLevel: workflow.step1?.academicLevel || '',
      deliveryMode: workflow.step1?.deliveryMode || 'in-person',
      moduleCode: modulePlan.moduleCode,
      moduleTitle: modulePlan.moduleTitle,
      sources: workflow.step5?.sources || [],
      glossaryEntries: workflow.step9?.entries || [],
    };

    // Create ZIP file for all lessons in this module
    const zip = new JSZip();

    for (const lesson of modulePlan.lessons) {
      try {
        const deck = await pptGenerationService.generateLessonPPT(lesson, context);
        const pptxBuffer = await pptGenerationService.exportPPTX(deck);

        const filename = `Lesson${lesson.lessonNumber}_${lesson.lessonTitle.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50)}.pptx`;
        zip.file(filename, pptxBuffer);

        loggingService.info('PPT generated for lesson', {
          moduleCode: modulePlan.moduleCode,
          lessonNumber: lesson.lessonNumber,
          slideCount: deck.slideCount,
        });
      } catch (error: any) {
        loggingService.error('Failed to generate PPT for lesson', {
          error: error.message,
          moduleCode: modulePlan.moduleCode,
          lessonNumber: lesson.lessonNumber,
        });
      }
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

    const workflow = await CurriculumWorkflow.findById(workflowId);

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
