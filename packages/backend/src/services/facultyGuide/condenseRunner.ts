/**
 * Runs the faculty-guide condensing pass (condensedGuide) over a programme's lessons and
 * stores each result on its lesson as `facultyGuide`. The lesson's own fields are not
 * touched, so the pass can be redone or dropped without losing anything.
 *
 * Idempotent: a lesson that already holds a current condensed session is skipped, so a run
 * cut short by a restart is finished by running it again. Before a module is saved its plan is
 * re-read and only the condensed sessions are merged in, so an edit made meanwhile survives.
 */
import { openaiService } from '../openaiService';
import { loggingService } from '../loggingService';
import { CurriculumWorkflow } from '../../models/CurriculumWorkflow';
import { ModuleLessonPlan } from '../../models/ModuleLessonPlan';
import { loadModulePlan, saveModulePlan } from '../step10Store';
import { hasActiveGeneration } from '../generationActivity';
import { guideContextFromWorkflow, guideSession } from './facultyGuideModel';
import {
  CONDENSED_GUIDE_VERSION,
  CondensedSession,
  parseCondensed,
  storedCondensed,
  SYSTEM_PROMPT,
  userPrompt,
} from './condensedGuide';
import mongoose from 'mongoose';

const MODEL = 'gpt-4o';
const LESSONS_IN_FLIGHT = 4;

export interface CondenseRun {
  workflowId: string;
  running: boolean;
  startedAt: string;
  finishedAt?: string;
  modules: string[];
  modulesDone: number;
  lessonsCondensed: number;
  lessonsSkipped: number;
  lessonsFailed: number;
  errors: string[];
}

const runs = new Map<string, CondenseRun>();

/** The latest run for a workflow in this process, if any. */
export const condenseRun = (workflowId: string) => runs.get(workflowId);

const lessonKey = (l: any, i: number) => String(l?.lessonId || l?.lessonNumber || i);

async function condenseOne(
  session: ReturnType<typeof guideSession>
): Promise<CondensedSession | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const raw = await openaiService.generateContent(userPrompt(session), SYSTEM_PROMPT, {
      model: MODEL,
      responseFormat: 'json_object',
      maxTokens: 3000,
      timeout: 120000,
    });
    const parsed = parseCondensed(raw, session);
    if (parsed) return parsed;
  }
  return null;
}

/** Map with at most `limit` promises running at once, in input order. */
async function inBatches<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    })
  );
  return results;
}

async function condenseModule(workflowId: string, workflow: any, module: any, run: CondenseRun) {
  const plan = await loadModulePlan(workflowId, module.id);
  if (!plan?.lessons?.length) return;
  const context = guideContextFromWorkflow(workflow, module);
  const ordered = [...(plan.lessons as any[])].sort(
    (a, b) => (a?.lessonNumber ?? 0) - (b?.lessonNumber ?? 0)
  );

  const done = new Map<string, CondensedSession>();
  const todo = ordered
    .map((lesson, i) => ({ lesson, i, previous: i > 0 ? ordered[i - 1] : undefined }))
    .filter(({ lesson }) => {
      if (storedCondensed(lesson?.facultyGuide)) {
        run.lessonsSkipped++;
        return false;
      }
      return true;
    });

  await inBatches(todo, LESSONS_IN_FLIGHT, async ({ lesson, i, previous }) => {
    const previousTopic = previous ? guideSession(previous, i - 1, context).topic : undefined;
    const session = guideSession(lesson, i, context, previousTopic);
    try {
      const condensed = await condenseOne(session);
      if (condensed) {
        done.set(lessonKey(lesson, i), condensed);
        run.lessonsCondensed++;
      } else {
        run.lessonsFailed++;
        run.errors.push(`${module.code || module.id} session ${session.number}: answer not usable`);
      }
    } catch (error) {
      run.lessonsFailed++;
      run.errors.push(
        `${module.code || module.id} session ${session.number}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  if (!done.size) return;
  if (await hasActiveGeneration(workflowId)) {
    run.errors.push(`${module.code || module.id}: not saved, a step is generating`);
    return;
  }
  // Merge into the plan as stored now, not as it was read, so a concurrent edit survives.
  const fresh = await loadModulePlan(workflowId, module.id);
  if (!fresh) return;
  const generatedAt = new Date().toISOString();
  const lessons = [...(fresh.lessons as any[])]
    .sort((a, b) => (a?.lessonNumber ?? 0) - (b?.lessonNumber ?? 0))
    .map((lesson, i) => {
      const condensed = done.get(lessonKey(lesson, i));
      return condensed
        ? { ...lesson, facultyGuide: { ...condensed, model: MODEL, generatedAt } }
        : lesson;
    });
  await saveModulePlan(workflowId, { ...fresh, moduleId: module.id, lessons }, module);
}

/**
 * Start condensing the given modules (Step 4 indexes, or all) in the background. Returns the
 * run at once; a run already in progress for the workflow is returned instead of a second.
 */
export async function startCondensing(
  workflowId: string,
  moduleIndexes: number[] | 'all'
): Promise<CondenseRun> {
  const existing = runs.get(workflowId);
  if (existing?.running) return existing;

  const workflow: any = await CurriculumWorkflow.findById(workflowId).lean();
  if (!workflow) throw new Error('Workflow not found');
  const all: any[] = workflow.step4?.modules || [];
  const modules = moduleIndexes === 'all' ? all : moduleIndexes.map((i) => all[i]).filter(Boolean);
  if (!modules.length) throw new Error('No such module');

  const run: CondenseRun = {
    workflowId,
    running: true,
    startedAt: new Date().toISOString(),
    modules: modules.map((m) => m.code || m.id),
    modulesDone: 0,
    lessonsCondensed: 0,
    lessonsSkipped: 0,
    lessonsFailed: 0,
    errors: [],
  };
  runs.set(workflowId, run);

  void (async () => {
    for (const module of modules) {
      try {
        await condenseModule(workflowId, workflow, module, run);
      } catch (error) {
        run.errors.push(
          `${module.code || module.id}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      run.modulesDone++;
    }
    run.running = false;
    run.finishedAt = new Date().toISOString();
    loggingService.info('Faculty guide condensing finished', {
      ...run,
      errors: run.errors.slice(0, 20),
    });
  })();
  return run;
}

/** How many of each module's lessons hold a current condensed session, from the database. */
export async function condensedCoverage(
  workflowId: string
): Promise<{ moduleCode: string; lessons: number; condensed: number }[]> {
  const rows = await ModuleLessonPlan.aggregate([
    { $match: { workflowId: new mongoose.Types.ObjectId(workflowId) } },
    {
      $project: {
        moduleCode: 1,
        lessons: { $size: { $ifNull: ['$lessons', []] } },
        condensed: {
          $size: {
            $filter: {
              input: { $ifNull: ['$lessons', []] },
              as: 'l',
              cond: { $eq: ['$$l.facultyGuide.version', CONDENSED_GUIDE_VERSION] },
            },
          },
        },
      },
    },
    { $sort: { moduleCode: 1 } },
  ]);
  return rows.map((r: any) => ({
    moduleCode: r.moduleCode,
    lessons: r.lessons,
    condensed: r.condensed,
  }));
}
