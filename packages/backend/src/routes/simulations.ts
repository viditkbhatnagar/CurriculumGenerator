import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { createSimulationEngine } from '../services/simulationEngine';
import { validateJWT, loadUser } from '../middleware/auth';

export const createSimulationsRouter = (): Router => {
  // TODO: Update SimulationEngine to use MongoDB models
  const db: any = null; // Temporary placeholder during migration
  const router = Router();
  const simulationEngine = createSimulationEngine(db);

  /**
   * POST /api/simulations/create
   * Create a new scenario
   * Implements Requirement 9.1
   */
  router.post('/create', validateJWT, loadUser, async (req: Request, res: Response) => {
    try {
      const { topic, difficulty, courseId, industry, roleType } = req.body;

      if (!topic || !difficulty) {
        return res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: 'Topic and difficulty are required',
          },
        });
      }

      if (difficulty < 1 || difficulty > 5) {
        return res.status(400).json({
          error: {
            code: 'INVALID_DIFFICULTY',
            message: 'Difficulty must be between 1 and 5',
          },
        });
      }

      const scenario = await simulationEngine.createScenario({
        topic,
        difficulty,
        courseId,
        industry,
        roleType,
      });

      res.status(201).json({
        success: true,
        scenario,
      });
    } catch (error) {
      console.error('Error creating scenario:', error);
      res.status(500).json({
        error: {
          code: 'SCENARIO_CREATION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to create scenario',
        },
      });
    }
  });

  /**
   * POST /api/simulations/:id/action
   * Process student action in a scenario
   * Implements Requirements 9.2, 9.3
   */
  router.post('/:id/action', validateJWT, loadUser, async (req: Request, res: Response) => {
    try {
      const scenarioId = req.params.id;
      const { actionId } = req.body;
      const studentId = (req as any).user?.userId;

      if (!actionId) {
        return res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: 'Action ID is required',
          },
        });
      }

      if (!studentId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Student ID not found in token',
          },
        });
      }

      const newState = await simulationEngine.processAction({
        scenarioId,
        studentId,
        actionId,
      });

      res.json({
        success: true,
        state: newState,
      });
    } catch (error) {
      console.error('Error processing action:', error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: error.message,
          },
        });
      }

      if (error instanceof Error && error.message.includes('already complete')) {
        return res.status(400).json({
          error: {
            code: 'SCENARIO_COMPLETE',
            message: error.message,
          },
        });
      }

      res.status(500).json({
        error: {
          code: 'ACTION_PROCESSING_FAILED',
          message: error instanceof Error ? error.message : 'Failed to process action',
        },
      });
    }
  });

  /**
   * GET /api/simulations/:id/evaluate
   * Get performance report for completed scenario
   * Implements Requirements 9.3, 9.4
   */
  router.get('/:id/evaluate', validateJWT, loadUser, async (req: Request, res: Response) => {
    try {
      const scenarioId = req.params.id;
      const studentId = (req as any).user?.userId;

      if (!studentId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Student ID not found in token',
          },
        });
      }

      const report = await simulationEngine.evaluatePerformance(scenarioId, studentId);

      res.json({
        success: true,
        report,
      });
    } catch (error) {
      console.error('Error evaluating performance:', error);

      if (error instanceof Error && error.message.includes('must be completed')) {
        return res.status(400).json({
          error: {
            code: 'SCENARIO_NOT_COMPLETE',
            message: error.message,
          },
        });
      }

      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: error.message,
          },
        });
      }

      res.status(500).json({
        error: {
          code: 'EVALUATION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to evaluate performance',
        },
      });
    }
  });

  /**
   * POST /api/simulations/:id/reset
   * Reset scenario to allow replay
   * Implements Requirement 9.5
   */
  router.post('/:id/reset', validateJWT, loadUser, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scenarioId = req.params.id;
      const studentId = (req as any).user?.userId;

      if (!studentId) {
        return res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Student ID not found in token',
          },
        });
      }

      const initialState = await simulationEngine.resetScenario(scenarioId, studentId);

      res.json({
        success: true,
        message: 'Scenario reset successfully',
        state: initialState,
      });
    } catch (error) {
      console.error('Error resetting scenario:', error);
      next(error);
    }
  });

  return router;
}
