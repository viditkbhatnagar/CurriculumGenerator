/**
 * New 5-Stage Workflow API Routes
 * Handles: Prompt Library, AI Research, Cost Evaluation, Generation, Publication
 */

import { Router, Request, Response } from 'express';
import { validateJWT, loadUser } from '../middleware/auth';
import { promptLibraryService } from '../services/promptLibraryService';
import { aiResearchService } from '../services/aiResearchService';
import { resourceCostService } from '../services/resourceCostService';
import { curriculumGenerationServiceV2 } from '../services/curriculumGenerationServiceV2';
import { publicationService } from '../services/publicationService';
import { CurriculumProject } from '../models/CurriculumProject';
import { PreliminaryCurriculumPackage } from '../models/PreliminaryCurriculumPackage';
import { loggingService } from '../services/loggingService';

const router = Router();

// ===== PROMPT LIBRARY ROUTES =====

/**
 * GET /api/v2/prompts
 * Get all active course prompts (filterable)
 * Public route - no auth required
 */
router.get('/prompts', async (req: Request, res: Response) => {
  try {
    const { domain, level, search } = req.query;

    const prompts = await promptLibraryService.getPrompts({
      domain: domain as string,
      level: level as string,
      search: search as string,
      status: 'active',
    });

    res.json({
      success: true,
      data: prompts,
      count: prompts.length,
    });
  } catch (error) {
    loggingService.error('Error getting prompts', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve prompts',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/v2/prompts/:id
 * Get a specific prompt by ID
 * Public route - no auth required
 */
router.get('/prompts/:id', async (req: Request, res: Response) => {
  try {
    const prompt = await promptLibraryService.getPromptById(req.params.id);

    if (!prompt) {
      return res.status(404).json({
        success: false,
        error: 'Prompt not found',
      });
    }

    res.json({
      success: true,
      data: prompt,
    });
  } catch (error) {
    loggingService.error('Error getting prompt', { error, promptId: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve prompt',
    });
  }
});

/**
 * POST /api/v2/prompts
 * Create a new course prompt (Admin/Instructor only)
 */
router.post('/prompts', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const promptData = {
      ...req.body,
      createdBy: (req as any).user.userId,
    };

    const newPrompt = await promptLibraryService.createPrompt(promptData);

    res.status(201).json({
      success: true,
      data: newPrompt,
      message: 'Course prompt created successfully',
    });
  } catch (error) {
    loggingService.error('Error creating prompt', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to create prompt',
    });
  }
});

// ===== CURRICULUM PROJECT ROUTES =====

/**
 * POST /api/v2/projects
 * Create a new curriculum project (Stage 1)
 */
router.post('/projects', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { promptId, projectName } = req.body;
    const userId = (req as any).user.id || (req as any).user.userId;

    if (!promptId || !projectName) {
      return res.status(400).json({
        success: false,
        error: 'promptId and projectName are required',
      });
    }

    // Get the prompt details to extract courseCode
    const prompt = await promptLibraryService.getPromptById(promptId);
    if (!prompt) {
      return res.status(404).json({
        success: false,
        error: 'Prompt not found',
      });
    }

    // Create project with all required fields
    const project = new CurriculumProject({
      promptId,
      courseCode: prompt.courseCode, // Required field from prompt
      smeId: userId, // Required field
      projectName,
      status: 'research', // Stage 1 complete, moving to Stage 2
      currentStage: 2, // Stage 1 (Prompt Selection) is complete, now at Stage 2
      stageProgress: {
        stage1_promptSelection: {
          status: 'completed',
          completedAt: new Date(),
        },
        stage2_aiResearch: { status: 'pending' },
        stage3_costEvaluation: { status: 'pending' },
        stage4_generation: { status: 'pending' },
        stage5_review: { status: 'pending' },
      },
      timeline: {
        stage1_completed: new Date(),
      },
    });

    await project.save();

    res.status(201).json({
      success: true,
      data: project,
      message: 'Project created successfully',
    });
  } catch (error) {
    loggingService.error('Error creating project', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to create project',
    });
  }
});

/**
 * GET /api/v2/projects
 * Get all projects for the authenticated user
 */
router.get('/projects', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { status } = req.query;

    const query: any = { smeId: userId };
    if (status) {
      query.status = status;
    }

    const projects = await CurriculumProject.find(query)
      .populate('promptId', 'promptTitle domain level')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: projects,
      count: projects.length,
    });
  } catch (error) {
    loggingService.error('Error getting projects', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve projects',
    });
  }
});

/**
 * GET /api/v2/projects/:id
 * Get project details
 * Public route - no auth required for now
 */
router.get('/projects/:id', async (req: Request, res: Response) => {
  try {
    const project = await CurriculumProject.findById(req.params.id)
      .populate('promptId')
      .populate('smeId', 'name email');

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }

    res.json({
      success: true,
      data: project,
    });
  } catch (error) {
    loggingService.error('Error getting project', { error, projectId: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve project',
    });
  }
});

// ===== AI RESEARCH ROUTES (STAGE 2) =====

/**
 * POST /api/v2/projects/:id/research/start
 * Start AI research phase (Stage 2)
 */
router.post(
  '/projects/:id/research/start',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const packageId = await aiResearchService.startResearch(req.params.id);

      res.json({
        success: true,
        data: { packageId },
        message: 'AI research started',
      });
    } catch (error: any) {
      // If duplicate key error (package already exists), return existing package
      if (error.code === 11000 || error.message?.includes('duplicate')) {
        try {
          const existingPackage = await PreliminaryCurriculumPackage.findOne({
            projectId: req.params.id,
          });
          if (existingPackage) {
            loggingService.info('Research already in progress, returning existing package', {
              projectId: req.params.id,
              packageId: existingPackage._id,
            });
            return res.json({
              success: true,
              data: { packageId: existingPackage._id.toString() },
              message: 'Research already in progress',
            });
          }
        } catch (findError) {
          loggingService.error('Error finding existing package', {
            error: findError,
            projectId: req.params.id,
          });
        }
      }

      loggingService.error('Error starting research', { error, projectId: req.params.id });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start research',
      });
    }
  }
);

/**
 * GET /api/v2/projects/:id/research/package
 * Get preliminary curriculum package
 * Public route - no auth required
 */
router.get('/projects/:id/research/package', async (req: Request, res: Response) => {
  try {
    const prelimPackage = await PreliminaryCurriculumPackage.findOne({ projectId: req.params.id });

    if (!prelimPackage) {
      return res.status(404).json({
        success: false,
        error: 'Preliminary package not found',
      });
    }

    res.json({
      success: true,
      data: prelimPackage,
    });
  } catch (error) {
    loggingService.error('Error getting package', { error, projectId: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve package',
    });
  }
});

/**
 * POST /api/v2/research/:packageId/feedback
 * Submit SME feedback for refinement
 */
router.post(
  '/research/:packageId/feedback',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const { componentRef, feedback } = req.body;
      const userId = (req as any).user.userId;

      if (!componentRef || !feedback) {
        return res.status(400).json({
          success: false,
          error: 'componentRef and feedback are required',
        });
      }

      const result = await aiResearchService.processSMEFeedback(
        req.params.packageId,
        componentRef,
        feedback,
        userId
      );

      res.json({
        success: true,
        data: result,
        message: 'Feedback processed and component refined',
      });
    } catch (error) {
      loggingService.error('Error processing feedback', { error, packageId: req.params.packageId });
      res.status(500).json({
        success: false,
        error: 'Failed to process feedback',
      });
    }
  }
);

/**
 * POST /api/v2/research/:packageId/submit
 * Submit preliminary package for approval (advance to Stage 3)
 */
router.post(
  '/research/:packageId/submit',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;

      await aiResearchService.submitForApproval(req.params.packageId, userId);

      res.json({
        success: true,
        message: 'Package submitted successfully. Moving to cost evaluation.',
      });
    } catch (error) {
      loggingService.error('Error submitting package', { error, packageId: req.params.packageId });
      res.status(500).json({
        success: false,
        error: 'Failed to submit package',
      });
    }
  }
);

/**
 * GET /api/v2/research/:packageId/chat
 * Get chat history
 */
router.get(
  '/research/:packageId/chat',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const chatHistory = await aiResearchService.getChatHistory(req.params.packageId);

      res.json({
        success: true,
        data: chatHistory,
      });
    } catch (error) {
      loggingService.error('Error getting chat history', {
        error,
        packageId: req.params.packageId,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve chat history',
      });
    }
  }
);

// ===== RESOURCE COST EVALUATION ROUTES (STAGE 3) =====

/**
 * POST /api/v2/projects/:id/cost/evaluate
 * Start cost evaluation (Stage 3)
 */
router.post(
  '/projects/:id/cost/evaluate',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const evaluationId = await resourceCostService.startEvaluation(req.params.id);

      // Auto-approve for now (management UI not built yet)
      await resourceCostService.autoApprove(evaluationId);

      res.json({
        success: true,
        data: { evaluationId },
        message: 'Cost evaluation complete (auto-approved)',
      });
    } catch (error) {
      loggingService.error('Error evaluating cost', { error, projectId: req.params.id });
      res.status(500).json({
        success: false,
        error: 'Failed to evaluate cost',
      });
    }
  }
);

/**
 * GET /api/v2/cost/:evaluationId
 * Get cost evaluation details
 */
router.get('/cost/:evaluationId', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const evaluation = await resourceCostService.getEvaluation(req.params.evaluationId);

    if (!evaluation) {
      return res.status(404).json({
        success: false,
        error: 'Evaluation not found',
      });
    }

    res.json({
      success: true,
      data: evaluation,
    });
  } catch (error) {
    loggingService.error('Error getting evaluation', {
      error,
      evaluationId: req.params.evaluationId,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve evaluation',
    });
  }
});

/**
 * POST /api/v2/cost/:evaluationId/decide
 * Management decision on cost evaluation (Admin only)
 */
router.post(
  '/cost/:evaluationId/decide',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const { decision, notes, selectedAlternatives } = req.body;
      const userId = (req as any).user.userId;

      if (!['approved', 'rejected'].includes(decision)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid decision. Must be "approved" or "rejected"',
        });
      }

      await resourceCostService.processManagementDecision(
        req.params.evaluationId,
        decision,
        userId,
        notes,
        selectedAlternatives
      );

      res.json({
        success: true,
        message: `Cost evaluation ${decision}`,
      });
    } catch (error) {
      loggingService.error('Error processing decision', {
        error,
        evaluationId: req.params.evaluationId,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to process decision',
      });
    }
  }
);

// ===== CURRICULUM GENERATION ROUTES (STAGE 4) =====

/**
 * POST /api/v2/projects/:id/generate
 * Generate full curriculum package (Stage 4)
 */
router.post(
  '/projects/:id/generate',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const fullPackageId = await curriculumGenerationServiceV2.startGeneration(req.params.id);

      res.json({
        success: true,
        data: { fullPackageId },
        message: 'Full curriculum generation started',
      });
    } catch (error) {
      loggingService.error('Error starting generation', { error, projectId: req.params.id });
      res.status(500).json({
        success: false,
        error: 'Failed to start generation',
      });
    }
  }
);

/**
 * GET /api/v2/curriculum/:packageId
 * Get full curriculum package
 */
router.get('/curriculum/:packageId', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const fullPackage = await curriculumGenerationServiceV2.getFullPackage(req.params.packageId);

    if (!fullPackage) {
      return res.status(404).json({
        success: false,
        error: 'Full package not found',
      });
    }

    res.json({
      success: true,
      data: fullPackage,
    });
  } catch (error) {
    loggingService.error('Error getting full package', { error, packageId: req.params.packageId });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve full package',
    });
  }
});

// ===== PUBLICATION & REVIEW ROUTES (STAGE 5) =====

/**
 * POST /api/v2/projects/:id/review/start
 * Start final review (Stage 5)
 */
router.post(
  '/projects/:id/review/start',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const reviewId = await publicationService.startReview(req.params.id, userId);

      res.json({
        success: true,
        data: { reviewId },
        message: 'Final review started',
      });
    } catch (error) {
      loggingService.error('Error starting review', { error, projectId: req.params.id });
      res.status(500).json({
        success: false,
        error: 'Failed to start review',
      });
    }
  }
);

/**
 * POST /api/v2/review/:reviewId/refine
 * Request refinement for specific material
 */
router.post(
  '/review/:reviewId/refine',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const { materialType, materialId, requestedChange } = req.body;
      const userId = (req as any).user.userId;

      if (!materialType || !requestedChange) {
        return res.status(400).json({
          success: false,
          error: 'materialType and requestedChange are required',
        });
      }

      await publicationService.requestRefinement(
        req.params.reviewId,
        materialType,
        materialId,
        requestedChange,
        userId
      );

      res.json({
        success: true,
        message: 'Refinement requested and being processed',
      });
    } catch (error) {
      loggingService.error('Error requesting refinement', { error, reviewId: req.params.reviewId });
      res.status(500).json({
        success: false,
        error: 'Failed to request refinement',
      });
    }
  }
);

/**
 * POST /api/v2/review/:reviewId/approve
 * SME approves curriculum
 */
router.post(
  '/review/:reviewId/approve',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
      const { digitalSignature } = req.body;

      await publicationService.smeApprove(req.params.reviewId, userId, ipAddress, digitalSignature);

      res.json({
        success: true,
        message: 'Curriculum approved by SME',
      });
    } catch (error) {
      loggingService.error('Error approving curriculum', { error, reviewId: req.params.reviewId });
      res.status(500).json({
        success: false,
        error: 'Failed to approve curriculum',
      });
    }
  }
);

/**
 * POST /api/v2/review/:reviewId/reject
 * Reject curriculum
 */
router.post(
  '/review/:reviewId/reject',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.userId;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: 'Rejection reason is required',
        });
      }

      await publicationService.rejectCurriculum(req.params.reviewId, userId, reason);

      res.json({
        success: true,
        message: 'Curriculum rejected',
      });
    } catch (error) {
      loggingService.error('Error rejecting curriculum', { error, reviewId: req.params.reviewId });
      res.status(500).json({
        success: false,
        error: 'Failed to reject curriculum',
      });
    }
  }
);

/**
 * POST /api/v2/review/:reviewId/publication/approve
 * Admin approves publication (Admin only)
 */
router.post(
  '/review/:reviewId/publication/approve',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const adminId = (req as any).user.userId;
      const { notes } = req.body;

      await publicationService.adminApprovePublication(req.params.reviewId, adminId, notes);

      res.json({
        success: true,
        message: 'Publication approved',
      });
    } catch (error) {
      loggingService.error('Error approving publication', { error, reviewId: req.params.reviewId });
      res.status(500).json({
        success: false,
        error: 'Failed to approve publication',
      });
    }
  }
);

/**
 * POST /api/v2/review/:reviewId/publish
 * Publish to LMS (Admin only)
 */
router.post(
  '/review/:reviewId/publish',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const { lmsConfig } = req.body;

      await publicationService.publishToLMS(req.params.reviewId, lmsConfig);

      res.json({
        success: true,
        message: 'Curriculum published to LMS successfully',
      });
    } catch (error) {
      loggingService.error('Error publishing to LMS', { error, reviewId: req.params.reviewId });
      res.status(500).json({
        success: false,
        error: 'Failed to publish to LMS',
      });
    }
  }
);

/**
 * GET /api/v2/review/:reviewId
 * Get review details
 */
router.get('/review/:reviewId', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const review = await publicationService.getReview(req.params.reviewId);

    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Review not found',
      });
    }

    res.json({
      success: true,
      data: review,
    });
  } catch (error) {
    loggingService.error('Error getting review', { error, reviewId: req.params.reviewId });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve review',
    });
  }
});

/**
 * GET /api/v2/review/:reviewId/refinements
 * Get refinements for a review
 */
router.get(
  '/review/:reviewId/refinements',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const refinements = await publicationService.getRefinements(req.params.reviewId);

      res.json({
        success: true,
        data: refinements,
      });
    } catch (error) {
      loggingService.error('Error getting refinements', { error, reviewId: req.params.reviewId });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve refinements',
      });
    }
  }
);

export default router;
