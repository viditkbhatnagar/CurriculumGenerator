/**
 * 9-Step Workflow API Routes
 * AI-Integrated Curriculum Generator Workflow v2.2
 *
 * Base Path: /api/v3/workflow
 *
 * Steps:
 * 1. Program Foundation (15-20 min)
 * 2. Competency & Knowledge Framework - KSC (10-15 min)
 * 3. Program Learning Outcomes - PLOs (15-20 min)
 * 4. Course Framework & MLOs (25-30 min)
 * 5. Topic-Level Sources - AGI Standards (10 min)
 * 6. Reading Lists (8 min)
 * 7. Auto-Gradable Assessments - MCQ-First (15-20 min)
 * 8. Case Studies (10-15 min)
 * 9. Glossary - Auto-Generated (5 min)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { promisify } from 'util';
import libreofficeConvert from 'libreoffice-convert';
import JSZip from 'jszip';
import { validateJWT, loadUser } from '../middleware/auth';
import { workflowService } from '../services/workflowService';
import { loggingService } from '../services/loggingService';
import { CurriculumWorkflow } from '../models/CurriculumWorkflow';
import { wordExportService } from '../services/wordExportService';
import { analyticsStorageService } from '../services/analyticsStorageService';
import { lessonPlanService } from '../services/lessonPlanService';
import { addStepJob, getStepJobStatus, stepQueue, removeStepJob } from '../queues/stepQueue';

const router = Router();

// ============================================================================
// TIMEOUT MIDDLEWARE FOR LONG-RUNNING AI GENERATION
// ============================================================================

/**
 * Middleware to extend request timeout for AI-heavy operations
 * Steps 5, 6, 7, 8, 9 can take several minutes with parallel processing
 */
const extendTimeout = (timeoutMs: number = 600000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Set Node.js socket timeout
    req.setTimeout(timeoutMs);
    res.setTimeout(timeoutMs);

    // Set keep-alive
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Keep-Alive', `timeout=${Math.floor(timeoutMs / 1000)}`);

    loggingService.info('Extended timeout for long-running operation', {
      timeoutMs,
      path: req.path,
    });

    next();
  };
};

// ============================================================================
// HELPER: PROPAGATE CHANGES ACROSS ALL STEPS
// ============================================================================

/**
 * Propagate module title changes to all steps that store module info
 * This ensures data consistency across the entire workflow
 */
function propagateModuleTitleChange(
  workflow: any,
  moduleId: string,
  oldTitle: string,
  newTitle: string
) {
  const stepsToUpdate: string[] = [];

  // Step 5: moduleSummaries
  if (workflow.step5?.moduleSummaries) {
    workflow.step5.moduleSummaries.forEach((summary: any) => {
      if (summary.moduleId === moduleId || summary.moduleTitle === oldTitle) {
        summary.moduleTitle = newTitle;
        stepsToUpdate.push('step5');
      }
    });
  }

  // Step 5: sources (moduleId reference - title in sourcesByModule key)
  if (workflow.step5?.sourcesByModule) {
    // sourcesByModule is keyed by moduleId, not title, so no change needed
    // But if there's a moduleTitle field in sources, update it
  }

  // Step 6: moduleReadingLists or readings with module references
  if (workflow.step6?.moduleReadingLists) {
    workflow.step6.moduleReadingLists.forEach((list: any) => {
      if (list.moduleId === moduleId || list.moduleTitle === oldTitle) {
        list.moduleTitle = newTitle;
        stepsToUpdate.push('step6');
      }
    });
  }
  if (workflow.step6?.moduleSummaries) {
    workflow.step6.moduleSummaries.forEach((summary: any) => {
      if (summary.moduleId === moduleId || summary.moduleTitle === oldTitle) {
        summary.moduleTitle = newTitle;
      }
    });
  }

  // Step 7: quizzes with module references
  if (workflow.step7?.quizzes) {
    workflow.step7.quizzes.forEach((quiz: any) => {
      if (quiz.moduleId === moduleId || quiz.moduleTitle === oldTitle) {
        quiz.moduleTitle = newTitle;
        stepsToUpdate.push('step7');
      }
    });
  }

  // Step 8: caseStudies with module references
  if (workflow.step8?.caseStudies) {
    workflow.step8.caseStudies.forEach((cs: any) => {
      if (cs.moduleId === moduleId || cs.moduleTitle === oldTitle) {
        cs.moduleTitle = newTitle;
        stepsToUpdate.push('step8');
      }
    });
  }

  // Mark all affected steps as modified
  const uniqueSteps = [...new Set(stepsToUpdate)];
  uniqueSteps.forEach((step) => workflow.markModified(step));

  if (uniqueSteps.length > 0) {
    loggingService.info('Module title propagated across steps', {
      moduleId,
      oldTitle,
      newTitle,
      affectedSteps: uniqueSteps,
    });
  }
}

// ============================================================================
// WORKFLOW MANAGEMENT
// ============================================================================

/**
 * POST /api/v3/workflow
 * Create a new curriculum workflow
 */
router.post('/', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { projectName } = req.body;
    const userId = (req as any).user?.id || (req as any).user?.userId;

    if (!projectName) {
      return res.status(400).json({
        success: false,
        error: 'projectName is required',
      });
    }

    const workflow = await workflowService.createWorkflow(projectName, userId);

    res.status(201).json({
      success: true,
      data: workflow,
      message: 'Workflow created successfully. Ready for Step 1: Program Foundation.',
    });
  } catch (error) {
    loggingService.error('Error creating workflow', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create workflow',
    });
  }
});

/**
 * GET /api/v3/workflow
 * Get all workflows for authenticated user
 */
router.get('/', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const { status, step } = req.query;

    const query: any = { createdBy: userId };
    if (status) query.status = status;
    if (step) query.currentStep = parseInt(step as string);

    const workflows = await CurriculumWorkflow.find(query)
      .select('projectName currentStep status createdAt updatedAt stepProgress')
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      data: workflows,
      count: workflows.length,
    });
  } catch (error) {
    loggingService.error('Error fetching workflows', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch workflows',
    });
  }
});

/**
 * GET /api/v3/workflow/:id
 * Get workflow by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const workflow = await workflowService.getWorkflow(req.params.id);

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
      });
    }

    res.json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    loggingService.error('Error fetching workflow', { error, workflowId: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch workflow',
    });
  }
});

/**
 * GET /api/v3/workflow/:id/progress
 * Get workflow progress summary
 */
router.get('/:id/progress', async (req: Request, res: Response) => {
  try {
    const workflow = await CurriculumWorkflow.findById(req.params.id).select(
      'projectName currentStep status stepProgress createdAt updatedAt'
    );

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
      });
    }

    const completedSteps = workflow.stepProgress.filter(
      (p: any) => p.status === 'completed' || p.status === 'approved'
    ).length;

    res.json({
      success: true,
      data: {
        workflowId: workflow._id,
        projectName: workflow.projectName,
        currentStep: workflow.currentStep,
        status: workflow.status,
        completedSteps,
        totalSteps: 9,
        progressPercent: Math.round((completedSteps / 9) * 100),
        stepProgress: workflow.stepProgress,
        estimatedTimeRemaining: calculateRemainingTime(workflow.currentStep),
      },
    });
  } catch (error) {
    loggingService.error('Error fetching workflow progress', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch workflow progress',
    });
  }
});

// ============================================================================
// STEP 1: PROGRAM FOUNDATION
// ============================================================================

/**
 * POST /api/v3/workflow/:id/step1
 * Submit Step 1: Program Foundation
 */
router.post('/:id/step1', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const {
      programTitle,
      programDescription,
      academicLevel,
      isCreditAwarding,
      creditSystem,
      credits,
      totalHours,
      customContactPercent,
      targetLearner,
      targetLearnerAgeRange,
      targetLearnerEducationalBackground,
      targetLearnerIndustrySector,
      targetLearnerExperienceLevel,
      deliveryMode,
      deliveryDescription,
      programPurpose,
      jobRoles,
    } = req.body;

    // Minimal validation stays synchronous
    if (!programTitle || programTitle.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Program title must be at least 3 characters',
      });
    }

    const filteredJobRoles = (jobRoles || []).filter((role: any) => {
      if (typeof role === 'string') {
        return role && role.trim();
      }
      return role && role.title && role.title.trim();
    });

    const inputData = {
      programTitle,
      programDescription: programDescription || '',
      academicLevel: academicLevel || 'certificate',
      isCreditAwarding: isCreditAwarding ?? true,
      creditSystem: creditSystem || 'uk',
      credits: credits || 60,
      totalHours,
      customContactPercent,
      targetLearnerAgeRange: targetLearnerAgeRange || '',
      targetLearnerEducationalBackground: targetLearnerEducationalBackground || '',
      targetLearnerIndustrySector: targetLearnerIndustrySector || '',
      targetLearnerExperienceLevel: targetLearnerExperienceLevel || 'professional',
      targetLearner: targetLearner,
      deliveryMode: deliveryMode || 'hybrid_blended',
      deliveryDescription: deliveryDescription || '',
      programPurpose: programPurpose || '',
      jobRoles: filteredJobRoles,
    };

    if (stepQueue) {
      const existingStatus = await getStepJobStatus(1, id);
      if (existingStatus && ['waiting', 'active', 'delayed'].includes(existingStatus.state)) {
        return res.status(202).json({
          success: true,
          data: { jobId: existingStatus.jobId, status: existingStatus.state, stepNumber: 1 },
          message: 'Step 1 generation already in progress.',
        });
      }

      await removeStepJob(1, id);
      const job = await addStepJob(1, id, userId, inputData);
      if (!job) {
        return res.status(500).json({ success: false, error: 'Failed to queue job' });
      }

      return res.status(202).json({
        success: true,
        data: { jobId: job.id, status: 'queued', stepNumber: 1 },
        message: 'Step 1 generation queued. Poll status endpoint for updates.',
      });
    }

    // Fallback: synchronous processing
    const workflow = await workflowService.processStep1(id, inputData);

    res.json({
      success: true,
      data: {
        step1: workflow.step1,
        currentStep: workflow.currentStep,
        status: workflow.status,
        completenessScore: workflow.step1?.completenessScore,
      },
      message:
        workflow.step1?.completenessScore && workflow.step1.completenessScore >= 70
          ? 'Step 1 complete. Ready for Step 2: Competency Framework.'
          : 'Step 1 saved. Please complete all required fields to proceed.',
    });
  } catch (error) {
    loggingService.error('Error processing Step 1', { error, workflowId: req.params.id });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process Step 1',
    });
  }
});

/**
 * POST /api/v3/workflow/:id/step1/approve
 * Approve Step 1 and advance to Step 2
 */
router.post('/:id/step1/approve', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const workflow = await CurriculumWorkflow.findById(req.params.id);

    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    if (!workflow.step1) {
      return res.status(400).json({
        success: false,
        error: 'Step 1 data not found. Please save the form first.',
      });
    }

    // Strict validation for approval
    const errors: string[] = [];

    if (!workflow.step1.programTitle || workflow.step1.programTitle.length < 5) {
      errors.push('Program title must be at least 5 characters');
    }
    if (!workflow.step1.programDescription || workflow.step1.programDescription.length < 50) {
      errors.push('Program description must be at least 50 characters');
    }

    // Handle targetLearner as string or object
    const targetLearner = workflow.step1.targetLearner;
    if (typeof targetLearner === 'string') {
      if (!targetLearner || targetLearner.length < 20) {
        errors.push('Target learner description must be at least 20 characters');
      }
    } else if (targetLearner && typeof targetLearner === 'object') {
      // Object format with industrySector, experienceLevel, etc.
      if (!targetLearner.industrySector && !targetLearner.educationalBackground) {
        errors.push('Target learner must have industry sector or educational background');
      }
    } else {
      errors.push('Target learner information is required');
    }

    if (!workflow.step1.programPurpose || workflow.step1.programPurpose.length < 20) {
      errors.push('Program purpose must be at least 20 characters');
    }

    // Handle jobRoles as array of strings or objects
    const jobRoles = workflow.step1.jobRoles || [];
    const validJobRoles = jobRoles.filter((role: any) => {
      if (typeof role === 'string') return role && role.trim();
      return role && role.title && role.title.trim();
    });
    if (validJobRoles.length < 2) {
      errors.push('At least 2 job roles are required');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot approve Step 1. Missing required fields:',
        details: errors,
      });
    }

    workflow.step1.approvedAt = new Date();
    workflow.step1.approvedBy = userId;

    await workflow.advanceStep();

    res.json({
      success: true,
      data: { currentStep: workflow.currentStep, status: workflow.status },
      message: 'Step 1 approved. Now at Step 2: Competency Framework (KSC).',
    });
  } catch (error) {
    loggingService.error('Error approving Step 1', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve Step 1',
    });
  }
});

// ============================================================================
// STEP 2: COMPETENCY & KNOWLEDGE FRAMEWORK (KSC)
// ============================================================================

/**
 * POST /api/v3/workflow/:id/step2
 * Submit Step 2: Competency Framework
 */
router.post('/:id/step2', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const { benchmarkPrograms, industryFrameworks, institutionalFrameworks } = req.body;

    const inputData = { benchmarkPrograms, industryFrameworks, institutionalFrameworks };

    if (stepQueue) {
      const existingStatus = await getStepJobStatus(2, id);
      if (existingStatus && ['waiting', 'active', 'delayed'].includes(existingStatus.state)) {
        return res.status(202).json({
          success: true,
          data: { jobId: existingStatus.jobId, status: existingStatus.state, stepNumber: 2 },
          message: 'Step 2 generation already in progress.',
        });
      }

      await removeStepJob(2, id);
      const job = await addStepJob(2, id, userId, inputData);
      if (!job) {
        return res.status(500).json({ success: false, error: 'Failed to queue job' });
      }

      return res.status(202).json({
        success: true,
        data: { jobId: job.id, status: 'queued', stepNumber: 2 },
        message: 'Step 2 generation queued. Poll status endpoint for updates.',
      });
    }

    const workflow = await workflowService.processStep2(id, inputData);

    res.json({
      success: true,
      data: {
        step2: workflow.step2,
        currentStep: workflow.currentStep,
        status: workflow.status,
      },
      message: 'Step 2 complete. KSC framework generated. Ready for Step 3: PLOs.',
    });
  } catch (error) {
    loggingService.error('Error processing Step 2', { error, workflowId: req.params.id });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process Step 2',
    });
  }
});

/**
 * PUT /api/v3/workflow/:id/step2/ksa/:ksaId
 * Edit a specific KSC item
 */
router.put('/:id/step2/ksa/:ksaId', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { id, ksaId } = req.params;
    const { statement, description, importance } = req.body;

    loggingService.info('Updating KSC item', {
      workflowId: id,
      ksaId,
      statement,
      description,
      importance,
    });

    const workflow = await CurriculumWorkflow.findById(id);
    if (!workflow || !workflow.step2) {
      return res.status(404).json({ success: false, error: 'Workflow or Step 2 not found' });
    }

    // Find the item in the appropriate array and update it
    let found = false;
    let updatedItem: any = null;

    // Check knowledge items
    for (const item of workflow.step2.knowledgeItems) {
      if ((item as any).id === ksaId) {
        if (statement !== undefined) (item as any).statement = statement;
        if (description !== undefined) (item as any).description = description;
        if (importance !== undefined) (item as any).importance = importance;
        found = true;
        updatedItem = item;
        break;
      }
    }

    // Check skill items
    if (!found) {
      for (const item of workflow.step2.skillItems) {
        if ((item as any).id === ksaId) {
          if (statement !== undefined) (item as any).statement = statement;
          if (description !== undefined) (item as any).description = description;
          if (importance !== undefined) (item as any).importance = importance;
          found = true;
          updatedItem = item;
          break;
        }
      }
    }

    // Check competency/attitude items
    if (!found) {
      const competencyItems =
        (workflow.step2 as any).competencyItems || workflow.step2.attitudeItems || [];
      for (const item of competencyItems) {
        if ((item as any).id === ksaId) {
          if (statement !== undefined) (item as any).statement = statement;
          if (description !== undefined) (item as any).description = description;
          if (importance !== undefined) (item as any).importance = importance;
          found = true;
          updatedItem = item;
          break;
        }
      }
    }

    if (!found) {
      return res.status(404).json({ success: false, error: 'KSC item not found' });
    }

    // Mark the step2 field as modified so Mongoose saves the changes
    workflow.markModified('step2');
    await workflow.save();

    loggingService.info('KSC item updated successfully', { ksaId, updatedItem });

    res.json({
      success: true,
      data: updatedItem,
      message: 'KSC item updated successfully',
    });
  } catch (error) {
    loggingService.error('Error updating KSC item', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to update KSC item',
    });
  }
});

/**
 * POST /api/v3/workflow/:id/step2/approve
 * Approve Step 2 and advance to Step 3
 */
router.post('/:id/step2/approve', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const workflow = await CurriculumWorkflow.findById(req.params.id);

    if (!workflow || !workflow.step2) {
      return res.status(404).json({ success: false, error: 'Workflow or Step 2 not found' });
    }

    // Validate minimum requirements
    if (workflow.step2.totalItems < 10) {
      return res.status(400).json({
        success: false,
        error: 'At least 10 KSC items are required',
      });
    }

    workflow.step2.approvedAt = new Date();
    workflow.step2.approvedBy = userId;

    await workflow.advanceStep();

    res.json({
      success: true,
      data: { currentStep: workflow.currentStep, status: workflow.status },
      message: 'Step 2 approved. Now at Step 3: Program Learning Outcomes.',
    });
  } catch (error) {
    loggingService.error('Error approving Step 2', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve Step 2',
    });
  }
});

// ============================================================================
// STEP 3: PROGRAM LEARNING OUTCOMES (PLOs)
// ============================================================================

/**
 * POST /api/v3/workflow/:id/step3
 * Submit Step 3: Generate PLOs
 */
router.post('/:id/step3', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const {
      bloomLevels,
      priorityCompetencies,
      outcomeEmphasis,
      targetCount,
      contextConstraints,
      preferredVerbs,
      avoidVerbs,
    } = req.body;

    // Validation stays synchronous
    if (!bloomLevels || bloomLevels.length < 2) {
      return res.status(400).json({
        success: false,
        error: "At least 2 Bloom's levels are required",
      });
    }

    if (!targetCount || targetCount < 4 || targetCount > 8) {
      return res.status(400).json({
        success: false,
        error: 'Target count must be between 4 and 8 PLOs',
      });
    }

    const inputData = {
      bloomLevels,
      priorityCompetencies: priorityCompetencies || [],
      outcomeEmphasis: outcomeEmphasis || 'mixed',
      targetCount,
      contextConstraints,
      preferredVerbs,
      avoidVerbs,
    };

    if (stepQueue) {
      const existingStatus = await getStepJobStatus(3, id);
      if (existingStatus && ['waiting', 'active', 'delayed'].includes(existingStatus.state)) {
        return res.status(202).json({
          success: true,
          data: { jobId: existingStatus.jobId, status: existingStatus.state, stepNumber: 3 },
          message: 'Step 3 generation already in progress.',
        });
      }

      await removeStepJob(3, id);
      const job = await addStepJob(3, id, userId, inputData);
      if (!job) {
        return res.status(500).json({ success: false, error: 'Failed to queue job' });
      }

      return res.status(202).json({
        success: true,
        data: { jobId: job.id, status: 'queued', stepNumber: 3 },
        message: 'Step 3 generation queued. Poll status endpoint for updates.',
      });
    }

    const workflow = await workflowService.processStep3(id, inputData);

    res.json({
      success: true,
      data: {
        step3: workflow.step3,
        currentStep: workflow.currentStep,
        status: workflow.status,
      },
      message: 'Step 3 complete. PLOs generated. Ready for Step 4: Course Framework.',
    });
  } catch (error) {
    loggingService.error('Error processing Step 3', { error, workflowId: req.params.id });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process Step 3',
    });
  }
});

/**
 * PUT /api/v3/workflow/:id/step3/plo/:ploId
 * Edit a specific PLO item
 */
router.put('/:id/step3/plo/:ploId', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { id, ploId } = req.params;
    const { statement, verb, bloomLevel, assessmentAlignment, jobTaskMapping } = req.body;

    loggingService.info('Updating PLO item', {
      workflowId: id,
      ploId,
      statement,
      verb,
      bloomLevel,
    });

    const workflow = await CurriculumWorkflow.findById(id);
    if (!workflow || !workflow.step3) {
      return res.status(404).json({ success: false, error: 'Workflow or Step 3 not found' });
    }

    // Find the PLO in the outcomes array
    const outcomes = workflow.step3.outcomes || [];
    const ploIndex = outcomes.findIndex((plo: any) => plo.id === ploId);

    if (ploIndex === -1) {
      return res.status(404).json({ success: false, error: 'PLO not found' });
    }

    // Update the PLO fields
    const plo = outcomes[ploIndex] as any;
    if (statement !== undefined) plo.statement = statement;
    if (verb !== undefined) plo.verb = verb;
    if (bloomLevel !== undefined) plo.bloomLevel = bloomLevel;
    if (assessmentAlignment !== undefined) plo.assessmentAlignment = assessmentAlignment;
    if (jobTaskMapping !== undefined) plo.jobTaskMapping = jobTaskMapping;

    // Mark the step3 field as modified so Mongoose saves the changes
    workflow.markModified('step3');
    await workflow.save();

    loggingService.info('PLO item updated successfully', { ploId, plo });

    res.json({
      success: true,
      data: plo,
      message: 'PLO updated successfully',
    });
  } catch (error) {
    loggingService.error('Error updating PLO', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to update PLO',
    });
  }
});

/**
 * POST /api/v3/workflow/:id/step3/approve
 * Approve Step 3 and advance to Step 4
 */
router.post('/:id/step3/approve', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const workflow = await CurriculumWorkflow.findById(req.params.id);

    if (!workflow || !workflow.step3) {
      return res.status(404).json({ success: false, error: 'Workflow or Step 3 not found' });
    }

    if (!workflow.step3.outcomes || workflow.step3.outcomes.length < 4) {
      return res.status(400).json({
        success: false,
        error: 'At least 4 PLOs are required',
      });
    }

    workflow.step3.approvedAt = new Date();
    workflow.step3.approvedBy = userId;

    await workflow.advanceStep();

    res.json({
      success: true,
      data: { currentStep: workflow.currentStep, status: workflow.status },
      message: 'Step 3 approved. Now at Step 4: Course Framework & MLOs.',
    });
  } catch (error) {
    loggingService.error('Error approving Step 3', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve Step 3',
    });
  }
});

// ============================================================================
// STEP 4: COURSE FRAMEWORK & MLOs
// ============================================================================

/**
 * POST /api/v3/workflow/:id/step4
 * Submit Step 4: Generate Course Framework
 */
router.post('/:id/step4', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id || (req as any).user?.userId;

    if (stepQueue) {
      const existingStatus = await getStepJobStatus(4, id);
      if (existingStatus && ['waiting', 'active', 'delayed'].includes(existingStatus.state)) {
        return res.status(202).json({
          success: true,
          data: { jobId: existingStatus.jobId, status: existingStatus.state, stepNumber: 4 },
          message: 'Step 4 generation already in progress.',
        });
      }

      await removeStepJob(4, id);
      const job = await addStepJob(4, id, userId);
      if (!job) {
        return res.status(500).json({ success: false, error: 'Failed to queue job' });
      }

      return res.status(202).json({
        success: true,
        data: { jobId: job.id, status: 'queued', stepNumber: 4 },
        message: 'Step 4 generation queued. Poll status endpoint for updates.',
      });
    }

    const workflow = await workflowService.processStep4(id);

    res.json({
      success: true,
      data: {
        step4: workflow.step4,
        currentStep: workflow.currentStep,
        status: workflow.status,
      },
      message: 'Step 4 complete. Course framework and MLOs generated. Ready for Step 5: Sources.',
    });
  } catch (error) {
    loggingService.error('Error processing Step 4', { error, workflowId: req.params.id });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process Step 4',
    });
  }
});

/**
 * PUT /api/v3/workflow/:id/step4/module/:moduleId
 * Edit a specific module
 */
router.put(
  '/:id/step4/module/:moduleId',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const { id, moduleId } = req.params;
      const updates = req.body;

      loggingService.info('Updating module', { workflowId: id, moduleId, updates });

      const workflow = await CurriculumWorkflow.findById(id);
      if (!workflow || !workflow.step4) {
        return res.status(404).json({ success: false, error: 'Workflow or Step 4 not found' });
      }

      const module = workflow.step4.modules.find((m: any) => m.id === moduleId);
      if (!module) {
        return res.status(404).json({ success: false, error: 'Module not found' });
      }

      // Apply updates (excluding mlos to prevent accidental overwrites)
      const { mlos, ...moduleUpdates } = updates;
      Object.assign(module, moduleUpdates);

      // Recalculate hours integrity
      const totalModuleHours = workflow.step4.modules.reduce(
        (sum: number, m: any) => sum + (m.totalHours || 0),
        0
      );
      workflow.step4.hoursIntegrity = totalModuleHours === workflow.step4.totalProgramHours;

      // Mark as modified and save
      workflow.markModified('step4');
      await workflow.save();

      loggingService.info('Module updated successfully', { moduleId, module });

      res.json({
        success: true,
        data: module,
        hoursIntegrity: workflow.step4.hoursIntegrity,
        message: 'Module updated successfully',
      });
    } catch (error) {
      loggingService.error('Error updating module', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to update module',
      });
    }
  }
);

/**
 * PUT /api/v3/workflow/:id/step4/module/:moduleId/mlo/:mloId
 * Edit a specific MLO within a module
 */
router.put(
  '/:id/step4/module/:moduleId/mlo/:mloId',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const { id, moduleId, mloId } = req.params;
      const { statement, code, bloomLevel, verb, linkedPLOs } = req.body;

      loggingService.info('Updating MLO', {
        workflowId: id,
        moduleId,
        mloId,
        statement,
        bloomLevel,
      });

      const workflow = await CurriculumWorkflow.findById(id);
      if (!workflow || !workflow.step4) {
        return res.status(404).json({ success: false, error: 'Workflow or Step 4 not found' });
      }

      const module = workflow.step4.modules.find((m: any) => m.id === moduleId);
      if (!module) {
        return res.status(404).json({ success: false, error: 'Module not found' });
      }

      const mlo = module.mlos?.find((m: any) => m.id === mloId);
      if (!mlo) {
        return res.status(404).json({ success: false, error: 'MLO not found' });
      }

      // Update MLO fields
      if (statement !== undefined) mlo.statement = statement;
      if (code !== undefined) mlo.code = code;
      if (bloomLevel !== undefined) mlo.bloomLevel = bloomLevel;
      if (verb !== undefined) mlo.verb = verb;
      if (linkedPLOs !== undefined) mlo.linkedPLOs = linkedPLOs;

      // Mark as modified and save
      workflow.markModified('step4');
      await workflow.save();

      loggingService.info('MLO updated successfully', { mloId, mlo });

      res.json({
        success: true,
        data: mlo,
        message: 'MLO updated successfully',
      });
    } catch (error) {
      loggingService.error('Error updating MLO', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to update MLO',
      });
    }
  }
);

/**
 * POST /api/v3/workflow/:id/step4/approve
 * Approve Step 4 and advance to Step 5
 */
router.post('/:id/step4/approve', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const workflow = await CurriculumWorkflow.findById(req.params.id);

    if (!workflow || !workflow.step4) {
      return res.status(404).json({ success: false, error: 'Workflow or Step 4 not found' });
    }

    if (!workflow.step4.hoursIntegrity) {
      return res.status(400).json({
        success: false,
        error: 'Module hours must equal total program hours before approval',
      });
    }

    if (!workflow.step4.modules || workflow.step4.modules.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'At least 6 modules are required',
      });
    }

    workflow.step4.approvedAt = new Date();
    workflow.step4.approvedBy = userId;

    await workflow.advanceStep();

    res.json({
      success: true,
      data: { currentStep: workflow.currentStep, status: workflow.status },
      message: 'Step 4 approved. Now at Step 5: Topic-Level Sources.',
    });
  } catch (error) {
    loggingService.error('Error approving Step 4', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve Step 4',
    });
  }
});

// ============================================================================
// STEP 5: TOPIC-LEVEL SOURCES (AGI STANDARDS)
// ============================================================================

/**
 * POST /api/v3/workflow/:id/step5
 * Submit Step 5: Generate Topic Sources
 */
router.post('/:id/step5', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id || (req as any).user?.userId;

    if (stepQueue) {
      const existingStatus = await getStepJobStatus(5, id);
      if (existingStatus && ['waiting', 'active', 'delayed'].includes(existingStatus.state)) {
        return res.status(202).json({
          success: true,
          data: { jobId: existingStatus.jobId, status: existingStatus.state, stepNumber: 5 },
          message: 'Step 5 generation already in progress.',
        });
      }

      await removeStepJob(5, id);
      const job = await addStepJob(5, id, userId);
      if (!job) {
        return res.status(500).json({ success: false, error: 'Failed to queue job' });
      }

      return res.status(202).json({
        success: true,
        data: { jobId: job.id, status: 'queued', stepNumber: 5 },
        message: 'Step 5 generation queued. Poll status endpoint for updates.',
      });
    }

    const workflow = await workflowService.processStep5(id);

    res.json({
      success: true,
      data: {
        step5: workflow.step5,
        currentStep: workflow.currentStep,
        status: workflow.status,
        agiCompliant: workflow.step5?.agiCompliant,
      },
      message: workflow.step5?.agiCompliant
        ? 'Step 5 complete. AGI-compliant sources generated. Ready for Step 6: Reading Lists.'
        : 'Step 5 complete but has compliance issues. Review required.',
    });
  } catch (error) {
    loggingService.error('Error processing Step 5', { error, workflowId: req.params.id });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process Step 5',
    });
  }
});

/**
 * PUT /api/v3/workflow/:id/step5/source/:sourceId
 * Edit a specific source
 */
router.put(
  '/:id/step5/source/:sourceId',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const { id, sourceId } = req.params;
      const {
        title,
        authors,
        year,
        citation,
        doi,
        url,
        category,
        type,
        complexityLevel,
        accessStatus,
      } = req.body;

      loggingService.info('Updating source', { workflowId: id, sourceId, title, authors, year });

      const workflow = await CurriculumWorkflow.findById(id);
      if (!workflow || !workflow.step5) {
        return res.status(404).json({ success: false, error: 'Workflow or Step 5 not found' });
      }

      // Find the source in the sources array
      const source = workflow.step5.sources?.find((s: any) => s.id === sourceId);
      if (!source) {
        return res.status(404).json({ success: false, error: 'Source not found' });
      }

      // Update source fields
      if (title !== undefined) source.title = title;
      if (authors !== undefined) source.authors = authors;
      if (year !== undefined) source.year = year;
      if (citation !== undefined) source.citation = citation;
      if (doi !== undefined) source.doi = doi;
      if (url !== undefined) source.url = url;
      if (category !== undefined) source.category = category;
      if (type !== undefined) source.type = type;
      if (complexityLevel !== undefined) source.complexityLevel = complexityLevel;
      if (accessStatus !== undefined) source.accessStatus = accessStatus;

      // Mark as modified and save
      workflow.markModified('step5');
      await workflow.save();

      loggingService.info('Source updated successfully', { sourceId, source });

      res.json({
        success: true,
        data: source,
        message: 'Source updated successfully',
      });
    } catch (error) {
      loggingService.error('Error updating source', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to update source',
      });
    }
  }
);

/**
 * POST /api/v3/workflow/:id/step5/approve
 * Approve Step 5 and advance to Step 6
 */
router.post('/:id/step5/approve', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const workflow = await CurriculumWorkflow.findById(req.params.id);

    if (!workflow || !workflow.step5) {
      return res.status(404).json({ success: false, error: 'Workflow or Step 5 not found' });
    }

    // Validation is informational only - no longer blocks approval
    // Issues will be logged but approval proceeds
    if (!workflow.step5.agiCompliant) {
      loggingService.warn('Step 5 approved with AGI compliance warnings', {
        workflowId: req.params.id,
        agiCompliant: workflow.step5.agiCompliant,
      });
    }

    workflow.step5.approvedAt = new Date();
    workflow.step5.approvedBy = userId;

    await workflow.advanceStep();

    res.json({
      success: true,
      data: { currentStep: workflow.currentStep, status: workflow.status },
      message: 'Step 5 approved. Now at Step 6: Reading Lists.',
      warnings: !workflow.step5.agiCompliant
        ? ['Some AGI compliance issues exist - review recommended']
        : [],
    });
  } catch (error) {
    loggingService.error('Error approving Step 5', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve Step 5',
    });
  }
});

// ============================================================================
// STEP 6: READING LISTS
// ============================================================================

/**
 * POST /api/v3/workflow/:id/step6
 * Submit Step 6: Generate Reading Lists
 */
router.post('/:id/step6', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id || (req as any).user?.userId;

    if (stepQueue) {
      const existingStatus = await getStepJobStatus(6, id);
      if (existingStatus && ['waiting', 'active', 'delayed'].includes(existingStatus.state)) {
        return res.status(202).json({
          success: true,
          data: { jobId: existingStatus.jobId, status: existingStatus.state, stepNumber: 6 },
          message: 'Step 6 generation already in progress.',
        });
      }

      await removeStepJob(6, id);
      const job = await addStepJob(6, id, userId);
      if (!job) {
        return res.status(500).json({ success: false, error: 'Failed to queue job' });
      }

      return res.status(202).json({
        success: true,
        data: { jobId: job.id, status: 'queued', stepNumber: 6 },
        message: 'Step 6 generation queued. Poll status endpoint for updates.',
      });
    }

    const workflow = await workflowService.processStep6(id);

    res.json({
      success: true,
      data: {
        step6: workflow.step6,
        currentStep: workflow.currentStep,
        status: workflow.status,
      },
      message: 'Step 6 complete. Reading lists generated. Ready for Step 7: Assessments.',
    });
  } catch (error) {
    loggingService.error('Error processing Step 6', { error, workflowId: req.params.id });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process Step 6',
    });
  }
});

/**
 * PUT /api/v3/workflow/:id/step6/reading/:readingId
 * Edit a specific reading item
 */
router.put(
  '/:id/step6/reading/:readingId',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const { id, readingId } = req.params;
      const {
        title,
        authors,
        year,
        citation,
        doi,
        url,
        category,
        contentType,
        readingType,
        complexity,
        estimatedReadingMinutes,
        specificChapters,
        pageRange,
        sectionNames,
        notes,
        suggestedWeek,
        linkedMLOs,
        assessmentRelevance,
      } = req.body;

      loggingService.info('Updating reading item', {
        workflowId: id,
        readingId,
        title,
        authors,
        year,
      });

      const workflow = await CurriculumWorkflow.findById(id);
      if (!workflow || !workflow.step6) {
        return res.status(404).json({ success: false, error: 'Workflow or Step 6 not found' });
      }

      // Find the reading in the readings array
      const reading = workflow.step6.readings?.find((r: any) => r.id === readingId);
      if (!reading) {
        return res.status(404).json({ success: false, error: 'Reading not found' });
      }

      // Update reading fields
      if (title !== undefined) reading.title = title;
      if (authors !== undefined) reading.authors = authors;
      if (year !== undefined) reading.year = year;
      if (citation !== undefined) reading.citation = citation;
      if (doi !== undefined) reading.doi = doi;
      if (url !== undefined) reading.url = url;
      if (category !== undefined) reading.category = category;
      if (contentType !== undefined) reading.contentType = contentType;
      if (readingType !== undefined) reading.readingType = readingType;
      if (complexity !== undefined) reading.complexity = complexity;
      if (estimatedReadingMinutes !== undefined)
        reading.estimatedReadingMinutes = estimatedReadingMinutes;
      if (specificChapters !== undefined) reading.specificChapters = specificChapters;
      if (pageRange !== undefined) reading.pageRange = pageRange;
      if (sectionNames !== undefined) reading.sectionNames = sectionNames;
      if (notes !== undefined) reading.notes = notes;
      if (suggestedWeek !== undefined) reading.suggestedWeek = suggestedWeek;
      if (linkedMLOs !== undefined) reading.linkedMLOs = linkedMLOs;
      if (assessmentRelevance !== undefined) reading.assessmentRelevance = assessmentRelevance;

      // Mark as modified and save
      workflow.markModified('step6');
      await workflow.save();

      loggingService.info('Reading item updated successfully', { readingId, reading });

      res.json({
        success: true,
        data: reading,
        message: 'Reading item updated successfully',
      });
    } catch (error) {
      loggingService.error('Error updating reading item', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to update reading item',
      });
    }
  }
);

/**
 * POST /api/v3/workflow/:id/step6/approve
 * Approve Step 6 and advance to Step 7
 */
router.post('/:id/step6/approve', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const workflow = await CurriculumWorkflow.findById(req.params.id);

    if (!workflow || !workflow.step6) {
      return res.status(404).json({ success: false, error: 'Workflow or Step 6 not found' });
    }

    workflow.step6.approvedAt = new Date();
    workflow.step6.approvedBy = userId;

    await workflow.advanceStep();

    res.json({
      success: true,
      data: { currentStep: workflow.currentStep, status: workflow.status },
      message: 'Step 6 approved. Now at Step 7: Auto-Gradable Assessments.',
    });
  } catch (error) {
    loggingService.error('Error approving Step 6', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve Step 6',
    });
  }
});

// ============================================================================
// STEP 7: AUTO-GRADABLE ASSESSMENTS (MCQ-FIRST)
// ============================================================================

/**
 * POST /api/v3/workflow/:id/step7
 * Submit Step 7: Comprehensive Assessment Generation (Assessment Generator Contract)
 */
router.post('/:id/step7', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id || (req as any).user?.userId;

    // Extract user preferences from request body with defaults
    const userPreferences = {
      assessmentStructure: req.body.assessmentStructure || 'both_formative_and_summative',
      assessmentBalance: req.body.assessmentBalance || 'blended_mix',
      certificationStyles: req.body.certificationStyles || ['None'],
      academicTypes: req.body.academicTypes || ['None'],
      summativeFormat: req.body.summativeFormat || 'mixed_format',
      userDefinedSummativeDescription: req.body.userDefinedSummativeDescription,
      formativeTypesPerUnit: req.body.formativeTypesPerUnit || [
        'Short quizzes',
        'MCQ knowledge checks',
      ],
      formativePerModule: Number(req.body.formativePerModule) || 2,
      weightages: {
        formative: req.body.weightages?.formative ? Number(req.body.weightages.formative) : 30,
        summative: req.body.weightages?.summative ? Number(req.body.weightages.summative) : 70,
      },
      assessmentMappingStrategy: 'hybrid',
      higherOrderPloPolicy: req.body.higherOrderPloPolicy || 'yes',
      higherOrderPloRules: req.body.higherOrderPloRules,
      useRealWorldScenarios: req.body.useRealWorldScenarios !== false,
      alignToWorkplacePerformance: req.body.alignToWorkplacePerformance !== false,
      integratedRealWorldSummative: req.body.integratedRealWorldSummative !== false,
      generateSampleQuestions: true,
    };

    // Validation stays synchronous
    if (
      isNaN(userPreferences.formativePerModule) ||
      userPreferences.formativePerModule < 1 ||
      userPreferences.formativePerModule > 5
    ) {
      return res.status(400).json({
        success: false,
        error: 'Formative assessments per module must be between 1 and 5',
      });
    }

    if (userPreferences.assessmentStructure === 'both_formative_and_summative') {
      const totalWeight =
        (userPreferences.weightages.formative || 0) + (userPreferences.weightages.summative || 0);
      if (Math.abs(totalWeight - 100) > 0.1) {
        return res.status(400).json({
          success: false,
          error: 'Formative and summative weightages must sum to 100%',
        });
      }
    }

    if (stepQueue) {
      const existingStatus = await getStepJobStatus(7, id);
      if (existingStatus && ['waiting', 'active', 'delayed'].includes(existingStatus.state)) {
        return res.status(202).json({
          success: true,
          data: { jobId: existingStatus.jobId, status: existingStatus.state, stepNumber: 7 },
          message: 'Step 7 generation already in progress.',
        });
      }

      await removeStepJob(7, id);
      const job = await addStepJob(7, id, userId, userPreferences);
      if (!job) {
        return res.status(500).json({ success: false, error: 'Failed to queue job' });
      }

      return res.status(202).json({
        success: true,
        data: { jobId: job.id, status: 'queued', stepNumber: 7 },
        message: 'Step 7 generation queued. Poll status endpoint for updates.',
      });
    }

    // Fallback: synchronous processing
    loggingService.info('Starting Step 7 comprehensive assessment generation', {
      workflowId: id,
      structure: userPreferences.assessmentStructure,
      formativePerModule: userPreferences.formativePerModule,
    });

    const workflow = await workflowService.processStep7(id, userPreferences);

    res.json({
      success: true,
      data: {
        step7: workflow.step7,
        currentStep: workflow.currentStep,
        status: workflow.status,
        summary: {
          formativeCount: workflow.step7?.formativeAssessments?.length || 0,
          summativeCount: workflow.step7?.summativeAssessments?.length || 0,
          sampleQuestionsTotal:
            (workflow.step7?.sampleQuestions?.mcq?.length || 0) +
            (workflow.step7?.sampleQuestions?.sjt?.length || 0) +
            (workflow.step7?.sampleQuestions?.caseQuestions?.length || 0) +
            (workflow.step7?.sampleQuestions?.essayPrompts?.length || 0) +
            (workflow.step7?.sampleQuestions?.practicalTasks?.length || 0),
        },
      },
      message:
        'Step 7 complete. Comprehensive assessments generated. Ready for Step 8: Case Studies.',
    });
  } catch (error) {
    loggingService.error('Error processing Step 7', { error, workflowId: req.params.id });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process Step 7',
      details: error instanceof Error ? error.stack : undefined,
    });
  }
});

/**
 * DELETE /api/v3/workflow/:id/step7
 * Clear Step 7 data to allow regeneration
 */
router.delete('/:id/step7', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const workflow = await CurriculumWorkflow.findById(req.params.id);

    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    if (!workflow.step7) {
      return res.status(404).json({ success: false, error: 'Step 7 not found' });
    }

    // Clear Step 7 data
    workflow.step7 = {
      userPreferences: {
        assessmentStructure: 'both_formative_and_summative',
        assessmentBalance: 'blended_mix',
        certificationStyles: ['None'],
        academicTypes: ['None'],
        summativeFormat: 'mixed_format',
        formativeTypesPerUnit: ['Short quizzes', 'MCQ knowledge checks'],
        formativePerModule: 2,
        weightages: { formative: 30, summative: 70 },
        assessmentMappingStrategy: 'hybrid',
        higherOrderPloPolicy: 'yes',
        useRealWorldScenarios: true,
        alignToWorkplacePerformance: true,
        integratedRealWorldSummative: true,
        generateSampleQuestions: true,
      },
      formativeAssessments: [],
      summativeAssessments: [],
      sampleQuestions: {
        mcq: [],
        sjt: [],
        caseQuestions: [],
        essayPrompts: [],
        practicalTasks: [],
      },
      lmsPackages: {},
      validation: {
        allFormativesMapped: false,
        allSummativesMapped: false,
        weightsSum100: false,
        sufficientSampleQuestions: false,
        plosCovered: false,
      },
      generatedAt: new Date(),
    };

    // Reset step progress
    const step7Progress = workflow.stepProgress.find((p) => p.step === 7);
    if (step7Progress) {
      step7Progress.status = 'pending';
      step7Progress.completedAt = undefined;
    }

    // Don't change currentStep or status - keep user at Step 7
    await workflow.save();

    loggingService.info('Step 7 data cleared for regeneration', { workflowId: req.params.id });

    res.json({
      success: true,
      message: 'Step 7 data cleared. You can now regenerate.',
    });
  } catch (error) {
    loggingService.error('Error clearing Step 7', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clear Step 7',
    });
  }
});

/**
 * GET /api/v3/workflow/:id/step7/debug
 * Debug endpoint to check Step 7 data in database
 */
router.get('/:id/step7/debug', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const workflow = await CurriculumWorkflow.findById(req.params.id);

    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    res.json({
      success: true,
      debug: {
        step7Exists: !!workflow.step7,
        formativeCount: workflow.step7?.formativeAssessments?.length || 0,
        summativeCount: workflow.step7?.summativeAssessments?.length || 0,
        sampleQuestions: {
          mcq: workflow.step7?.sampleQuestions?.mcq?.length || 0,
          sjt: workflow.step7?.sampleQuestions?.sjt?.length || 0,
          caseQuestions: workflow.step7?.sampleQuestions?.caseQuestions?.length || 0,
          essayPrompts: workflow.step7?.sampleQuestions?.essayPrompts?.length || 0,
          practicalTasks: workflow.step7?.sampleQuestions?.practicalTasks?.length || 0,
        },
        validation: workflow.step7?.validation,
        currentStep: workflow.currentStep,
        status: workflow.status,
      },
    });
  } catch (error) {
    loggingService.error('Error debugging Step 7', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to debug Step 7',
    });
  }
});

/**
 * POST /api/v3/workflow/:id/step7/approve
 * Approve Step 7 and advance to Step 8
 */
router.post('/:id/step7/approve', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const workflow = await CurriculumWorkflow.findById(req.params.id);

    if (!workflow || !workflow.step7) {
      return res.status(404).json({ success: false, error: 'Workflow or Step 7 not found' });
    }

    // Validation is informational only - no longer blocks approval
    const warnings: string[] = [];
    if (!workflow.step7.validation?.plosCovered) {
      warnings.push('Some PLOs may not be fully covered');
      loggingService.warn('Step 7 approved with validation warnings', {
        workflowId: req.params.id,
        validation: workflow.step7.validation,
      });
    }

    workflow.step7.approvedAt = new Date();
    workflow.step7.approvedBy = userId;

    await workflow.advanceStep();

    res.json({
      success: true,
      data: { currentStep: workflow.currentStep, status: workflow.status },
      message: 'Step 7 approved. Now at Step 8: Case Studies.',
      warnings,
    });
  } catch (error) {
    loggingService.error('Error approving Step 7', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve Step 7',
    });
  }
});

/**
 * PUT /api/v3/workflow/:id/step7/formative/:assessmentId
 * Edit a specific formative assessment
 */
router.put(
  '/:id/step7/formative/:assessmentId',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const { id, assessmentId } = req.params;
      const {
        title,
        assessmentType,
        description,
        instructions,
        alignedPLOs,
        alignedMLOs,
        assessmentCriteria,
        maxMarks,
        questions,
      } = req.body;

      loggingService.info('Updating formative assessment', { workflowId: id, assessmentId, title });

      const workflow = await CurriculumWorkflow.findById(id);
      if (!workflow || !workflow.step7) {
        return res.status(404).json({ success: false, error: 'Workflow or Step 7 not found' });
      }

      // Find the formative assessment in the formativeAssessments array
      const assessment = workflow.step7.formativeAssessments?.find(
        (a: any) => a.id === assessmentId
      );
      if (!assessment) {
        return res.status(404).json({ success: false, error: 'Formative assessment not found' });
      }

      // Update assessment fields
      if (title !== undefined) assessment.title = title;
      if (assessmentType !== undefined) assessment.assessmentType = assessmentType;
      if (description !== undefined) assessment.description = description;
      if (instructions !== undefined) assessment.instructions = instructions;
      if (alignedPLOs !== undefined) assessment.alignedPLOs = alignedPLOs;
      if (alignedMLOs !== undefined) assessment.alignedMLOs = alignedMLOs;
      if (assessmentCriteria !== undefined) assessment.assessmentCriteria = assessmentCriteria;
      if (maxMarks !== undefined) assessment.maxMarks = maxMarks;
      if (questions !== undefined) assessment.questions = questions;

      // Mark as modified and save
      workflow.markModified('step7');
      await workflow.save();

      loggingService.info('Formative assessment updated successfully', {
        assessmentId,
        assessment,
      });

      res.json({
        success: true,
        data: assessment,
        message: 'Formative assessment updated successfully',
      });
    } catch (error) {
      loggingService.error('Error updating formative assessment', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to update formative assessment',
      });
    }
  }
);

/**
 * PUT /api/v3/workflow/:id/step7/summative/:assessmentId
 * Edit a specific summative assessment
 */
router.put(
  '/:id/step7/summative/:assessmentId',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const { id, assessmentId } = req.params;
      const { title, format, overview, alignmentTable, components, markingModel } = req.body;

      loggingService.info('Updating summative assessment', { workflowId: id, assessmentId, title });

      const workflow = await CurriculumWorkflow.findById(id);
      if (!workflow || !workflow.step7) {
        return res.status(404).json({ success: false, error: 'Workflow or Step 7 not found' });
      }

      // Find the summative assessment in the summativeAssessments array
      const assessment = workflow.step7.summativeAssessments?.find(
        (a: any) => a.id === assessmentId
      );
      if (!assessment) {
        return res.status(404).json({ success: false, error: 'Summative assessment not found' });
      }

      // Update assessment fields
      if (title !== undefined) assessment.title = title;
      if (format !== undefined) assessment.format = format;
      if (overview !== undefined) assessment.overview = overview;
      if (alignmentTable !== undefined) assessment.alignmentTable = alignmentTable;
      if (components !== undefined) assessment.components = components;
      if (markingModel !== undefined) assessment.markingModel = markingModel;

      // Mark as modified and save
      workflow.markModified('step7');
      await workflow.save();

      loggingService.info('Summative assessment updated successfully', {
        assessmentId,
        assessment,
      });

      res.json({
        success: true,
        data: assessment,
        message: 'Summative assessment updated successfully',
      });
    } catch (error) {
      loggingService.error('Error updating summative assessment', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to update summative assessment',
      });
    }
  }
);

// ============================================================================
// STEP 8: CASE STUDIES
// ============================================================================

/**
 * POST /api/v3/workflow/:id/step8
 * Submit Step 8: Generate Case Studies
 */
router.post('/:id/step8', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id || (req as any).user?.userId;

    if (stepQueue) {
      const existingStatus = await getStepJobStatus(8, id);
      if (existingStatus && ['waiting', 'active', 'delayed'].includes(existingStatus.state)) {
        return res.status(202).json({
          success: true,
          data: { jobId: existingStatus.jobId, status: existingStatus.state, stepNumber: 8 },
          message: 'Step 8 generation already in progress.',
        });
      }

      await removeStepJob(8, id);
      const job = await addStepJob(8, id, userId);
      if (!job) {
        return res.status(500).json({ success: false, error: 'Failed to queue job' });
      }

      return res.status(202).json({
        success: true,
        data: { jobId: job.id, status: 'queued', stepNumber: 8 },
        message: 'Step 8 generation queued. Poll status endpoint for updates.',
      });
    }

    const workflow = await workflowService.processStep8(id);

    res.json({
      success: true,
      data: {
        step8: workflow.step8,
        currentStep: workflow.currentStep,
        status: workflow.status,
      },
      message: 'Step 8 complete. Case studies generated. Ready for Step 9: Glossary.',
    });
  } catch (error) {
    loggingService.error('Error processing Step 8', { error, workflowId: req.params.id });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process Step 8',
    });
  }
});

/**
 * PUT /api/v3/workflow/:id/step8/case/:caseId
 * Edit a specific case study
 */
router.put(
  '/:id/step8/case/:caseId',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const { id, caseId } = req.params;
      const {
        title,
        caseType,
        difficulty,
        scenario,
        organizationalContext,
        backgroundInformation,
        challengeDescription,
        industryContext,
        brandName,
        linkedMLOs,
        suggestedTiming,
        estimatedDuration,
        learningApplication,
        suggestedApproach,
        discussionPrompts,
        ethicsCompliant,
        noPII,
      } = req.body;

      loggingService.info('Updating case study', { workflowId: id, caseId, title });

      const workflow = await CurriculumWorkflow.findById(id);
      if (!workflow || !workflow.step8) {
        return res.status(404).json({ success: false, error: 'Workflow or Step 8 not found' });
      }

      // Find the case study in the caseStudies array
      const caseStudy = workflow.step8.caseStudies?.find((cs: any) => cs.id === caseId);
      if (!caseStudy) {
        return res.status(404).json({ success: false, error: 'Case study not found' });
      }

      // Update case study fields
      if (title !== undefined) caseStudy.title = title;
      if (caseType !== undefined) caseStudy.caseType = caseType;
      if (difficulty !== undefined) caseStudy.difficulty = difficulty;
      if (scenario !== undefined) {
        caseStudy.scenario = scenario;
        // Recalculate word count
        caseStudy.wordCount = scenario.split(/\s+/).filter(Boolean).length;
      }
      if (organizationalContext !== undefined)
        caseStudy.organizationalContext = organizationalContext;
      if (backgroundInformation !== undefined)
        caseStudy.backgroundInformation = backgroundInformation;
      if (challengeDescription !== undefined) caseStudy.challengeDescription = challengeDescription;
      if (industryContext !== undefined) caseStudy.industryContext = industryContext;
      if (brandName !== undefined) caseStudy.brandName = brandName;
      if (linkedMLOs !== undefined) caseStudy.linkedMLOs = linkedMLOs;
      if (suggestedTiming !== undefined) caseStudy.suggestedTiming = suggestedTiming;
      if (estimatedDuration !== undefined) caseStudy.estimatedDuration = estimatedDuration;
      if (learningApplication !== undefined) caseStudy.learningApplication = learningApplication;
      if (suggestedApproach !== undefined) caseStudy.suggestedApproach = suggestedApproach;
      if (discussionPrompts !== undefined) caseStudy.discussionPrompts = discussionPrompts;
      if (ethicsCompliant !== undefined) caseStudy.ethicsCompliant = ethicsCompliant;
      if (noPII !== undefined) caseStudy.noPII = noPII;

      // Mark as modified and save
      workflow.markModified('step8');
      await workflow.save();

      loggingService.info('Case study updated successfully', { caseId, caseStudy });

      res.json({
        success: true,
        data: caseStudy,
        message: 'Case study updated successfully',
      });
    } catch (error) {
      loggingService.error('Error updating case study', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to update case study',
      });
    }
  }
);

/**
 * POST /api/v3/workflow/:id/step8/approve
 * Approve Step 8 and advance to Step 9
 */
router.post('/:id/step8/approve', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const workflow = await CurriculumWorkflow.findById(req.params.id);

    if (!workflow || !workflow.step8) {
      return res.status(404).json({ success: false, error: 'Workflow or Step 8 not found' });
    }

    workflow.step8.approvedAt = new Date();
    workflow.step8.approvedBy = userId;

    await workflow.advanceStep();

    res.json({
      success: true,
      data: { currentStep: workflow.currentStep, status: workflow.status },
      message: 'Step 8 approved. Now at Step 9: Glossary (Auto-Generated).',
    });
  } catch (error) {
    loggingService.error('Error approving Step 8', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve Step 8',
    });
  }
});

// ============================================================================
// STEP 9: GLOSSARY (AUTO-GENERATED)
// ============================================================================

/**
 * POST /api/v3/workflow/:id/step9
 * Submit Step 9: Generate Glossary (Automatic - No SME Input)
 */
router.post('/:id/step9', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id || (req as any).user?.userId;

    // If queue is available, use background processing
    if (stepQueue) {
      // Check for already-running job
      const existingStatus = await getStepJobStatus(9, id);
      if (existingStatus && ['waiting', 'active', 'delayed'].includes(existingStatus.state)) {
        return res.status(202).json({
          success: true,
          data: { jobId: existingStatus.jobId, status: existingStatus.state, stepNumber: 9 },
          message: 'Step 9 generation already in progress.',
        });
      }

      // Remove old completed/failed job to allow re-submission
      await removeStepJob(9, id);

      const job = await addStepJob(9, id, userId);
      if (!job) {
        return res.status(500).json({ success: false, error: 'Failed to queue job' });
      }

      return res.status(202).json({
        success: true,
        data: { jobId: job.id, status: 'queued', stepNumber: 9 },
        message: 'Step 9 generation queued. Poll status endpoint for updates.',
      });
    }

    // Fallback: synchronous processing (local dev without Redis)
    const workflow = await workflowService.processStep9(id);

    res.json({
      success: true,
      data: {
        step9: workflow.step9,
        currentStep: workflow.currentStep,
        status: workflow.status,
        totalTerms: workflow.step9?.totalTerms,
      },
      message: 'Step 9 complete. Glossary auto-generated. Workflow complete!',
    });
  } catch (error) {
    loggingService.error('Error processing Step 9', { error, workflowId: req.params.id });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process Step 9',
    });
  }
});

/**
 * PUT /api/v3/workflow/:id/step9/term/:termId
 * Edit a specific glossary term
 */
router.put(
  '/:id/step9/term/:termId',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const { id, termId } = req.params;
      const {
        term,
        definition,
        exampleSentence,
        technicalNote,
        relatedTerms,
        broaderTerms,
        narrowerTerms,
        synonyms,
        isAcronym,
        acronymExpansion,
        category,
        priority,
        usedInAssessment,
      } = req.body;

      loggingService.info('Updating glossary term', { workflowId: id, termId, term });

      const workflow = await CurriculumWorkflow.findById(id);
      if (!workflow || !workflow.step9) {
        return res.status(404).json({ success: false, error: 'Workflow or Step 9 not found' });
      }

      // Find the term in the terms array
      const glossaryTerm = workflow.step9.terms?.find((t: any) => t.id === termId);
      if (!glossaryTerm) {
        return res.status(404).json({ success: false, error: 'Glossary term not found' });
      }

      // Update term fields
      if (term !== undefined) glossaryTerm.term = term;
      if (definition !== undefined) {
        glossaryTerm.definition = definition;
        // Recalculate word count
        glossaryTerm.wordCount = definition.split(/\s+/).filter(Boolean).length;
      }
      if (exampleSentence !== undefined) glossaryTerm.exampleSentence = exampleSentence;
      if (technicalNote !== undefined) glossaryTerm.technicalNote = technicalNote;
      if (relatedTerms !== undefined) glossaryTerm.relatedTerms = relatedTerms;
      if (broaderTerms !== undefined) glossaryTerm.broaderTerms = broaderTerms;
      if (narrowerTerms !== undefined) glossaryTerm.narrowerTerms = narrowerTerms;
      if (synonyms !== undefined) glossaryTerm.synonyms = synonyms;
      if (isAcronym !== undefined) glossaryTerm.isAcronym = isAcronym;
      if (acronymExpansion !== undefined) glossaryTerm.acronymExpansion = acronymExpansion;
      if (category !== undefined) glossaryTerm.category = category;
      if (priority !== undefined) glossaryTerm.priority = priority;
      if (usedInAssessment !== undefined) glossaryTerm.usedInAssessment = usedInAssessment;

      // Mark as modified and save
      workflow.markModified('step9');
      await workflow.save();

      loggingService.info('Glossary term updated successfully', { termId, glossaryTerm });

      res.json({
        success: true,
        data: glossaryTerm,
        message: 'Glossary term updated successfully',
      });
    } catch (error) {
      loggingService.error('Error updating glossary term', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to update glossary term',
      });
    }
  }
);

/**
 * POST /api/v3/workflow/:id/step9/approve
 * Approve Step 9 and advance to Step 10
 */
router.post('/:id/step9/approve', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const workflow = await CurriculumWorkflow.findById(req.params.id);

    if (!workflow || !workflow.step9) {
      return res.status(404).json({ success: false, error: 'Workflow or Step 9 not found' });
    }

    if (!workflow.step9.terms || workflow.step9.terms.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'At least 10 glossary terms are required',
      });
    }

    workflow.step9.approvedAt = new Date();
    workflow.step9.approvedBy = userId;

    await workflow.advanceStep();

    res.json({
      success: true,
      data: { currentStep: workflow.currentStep, status: workflow.status },
      message: 'Step 9 approved. Now at Step 10: Lesson Plans & PPT Generation.',
    });
  } catch (error) {
    loggingService.error('Error approving Step 9', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve Step 9',
    });
  }
});

/**
 * POST /api/v3/workflow/:id/step10
 * Submit Step 10: Generate Lesson Plans and PPT Decks
 * This endpoint queues the generation as a background job
 */
router.post('/:id/step10', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id || (req as any).user?.userId;

    loggingService.info('Step 10 generation requested', { workflowId: id });

    // Validate workflow exists and step 9 is complete AND approved
    const existingWorkflow = await CurriculumWorkflow.findById(id);
    if (!existingWorkflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
      });
    }

    if (!existingWorkflow.step9 || existingWorkflow.currentStep < 9) {
      return res.status(400).json({
        success: false,
        error: 'Step 9 must be completed before generating lesson plans',
      });
    }

    // Check if Step 9 is approved (status must be step9_complete or later)
    const validStatuses = [
      'step9_complete',
      'step10_pending',
      'step10_complete',
      'review_pending',
      'published',
    ];
    if (!validStatuses.includes(existingWorkflow.status)) {
      return res.status(400).json({
        success: false,
        error: 'Step 9 must be approved before proceeding to Step 10. Please approve Step 9 first.',
      });
    }

    // Import queue functions
    const { queueAllRemainingModules, getAllStep10Jobs, step10Queue } = await import(
      '../queues/step10Queue'
    );

    // Check if Redis/queue is available
    if (!step10Queue) {
      // Fallback to incremental synchronous generation if queue is not available
      loggingService.warn('Step 10 queue not available, using incremental synchronous generation', {
        workflowId: id,
      });

      const step10CompletedIds = new Set(
        (existingWorkflow.step10?.moduleLessonPlans || []).map((m: any) => m.moduleId)
      );
      const existingModules = step10CompletedIds.size;
      const totalModules = new Set((existingWorkflow.step4?.modules || []).map((m: any) => m.id))
        .size;

      // Check if already complete
      if (existingModules >= totalModules) {
        return res.json({
          success: true,
          data: existingWorkflow.step10,
          message: 'All modules already generated',
        });
      }

      // Generate the next module only (with immediate response and background processing)
      loggingService.info('Starting Step 10 next module generation', {
        workflowId: id,
        moduleNumber: existingModules + 1,
        totalModules,
      });

      // Start generation in background (don't await)
      workflowService
        .processStep10NextModule(id)
        .then((result) => {
          loggingService.info('Step 10 module generation completed successfully', {
            workflowId: id,
            modulesGenerated: new Set(
              (result.step10?.moduleLessonPlans || []).map((m: any) => m.moduleId)
            ).size,
            totalModules,
            moduleJustCompleted: existingModules + 1,
          });
        })
        .catch((err) => {
          loggingService.error('Step 10 module generation failed in background', {
            workflowId: id,
            moduleNumber: existingModules + 1,
            totalModules,
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          });
        });

      // Return immediately with status
      return res.json({
        success: true,
        data: {
          modulesGenerated: existingModules,
          totalModules,
          allComplete: false,
          generationStarted: true,
          message:
            'Generation started in background. Refresh the page in 2-3 minutes to see progress.',
        },
        message: `Module ${existingModules + 1}/${totalModules} generation started. This will take 2-5 minutes. Refresh the page to see progress.`,
      });
    }

    // Check if there are already jobs running
    const existingJobs = await getAllStep10Jobs(id);
    const activeJobs = existingJobs.filter(
      (job) => job && ['waiting', 'active', 'delayed'].includes(job.getState() as any)
    );

    if (activeJobs.length > 0) {
      return res.json({
        success: true,
        data: {
          message: 'Generation already in progress',
          jobsQueued: activeJobs.length,
          modulesGenerated: new Set(
            (existingWorkflow.step10?.moduleLessonPlans || []).map((m: any) => m.moduleId)
          ).size,
          totalModules: new Set((existingWorkflow.step4?.modules || []).map((m: any) => m.id)).size,
        },
        message: 'Step 10 generation is already in progress. Check status for updates.',
      });
    }

    // Queue the remaining modules
    const jobs = await queueAllRemainingModules(id, userId);

    const modulesGenerated = new Set(
      (existingWorkflow.step10?.moduleLessonPlans || []).map((m: any) => m.moduleId)
    ).size;
    const totalModules = new Set((existingWorkflow.step4?.modules || []).map((m: any) => m.id))
      .size;

    loggingService.info('Step 10 jobs queued', {
      workflowId: id,
      jobsQueued: jobs.length,
      modulesGenerated,
      totalModules,
    });

    res.json({
      success: true,
      data: {
        jobsQueued: jobs.length,
        modulesGenerated,
        totalModules,
        estimatedTimeMinutes: (totalModules - modulesGenerated) * 15,
      },
      message: `Step 10 generation started. ${totalModules - modulesGenerated} module(s) will be generated in the background.`,
    });
  } catch (error) {
    loggingService.error('Error queueing Step 10', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      workflowId: req.params.id,
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to queue Step 10 generation',
    });
  }
});

/**
 * POST /api/v3/workflow/:id/step10/next-module
 * Generate the next module in Step 10 (one module at a time)
 * This endpoint generates only the next incomplete module, saves it, and returns immediately
 */
router.post(
  '/:id/step10/next-module',
  validateJWT,
  loadUser,
  extendTimeout(600000), // 10 minutes for a single module
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      loggingService.info('Step 10 next module generation requested', { workflowId: id });

      // Get workflow
      const workflow = await CurriculumWorkflow.findById(id);
      if (!workflow) {
        return res.status(404).json({
          success: false,
          error: 'Workflow not found',
        });
      }

      if (!workflow.step9 || workflow.currentStep < 9) {
        return res.status(400).json({
          success: false,
          error: 'Step 9 must be completed before generating lesson plans',
        });
      }

      // Check how many modules are already generated
      const nmCompletedIds = new Set(
        (workflow.step10?.moduleLessonPlans || []).map((m: any) => m.moduleId)
      );
      const existingModules = nmCompletedIds.size;
      const totalModules = new Set((workflow.step4?.modules || []).map((m: any) => m.id)).size;

      if (existingModules >= totalModules) {
        return res.json({
          success: true,
          data: {
            step10: workflow.step10,
            currentStep: workflow.currentStep,
            status: workflow.status,
            allModulesComplete: true,
          },
          message: 'All modules already generated!',
        });
      }

      loggingService.info('Generating next module', {
        workflowId: id,
        moduleNumber: existingModules + 1,
        totalModules,
      });

      // Generate the next module
      const updatedWorkflow = await workflowService.processStep10NextModule(id);

      const newModulesCount = new Set(
        (updatedWorkflow.step10?.moduleLessonPlans || []).map((m: any) => m.moduleId)
      ).size;
      const allComplete = newModulesCount >= totalModules;

      loggingService.info('Next module generation complete', {
        workflowId: id,
        modulesGenerated: newModulesCount,
        totalModules,
        allComplete,
      });

      res.json({
        success: true,
        data: {
          step10: updatedWorkflow.step10,
          currentStep: updatedWorkflow.currentStep,
          status: updatedWorkflow.status,
          modulesGenerated: newModulesCount,
          totalModules,
          allModulesComplete: allComplete,
        },
        message: allComplete
          ? 'All modules complete!'
          : `Module ${newModulesCount}/${totalModules} generated successfully`,
      });
    } catch (error) {
      loggingService.error('Error generating next module', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        workflowId: req.params.id,
      });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate next module',
      });
    }
  }
);

/**
 * GET /api/v3/workflow/:id/step10/status
 * Get Step 10 generation status (job queue status)
 */
router.get('/:id/step10/status', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get workflow
    const workflow = await CurriculumWorkflow.findById(id);
    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
      });
    }

    // Import queue functions
    const { getAllStep10Jobs } = await import('../queues/step10Queue');

    // Get all jobs for this workflow
    const jobs = await getAllStep10Jobs(id);

    const jobStatuses = await Promise.all(
      jobs.map(async (job) => {
        const state = await job.getState();
        return {
          jobId: job.id,
          moduleIndex: job.data.moduleIndex,
          state,
          progress: job.progress(),
          attemptsMade: job.attemptsMade,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
          failedReason: job.failedReason,
        };
      })
    );

    const modulesGenerated = new Set(
      (workflow.step10?.moduleLessonPlans || []).map((m: any) => m.moduleId)
    ).size;
    const totalModules = new Set((workflow.step4?.modules || []).map((m: any) => m.id)).size;
    const allComplete = modulesGenerated >= totalModules;

    const activeJobs = jobStatuses.filter((j) =>
      ['waiting', 'active', 'delayed'].includes(j.state)
    );
    const completedJobs = jobStatuses.filter((j) => j.state === 'completed');
    const failedJobs = jobStatuses.filter((j) => j.state === 'failed');

    res.json({
      success: true,
      data: {
        workflowId: id,
        modulesGenerated,
        totalModules,
        allComplete,
        totalLessons: workflow.step10?.summary?.totalLessons || 0,
        totalContactHours: workflow.step10?.summary?.totalContactHours || 0,
        jobs: {
          total: jobStatuses.length,
          active: activeJobs.length,
          completed: completedJobs.length,
          failed: failedJobs.length,
          details: jobStatuses,
        },
        status: allComplete
          ? 'complete'
          : activeJobs.length > 0
            ? 'in_progress'
            : failedJobs.length > 0
              ? 'failed'
              : 'pending',
      },
    });
  } catch (error) {
    loggingService.error('Error getting Step 10 status', {
      error: error instanceof Error ? error.message : String(error),
      workflowId: req.params.id,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get Step 10 status',
    });
  }
});

/**
 * GET /api/v3/workflow/:id/step10
 * Retrieve Step 10 data (lesson plans and PPT references)
 */
router.get('/:id/step10', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const workflow = await CurriculumWorkflow.findById(id);
    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
      });
    }

    if (!workflow.step10) {
      return res.status(404).json({
        success: false,
        error: 'Step 10 data not found. Please generate lesson plans first.',
      });
    }

    res.json({
      success: true,
      data: {
        step10: workflow.step10,
        currentStep: workflow.currentStep,
        status: workflow.status,
      },
    });
  } catch (error) {
    loggingService.error('Error retrieving Step 10', { error, workflowId: req.params.id });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retrieve Step 10',
    });
  }
});

/**
 * POST /api/v3/workflow/:id/step10/approve
 * Approve Step 10 (Lesson Plans) and advance to Step 11 (PPT Generation)
 */
router.post('/:id/step10/approve', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    loggingService.info('Approving Step 10', { workflowId: id });

    const workflow = await CurriculumWorkflow.findById(id);
    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
      });
    }

    // Validate Step 10 is complete
    if (!workflow.step10 || !workflow.step10.moduleLessonPlans) {
      return res.status(400).json({
        success: false,
        error: 'Step 10 must be generated before approval',
      });
    }

    const totalModules = new Set((workflow.step4?.modules || []).map((m: any) => m.id)).size;
    const completedModules = new Set(workflow.step10.moduleLessonPlans.map((m: any) => m.moduleId))
      .size;

    if (completedModules < totalModules) {
      return res.status(400).json({
        success: false,
        error: `All modules must be generated before approval. ${completedModules}/${totalModules} modules complete.`,
      });
    }

    // Check if all modules have lessons
    const modulesWithoutLessons = workflow.step10.moduleLessonPlans.filter(
      (m: any) => !m.lessons || m.lessons.length === 0
    );
    if (modulesWithoutLessons.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Some modules have no lessons generated: ${modulesWithoutLessons.map((m: any) => m.moduleCode).join(', ')}`,
      });
    }

    // Mark Step 10 as approved
    workflow.step10.approvedAt = new Date();

    // Update validation
    workflow.step10.validation = {
      allModulesHaveLessonPlans: true,
      allLessonDurationsValid: true,
      totalHoursMatch: true,
      allMLOsCovered: true,
      caseStudiesIntegrated: true,
      assessmentsIntegrated: true,
    };

    // Update workflow status - advance to Step 11
    workflow.currentStep = 11;
    workflow.status = 'step11_pending';

    // Update step progress for Step 10
    const step10Progress = workflow.stepProgress.find((p) => p.step === 10);
    if (step10Progress) {
      step10Progress.completedAt = new Date();
      step10Progress.status = 'approved';
    } else {
      workflow.stepProgress.push({
        step: 10,
        status: 'approved',
        startedAt: workflow.step10.generatedAt || new Date(),
        completedAt: new Date(),
      });
    }

    // Initialize Step 11 progress
    const step11Progress = workflow.stepProgress.find((p) => p.step === 11);
    if (step11Progress) {
      step11Progress.status = 'in_progress';
      step11Progress.startedAt = new Date();
    } else {
      workflow.stepProgress.push({
        step: 11,
        status: 'in_progress',
        startedAt: new Date(),
      });
    }

    workflow.markModified('step10');
    workflow.markModified('stepProgress');
    await workflow.save();

    loggingService.info('Step 10 approved successfully, advancing to Step 11', {
      workflowId: id,
      totalModules: completedModules,
      totalLessons: workflow.step10.summary?.totalLessons || 0,
    });

    res.json({
      success: true,
      data: {
        approvedAt: workflow.step10.approvedAt,
        status: workflow.status,
        currentStep: workflow.currentStep,
        summary: workflow.step10.summary,
      },
      message: 'Step 10 approved! Now at Step 11: PPT Generation.',
    });
  } catch (error) {
    loggingService.error('Error approving Step 10', { error, workflowId: req.params.id });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve Step 10',
    });
  }
});

// ============================================================================
// STEP 11: PPT GENERATION ROUTES (Separated from Step 10 for timeout prevention)
// ============================================================================

/**
 * POST /api/v3/workflow/:id/step11
 * Submit Step 11: Generate PPT decks for all lessons
 * This endpoint queues the generation as a background job
 */
router.post('/:id/step11', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id || (req as any).user?.userId;

    loggingService.info('Step 11 PPT generation requested', { workflowId: id });

    // Validate workflow exists and step 10 is complete AND approved
    const existingWorkflow = await CurriculumWorkflow.findById(id);
    if (!existingWorkflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
      });
    }

    if (!existingWorkflow.step10 || existingWorkflow.currentStep < 10) {
      return res.status(400).json({
        success: false,
        error: 'Step 10 must be completed before generating PPTs',
      });
    }

    // Check if Step 10 is approved
    const validStatuses = [
      'step10_complete',
      'step11_pending',
      'step11_complete',
      'review_pending',
      'published',
    ];
    if (!validStatuses.includes(existingWorkflow.status)) {
      return res.status(400).json({
        success: false,
        error:
          'Step 10 must be approved before proceeding to Step 11. Please approve Step 10 first.',
      });
    }

    // Clear any stale lastError from previous attempts so the frontend doesn't
    // immediately cancel the new generation based on an old error
    if (existingWorkflow.step11?.lastError) {
      existingWorkflow.step11.lastError = undefined;
      existingWorkflow.markModified('step11');
      await existingWorkflow.save();
    }

    // Import queue functions
    const { queueAllRemainingStep11Modules, getAllStep11Jobs, step11Queue } = await import(
      '../queues/step11Queue'
    );

    // Helper: count unique completed modules by matching step10 moduleIds
    const completedModuleIds = new Set(
      (existingWorkflow.step11?.modulePPTDecks || []).map((m: any) => m.moduleId)
    );
    const lessonPlans = existingWorkflow.step10?.moduleLessonPlans || [];

    // Check if Redis/queue is available
    if (!step11Queue) {
      // Fallback to incremental synchronous generation if queue is not available
      loggingService.warn('Step 11 queue not available, using incremental synchronous generation', {
        workflowId: id,
      });

      const totalModules = new Set(lessonPlans.map((m: any) => m.moduleId)).size;
      const existingModules = completedModuleIds.size;

      // Check if already complete
      if (existingModules >= totalModules) {
        return res.json({
          success: true,
          data: existingWorkflow.step11,
          message: 'All PPT decks already generated',
        });
      }

      // Generate the next module only (with immediate response and background processing)
      loggingService.info('Starting Step 11 next module PPT generation', {
        workflowId: id,
        moduleNumber: existingModules + 1,
        totalModules,
      });

      // Start generation in background (don't await)
      workflowService
        .processStep11NextModule(id)
        .then((result) => {
          loggingService.info('Step 11 module PPT generation completed successfully', {
            workflowId: id,
            modulesGenerated: new Set(
              (result.step11?.modulePPTDecks || []).map((m: any) => m.moduleId)
            ).size,
            totalModules,
            moduleJustCompleted: existingModules + 1,
          });
        })
        .catch(async (err) => {
          loggingService.error('Step 11 module PPT generation failed in background', {
            workflowId: id,
            moduleNumber: existingModules + 1,
            totalModules,
            error: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : undefined,
          });
          // Persist error to workflow document so frontend can detect it
          try {
            const errorWorkflow = await CurriculumWorkflow.findById(id);
            if (errorWorkflow) {
              if (!errorWorkflow.step11) {
                errorWorkflow.step11 = {
                  modulePPTDecks: [],
                  validation: {
                    allLessonsHavePPTs: false,
                    allSlideCountsValid: false,
                    allMLOsCovered: false,
                    allCitationsValid: false,
                  },
                  summary: { totalPPTDecks: 0, totalSlides: 0, averageSlidesPerLesson: 0 },
                  generatedAt: new Date(),
                };
              }
              errorWorkflow.step11.lastError = {
                message: err instanceof Error ? err.message : String(err),
                moduleIndex: existingModules,
                timestamp: new Date(),
              };
              errorWorkflow.markModified('step11');
              await errorWorkflow.save();
            }
          } catch (dbErr) {
            loggingService.error('Failed to persist Step 11 error', {
              error: dbErr instanceof Error ? dbErr.message : String(dbErr),
            });
          }
        });

      // Return immediately with status
      return res.json({
        success: true,
        data: {
          modulesGenerated: existingModules,
          totalModules,
          moduleBeingGenerated: existingModules + 1,
          estimatedTimeMinutes: 15,
        },
        message: `Step 11 PPT generation started for module ${existingModules + 1} of ${totalModules}. Check status endpoint for progress.`,
      });
    }

    // Check if jobs are already in progress, and clean up stale completed/failed ones
    const existingJobs = await getAllStep11Jobs(id);
    const jobStates = await Promise.all(
      existingJobs.map(async (job: any) => ({
        job,
        state: await job.getState(),
      }))
    );

    // Remove stale completed/failed jobs to prevent interference
    const staleJobs = jobStates.filter(({ state }) => ['completed', 'failed'].includes(state));
    for (const { job: staleJob } of staleJobs) {
      try {
        await staleJob.remove();
      } catch (_e) {
        // Ignore removal errors for already-removed jobs
      }
    }

    const activeJobs = jobStates.filter(({ state }) =>
      ['waiting', 'active', 'delayed'].includes(state)
    );

    if (activeJobs.length > 0) {
      return res.json({
        success: true,
        data: {
          message: 'PPT generation already in progress',
          jobsQueued: activeJobs.length,
          modulesGenerated: completedModuleIds.size,
          totalModules: lessonPlans.length,
        },
        message: 'Step 11 PPT generation is already in progress. Check status for updates.',
      });
    }

    // Queue the remaining modules
    const jobs = await queueAllRemainingStep11Modules(id, userId);

    const modulesGenerated = completedModuleIds.size;
    const totalModules = new Set(lessonPlans.map((m: any) => m.moduleId)).size;

    loggingService.info('Step 11 jobs queued', {
      workflowId: id,
      jobsQueued: jobs.length,
      modulesGenerated,
      totalModules,
    });

    res.json({
      success: true,
      data: {
        jobsQueued: jobs.length,
        modulesGenerated,
        totalModules,
        estimatedTimeMinutes: (totalModules - modulesGenerated) * 10,
      },
      message: `Step 11 PPT generation started. ${totalModules - modulesGenerated} module(s) will be generated in the background.`,
    });
  } catch (error) {
    loggingService.error('Error queueing Step 11', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      workflowId: req.params.id,
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to queue Step 11 PPT generation',
    });
  }
});

/**
 * POST /api/v3/workflow/:id/step11/next-module
 * Generate PPT for the next module in Step 11 (one module at a time)
 */
router.post(
  '/:id/step11/next-module',
  validateJWT,
  loadUser,
  extendTimeout(600000), // 10 minutes for a single module
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      loggingService.info('Step 11 next module PPT generation requested', { workflowId: id });

      // Get workflow
      const workflow = await CurriculumWorkflow.findById(id);
      if (!workflow) {
        return res.status(404).json({
          success: false,
          error: 'Workflow not found',
        });
      }

      if (!workflow.step10 || workflow.currentStep < 10) {
        return res.status(400).json({
          success: false,
          error: 'Step 10 must be completed before generating PPTs',
        });
      }

      // Check how many modules are already generated (unique count)
      const nextModuleLessonPlans = workflow.step10?.moduleLessonPlans || [];
      const totalModules = new Set(nextModuleLessonPlans.map((m: any) => m.moduleId)).size;
      const nextModuleCompletedIds = new Set(
        (workflow.step11?.modulePPTDecks || []).map((m: any) => m.moduleId)
      );
      const existingModules = nextModuleCompletedIds.size;

      if (existingModules >= totalModules) {
        return res.json({
          success: true,
          data: {
            step11: workflow.step11,
            currentStep: workflow.currentStep,
            status: workflow.status,
            allModulesComplete: true,
          },
          message: 'All PPT decks already generated!',
        });
      }

      loggingService.info('Generating next module PPT', {
        workflowId: id,
        moduleNumber: existingModules + 1,
        totalModules,
      });

      // Generate the next module PPT
      const updatedWorkflow = await workflowService.processStep11NextModule(id);

      const newCompletedIds = new Set(
        (updatedWorkflow.step11?.modulePPTDecks || []).map((m: any) => m.moduleId)
      );
      const newModulesCount = newCompletedIds.size;
      const allComplete = newModulesCount >= totalModules;

      loggingService.info('Next module PPT generation complete', {
        workflowId: id,
        modulesGenerated: newModulesCount,
        totalModules,
        allComplete,
      });

      res.json({
        success: true,
        data: {
          step11: updatedWorkflow.step11,
          currentStep: updatedWorkflow.currentStep,
          status: updatedWorkflow.status,
          modulesGenerated: newModulesCount,
          totalModules,
          allModulesComplete: allComplete,
        },
        message: allComplete
          ? 'All PPT decks complete!'
          : `PPT for module ${newModulesCount}/${totalModules} generated successfully`,
      });
    } catch (error) {
      loggingService.error('Error generating next module PPT', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        workflowId: req.params.id,
      });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate next module PPT',
      });
    }
  }
);

/**
 * GET /api/v3/workflow/:id/step11/status
 * Get Step 11 PPT generation status
 */
router.get('/:id/step11/status', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Get workflow
    const workflow = await CurriculumWorkflow.findById(id);
    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
      });
    }

    // Import queue functions
    const { getAllStep11Jobs } = await import('../queues/step11Queue');

    // Get all jobs for this workflow
    const jobs = await getAllStep11Jobs(id);

    const jobStatuses = await Promise.all(
      jobs.map(async (job) => {
        const state = await job.getState();
        return {
          jobId: job.id,
          moduleIndex: job.data.moduleIndex,
          state,
          progress: job.progress(),
          attemptsMade: job.attemptsMade,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
          failedReason: job.failedReason,
        };
      })
    );

    const statusLessonPlans = workflow.step10?.moduleLessonPlans || [];
    const totalModules = new Set(statusLessonPlans.map((m: any) => m.moduleId)).size;
    const statusCompletedIds = new Set(
      (workflow.step11?.modulePPTDecks || []).map((m: any) => m.moduleId)
    );
    const modulesGenerated = statusCompletedIds.size;
    const allComplete = modulesGenerated >= totalModules;

    const activeJobs = jobStatuses.filter((j) =>
      ['waiting', 'active', 'delayed'].includes(j.state)
    );
    const completedJobs = jobStatuses.filter((j) => j.state === 'completed');
    const failedJobs = jobStatuses.filter((j) => j.state === 'failed');

    res.json({
      success: true,
      data: {
        workflowId: id,
        modulesGenerated,
        totalModules,
        allComplete,
        progressPercent: totalModules > 0 ? Math.round((modulesGenerated / totalModules) * 100) : 0,
        jobs: {
          active: activeJobs.length,
          completed: completedJobs.length,
          failed: failedJobs.length,
          details: jobStatuses,
        },
        step11Summary: workflow.step11?.summary || null,
        status: workflow.status,
        currentStep: workflow.currentStep,
      },
    });
  } catch (error) {
    loggingService.error('Error getting Step 11 status', {
      error: error instanceof Error ? error.message : String(error),
      workflowId: req.params.id,
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get Step 11 status',
    });
  }
});

/**
 * POST /api/v3/workflow/:id/step11/approve
 * Approve Step 11 and mark workflow as ready for final review
 */
router.post('/:id/step11/approve', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    loggingService.info('Approving Step 11', { workflowId: id });

    const workflow = await CurriculumWorkflow.findById(id);
    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
      });
    }

    // Validate Step 11 is complete
    if (!workflow.step11 || !workflow.step11.modulePPTDecks) {
      return res.status(400).json({
        success: false,
        error: 'Step 11 must be generated before approval',
      });
    }

    const totalModules = new Set(
      (workflow.step10?.moduleLessonPlans || []).map((m: any) => m.moduleId)
    ).size;
    const completedModules = new Set(workflow.step11.modulePPTDecks.map((m: any) => m.moduleId))
      .size;

    if (completedModules < totalModules) {
      return res.status(400).json({
        success: false,
        error: `All module PPTs must be generated before approval. ${completedModules}/${totalModules} modules complete.`,
      });
    }

    // Mark Step 11 as approved
    workflow.step11.approvedAt = new Date();

    // Update validation
    workflow.step11.validation = {
      allLessonsHavePPTs: true,
      allSlideCountsValid: true,
      allMLOsCovered: true,
      allCitationsValid: true,
    };

    // Update workflow status — advance to Step 12
    workflow.currentStep = 12;
    workflow.status = 'step12_pending';

    // Update step progress
    const step11Progress = workflow.stepProgress.find((p) => p.step === 11);
    if (step11Progress) {
      step11Progress.completedAt = new Date();
      step11Progress.status = 'approved';
    } else {
      workflow.stepProgress.push({
        step: 11,
        status: 'approved',
        startedAt: workflow.step11.generatedAt || new Date(),
        completedAt: new Date(),
      });
    }

    // Initialize Step 12 progress
    const step12Progress = workflow.stepProgress.find((p) => p.step === 12);
    if (step12Progress) {
      step12Progress.status = 'in_progress';
      step12Progress.startedAt = new Date();
    } else {
      workflow.stepProgress.push({
        step: 12,
        status: 'in_progress',
        startedAt: new Date(),
      });
    }

    workflow.markModified('step11');
    workflow.markModified('stepProgress');
    await workflow.save();

    loggingService.info('Step 11 approved successfully, advancing to Step 12', {
      workflowId: id,
      totalModules: completedModules,
      totalPPTDecks: workflow.step11.summary?.totalPPTDecks || 0,
    });

    res.json({
      success: true,
      data: {
        approvedAt: workflow.step11.approvedAt,
        status: workflow.status,
        currentStep: workflow.currentStep,
        summary: workflow.step11.summary,
      },
      message: 'Step 11 approved! Now at Step 12: Assignment Packs.',
    });
  } catch (error) {
    loggingService.error('Error approving Step 11', { error, workflowId: req.params.id });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve Step 11',
    });
  }
});

// ============================================================================
// STEP 12: ASSIGNMENT PACKS ROUTES
// ============================================================================

/**
 * POST /api/v3/workflow/:id/step12
 * Submit Step 12: Generate Assignment Packs for all modules (3 delivery variants each)
 */
router.post('/:id/step12', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id || (req as any).user?.userId;

    loggingService.info('Step 12 Assignment Pack generation requested', { workflowId: id });

    const existingWorkflow = await CurriculumWorkflow.findById(id);
    if (!existingWorkflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    if (!existingWorkflow.step11 || existingWorkflow.currentStep < 11) {
      return res.status(400).json({
        success: false,
        error: 'Step 11 must be completed before generating assignment packs',
      });
    }

    // Try background queue first
    try {
      const { queueAllRemainingStep12Modules } = await import('../queues/step12Queue');
      const jobs = await queueAllRemainingStep12Modules(id, userId);

      if (jobs.length > 0) {
        loggingService.info('Step 12 jobs queued', { workflowId: id, jobCount: jobs.length });

        return res.status(202).json({
          success: true,
          data: {
            jobId: String(jobs[0].id),
            status: 'queued',
            message: 'Assignment pack generation started in background',
          },
        });
      }
    } catch (queueError) {
      loggingService.warn('Step 12 queue unavailable, falling back to sync', {
        error: queueError instanceof Error ? queueError.message : String(queueError),
      });
    }

    // Sync fallback
    const updatedWorkflow = await workflowService.processStep12NextModule(id);
    res.json({
      success: true,
      data: updatedWorkflow.step12,
    });
  } catch (error) {
    loggingService.error('Error processing Step 12', { error, workflowId: req.params.id });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process Step 12',
    });
  }
});

/**
 * POST /api/v3/workflow/:id/step12/next-module
 * Generate assignment packs for the next module
 */
router.post(
  '/:id/step12/next-module',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id || (req as any).user?.userId;

      // Try background queue first
      try {
        const { queueAllRemainingStep12Modules } = await import('../queues/step12Queue');
        const jobs = await queueAllRemainingStep12Modules(id, userId);

        if (jobs.length > 0) {
          return res.status(202).json({
            success: true,
            data: {
              jobId: String(jobs[0].id),
              status: 'queued',
              message: 'Next module assignment pack generation started',
            },
          });
        }
      } catch (queueError) {
        loggingService.warn('Step 12 queue unavailable, falling back to sync');
      }

      // Sync fallback
      const updatedWorkflow = await workflowService.processStep12NextModule(id);
      res.json({
        success: true,
        data: updatedWorkflow.step12,
      });
    } catch (error) {
      loggingService.error('Error processing Step 12 next module', {
        error,
        workflowId: req.params.id,
      });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate next module',
      });
    }
  }
);

/**
 * GET /api/v3/workflow/:id/step12/status
 * Get Step 12 generation status
 */
router.get('/:id/step12/status', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const workflow = await CurriculumWorkflow.findById(id);

    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    const totalModules = new Set((workflow.step4?.modules || []).map((m: any) => m.id)).size;
    const completedModules = new Set(
      (workflow.step12?.moduleAssignmentPacks || []).map((m: any) => m.moduleId)
    ).size;

    // Check queue status
    let queueStatus = null;
    try {
      const { getAllStep12Jobs } = await import('../queues/step12Queue');
      const jobs = await getAllStep12Jobs(id);
      if (jobs.length > 0) {
        const latestJob = jobs[jobs.length - 1];
        const state = await latestJob.getState();
        queueStatus = {
          jobId: String(latestJob.id),
          state,
          progress: latestJob.progress(),
          moduleIndex: latestJob.data.moduleIndex,
        };
      }
    } catch {
      // Queue not available
    }

    res.json({
      success: true,
      data: {
        totalModules,
        completedModules,
        allComplete: completedModules >= totalModules,
        totalAssignmentPacks: completedModules * 3,
        queueStatus,
        step12Data: workflow.step12
          ? {
              summary: workflow.step12.summary,
              validation: workflow.step12.validation,
            }
          : null,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get status',
    });
  }
});

/**
 * POST /api/v3/workflow/:id/step12/approve
 * Approve Step 12 and advance to Step 13
 */
router.post('/:id/step12/approve', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    loggingService.info('Approving Step 12', { workflowId: id });

    const workflow = await CurriculumWorkflow.findById(id);
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    if (!workflow.step12 || !workflow.step12.moduleAssignmentPacks) {
      return res.status(400).json({
        success: false,
        error: 'Step 12 must be generated before approval',
      });
    }

    const totalModules = new Set((workflow.step4?.modules || []).map((m: any) => m.id)).size;
    const completedModules = new Set(
      workflow.step12.moduleAssignmentPacks.map((m: any) => m.moduleId)
    ).size;

    if (completedModules < totalModules) {
      return res.status(400).json({
        success: false,
        error: `All module assignment packs must be generated before approval. ${completedModules}/${totalModules} modules complete.`,
      });
    }

    workflow.step12.approvedAt = new Date();

    // Advance to Step 13
    workflow.currentStep = 13;
    workflow.status = 'step13_pending';

    const step12Progress = workflow.stepProgress.find((p) => p.step === 12);
    if (step12Progress) {
      step12Progress.completedAt = new Date();
      step12Progress.status = 'approved';
    }

    // Initialize Step 13 progress
    const step13Progress = workflow.stepProgress.find((p) => p.step === 13);
    if (step13Progress) {
      step13Progress.status = 'in_progress';
      step13Progress.startedAt = new Date();
    }

    workflow.markModified('step12');
    workflow.markModified('stepProgress');
    await workflow.save();

    loggingService.info('Step 12 approved, advancing to Step 13', {
      workflowId: id,
      totalModules: completedModules,
    });

    res.json({
      success: true,
      data: {
        approvedAt: workflow.step12.approvedAt,
        status: workflow.status,
        currentStep: workflow.currentStep,
        summary: workflow.step12.summary,
      },
      message: 'Step 12 approved! Now at Step 13: Summative Exam.',
    });
  } catch (error) {
    loggingService.error('Error approving Step 12', { error, workflowId: req.params.id });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve Step 12',
    });
  }
});

// ============================================================================
// STEP 13: SUMMATIVE EXAM ROUTES
// ============================================================================

/**
 * POST /api/v3/workflow/:id/step13
 * Submit Step 13: Generate Summative Exam Package
 */
router.post('/:id/step13', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id || (req as any).user?.userId;

    loggingService.info('Step 13 Summative Exam generation requested', { workflowId: id });

    const existingWorkflow = await CurriculumWorkflow.findById(id);
    if (!existingWorkflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    if (!existingWorkflow.step12 || existingWorkflow.currentStep < 12) {
      return res.status(400).json({
        success: false,
        error: 'Step 12 must be completed before generating summative exam',
      });
    }

    // Try background queue (generic stepQueue)
    try {
      const { addStepJob, removeStepJob, stepQueue } = await import('../queues/stepQueue');
      if (stepQueue) {
        // Remove old completed/failed job so we can re-submit with the same jobId
        await removeStepJob(13, id);
        const job = await addStepJob(13, id, userId);
        if (job) {
          return res.status(202).json({
            success: true,
            data: {
              jobId: String(job.id),
              status: 'queued',
              message: 'Summative exam generation started in background',
            },
          });
        }
      }
    } catch (queueError) {
      loggingService.warn('Step 13 queue unavailable, falling back to sync');
    }

    // Sync fallback
    const updatedWorkflow = await workflowService.processStep13(id);
    res.json({
      success: true,
      data: updatedWorkflow.step13,
    });
  } catch (error) {
    loggingService.error('Error processing Step 13', { error, workflowId: req.params.id });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process Step 13',
    });
  }
});

/**
 * POST /api/v3/workflow/:id/step13/approve
 * Approve Step 13 — workflow is now complete
 */
router.post('/:id/step13/approve', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    loggingService.info('Approving Step 13', { workflowId: id });

    const workflow = await CurriculumWorkflow.findById(id);
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    if (!workflow.step13) {
      return res.status(400).json({
        success: false,
        error: 'Step 13 must be generated before approval',
      });
    }

    workflow.step13.approvedAt = new Date();

    workflow.currentStep = 13;
    workflow.status = 'step13_complete';

    const step13Progress = workflow.stepProgress.find((p) => p.step === 13);
    if (step13Progress) {
      step13Progress.completedAt = new Date();
      step13Progress.status = 'approved';
    }

    workflow.markModified('step13');
    workflow.markModified('stepProgress');
    await workflow.save();

    loggingService.info('Step 13 approved', {
      workflowId: id,
      totalQuestions: workflow.step13.summary?.totalQuestions || 0,
    });

    res.json({
      success: true,
      data: {
        approvedAt: workflow.step13.approvedAt,
        status: workflow.status,
        currentStep: workflow.currentStep,
        summary: workflow.step13.summary,
      },
      message: 'Step 13 approved! Curriculum is ready for final review and publication.',
    });
  } catch (error) {
    loggingService.error('Error approving Step 13', { error, workflowId: req.params.id });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to approve Step 13',
    });
  }
});

/**
 * POST /api/v3/workflow/:id/complete
 * Mark workflow as complete and ready for final review
 */
router.post('/:id/complete', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || (req as any).user?.userId;
    const workflow = await CurriculumWorkflow.findById(req.params.id);

    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    if (
      workflow.currentStep < 13 ||
      !workflow.step12 ||
      !workflow.step12.moduleAssignmentPacks ||
      workflow.step12.moduleAssignmentPacks.length === 0 ||
      !workflow.step13
    ) {
      return res.status(400).json({
        success: false,
        error:
          'All 13 steps must be completed first, including assignment packs and summative exam',
      });
    }

    workflow.status = 'review_pending';
    workflow.completedAt = new Date();

    // Calculate total time
    const startTime = workflow.stepProgress.find((p) => p.step === 1)?.startedAt;
    if (startTime) {
      workflow.totalTimeSpentMinutes = Math.round(
        (workflow.completedAt.getTime() - startTime.getTime()) / 60000
      );
    }

    await workflow.save();

    res.json({
      success: true,
      data: {
        status: workflow.status,
        completedAt: workflow.completedAt,
        totalTimeSpentMinutes: workflow.totalTimeSpentMinutes,
      },
      message: 'Workflow complete! Ready for final review and publication.',
    });
  } catch (error) {
    loggingService.error('Error completing workflow', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete workflow',
    });
  }
});

// ============================================================================
// EXPORT & DELIVERABLES
// ============================================================================

/**
 * GET /api/v3/workflow/:id/export
 * Export complete curriculum package
 */
router.get('/:id/export', async (req: Request, res: Response) => {
  try {
    const workflow = await CurriculumWorkflow.findById(req.params.id);

    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    if (
      workflow.status !== 'step9_complete' &&
      workflow.status !== 'review_pending' &&
      workflow.status !== 'published'
    ) {
      return res.status(400).json({
        success: false,
        error: 'Workflow must be complete before export',
      });
    }

    // Compile full export package
    const exportPackage = {
      programSpecification: {
        ...workflow.step1,
        creditEquivalencies: calculateCreditEquivalencies(workflow.step1?.creditFramework),
      },
      competencyFramework: workflow.step2,
      programLearningOutcomes: workflow.step3,
      courseFramework: workflow.step4,
      sources: workflow.step5,
      readingLists: workflow.step6,
      assessments: workflow.step7,
      caseStudies: workflow.step8,
      glossary: workflow.step9,
      metadata: {
        workflowId: workflow._id,
        projectName: workflow.projectName,
        createdAt: workflow.createdAt,
        completedAt: workflow.completedAt,
        totalTimeMinutes: workflow.totalTimeSpentMinutes,
      },
    };

    res.json({
      success: true,
      data: exportPackage,
    });
  } catch (error) {
    loggingService.error('Error exporting workflow', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to export workflow',
    });
  }
});

/**
 * GET /api/v3/workflow/:id/export/word
 * Export curriculum as Word document (.docx)
 */
router.get('/:id/export/word', async (req: Request, res: Response) => {
  try {
    const workflow = await CurriculumWorkflow.findById(req.params.id);

    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    // Allow export even if not fully complete (for preview purposes)
    const workflowData = {
      projectName: workflow.projectName,
      step1: workflow.step1,
      step2: workflow.step2,
      step3: workflow.step3,
      step4: workflow.step4,
      step5: workflow.step5,
      step6: workflow.step6,
      step7: workflow.step7,
      step8: workflow.step8,
      step9: workflow.step9,
      step10: workflow.step10,
      step11: workflow.step11,
      step12: workflow.step12,
      step13: workflow.step13,
      createdAt: workflow.createdAt?.toISOString(),
      updatedAt: workflow.updatedAt?.toISOString(),
    };

    const buffer = await wordExportService.generateDocument(workflowData);

    // Generate filename
    const filename = `${workflow.projectName?.replace(/[^a-zA-Z0-9]/g, '-') || 'curriculum'}-${new Date().toISOString().split('T')[0]}.docx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    res.send(buffer);

    loggingService.info('Word document exported', {
      workflowId: workflow._id,
      filename,
    });
  } catch (error) {
    loggingService.error('Error exporting Word document', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to export Word document',
    });
  }
});

/**
 * GET /api/v3/workflow/:id/export/pdf
 * Export curriculum as PDF document
 */
router.get('/:id/export/pdf', async (req: Request, res: Response) => {
  try {
    const workflow = await CurriculumWorkflow.findById(req.params.id);

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
      });
    }

    loggingService.info('Generating PDF export', {
      workflowId: workflow._id,
      projectName: workflow.projectName,
    });

    // First generate Word document
    const workflowData = {
      projectName: workflow.projectName,
      step1: workflow.step1,
      step2: workflow.step2,
      step3: workflow.step3,
      step4: workflow.step4,
      step5: workflow.step5,
      step6: workflow.step6,
      step7: workflow.step7,
      step8: workflow.step8,
      step9: workflow.step9,
      step10: workflow.step10,
      step11: workflow.step11,
      step12: workflow.step12,
      step13: workflow.step13,
      createdAt: workflow.createdAt?.toISOString(),
      updatedAt: workflow.updatedAt?.toISOString(),
    };

    const wordBuffer = await wordExportService.generateDocument(workflowData);

    // Convert Word to PDF using libre-office or similar
    // For now, we'll use a simple approach: convert via docx-pdf library
    const convertAsync = promisify(libreofficeConvert.convert);

    const pdfBuffer = await convertAsync(wordBuffer, '.pdf', undefined);

    // Generate filename
    const filename = `${workflow.projectName?.replace(/[^a-zA-Z0-9]/g, '-') || 'curriculum'}-${new Date().toISOString().split('T')[0]}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.send(pdfBuffer);

    loggingService.info('PDF document exported', {
      workflowId: workflow._id,
      filename,
    });
  } catch (error) {
    loggingService.error('Error exporting PDF document', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to export PDF document. LibreOffice conversion may not be available.',
      fallback:
        'Please use Word export and convert manually, or install LibreOffice for PDF conversion.',
    });
  }
});

/**
 * POST /api/v3/workflow/:id/export/scorm
 * Export curriculum as SCORM package
 */
router.post('/:id/export/scorm', async (req: Request, res: Response) => {
  try {
    const workflow = await CurriculumWorkflow.findById(req.params.id);

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
      });
    }

    loggingService.info('Generating SCORM package', {
      workflowId: workflow._id,
      projectName: workflow.projectName,
    });

    const zip = new JSZip();

    // SCORM 1.2 manifest
    const manifest = `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="curriculum_${workflow._id}" version="1.0"
          xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
          xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                              http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd
                              http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="curriculum_org">
    <organization identifier="curriculum_org">
      <title>${workflow.projectName || 'Curriculum'}</title>
      ${
        workflow.step4?.modules
          ?.map(
            (module: any, idx: number) => `
      <item identifier="module_${idx + 1}" identifierref="resource_module_${idx + 1}">
        <title>${module.moduleCode}: ${module.title}</title>
      </item>`
          )
          .join('') || ''
      }
    </organization>
  </organizations>
  <resources>
    ${
      workflow.step4?.modules
        ?.map(
          (module: any, idx: number) => `
    <resource identifier="resource_module_${idx + 1}" type="webcontent" adlcp:scormtype="sco" href="module_${idx + 1}/index.html">
      <file href="module_${idx + 1}/index.html"/>
    </resource>`
        )
        .join('') || ''
    }
  </resources>
</manifest>`;

    zip.file('imsmanifest.xml', manifest);

    // Create HTML content for each module
    if (workflow.step4?.modules) {
      for (let i = 0; i < workflow.step4.modules.length; i++) {
        const module = workflow.step4.modules[i];
        const moduleLessonPlan = workflow.step10?.moduleLessonPlans?.find(
          (mlp: any) => mlp.moduleId === module.id
        );

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${module.moduleCode}: ${module.title}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #1F4788; }
    h2 { color: #4A90E2; margin-top: 30px; }
    .lesson { background: #f5f5f5; padding: 15px; margin: 15px 0; border-radius: 8px; }
    .objective { margin: 10px 0; padding-left: 20px; }
  </style>
</head>
<body>
  <h1>${module.moduleCode}: ${module.title}</h1>
  <p>${module.description || ''}</p>
  
  <h2>Module Learning Outcomes</h2>
  <ul>
    ${module.mlos?.map((mlo: any) => `<li>${mlo.statement} [${mlo.bloomLevel}]</li>`).join('') || ''}
  </ul>
  
  ${
    moduleLessonPlan
      ? `
  <h2>Lessons</h2>
  ${
    moduleLessonPlan.lessons
      ?.map(
        (lesson: any) => `
    <div class="lesson">
      <h3>Lesson ${lesson.lessonNumber}: ${lesson.lessonTitle}</h3>
      <p><strong>Duration:</strong> ${lesson.duration} minutes | <strong>Bloom Level:</strong> ${lesson.bloomLevel}</p>
      <h4>Learning Objectives:</h4>
      <ul>
        ${lesson.objectives?.map((obj: string) => `<li>${obj}</li>`).join('') || ''}
      </ul>
      <h4>Activities:</h4>
      <ul>
        ${lesson.activities?.map((act: any) => `<li><strong>${act.title}</strong> (${act.duration} min): ${act.description}</li>`).join('') || ''}
      </ul>
    </div>
  `
      )
      .join('') || ''
  }
  `
      : ''
  }
  
  <script src="../scorm_api.js"></script>
  <script>
    // SCORM API initialization
    if (typeof API !== 'undefined') {
      API.LMSInitialize("");
      API.LMSSetValue("cmi.core.lesson_status", "completed");
      API.LMSCommit("");
      API.LMSFinish("");
    }
  </script>
</body>
</html>`;

        zip.folder(`module_${i + 1}`)?.file('index.html', html);
      }
    }

    // Add SCORM API wrapper
    const scormAPI = `
var API = {
  LMSInitialize: function(param) { return "true"; },
  LMSFinish: function(param) { return "true"; },
  LMSGetValue: function(element) { return ""; },
  LMSSetValue: function(element, value) { return "true"; },
  LMSCommit: function(param) { return "true"; },
  LMSGetLastError: function() { return "0"; },
  LMSGetErrorString: function(errorCode) { return "No error"; },
  LMSGetDiagnostic: function(errorCode) { return "No error"; }
};`;

    zip.file('scorm_api.js', scormAPI);

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // Generate filename
    const filename = `${workflow.projectName?.replace(/[^a-zA-Z0-9]/g, '-') || 'curriculum'}-SCORM-${new Date().toISOString().split('T')[0]}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', zipBuffer.length);

    res.send(zipBuffer);

    loggingService.info('SCORM package exported', {
      workflowId: workflow._id,
      filename,
      moduleCount: workflow.step4?.modules?.length || 0,
    });
  } catch (error) {
    loggingService.error('Error exporting SCORM package', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to export SCORM package',
    });
  }
});

/**
 * PUT /api/v3/workflow/:id/step10/lesson/:lessonId
 * Edit a specific lesson plan
 */
router.put(
  '/:id/step10/lesson/:lessonId',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const { id, lessonId } = req.params;
      const {
        lessonTitle,
        duration,
        objectives,
        activities,
        instructorNotes,
        independentStudy,
        formativeChecks,
      } = req.body;

      loggingService.info('Updating lesson plan', { workflowId: id, lessonId, lessonTitle });

      const workflow = await CurriculumWorkflow.findById(id);
      if (!workflow || !workflow.step10) {
        return res.status(404).json({ success: false, error: 'Workflow or Step 10 not found' });
      }

      // Find the lesson in the moduleLessonPlans
      let foundLesson: any = null;
      let foundModule: any = null;

      for (const module of workflow.step10.moduleLessonPlans || []) {
        const lesson = module.lessons?.find((l: any) => l.lessonId === lessonId);
        if (lesson) {
          foundLesson = lesson;
          foundModule = module;
          break;
        }
      }

      if (!foundLesson) {
        return res.status(404).json({ success: false, error: 'Lesson not found' });
      }

      // Update lesson fields
      if (lessonTitle !== undefined) foundLesson.lessonTitle = lessonTitle;
      if (duration !== undefined) foundLesson.duration = duration;
      if (objectives !== undefined) foundLesson.objectives = objectives;
      if (activities !== undefined) foundLesson.activities = activities;
      if (instructorNotes !== undefined) foundLesson.instructorNotes = instructorNotes;
      if (independentStudy !== undefined) foundLesson.independentStudy = independentStudy;
      if (formativeChecks !== undefined) foundLesson.formativeChecks = formativeChecks;

      // Recalculate module totals if duration changed
      if (duration !== undefined && foundModule) {
        foundModule.totalContactHours = foundModule.lessons.reduce(
          (sum: number, l: any) => sum + l.duration / 60,
          0
        );
      }

      // Recalculate summary if needed
      if (workflow.step10.summary && duration !== undefined) {
        workflow.step10.summary.totalContactHours = workflow.step10.moduleLessonPlans.reduce(
          (sum: number, m: any) => sum + m.totalContactHours,
          0
        );
      }

      // Mark as modified and save
      workflow.markModified('step10');
      await workflow.save();

      loggingService.info('Lesson plan updated successfully', { lessonId, foundLesson });

      res.json({
        success: true,
        data: foundLesson,
        message: 'Lesson plan updated successfully',
      });
    } catch (error) {
      loggingService.error('Error updating lesson plan', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to update lesson plan',
      });
    }
  }
);

/**
 * POST /api/v3/workflow/:id/regenerate-lesson
 * Regenerate a specific lesson
 */
router.post(
  '/:id/regenerate-lesson',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const { moduleId, lessonId } = req.body;

      if (!moduleId || !lessonId) {
        return res.status(400).json({
          success: false,
          error: 'moduleId and lessonId are required',
        });
      }

      const workflow = await CurriculumWorkflow.findById(req.params.id);
      if (!workflow || !workflow.step10) {
        return res.status(404).json({
          success: false,
          error: 'Workflow or Step 10 data not found',
        });
      }

      // Find the module and lesson
      const moduleIndex = workflow.step10.moduleLessonPlans?.findIndex(
        (m) => m.moduleId === moduleId
      );
      if (moduleIndex === undefined || moduleIndex === -1) {
        return res.status(404).json({
          success: false,
          error: 'Module not found',
        });
      }

      const module = workflow.step10.moduleLessonPlans[moduleIndex];
      const lessonIndex = module.lessons.findIndex((l) => l.lessonId === lessonId);
      if (lessonIndex === -1) {
        return res.status(404).json({
          success: false,
          error: 'Lesson not found',
        });
      }

      const oldLesson = module.lessons[lessonIndex];

      loggingService.info('🔄 Regenerating lesson', {
        workflowId: req.params.id,
        moduleId,
        lessonId,
        lessonNumber: oldLesson.lessonNumber,
        lessonTitle: oldLesson.lessonTitle,
      });

      // Get module data from step4
      const step4Module = workflow.step4?.modules?.find((m: any) => m.id === moduleId);
      if (!step4Module) {
        return res.status(404).json({
          success: false,
          error: 'Module not found in Step 4',
        });
      }

      // Regenerate the lesson using the lesson plan service
      const newLesson = await lessonPlanService.generateSingleLesson(
        step4Module,
        oldLesson.lessonNumber,
        {
          programTitle: workflow.step1?.programTitle || '',
          deliveryMode: workflow.step1?.delivery?.mode || 'hybrid_blended',
          plos: workflow.step3?.outcomes || [],
          sources: workflow.step5?.sourcesByModule?.[moduleId] || [],
          readings:
            workflow.step6?.moduleReadingLists?.find((r: any) => r.moduleId === moduleId)
              ?.readings || [],
          assessments: workflow.step7?.quizzes?.filter((q: any) => q.moduleId === moduleId) || [],
          caseStudies:
            workflow.step8?.caseStudies?.filter((cs: any) => cs.moduleId === moduleId) || [],
          glossary: workflow.step9?.entries || [],
        }
      );

      // Replace the old lesson with the new one
      module.lessons[lessonIndex] = newLesson;

      // Recalculate module totals
      module.totalLessons = module.lessons.length;
      module.totalContactHours = module.lessons.reduce((sum, l) => sum + l.duration / 60, 0);

      // Recalculate summary
      if (workflow.step10.summary) {
        workflow.step10.summary.totalLessons = workflow.step10.moduleLessonPlans.reduce(
          (sum, m) => sum + m.totalLessons,
          0
        );
        workflow.step10.summary.totalContactHours = workflow.step10.moduleLessonPlans.reduce(
          (sum, m) => sum + m.totalContactHours,
          0
        );
      }

      // Mark as modified and save
      workflow.markModified('step10');
      await workflow.save();

      loggingService.info('✅ Lesson regenerated successfully', {
        workflowId: req.params.id,
        moduleId,
        lessonId,
        newLessonTitle: newLesson.lessonTitle,
      });

      res.json({
        success: true,
        data: {
          lesson: newLesson,
          module: module,
          summary: workflow.step10.summary,
        },
        message: 'Lesson regenerated successfully',
      });
    } catch (error) {
      loggingService.error('Error regenerating lesson', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to regenerate lesson',
      });
    }
  }
);

/**
 * POST /api/v3/workflow/:id/approve
 * Approve workflow and mark as ready for final download
 */
router.post('/:id/approve', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const workflow = await CurriculumWorkflow.findById(req.params.id);
    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
      });
    }

    if (!workflow.step10) {
      return res.status(400).json({
        success: false,
        error: 'Step 10 must be completed before approval',
      });
    }

    // Update workflow status
    workflow.status = 'approved';
    workflow.updatedAt = new Date();
    await workflow.save();

    loggingService.info('Workflow approved', {
      workflowId: workflow._id,
      projectName: workflow.projectName,
    });

    res.json({
      success: true,
      data: workflow,
      message: 'Workflow approved successfully',
    });
  } catch (error) {
    loggingService.error('Error approving workflow', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to approve workflow',
    });
  }
});

// ============================================================================
// DELETE WORKFLOW
// ============================================================================

/**
 * DELETE /api/v3/workflow/:id
 * Delete a workflow and all its associated data
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const workflowId = req.params.id;

    // Find the workflow first
    const workflow = await CurriculumWorkflow.findById(workflowId);

    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
      });
    }

    // Delete the workflow
    await CurriculumWorkflow.findByIdAndDelete(workflowId);

    loggingService.info('Workflow deleted', {
      workflowId,
      projectName: workflow.projectName,
    });

    res.json({
      success: true,
      message: 'Workflow deleted successfully',
    });
  } catch (error) {
    loggingService.error('Error deleting workflow', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to delete workflow',
    });
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function calculateCreditEquivalencies(creditFramework: any) {
  if (!creditFramework) return null;

  const { totalHours } = creditFramework;

  return {
    ukCredits: Math.round(totalHours / 10),
    ects: Math.round(totalHours / 25),
    usSemester: Math.round(totalHours / 45),
    totalHours,
  };
}

function calculateRemainingTime(currentStep: number): string {
  const stepTimes: Record<number, number> = {
    1: 20,
    2: 15,
    3: 20,
    4: 30,
    5: 10,
    6: 8,
    7: 20,
    8: 15,
    9: 5,
  };

  let remaining = 0;
  for (let i = currentStep; i <= 9; i++) {
    remaining += stepTimes[i] || 0;
  }

  if (remaining <= 60) {
    return `~${remaining} minutes`;
  }
  return `~${Math.round((remaining / 60) * 10) / 10} hours`;
}

// ============================================================================
// ANALYTICS
// ============================================================================

/**
 * GET /api/v3/workflow/analytics/dashboard
 * Get comprehensive dashboard metrics for admin
 */
router.get('/analytics/dashboard', async (req: Request, res: Response) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Total workflows
    const totalWorkflows = await CurriculumWorkflow.countDocuments();

    // Workflows by status
    const workflowsByStatus = await CurriculumWorkflow.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Completed workflows (step9_complete or published)
    const completedWorkflows = await CurriculumWorkflow.countDocuments({
      status: { $in: ['step9_complete', 'review_pending', 'published'] },
    });

    // In progress workflows
    const inProgressWorkflows = await CurriculumWorkflow.countDocuments({
      status: { $nin: ['step9_complete', 'review_pending', 'published'] },
    });

    // Published workflows
    const publishedWorkflows = await CurriculumWorkflow.countDocuments({
      status: 'published',
    });

    // Workflows created per day (last 30 days)
    const workflowsPerDay = await CurriculumWorkflow.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Step distribution (current step of in-progress workflows)
    const stepDistribution = await CurriculumWorkflow.aggregate([
      { $match: { status: { $nin: ['step9_complete', 'published'] } } },
      { $group: { _id: '$currentStep', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    // Average completion time (in minutes)
    const completedWithTime = await CurriculumWorkflow.find({
      completedAt: { $exists: true },
      createdAt: { $exists: true },
    });

    let avgCompletionTime = 0;
    if (completedWithTime.length > 0) {
      const totalTime = completedWithTime.reduce((sum, w) => {
        if (w.completedAt && w.createdAt) {
          return sum + (w.completedAt.getTime() - w.createdAt.getTime()) / 60000;
        }
        return sum;
      }, 0);
      avgCompletionTime = Math.round(totalTime / completedWithTime.length);
    }

    // Recent workflows
    const recentWorkflows = await CurriculumWorkflow.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('projectName status currentStep createdAt updatedAt');

    // Workflows created this week vs last week
    const thisWeekWorkflows = await CurriculumWorkflow.countDocuments({
      createdAt: { $gte: sevenDaysAgo },
    });

    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const lastWeekWorkflows = await CurriculumWorkflow.countDocuments({
      createdAt: { $gte: twoWeeksAgo, $lt: sevenDaysAgo },
    });

    // Calculate growth percentage
    const growthPercentage =
      lastWeekWorkflows > 0
        ? (((thisWeekWorkflows - lastWeekWorkflows) / lastWeekWorkflows) * 100).toFixed(1)
        : thisWeekWorkflows > 0
          ? 100
          : 0;

    // Get REAL API costs from analytics storage (last 30 days)
    const totalApiCost = await analyticsStorageService.getTotalCost(thirtyDaysAgo);
    const totalTokens = await analyticsStorageService.getTotalTokens(thirtyDaysAgo);

    // Calculate average cost per workflow
    const avgCostPerWorkflow = completedWorkflows > 0 ? totalApiCost / completedWorkflows : 0;

    res.json({
      success: true,
      data: {
        overview: {
          totalWorkflows,
          completedWorkflows,
          inProgressWorkflows,
          publishedWorkflows,
          avgCompletionTime,
          thisWeekWorkflows,
          growthPercentage: parseFloat(String(growthPercentage)),
        },
        statusBreakdown: workflowsByStatus.reduce((acc: any, item: any) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        workflowsPerDay: workflowsPerDay.map((d: any) => ({
          date: d._id,
          count: d.count,
        })),
        stepDistribution: stepDistribution.map((s: any) => ({
          step: s._id,
          count: s.count,
        })),
        recentWorkflows: recentWorkflows.map((w: any) => ({
          id: w._id,
          name: w.projectName,
          status: w.status,
          currentStep: w.currentStep,
          createdAt: w.createdAt,
          updatedAt: w.updatedAt,
        })),
        costs: {
          totalApiCost: totalApiCost.toFixed(4),
          totalTokens: Math.round(totalTokens),
          avgPerWorkflow: avgCostPerWorkflow.toFixed(4),
          model: 'gpt-5',
          costPer1kTokens: 0.005625, // GPT-5 average pricing ($5.625/1M tokens)
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    loggingService.error('Error fetching workflow analytics', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics',
    });
  }
});

// ============================================================================
// CANVAS AI EDITING ROUTES
// ============================================================================

/**
 * POST /api/v3/workflow/canvas-edit
 * AI-powered canvas editing - processes user edit requests and generates proposals
 */
router.post('/canvas-edit', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { workflowId, stepNumber, userMessage, editTarget, context } = req.body;

    if (!workflowId || !stepNumber || !userMessage) {
      return res.status(400).json({
        success: false,
        error: 'workflowId, stepNumber, and userMessage are required',
      });
    }

    loggingService.info('Canvas AI edit request', { workflowId, stepNumber, editTarget });

    // Call the AI service to generate edit proposals
    const result = await workflowService.canvasEdit({
      workflowId,
      stepNumber,
      userMessage,
      editTarget,
      context,
    });

    res.json({
      success: true,
      message: result.message,
      proposedChanges: result.proposedChanges,
      suggestions: result.suggestions,
    });
  } catch (error: any) {
    loggingService.error('Canvas AI edit failed', { error });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process edit request',
    });
  }
});

/**
 * POST /api/v3/workflow/replace-source
 * Request AI to generate a replacement source for a rejected one
 */
router.post('/replace-source', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { workflowId, rejectedSourceId, moduleId } = req.body;

    if (!workflowId || !rejectedSourceId) {
      return res.status(400).json({
        success: false,
        error: 'workflowId and rejectedSourceId are required',
      });
    }

    loggingService.info('Replacement source request', { workflowId, rejectedSourceId, moduleId });

    // Call the AI service to generate a replacement source
    const result = await workflowService.generateReplacementSource({
      workflowId,
      rejectedSourceId,
      moduleId,
    });

    res.json({
      success: true,
      data: {
        replacementSource: result.replacementSource,
      },
    });
  } catch (error: any) {
    loggingService.error('Replacement source generation failed', { error });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate replacement source',
    });
  }
});

/**
 * POST /api/v3/workflow/upload-framework
 * Upload a custom framework document for a specific workflow
 */
router.post('/upload-framework', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { workflowId, type } = req.body;
    const file = (req as any).file;

    if (!workflowId) {
      return res.status(400).json({
        success: false,
        error: 'workflowId is required',
      });
    }

    loggingService.info('Framework upload request', {
      workflowId,
      type,
      fileName: file?.originalname,
    });

    // TODO: Implement file upload handling with multer
    // For now, return a placeholder response
    res.json({
      success: true,
      data: {
        id: `fw-${Date.now()}`,
        name: file?.originalname || 'Uploaded Framework',
        status: 'uploaded',
      },
    });
  } catch (error: any) {
    loggingService.error('Framework upload failed', { error });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload framework',
    });
  }
});

/**
 * POST /api/v3/workflow/:id/apply-edit
 * Apply canvas AI edit changes to the workflow
 */
router.post('/:id/apply-edit', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { stepNumber, itemId, sectionId, fieldPath, newContent } = req.body;

    if (!stepNumber || !newContent) {
      return res.status(400).json({
        success: false,
        error: 'stepNumber and newContent are required',
      });
    }

    loggingService.info('Applying canvas edit', { workflowId: id, stepNumber, itemId, fieldPath });

    // Find and update the workflow
    const workflow = await CurriculumWorkflow.findById(id);
    if (!workflow) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found',
      });
    }

    // Apply the edit based on step and target
    const stepKey = `step${stepNumber}` as keyof typeof workflow;
    const stepData = (workflow as any)[stepKey];

    if (!stepData) {
      return res.status(400).json({
        success: false,
        error: `Step ${stepNumber} data not found`,
      });
    }

    // Log the incoming changes for debugging
    loggingService.info('Canvas edit newContent', {
      newContentKeys: Object.keys(newContent || {}),
      newContentPreview: JSON.stringify(newContent).substring(0, 500),
    });

    // =====================================================
    // FLEXIBLE UPDATE SYSTEM - Handle any change to any step
    // =====================================================

    // Process the new "updates" array format for flexible editing
    if (newContent.updates && Array.isArray(newContent.updates)) {
      for (const update of newContent.updates) {
        const targetStep = update.step || stepNumber;
        const targetStepKey = `step${targetStep}`;
        const targetStepData = (workflow as any)[targetStepKey];

        if (!targetStepData) {
          loggingService.warn('Target step not found', { targetStep });
          continue;
        }

        loggingService.info('Processing update', {
          step: targetStep,
          path: update.path,
          action: update.action,
        });

        // Handle "set" action for direct field updates
        if (update.action === 'set' && update.path && update.value !== undefined) {
          (workflow as any)[targetStepKey][update.path] = update.value;
          workflow.markModified(targetStepKey);
          loggingService.info('Field set', {
            step: targetStep,
            path: update.path,
            value: update.value,
          });
        }

        // Handle array operations (update, add, delete)
        else if (
          update.path &&
          targetStepData[update.path] &&
          Array.isArray(targetStepData[update.path])
        ) {
          const arr = targetStepData[update.path];

          if (update.action === 'update' && update.match) {
            // Find item by matching any field
            const itemIdx = arr.findIndex((item: any) => {
              return Object.keys(update.match).every((key) => {
                // Case-insensitive string comparison
                if (typeof item[key] === 'string' && typeof update.match[key] === 'string') {
                  return (
                    item[key].toLowerCase().includes(update.match[key].toLowerCase()) ||
                    update.match[key].toLowerCase().includes(item[key].toLowerCase())
                  );
                }
                return item[key] === update.match[key];
              });
            });

            if (itemIdx !== -1) {
              arr[itemIdx] = { ...arr[itemIdx], ...update.changes };
              workflow.markModified(targetStepKey);
              loggingService.info('Item updated in array', {
                step: targetStep,
                path: update.path,
                itemIdx,
                changes: update.changes,
              });
            } else {
              loggingService.warn('No matching item found for update', { match: update.match });
            }
          } else if (update.action === 'add' && update.item) {
            // Add new item with unique ID if missing
            if (!update.item.id) {
              update.item.id = `${update.path}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            }
            arr.push(update.item);
            workflow.markModified(targetStepKey);
            loggingService.info('Item added to array', {
              step: targetStep,
              path: update.path,
              item: update.item,
            });
          } else if (update.action === 'delete' && update.match) {
            const itemIdx = arr.findIndex((item: any) => {
              return Object.keys(update.match).every((key) => item[key] === update.match[key]);
            });
            if (itemIdx !== -1) {
              arr.splice(itemIdx, 1);
              workflow.markModified(targetStepKey);
              loggingService.info('Item deleted from array', {
                step: targetStep,
                path: update.path,
                itemIdx,
              });
            }
          }
        }

        // Handle NESTED paths like "modules.mlos", "modules.topics", "quizzes.questions"
        else if (update.path && update.path.includes('.')) {
          const pathParts = update.path.split('.');
          const parentArrayName = pathParts[0]; // e.g., "modules"
          const childArrayName = pathParts[1]; // e.g., "mlos", "topics"

          const parentArray = targetStepData[parentArrayName];
          if (parentArray && Array.isArray(parentArray)) {
            // Find the parent item (e.g., module)
            const parentMatch =
              update.match?.moduleId || update.match?.quizId || update.match?.caseId;
            let parentItem: any = null;

            if (parentMatch) {
              parentItem = parentArray.find((item: any) => item.id === parentMatch);
            } else if (update.match) {
              // Try to find by other match criteria
              parentItem = parentArray.find((item: any) => {
                return Object.keys(update.match).some(
                  (key) =>
                    !['moduleId', 'quizId', 'caseId'].includes(key) &&
                    item[key] === update.match[key]
                );
              });
            }

            if (
              parentItem &&
              parentItem[childArrayName] &&
              Array.isArray(parentItem[childArrayName])
            ) {
              const childArray = parentItem[childArrayName];

              if (update.action === 'update' && update.match) {
                // Find the child item by matching
                const childIdx = childArray.findIndex((child: any) => {
                  const matchCriteria = { ...update.match };
                  delete matchCriteria.moduleId;
                  delete matchCriteria.quizId;
                  delete matchCriteria.caseId;
                  return Object.keys(matchCriteria).every((key) => {
                    if (typeof child[key] === 'string' && typeof matchCriteria[key] === 'string') {
                      return (
                        child[key].toLowerCase() === matchCriteria[key].toLowerCase() ||
                        child[key].toLowerCase().includes(matchCriteria[key].toLowerCase())
                      );
                    }
                    return child[key] === matchCriteria[key];
                  });
                });

                if (childIdx !== -1) {
                  childArray[childIdx] = { ...childArray[childIdx], ...update.changes };
                  workflow.markModified(targetStepKey);
                  loggingService.info('Nested item updated', {
                    step: targetStep,
                    parent: parentArrayName,
                    child: childArrayName,
                    childIdx,
                    changes: update.changes,
                  });
                } else {
                  loggingService.warn('No matching nested item found', { match: update.match });
                }
              } else if (update.action === 'add' && update.item) {
                if (!update.item.id) {
                  update.item.id = `${childArrayName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                }
                childArray.push(update.item);
                workflow.markModified(targetStepKey);
                loggingService.info('Nested item added', {
                  step: targetStep,
                  parent: parentArrayName,
                  child: childArrayName,
                });
              } else if (update.action === 'delete' && update.match) {
                const matchCriteria = { ...update.match };
                delete matchCriteria.moduleId;
                delete matchCriteria.quizId;
                delete matchCriteria.caseId;
                const childIdx = childArray.findIndex((child: any) =>
                  Object.keys(matchCriteria).every((key) => child[key] === matchCriteria[key])
                );
                if (childIdx !== -1) {
                  childArray.splice(childIdx, 1);
                  workflow.markModified(targetStepKey);
                  loggingService.info('Nested item deleted', {
                    step: targetStep,
                    parent: parentArrayName,
                    child: childArrayName,
                  });
                }
              }
            } else {
              loggingService.warn('Parent item or child array not found', {
                parentMatch,
                parentFound: !!parentItem,
                childArrayName,
              });
            }
          }
        }

        // Handle nested object updates (non-array)
        else if (update.path && update.changes) {
          if (targetStepData[update.path]) {
            Object.assign(targetStepData[update.path], update.changes);
          } else {
            targetStepData[update.path] = update.changes;
          }
          workflow.markModified(targetStepKey);
          loggingService.info('Object updated', { step: targetStep, path: update.path });
        }
      }
    }

    // =====================================================
    // LEGACY SUPPORT - Handle old format for backwards compatibility
    // =====================================================

    // Handle legacy sources array (direct merge)
    if (newContent.sources && Array.isArray(newContent.sources)) {
      const existingSources = stepData.sources || [];
      newContent.sources.forEach((newSrc: any) => {
        const existingIdx = existingSources.findIndex((s: any) => s.id === newSrc.id);
        if (existingIdx !== -1) {
          existingSources[existingIdx] = { ...existingSources[existingIdx], ...newSrc };
        } else {
          if (!newSrc.id) {
            newSrc.id = `src-ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          }
          existingSources.push(newSrc);
        }
      });
      stepData.sources = existingSources;
      workflow.markModified(`step${stepNumber}`);
    }

    // Handle legacy moduleTitleUpdates
    if (newContent.moduleTitleUpdates && Array.isArray(newContent.moduleTitleUpdates)) {
      const step4Data = (workflow as any).step4;
      if (step4Data?.modules) {
        newContent.moduleTitleUpdates.forEach((update: any) => {
          const moduleIdx = step4Data.modules.findIndex(
            (m: any) =>
              m.id === update.moduleId ||
              m.title === update.oldTitle ||
              m.title?.toLowerCase().includes((update.oldTitle || '').toLowerCase())
          );
          if (moduleIdx !== -1) {
            const oldTitle = step4Data.modules[moduleIdx].title;
            const moduleId = step4Data.modules[moduleIdx].id;

            if (update.newTitle) step4Data.modules[moduleIdx].title = update.newTitle;
            if (update.newDescription)
              step4Data.modules[moduleIdx].description = update.newDescription;

            // PROPAGATE TITLE CHANGE TO ALL STEPS
            propagateModuleTitleChange(workflow, moduleId, oldTitle, update.newTitle);

            loggingService.info('Module title updated and propagated', {
              moduleId,
              oldTitle,
              newTitle: update.newTitle,
            });
          }
        });
        workflow.markModified('step4');
      }
    }

    // =====================================================
    // PROPAGATE CHANGES ACROSS ALL STEPS
    // =====================================================

    // If step 4 modules were updated via the updates array, propagate changes
    if (newContent.updates) {
      for (const update of newContent.updates) {
        if (
          update.step === 4 &&
          update.path === 'modules' &&
          update.action === 'update' &&
          update.changes?.title
        ) {
          // Find the module that was updated
          const step4Data = (workflow as any).step4;
          if (step4Data?.modules) {
            const module = step4Data.modules.find((m: any) => {
              if (update.match) {
                return Object.keys(update.match).some((key) => {
                  if (typeof m[key] === 'string' && typeof update.match[key] === 'string') {
                    return (
                      m[key].toLowerCase().includes(update.match[key].toLowerCase()) ||
                      update.match[key].toLowerCase().includes(m[key].toLowerCase())
                    );
                  }
                  return m[key] === update.match[key];
                });
              }
              return false;
            });

            if (module) {
              const oldTitle = Object.values(update.match)[0] as string;
              propagateModuleTitleChange(workflow, module.id, oldTitle, update.changes.title);
            }
          }
        }
      }
    }

    // =====================================================
    // AUTO-RECALCULATE STEP 5 VALIDATION AFTER SOURCE CHANGES
    // =====================================================
    const step5Data = (workflow as any).step5;
    if (step5Data?.sources && Array.isArray(step5Data.sources)) {
      const sources = step5Data.sources;
      const totalSources = sources.length;
      const peerReviewedSources = sources.filter(
        (s: any) => s.category === 'peer_reviewed_journal'
      );
      const academicSources = sources.filter((s: any) => s.type === 'academic');
      const appliedSources = sources.filter((s: any) => s.type === 'applied');

      // Get all MLO codes from Step 4
      const step4Data = (workflow as any).step4;
      const allMLOs: string[] = [];
      if (step4Data?.modules) {
        step4Data.modules.forEach((m: any) => {
          (m.mlos || []).forEach((mlo: any) => {
            if (mlo.code) allMLOs.push(mlo.code);
          });
        });
      }

      // Get covered MLOs from sources
      const coveredMLOs = new Set<string>();
      sources.forEach((src: any) => {
        (src.linkedMLOs || []).forEach((mlo: string) => coveredMLOs.add(mlo));
      });

      // Calculate metrics
      const peerReviewedPercent =
        totalSources > 0 ? Math.round((peerReviewedSources.length / totalSources) * 100) : 0;
      const hasBalance = academicSources.length > 0 && appliedSources.length > 0;
      const allMLOsSupported = allMLOs.length === 0 || allMLOs.every((mlo) => coveredMLOs.has(mlo));

      // Update Step 5 validation data
      step5Data.totalSources = totalSources;
      step5Data.totalPeerReviewed = peerReviewedSources.length;
      step5Data.peerReviewedPercent = peerReviewedPercent;
      step5Data.academicAppliedBalance = hasBalance;

      // Update validation report
      if (!step5Data.validationReport) step5Data.validationReport = {};
      step5Data.validationReport.peerReviewRatio = peerReviewedPercent >= 50;
      step5Data.validationReport.everyMLOSupported = allMLOsSupported;
      step5Data.validationReport.academicAppliedBalance = hasBalance;

      // Update compliance issues
      const issues: string[] = [];
      if (peerReviewedPercent < 50) issues.push('Peer-reviewed ratio below 50%');
      if (!hasBalance) issues.push('Missing academic/applied source balance');
      if (!allMLOsSupported) issues.push('Not all MLOs have supporting sources');
      step5Data.complianceIssues = issues;

      // Update AGI compliance status
      step5Data.agiCompliant =
        issues.length === 0 &&
        step5Data.validationReport.allSourcesApproved !== false &&
        step5Data.validationReport.recencyCompliance !== false;

      workflow.markModified('step5');
      loggingService.info('Step 5 validation recalculated', {
        totalSources,
        peerReviewedPercent,
        allMLOsSupported,
        hasBalance,
        issues,
      });
    }

    await workflow.save();

    loggingService.info('Canvas edit saved successfully', { workflowId: id, stepNumber });

    res.json({
      success: true,
      message: 'Edit applied successfully',
      updatedStep: (workflow as any)[`step${stepNumber}`],
    });
  } catch (error: any) {
    loggingService.error('Apply edit failed', { error });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to apply edit',
    });
  }
});

// ============================================================================
// GENERIC STEP STATUS ENDPOINT (Steps 1-9)
// ============================================================================

/**
 * GET /api/v3/workflow/:id/step/:stepNumber/status
 * Poll background job status for any step 1-9
 */
router.get(
  '/:id/step/:stepNumber/status',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const { id, stepNumber } = req.params;
      const step = parseInt(stepNumber, 10);

      if (step < 1 || (step > 9 && step !== 13)) {
        return res.status(400).json({
          success: false,
          error: 'Step number must be between 1 and 9, or 13',
        });
      }

      const workflow = await CurriculumWorkflow.findById(id);
      if (!workflow) {
        return res.status(404).json({ success: false, error: 'Workflow not found' });
      }

      const jobStatus = await getStepJobStatus(step, id);
      const stepKey = `step${step}` as string;
      const stepData = (workflow as any)[stepKey];
      const hasData = !!stepData && Object.keys(stepData).length > 0;

      // Determine overall status
      let overallStatus: 'pending' | 'queued' | 'processing' | 'completed' | 'failed' = 'pending';
      if (jobStatus) {
        if (jobStatus.state === 'completed') overallStatus = 'completed';
        else if (jobStatus.state === 'active') overallStatus = 'processing';
        else if (jobStatus.state === 'waiting' || jobStatus.state === 'delayed')
          overallStatus = 'queued';
        else if (jobStatus.state === 'failed') overallStatus = 'failed';
      } else if (hasData) {
        overallStatus = 'completed';
      }

      res.json({
        success: true,
        data: {
          workflowId: id,
          stepNumber: step,
          status: overallStatus,
          hasData,
          job: jobStatus
            ? {
                jobId: jobStatus.jobId,
                state: jobStatus.state,
                progress: jobStatus.progress,
                attemptsMade: jobStatus.attemptsMade,
                failedReason: jobStatus.failedReason,
                processedOn: jobStatus.processedOn,
                finishedOn: jobStatus.finishedOn,
              }
            : null,
          stepData:
            overallStatus === 'completed'
              ? {
                  currentStep: workflow.currentStep,
                  workflowStatus: workflow.status,
                }
              : null,
        },
      });
    } catch (error) {
      loggingService.error('Error getting step status', {
        error: error instanceof Error ? error.message : String(error),
        workflowId: req.params.id,
        stepNumber: req.params.stepNumber,
      });
      res.status(500).json({ success: false, error: 'Failed to get step status' });
    }
  }
);

export default router;
