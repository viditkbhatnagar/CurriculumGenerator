/**
 * Writes each unit's assessment criteria, indicative content and aim (unitCriteria) in the
 * background, and stores them on the Step 4 module as `othm`.
 *
 * Idempotent: a unit whose outcomes all have current criteria is skipped, so a run cut short by
 * a restart is finished by running it again. Each unit is saved with a positional update of
 * its own module, so units finishing together cannot overwrite each other, and an edit made to
 * the rest of Step 4 meanwhile is kept.
 */
import mongoose from 'mongoose';
import { openaiService } from '../openaiService';
import { loggingService } from '../loggingService';
import { CurriculumWorkflow } from '../../models/CurriculumWorkflow';
import {
  parseUnitCriteria,
  SYSTEM_PROMPT,
  UnitCriteria,
  unitCriteriaComplete,
  userPrompt,
} from './unitCriteria';

const UNITS_IN_FLIGHT = 3;

export interface CriteriaRun {
  workflowId: string;
  running: boolean;
  startedAt: string;
  finishedAt?: string;
  units: number;
  written: number;
  skipped: number;
  failed: number;
  errors: string[];
}

const runs = new Map<string, CriteriaRun>();
export const criteriaRun = (workflowId: string) => runs.get(workflowId);

async function writeUnit(module: any, programme: { title?: string; level?: string }) {
  let last: UnitCriteria | null = null;
  for (let attempt = 1; attempt <= 2 && !last; attempt++) {
    const raw = await openaiService.generateContent(userPrompt(module, programme), SYSTEM_PROMPT, {
      responseFormat: 'json_object',
      maxTokens: 16000,
      timeout: 300000,
    });
    last = parseUnitCriteria(raw, module);
  }
  return last;
}

/** Start writing criteria for every unit that lacks them. Returns the run at once. */
export async function startUnitCriteria(workflowId: string): Promise<CriteriaRun> {
  const existing = runs.get(workflowId);
  if (existing?.running) return existing;

  const workflow: any = await CurriculumWorkflow.findById(workflowId).lean();
  const modules: any[] = workflow?.step4?.modules || [];
  if (!workflow || !modules.length) throw new Error('Workflow or Step 4 modules not found');
  const programme = {
    title: workflow.step1?.programTitle || workflow.projectName,
    level: workflow.step1?.academicLevel,
  };

  const todo = modules.filter((m) => m?.id && (m.mlos || []).length && !unitCriteriaComplete(m));
  const run: CriteriaRun = {
    workflowId,
    running: true,
    startedAt: new Date().toISOString(),
    units: modules.length,
    written: 0,
    skipped: modules.length - todo.length,
    failed: 0,
    errors: [],
  };
  runs.set(workflowId, run);

  void (async () => {
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(UNITS_IN_FLIGHT, todo.length) }, async () => {
        while (next < todo.length) {
          const module = todo[next++];
          try {
            const result = await writeUnit(module, programme);
            if (!result) {
              run.failed++;
              run.errors.push(`${module.code || module.id}: answer incomplete after two attempts`);
              continue;
            }
            await CurriculumWorkflow.collection.updateOne(
              { _id: new mongoose.Types.ObjectId(workflowId), 'step4.modules.id': module.id },
              { $set: { 'step4.modules.$.othm': result } }
            );
            run.written++;
          } catch (error) {
            run.failed++;
            run.errors.push(
              `${module.code || module.id}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      })
    );
    run.running = false;
    run.finishedAt = new Date().toISOString();
    loggingService.info('Unit assessment criteria finished', {
      ...run,
      errors: run.errors.slice(0, 20),
    });
  })();
  return run;
}
