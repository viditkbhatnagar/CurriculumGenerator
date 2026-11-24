/**
 * Refuses a step's first generation until the previous step is approved (services/stepGating,
 * generationBlocker). Mounted in front of every step's generate route.
 */
import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { CurriculumWorkflow } from '../models/CurriculumWorkflow';
import { generationBlocker } from '../services/stepGating';
import { loggingService } from '../services/loggingService';

export function requirePreviousApproval(step: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id || (req.params as any)[0];
      if (!mongoose.isValidObjectId(id)) return next(); // the route itself answers
      // Only the step's field names: a Step 7 or Step 10 document can run to megabytes.
      const [row] = await CurriculumWorkflow.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(id) } },
        {
          $project: {
            stepProgress: 1,
            previousApprovedAt: `$step${step - 1}.approvedAt`,
            stepKeys: {
              $map: {
                input: { $objectToArray: { $ifNull: [`$step${step}`, {}] } },
                as: 'f',
                in: '$$f.k',
              },
            },
          },
        },
      ]);
      if (!row) return next(); // the route itself answers 404
      const workflow = {
        stepProgress: row.stepProgress,
        [`step${step - 1}`]: { approvedAt: row.previousApprovedAt },
        [`step${step}`]: Object.fromEntries((row.stepKeys || []).map((k: string) => [k, true])),
      };
      const blocker = generationBlocker(workflow, step);
      if (!blocker) return next();
      return res.status(409).json({ success: false, code: 'APPROVAL_REQUIRED', error: blocker });
    } catch (error) {
      // The gate must not stop work because of its own failure; the route's checks still run.
      loggingService.warn('Approval gate could not check the workflow', {
        step,
        error: error instanceof Error ? error.message : String(error),
      });
      return next();
    }
  };
}
