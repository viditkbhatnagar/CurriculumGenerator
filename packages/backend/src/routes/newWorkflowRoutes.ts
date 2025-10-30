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
 * GET /api/v2/projects/published
 * Get all published projects (public endpoint for dashboard)
 */
router.get('/projects/published', async (req: Request, res: Response) => {
  try {
    const { limit = 10 } = req.query;

    const projects = await CurriculumProject.find({ status: 'published' })
      .populate('promptId', 'promptTitle domain level')
      .populate('smeId', 'name email')
      .sort({ 'stageProgress.stage5.publishedAt': -1 })
      .limit(parseInt(limit as string));

    res.json({
      success: true,
      data: projects,
      count: projects.length,
    });
  } catch (error) {
    loggingService.error('Error getting published projects', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve published projects',
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
 * POST /api/v2/projects/:id/research/regenerate/:componentKey
 * Regenerate a specific component in the preliminary package
 * Requires authentication
 */
router.post(
  '/projects/:id/research/regenerate/:componentKey',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const { id: projectId, componentKey } = req.params;

      // Validate component key
      const validComponents = [
        'programOverview',
        'competencyFramework',
        'learningOutcomes',
        'courseFramework',
        'topicSources',
        'readingList',
        'assessments',
        'glossary',
        'caseStudies',
        'deliveryTools',
        'references',
        'submissionMetadata',
        'outcomeWritingGuide',
        'comparativeBenchmarking',
      ];

      if (!validComponents.includes(componentKey)) {
        return res.status(400).json({
          success: false,
          error: `Invalid component key. Must be one of: ${validComponents.join(', ')}`,
        });
      }

      loggingService.info(`Regenerating component: ${componentKey}`, { projectId });

      // Regenerate the component
      await aiResearchService.regenerateComponent(projectId, componentKey);

      res.json({
        success: true,
        message: `Component ${componentKey} regenerated successfully`,
      });
    } catch (error) {
      loggingService.error('Error regenerating component', {
        error,
        projectId: req.params.id,
        componentKey: req.params.componentKey,
      });
      res.status(500).json({
        success: false,
        error: 'Failed to regenerate component',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

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

// ==================================================================================
// STAGE 3: RESOURCE COST EVALUATION ROUTES
// ==================================================================================

/**
 * POST /api/v2/projects/:id/cost/evaluate
 * Start cost evaluation (scan components for paid resources)
 */
router.post(
  '/projects/:id/cost/evaluate',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const { resourceCostService } = await import('../services/resourceCostService');
      const costEval = await resourceCostService.startEvaluation(req.params.id);

      res.json({
        success: true,
        data: costEval,
        message: 'Cost evaluation started successfully',
      });
    } catch (error) {
      loggingService.error('Error starting cost evaluation', { error, projectId: req.params.id });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start cost evaluation',
      });
    }
  }
);

/**
 * GET /api/v2/projects/:id/cost
 * Get cost evaluation results
 */
router.get('/projects/:id/cost', async (req: Request, res: Response) => {
  try {
    const { resourceCostService } = await import('../services/resourceCostService');
    const costEval = await resourceCostService.getCostEvaluation(req.params.id);

    if (!costEval) {
      return res.status(404).json({
        success: false,
        error: 'Cost evaluation not found',
      });
    }

    res.json({
      success: true,
      data: costEval,
    });
  } catch (error) {
    loggingService.error('Error getting cost evaluation', { error, projectId: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve cost evaluation',
    });
  }
});

/**
 * POST /api/v2/projects/:id/cost/approve
 * Management approves cost evaluation
 */
router.post(
  '/projects/:id/cost/approve',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const { resourceCostService } = await import('../services/resourceCostService');
      const { selectedAlternatives } = req.body;
      const userId = (req as any).user?.userId || 'dev-user';

      const costEval = await resourceCostService.approveCostEvaluation(
        req.params.id,
        userId,
        selectedAlternatives
      );

      res.json({
        success: true,
        data: costEval,
        message: 'Cost evaluation approved. Moving to Stage 4.',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      loggingService.error('Error approving cost evaluation', {
        error: errorMessage,
        stack: errorStack,
        projectId: req.params.id,
      });
      res.status(500).json({
        success: false,
        error: errorMessage || 'Failed to approve cost evaluation',
      });
    }
  }
);

/**
 * POST /api/v2/projects/:id/cost/reject
 * Management rejects cost evaluation
 */
router.post(
  '/projects/:id/cost/reject',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const { resourceCostService } = await import('../services/resourceCostService');
      const { reason } = req.body;
      const userId = (req as any).user?.userId || 'dev-user';

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: 'Rejection reason is required',
        });
      }

      const costEval = await resourceCostService.rejectCostEvaluation(
        req.params.id,
        userId,
        reason
      );

      res.json({
        success: true,
        data: costEval,
        message: 'Cost evaluation rejected. SME will need to revise resources.',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      loggingService.error('Error rejecting cost evaluation', {
        error: errorMessage,
        stack: errorStack,
        projectId: req.params.id,
      });
      res.status(500).json({
        success: false,
        error: errorMessage || 'Failed to reject cost evaluation',
      });
    }
  }
);

// ==========================================
// STAGE 4: FULL CURRICULUM PACKAGE GENERATION
// ==========================================

/**
 * POST /api/v2/projects/:id/curriculum/generate
 * Start full curriculum package generation
 */
router.post(
  '/projects/:id/curriculum/generate',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const { curriculumGenerationServiceV2 } = await import(
        '../services/curriculumGenerationServiceV2'
      );

      const fullPackageId = await curriculumGenerationServiceV2.startGeneration(req.params.id);

      res.json({
        success: true,
        data: { fullPackageId },
        message: 'Full curriculum generation started',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      loggingService.error('Error starting curriculum generation', {
        error: errorMessage,
        stack: errorStack,
        projectId: req.params.id,
      });
      res.status(500).json({
        success: false,
        error: errorMessage || 'Failed to start curriculum generation',
      });
    }
  }
);

/**
 * GET /api/v2/projects/:id/curriculum/package
 * Get full curriculum package
 */
router.get('/projects/:id/curriculum/package', async (req: Request, res: Response) => {
  try {
    const { FullCurriculumPackage } = await import('../models/FullCurriculumPackage');

    const fullPackage = await FullCurriculumPackage.findOne({ projectId: req.params.id });

    if (!fullPackage) {
      return res.status(404).json({
        success: false,
        error: 'Full curriculum package not found',
      });
    }

    // Transform response to match frontend expectations
    const packageData = fullPackage.toObject();

    // Extract rubrics from case studies
    const rubrics = [];
    for (const caseStudy of packageData.caseStudies || []) {
      if (caseStudy.rubric) {
        rubrics.push({
          id: caseStudy.id || caseStudy._id,
          title: `Rubric for: ${caseStudy.title}`,
          assessmentType: 'Case Study',
          levels: caseStudy.rubric.levels || [],
          criteria: caseStudy.rubric.criteria || [],
        });
      }
    }

    const responseData = {
      ...packageData,
      assessmentBank: packageData.mcqExams || [], // Frontend expects assessmentBank
      rubrics: rubrics, // Extract rubrics from case studies
    };

    res.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    loggingService.error('Error getting full curriculum package', {
      error,
      projectId: req.params.id,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to get full curriculum package',
    });
  }
});

/**
 * GET /api/v2/projects/:id/curriculum/download
 * Download full curriculum package as Word document
 */
router.get('/projects/:id/curriculum/download', async (req: Request, res: Response) => {
  try {
    const { FullCurriculumPackage } = await import('../models/FullCurriculumPackage');
    const { docxGenerationService } = await import('../services/docxGenerationService');

    const fullPackage = await FullCurriculumPackage.findOne({ projectId: req.params.id });

    if (!fullPackage) {
      return res.status(404).json({
        success: false,
        error: 'Full curriculum package not found',
      });
    }

    // Generate DOCX buffer
    const buffer = await docxGenerationService.generateCurriculumDocument(fullPackage.toObject());

    // Set headers for file download
    const filename = `curriculum-package-${req.params.id}-${new Date().toISOString().split('T')[0]}.docx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    // Send buffer
    res.send(buffer);
  } catch (error) {
    loggingService.error('Error downloading curriculum package', {
      error,
      projectId: req.params.id,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to download curriculum package',
    });
  }
});

// ==========================================
// STAGE 5: FINAL REVIEW & PUBLICATION
// ==========================================

/**
 * POST /api/v2/projects/:id/review/start
 * Start final SME review
 */
router.post(
  '/projects/:id/review/start',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const { publicationService } = await import('../services/publicationService');
      const userId = (req as any).user?.userId || 'dev-user';

      const reviewId = await publicationService.startReview(req.params.id, userId);

      res.json({
        success: true,
        data: { reviewId },
        message: 'Final review started',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      loggingService.error('Error starting review', {
        error: errorMessage,
        stack: errorStack,
        projectId: req.params.id,
      });
      res.status(500).json({
        success: false,
        error: errorMessage || 'Failed to start review',
      });
    }
  }
);

/**
 * GET /api/v2/projects/:id/review
 * Get review status
 */
router.get('/projects/:id/review', async (req: Request, res: Response) => {
  try {
    const { CurriculumReview } = await import('../models/CurriculumReview');

    const review = await CurriculumReview.findOne({ projectId: req.params.id });

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
    loggingService.error('Error getting review', { error, projectId: req.params.id });
    res.status(500).json({
      success: false,
      error: 'Failed to get review',
    });
  }
});

/**
 * POST /api/v2/projects/:id/review/approve
 * SME approves curriculum for publication
 */
router.post(
  '/projects/:id/review/approve',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const { publicationService } = await import('../services/publicationService');
      const userId = (req as any).user?.userId || 'dev-user';
      const ipAddress = req.ip || 'unknown';
      const { digitalSignature } = req.body;

      const { CurriculumReview } = await import('../models/CurriculumReview');
      const review = await CurriculumReview.findOne({ projectId: req.params.id });

      if (!review) {
        return res.status(404).json({
          success: false,
          error: 'Review not found',
        });
      }

      await publicationService.smeApprove(
        review._id.toString(),
        userId,
        ipAddress,
        digitalSignature
      );

      res.json({
        success: true,
        message: 'Curriculum approved by SME',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      loggingService.error('Error approving curriculum', {
        error: errorMessage,
        stack: errorStack,
        projectId: req.params.id,
      });
      res.status(500).json({
        success: false,
        error: errorMessage || 'Failed to approve curriculum',
      });
    }
  }
);

/**
 * POST /api/v2/projects/:id/review/reject
 * Reject curriculum with reason
 */
router.post(
  '/projects/:id/review/reject',
  validateJWT,
  loadUser,
  async (req: Request, res: Response) => {
    try {
      const { publicationService } = await import('../services/publicationService');
      const userId = (req as any).user?.userId || 'dev-user';
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: 'Rejection reason is required',
        });
      }

      const { CurriculumReview } = await import('../models/CurriculumReview');
      const review = await CurriculumReview.findOne({ projectId: req.params.id });

      if (!review) {
        return res.status(404).json({
          success: false,
          error: 'Review not found',
        });
      }

      await publicationService.rejectCurriculum(review._id.toString(), userId, reason);

      res.json({
        success: true,
        message: 'Curriculum rejected',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      loggingService.error('Error rejecting curriculum', {
        error: errorMessage,
        stack: errorStack,
        projectId: req.params.id,
      });
      res.status(500).json({
        success: false,
        error: errorMessage || 'Failed to reject curriculum',
      });
    }
  }
);

/**
 * POST /api/v2/projects/:id/publish
 * Publish curriculum to LMS
 */
router.post('/projects/:id/publish', validateJWT, loadUser, async (req: Request, res: Response) => {
  try {
    const { publicationService } = await import('../services/publicationService');
    const { lmsConfig } = req.body;

    const { CurriculumReview } = await import('../models/CurriculumReview');
    const review = await CurriculumReview.findOne({ projectId: req.params.id });

    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Review not found',
      });
    }

    await publicationService.publishToLMS(review._id.toString(), lmsConfig);

    res.json({
      success: true,
      message: 'Curriculum published to LMS successfully',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    loggingService.error('Error publishing curriculum', {
      error: errorMessage,
      stack: errorStack,
      projectId: req.params.id,
    });
    res.status(500).json({
      success: false,
      error: errorMessage || 'Failed to publish curriculum',
    });
  }
});

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

export default router;
