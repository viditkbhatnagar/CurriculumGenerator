/**
 * Step 7 Streaming Routes
 * Server-Sent Events (SSE) endpoint for real-time assessment generation
 */
import { Router, Request, Response } from 'express';
import { validateJWT, loadUser } from '../middleware/auth';
import { loggingService } from '../services/loggingService';
import { workflowService } from '../services/workflowService';
import { CurriculumWorkflow } from '../models/CurriculumWorkflow';
import { AssessmentUserPreferences } from '../types/assessmentGenerator';

const router = Router();

/**
 * POST /api/v3/workflow/:id/step7/stream
 * Stream Step 7 assessment generation with real-time updates
 */
router.post('/:id/step7/stream', validateJWT, loadUser, async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Stream established' })}\n\n`);

    // Extract user preferences
    const userPreferences: AssessmentUserPreferences = {
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

    // Validation
    if (
      isNaN(userPreferences.formativePerModule) ||
      userPreferences.formativePerModule < 1 ||
      userPreferences.formativePerModule > 5
    ) {
      res.write(
        `data: ${JSON.stringify({ type: 'error', error: 'Formative assessments per module must be between 1 and 5' })}\n\n`
      );
      res.end();
      return;
    }

    if (userPreferences.assessmentStructure === 'both_formative_and_summative') {
      const totalWeight =
        (userPreferences.weightages.formative || 0) + (userPreferences.weightages.summative || 0);
      if (Math.abs(totalWeight - 100) > 0.1) {
        res.write(
          `data: ${JSON.stringify({ type: 'error', error: 'Formative and summative weightages must sum to 100%' })}\n\n`
        );
        res.end();
        return;
      }
    }

    loggingService.info('[Step 7 Stream] Starting generation', { workflowId: id });

    // Send progress updates as generation happens
    const progressCallback = (progress: any) => {
      res.write(`data: ${JSON.stringify({ type: 'progress', progress })}\n\n`);
    };

    // Send incremental data updates directly (don't wrap in extra layer)
    const dataCallback = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Process Step 7 with callbacks - returns workflow with all saves completed
    const workflow = await workflowService.processStep7Streaming(
      id,
      userPreferences,
      progressCallback,
      dataCallback
    );

    // Send completion message with the returned workflow (already saved to DB)
    loggingService.info('[Step 7 Stream] Sending completion message', {
      formativeCount: workflow?.step7?.formativeAssessments?.length || 0,
      summativeCount: workflow?.step7?.summativeAssessments?.length || 0,
    });

    res.write(
      `data: ${JSON.stringify({
        type: 'complete',
        data: {
          step7: workflow?.step7,
          summary: {
            formativeCount: workflow?.step7?.formativeAssessments?.length || 0,
            summativeCount: workflow?.step7?.summativeAssessments?.length || 0,
            sampleQuestionsTotal:
              (workflow?.step7?.sampleQuestions?.mcq?.length || 0) +
              (workflow?.step7?.sampleQuestions?.sjt?.length || 0) +
              (workflow?.step7?.sampleQuestions?.caseQuestions?.length || 0) +
              (workflow?.step7?.sampleQuestions?.essayPrompts?.length || 0) +
              (workflow?.step7?.sampleQuestions?.practicalTasks?.length || 0),
          },
        },
        message: 'Step 7 complete',
      })}\n\n`
    );

    res.end();
  } catch (error) {
    loggingService.error('[Step 7 Stream] Error', { error, workflowId: id });
    res.write(
      `data: ${JSON.stringify({
        type: 'error',
        error: error instanceof Error ? error.message : 'Failed to process Step 7',
      })}\n\n`
    );
    res.end();
  }
});

export default router;
