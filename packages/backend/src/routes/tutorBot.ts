import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { validateJWT, loadUser, requireRole } from '../middleware/auth';
import { UserRole } from '../types/auth';
import { createTutorBotService } from '../services/tutorBotService';
import { ChatRequest } from '../types/tutorBot';

/**
 * Tutor Bot Routes
 * API endpoints for AI-powered student support
 * Implements Requirements 8.1, 8.4
 */

export function createTutorBotRouter(): Router {
  // TODO: Update TutorBotService to use MongoDB models
  const db: any = null; // Temporary placeholder during migration
  const router = Router();
  const tutorBotService = createTutorBotService(db);

  // All tutor bot routes require authentication
  router.use(validateJWT, loadUser);

  /**
   * POST /api/tutor/chat
   * Send a chat message to the tutor bot
   * Implements Requirements 8.1, 8.5
   */
  router.post('/chat', async (req: Request, res: Response) => {
    try {
      const { studentId, message, courseId }: ChatRequest = req.body;

      // Validate request
      if (!studentId || !message || !courseId) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'studentId, message, and courseId are required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      // Students can only chat as themselves
      if (req.user?.role === UserRole.STUDENT && req.user.id !== studentId) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Students can only access their own chat',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      // Generate tutor response
      const response = await tutorBotService.chat(studentId, message, courseId);

      res.json({
        success: true,
        data: response,
      });
    } catch (error) {
      console.error('Error in tutor chat:', error);
      res.status(500).json({
        error: {
          code: 'CHAT_ERROR',
          message: error instanceof Error ? error.message : 'Failed to process chat message',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
    }
  });

  /**
   * GET /api/tutor/history/:studentId
   * Get conversation history for a student
   * Implements Requirement 8.4
   */
  router.get('/history/:studentId', async (req: Request, res: Response) => {
    try {
      const { studentId } = req.params;
      const { courseId } = req.query;

      if (!courseId) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'courseId query parameter is required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      // Students can only view their own history
      if (req.user?.role === UserRole.STUDENT && req.user.id !== studentId) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Students can only access their own conversation history',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      const history = await tutorBotService.getConversationHistory(
        studentId,
        courseId as string
      );

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      console.error('Error fetching conversation history:', error);
      res.status(500).json({
        error: {
          code: 'HISTORY_ERROR',
          message: 'Failed to fetch conversation history',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
    }
  });

  /**
   * GET /api/tutor/progress/:studentId
   * Get student progress and comprehension tracking
   * Implements Requirement 8.4
   */
  router.get('/progress/:studentId', async (req: Request, res: Response) => {
    try {
      const { studentId } = req.params;
      const { courseId } = req.query;

      if (!courseId) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'courseId query parameter is required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      // Students can only view their own progress
      // Admins and SMEs can view any student's progress
      if (
        req.user?.role === UserRole.STUDENT &&
        req.user.id !== studentId
      ) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Students can only access their own progress',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      const progress = await tutorBotService.getStudentProgress(
        studentId,
        courseId as string
      );

      // Convert Map to object for JSON serialization
      const progressData = {
        ...progress,
        comprehensionLevels: Object.fromEntries(progress.comprehensionLevels),
      };

      res.json({
        success: true,
        data: progressData,
      });
    } catch (error) {
      console.error('Error fetching student progress:', error);
      res.status(500).json({
        error: {
          code: 'PROGRESS_ERROR',
          message: 'Failed to fetch student progress',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
    }
  });

  /**
   * POST /api/tutor/resource-engagement
   * Track when a student engages with a suggested resource
   * Implements Requirement 8.4
   */
  router.post('/resource-engagement', async (req: Request, res: Response) => {
    try {
      const { studentId, courseId, resourceId } = req.body;

      if (!studentId || !courseId || !resourceId) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'studentId, courseId, and resourceId are required',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      // Students can only track their own engagement
      if (req.user?.role === UserRole.STUDENT && req.user.id !== studentId) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Students can only track their own resource engagement',
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id'] || 'unknown',
          },
        });
        return;
      }

      await tutorBotService.trackResourceEngagement(studentId, courseId, resourceId);

      res.json({
        success: true,
        message: 'Resource engagement tracked successfully',
      });
    } catch (error) {
      console.error('Error tracking resource engagement:', error);
      res.status(500).json({
        error: {
          code: 'TRACKING_ERROR',
          message: 'Failed to track resource engagement',
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id'] || 'unknown',
        },
      });
    }
  });

  return router;
}
