/**
 * Standalone Step Execution API Routes
 *
 * Base Path: /api/v3/standalone
 *
 * This router provides endpoints for executing individual curriculum generation
 * steps (2-10) without requiring a full workflow context.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 6.2, 6.3, 6.4, 6.5
 */

import { Router, Request, Response, NextFunction } from 'express';
import { standaloneService, STEP_METADATA } from '../services/standaloneService';
import { standaloneWordExportService } from '../services/standaloneWordExportService';
import { loggingService } from '../services/loggingService';

const router = Router();

// ============================================================================
// TIMEOUT MIDDLEWARE FOR LONG-RUNNING AI GENERATION
// ============================================================================

/**
 * Middleware to extend request timeout for AI-heavy operations
 */
const extendTimeout = (timeoutMs: number = 600000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    req.setTimeout(timeoutMs);
    res.setTimeout(timeoutMs);
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Keep-Alive', `timeout=${Math.floor(timeoutMs / 1000)}`);
    next();
  };
};

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate step number is in valid range (2-10)
 * Requirements: 9.5
 */
function validateStepNumber(stepNumber: number): { valid: boolean; error?: string } {
  if (isNaN(stepNumber)) {
    return { valid: false, error: 'Step number must be a valid number' };
  }
  if (stepNumber < 2 || stepNumber > 10) {
    return { valid: false, error: 'Step number must be between 2 and 10' };
  }
  return { valid: true };
}

/**
 * Validate description meets minimum requirements
 * Requirements: 9.5, 10.2
 */
function validateDescription(description: any): { valid: boolean; error?: string } {
  if (!description || typeof description !== 'string') {
    return { valid: false, error: 'Description is required' };
  }
  if (description.trim().length < 10) {
    return { valid: false, error: 'Please provide more details in your description.' };
  }
  return { valid: true };
}

// ============================================================================
// ROUTES
// ============================================================================

/**
 * GET /api/v3/standalone/steps
 * Get available steps metadata
 */
router.get('/steps', (req: Request, res: Response) => {
  const steps = Object.entries(STEP_METADATA).map(([stepNumber, metadata]) => ({
    stepNumber: parseInt(stepNumber),
    ...metadata,
  }));

  res.json({
    success: true,
    data: steps,
  });
});

/**
 * POST /api/v3/standalone/step/:stepNumber
 * Execute a standalone step generation
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 *
 * @param stepNumber - Step number (2-10)
 * @body description - User-provided description for the step
 *
 * @returns JSON response with generated content
 */
router.post(
  '/step/:stepNumber',
  extendTimeout(3600000), // 60 minutes timeout for GPT-5 with 128k token generation
  async (req: Request, res: Response) => {
    const startTime = Date.now();

    try {
      const stepNumber = parseInt(req.params.stepNumber, 10);
      const { description } = req.body;

      // Validate step number (Requirements: 9.5)
      const stepValidation = validateStepNumber(stepNumber);
      if (!stepValidation.valid) {
        return res.status(400).json({
          success: false,
          error: stepValidation.error,
        });
      }

      // Validate description (Requirements: 9.5, 10.2)
      const descValidation = validateDescription(description);
      if (!descValidation.valid) {
        return res.status(400).json({
          success: false,
          error: descValidation.error,
        });
      }

      loggingService.info('Standalone step execution started', {
        stepNumber,
        descriptionLength: description.length,
      });

      // Execute step generation (Requirements: 9.3 - no auth required)
      const result = await standaloneService.generateStep(stepNumber, description.trim());

      const duration = Date.now() - startTime;
      loggingService.info('Standalone step execution completed', {
        stepNumber,
        duration,
      });

      // Return JSON response (Requirements: 9.2, 9.4)
      res.json({
        success: true,
        data: {
          stepNumber: result.stepNumber,
          stepName: result.stepName,
          content: result.content,
          generatedAt: result.generatedAt,
        },
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      loggingService.error('Standalone step execution failed', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        stepNumber: req.params.stepNumber,
        duration,
      });

      // Handle timeout errors
      if (error instanceof Error && error.message.includes('timeout')) {
        return res.status(504).json({
          success: false,
          error: 'Request timed out. Please try again.',
        });
      }

      // Handle OpenAI API errors with more detail
      if (error instanceof Error) {
        // Check for API key issues
        if (error.message.includes('API key') || error.message.includes('authentication')) {
          return res.status(500).json({
            success: false,
            error: 'AI service configuration error. Please contact support.',
          });
        }
        
        // Check for rate limiting
        if (error.message.includes('rate limit') || error.message.includes('429')) {
          return res.status(429).json({
            success: false,
            error: 'AI service is busy. Please try again in a few moments.',
          });
        }

        // Return the actual error message for debugging
        return res.status(500).json({
          success: false,
          error: `Generation failed: ${error.message}`,
        });
      }

      // Generic error
      res.status(500).json({
        success: false,
        error: 'Generation failed. Please try again.',
      });
    }
  }
);

/**
 * POST /api/v3/standalone/export
 * Export standalone step output as Word document
 *
 * Requirements: 6.2, 6.3, 6.4, 6.5
 *
 * @body stepNumber - Step number (2-10)
 * @body stepName - Name of the step
 * @body description - User-provided description
 * @body content - Generated content to export
 *
 * @returns Word document (.docx) file
 */
router.post('/export', async (req: Request, res: Response) => {
  try {
    const { stepNumber, stepName, description, content } = req.body;

    // Validate required fields
    if (!stepNumber || !stepName || !content) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: stepNumber, stepName, and content are required',
      });
    }

    // Validate step number
    const stepValidation = validateStepNumber(stepNumber);
    if (!stepValidation.valid) {
      return res.status(400).json({
        success: false,
        error: stepValidation.error,
      });
    }

    loggingService.info('Standalone Word export started', {
      stepNumber,
      stepName,
      hasDescription: !!description,
    });

    // Generate Word document (Requirements: 6.2, 6.3, 6.4, 6.5)
    const buffer = await standaloneWordExportService.generateStepDocument({
      stepNumber,
      stepName,
      description: description || '',
      content,
    });

    // Set response headers for file download
    const filename = `${stepName.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.docx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);

    loggingService.info('Standalone Word export completed', {
      stepNumber,
      filename,
      bufferSize: buffer.length,
    });

    res.send(buffer);
  } catch (error) {
    loggingService.error('Standalone Word export failed', {
      error: error instanceof Error ? error.message : String(error),
    });

    res.status(500).json({
      success: false,
      error: 'Failed to generate Word document. Please try again.',
    });
  }
});

export default router;
