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

import { Router, Request, Response } from 'express';
import { validateJWT, loadUser } from '../middleware/auth';
import { workflowService } from '../services/workflowService';
import { loggingService } from '../services/loggingService';
import { CurriculumWorkflow } from '../models/CurriculumWorkflow';
import { wordExportService } from '../services/wordExportService';
import { analyticsStorageService } from '../services/analyticsStorageService';

const router = Router();

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
    const {
      programTitle,
      programDescription,
      academicLevel,
      // Credit Framework
      isCreditAwarding,
      creditSystem,
      credits,
      totalHours,
      customContactPercent,
      // Target Learner Profile (structured v2.2)
      targetLearner, // Legacy: single string or object
      targetLearnerAgeRange,
      targetLearnerEducationalBackground,
      targetLearnerIndustrySector,
      targetLearnerExperienceLevel,
      // Delivery
      deliveryMode,
      deliveryDescription,
      // Labour Market
      programPurpose,
      jobRoles,
    } = req.body;

    // Minimal validation for saving draft - only require program title
    if (!programTitle || programTitle.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Program title must be at least 3 characters',
      });
    }

    // Filter out empty job roles - handle both string and object formats
    const filteredJobRoles = (jobRoles || []).filter((role: any) => {
      if (typeof role === 'string') {
        return role && role.trim();
      }
      // Object format: { title, description, tasks }
      return role && role.title && role.title.trim();
    });

    const workflow = await workflowService.processStep1(id, {
      programTitle,
      programDescription: programDescription || '',
      academicLevel: academicLevel || 'certificate',
      isCreditAwarding: isCreditAwarding ?? true,
      creditSystem: creditSystem || 'uk',
      credits: credits || 60,
      totalHours,
      customContactPercent,
      // Pass structured target learner fields
      targetLearnerAgeRange: targetLearnerAgeRange || '',
      targetLearnerEducationalBackground: targetLearnerEducationalBackground || '',
      targetLearnerIndustrySector: targetLearnerIndustrySector || '',
      targetLearnerExperienceLevel: targetLearnerExperienceLevel || 'professional',
      targetLearner: targetLearner, // Legacy support
      deliveryMode: deliveryMode || 'hybrid_blended',
      deliveryDescription: deliveryDescription || '',
      programPurpose: programPurpose || '',
      jobRoles: filteredJobRoles,
    });

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
    const { benchmarkPrograms, industryFrameworks, institutionalFrameworks } = req.body;

    const workflow = await workflowService.processStep2(id, {
      benchmarkPrograms,
      industryFrameworks,
      institutionalFrameworks,
    });

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

    const workflow = await CurriculumWorkflow.findById(id);
    if (!workflow || !workflow.step2) {
      return res.status(404).json({ success: false, error: 'Workflow or Step 2 not found' });
    }

    // Find and update the KSC item
    const allItems = [
      ...workflow.step2.knowledgeItems,
      ...workflow.step2.skillItems,
      ...workflow.step2.attitudeItems,
    ];

    const item = allItems.find((i: any) => i.id === ksaId);
    if (!item) {
      return res.status(404).json({ success: false, error: 'KSC item not found' });
    }

    if (statement) item.statement = statement;
    if (description) item.description = description;
    if (importance) item.importance = importance;

    await workflow.save();

    res.json({
      success: true,
      data: item,
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
    const {
      bloomLevels,
      priorityCompetencies,
      outcomeEmphasis,
      targetCount,
      contextConstraints,
      preferredVerbs,
      avoidVerbs,
    } = req.body;

    // Validation
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

    const workflow = await workflowService.processStep3(id, {
      bloomLevels,
      priorityCompetencies: priorityCompetencies || [],
      outcomeEmphasis: outcomeEmphasis || 'mixed',
      targetCount,
      contextConstraints,
      preferredVerbs,
      avoidVerbs,
    });

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

      const workflow = await CurriculumWorkflow.findById(id);
      if (!workflow || !workflow.step4) {
        return res.status(404).json({ success: false, error: 'Workflow or Step 4 not found' });
      }

      const module = workflow.step4.modules.find((m: any) => m.id === moduleId);
      if (!module) {
        return res.status(404).json({ success: false, error: 'Module not found' });
      }

      // Apply updates
      Object.assign(module, updates);

      // Recalculate hours integrity
      const totalModuleHours = workflow.step4.modules.reduce(
        (sum: number, m: any) => sum + (m.totalHours || 0),
        0
      );
      workflow.step4.hoursIntegrity = totalModuleHours === workflow.step4.totalProgramHours;

      await workflow.save();

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
 * Submit Step 7: Generate Assessments
 */
router.post('/:id/step7', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      finalExamWeight = 40,
      passMark = 60,
      questionsPerQuiz = 20,
      questionsForFinal = 60,
      bankMultiplier = 3,
      randomize = true,
      enableCloze = false,
    } = req.body;

    // Validation
    if (finalExamWeight < 30 || finalExamWeight > 50) {
      return res.status(400).json({
        success: false,
        error: 'Final exam weight must be between 30% and 50%',
      });
    }

    const workflow = await workflowService.processStep7(id, {
      finalExamWeight,
      passMark,
      questionsPerQuiz,
      questionsForFinal,
      bankMultiplier,
      randomize,
      enableCloze,
    });

    res.json({
      success: true,
      data: {
        step7: workflow.step7,
        currentStep: workflow.currentStep,
        status: workflow.status,
      },
      message: 'Step 7 complete. MCQ banks generated. Ready for Step 8: Case Studies.',
    });
  } catch (error) {
    loggingService.error('Error processing Step 7', { error, workflowId: req.params.id });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process Step 7',
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
    if (!workflow.step7.validation?.allAutoGradable) {
      warnings.push('Some assessments may not be fully auto-gradable');
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

    if (workflow.currentStep < 9 || !workflow.step9) {
      return res.status(400).json({
        success: false,
        error: 'All 9 steps must be completed first',
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

export default router;
