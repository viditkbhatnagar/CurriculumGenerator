/**
 * Reading and writing Step 10 lesson plans, which live outside the workflow document.
 *
 * The workflow document keeps a stub per module — code, title, hours, lesson count — and the
 * lesson bodies live one row per module in `modulelessonplans`. See `ModuleLessonPlan` for
 * why: 46 modules of teaching content do not fit in MongoDB's 16MB document limit, and the
 * programme that proved it had 645 bytes to spare.
 *
 * Two rules this module exists to enforce:
 *
 * A failed save must stop generation. Previously the progress callback caught its own write
 * errors and let the loop continue, so once the document was full the system spent forty
 * minutes making OpenAI calls whose results were discarded, and reported the module as
 * generated afterwards. Writes here throw.
 *
 * Lesson bodies must never be attached to a live Mongoose document. `withLessons` returns a
 * plain object, so no caller can load 26MB of lessons and then persist them back into the
 * document this whole module exists to keep small.
 *
 * Step 11 solved the same 16MB problem by archiving deck slides to S3 (`pptDeckStore`). The
 * storage differs deliberately: deck slides are never read back — the .pptx download
 * regenerates them from these lesson plans — whereas lesson plans are read on every export,
 * every PPT generation, every LMS import and every time the screen opens a module. That is a
 * read-heavy, must-not-be-lossy workload, so it stays in MongoDB where it is one indexed
 * query and does not depend on S3 being configured.
 */

import mongoose from 'mongoose';
import { ModuleLessonPlan } from '../models/ModuleLessonPlan';
import { CurriculumWorkflow } from '../models/CurriculumWorkflow';
import { loggingService } from './loggingService';
import {
  CountableModule,
  LessonPlanLike,
  moduleStub,
  lessonsHeld,
  summariseFromStubs,
  validationFromStubs,
} from './step10Completion';

const toObjectId = (workflowId: string | mongoose.Types.ObjectId) =>
  typeof workflowId === 'string' ? new mongoose.Types.ObjectId(workflowId) : workflowId;

/**
 * Persist one module's lesson plans.
 *
 * The row is written first and the workflow stub second: if the process dies between them
 * the lessons still exist and the stub is rebuilt on the next read by `syncStubs`. The
 * reverse order would advertise lessons that were never stored.
 */
export async function saveModulePlan(
  workflowId: string,
  plan: LessonPlanLike & { moduleId: string },
  module?: CountableModule
): Promise<void> {
  const held = lessonsHeld(plan);

  await ModuleLessonPlan.updateOne(
    { workflowId: toObjectId(workflowId), moduleId: plan.moduleId },
    {
      $set: {
        moduleCode: plan.moduleCode || '',
        moduleTitle: plan.moduleTitle || '',
        moduleDescription: plan.moduleDescription || '',
        totalContactHours: plan.totalContactHours || 0,
        totalLessons: held,
        plannedLessonCount: plan.plannedLessonCount || held,
        lessons: plan.lessons || [],
        pptDecks: plan.pptDecks || [],
      },
    },
    { upsert: true }
  );

  await writeStub(workflowId, moduleStub({ ...plan, totalLessons: held }, module));
}

/**
 * Mirror a module's summary into the workflow document.
 *
 * Positional update first, push only when the module has no entry — the same shape the
 * previous incremental save used, because two concurrent module generations must not
 * overwrite each other's entries by rewriting the whole array.
 */
async function writeStub(workflowId: string, stub: LessonPlanLike): Promise<void> {
  const updated = await CurriculumWorkflow.updateOne(
    { _id: workflowId, 'step10.moduleLessonPlans.moduleId': stub.moduleId },
    { $set: { 'step10.moduleLessonPlans.$': stub } }
  );
  if (updated.matchedCount > 0) return;

  await CurriculumWorkflow.updateOne(
    { _id: workflowId, 'step10.moduleLessonPlans': { $exists: false } },
    {
      $set: {
        'step10.moduleLessonPlans': [],
        'step10.generatedAt': new Date(),
      },
    }
  );

  await CurriculumWorkflow.updateOne(
    { _id: workflowId, 'step10.moduleLessonPlans.moduleId': { $ne: stub.moduleId } },
    { $push: { 'step10.moduleLessonPlans': stub } } as any
  );
}

/** Every module plan for a workflow, lesson bodies included, in Step 4 module order. */
export async function loadModulePlans(workflowId: string): Promise<LessonPlanLike[]> {
  const rows = await ModuleLessonPlan.find({ workflowId: toObjectId(workflowId) }).lean();
  return rows.map(rowToPlan);
}

/** One module's plan with its lesson bodies, or null when it has never been generated. */
export async function loadModulePlan(
  workflowId: string,
  moduleId: string
): Promise<LessonPlanLike | null> {
  const row = await ModuleLessonPlan.findOne({
    workflowId: toObjectId(workflowId),
    moduleId,
  }).lean();
  return row ? rowToPlan(row) : null;
}

function rowToPlan(row: any): LessonPlanLike {
  return {
    moduleId: row.moduleId,
    moduleCode: row.moduleCode,
    moduleTitle: row.moduleTitle,
    moduleDescription: row.moduleDescription,
    totalContactHours: row.totalContactHours,
    totalLessons: row.totalLessons,
    plannedLessonCount: row.plannedLessonCount,
    lessons: row.lessons || [],
    pptDecks: row.pptDecks || [],
  };
}

/** Drop a module's plans, for a regenerate. */
export async function deleteModulePlan(workflowId: string, moduleId: string): Promise<void> {
  await ModuleLessonPlan.deleteOne({ workflowId: toObjectId(workflowId), moduleId });
  await CurriculumWorkflow.updateOne({ _id: workflowId }, {
    $pull: { 'step10.moduleLessonPlans': { moduleId } },
  } as any);
}

/**
 * A plain copy of the workflow with Step 10 lesson bodies filled in.
 *
 * Plain, and deliberately not the Mongoose document: attaching lessons to the live document
 * and calling `save()` anywhere downstream would write them straight back into the 16MB
 * budget. Callers that only need counts should use the stubs already in the workflow and not
 * call this at all.
 *
 * Module order follows Step 4, so the export and the screen list modules the same way
 * regardless of the order rows come back from the database.
 */
export async function withLessons(workflow: any): Promise<any> {
  if (!workflow) return workflow;
  const plain = typeof workflow.toObject === 'function' ? workflow.toObject() : { ...workflow };
  if (!plain.step10) return plain;

  const plans = await loadModulePlans(String(plain._id));
  if (plans.length === 0) return plain;

  const byId = new Map(plans.map((p) => [p.moduleId, p]));
  const order: string[] = (plain.step4?.modules || []).map((m: any) => m.id);
  const stubs: LessonPlanLike[] = plain.step10.moduleLessonPlans || [];

  const ordered = order.length > 0 ? order : stubs.map((s) => s.moduleId || '');
  const merged = ordered.map((id) => byId.get(id)).filter((p): p is LessonPlanLike => !!p);

  // Anything stored under a module id Step 4 no longer lists still belongs to the workflow;
  // dropping it here would make an export quietly shorter than the data behind it.
  for (const plan of plans) {
    if (!ordered.includes(plan.moduleId || '')) merged.push(plan);
  }

  plain.step10 = { ...plain.step10, moduleLessonPlans: merged };
  return plain;
}

/**
 * Rebuild the workflow's stubs from the rows, and report whether anything changed.
 *
 * Covers the gap between the two writes in `saveModulePlan`, and is what a workflow migrated
 * from the old embedded layout gets its stub list from.
 */
export async function syncStubs(workflowId: string): Promise<boolean> {
  const plans = await loadModulePlans(workflowId);
  if (plans.length === 0) return false;

  const workflow = await CurriculumWorkflow.findById(workflowId).select('step10.moduleLessonPlans');
  const existing: LessonPlanLike[] = (workflow as any)?.step10?.moduleLessonPlans || [];
  const stubs = plans.map((p) => moduleStub(p));

  const same =
    existing.length === stubs.length &&
    stubs.every((s) => {
      const found = existing.find((e) => e.moduleId === s.moduleId);
      return found && lessonsHeld(found) === s.totalLessons;
    });
  if (same) return false;

  await CurriculumWorkflow.updateOne(
    { _id: workflowId },
    { $set: { 'step10.moduleLessonPlans': stubs } }
  );
  loggingService.info('Rebuilt Step 10 stubs from stored lesson plans', {
    workflowId,
    modules: stubs.length,
  });
  return true;
}

/**
 * The module plan that owns a given lesson.
 *
 * Lessons are edited by id from the screen, which knows nothing about which module holds
 * them, so the lookup is by content rather than by key.
 */
export async function findPlanByLessonId(
  workflowId: string,
  lessonId: string
): Promise<LessonPlanLike | null> {
  const row = await ModuleLessonPlan.findOne({
    workflowId: toObjectId(workflowId),
    'lessons.lessonId': lessonId,
  }).lean();
  return row ? rowToPlan(row) : null;
}

/**
 * Recompute the Step 10 summary and validation on the workflow from its stubs.
 *
 * Called after anything changes a module's lessons. Both figures are derived from the
 * per-module stats the stubs carry, so this touches no lesson bodies.
 */
export async function refreshAggregates(workflowId: string): Promise<void> {
  const workflow = await CurriculumWorkflow.findById(workflowId).select('step10 step4.modules');
  if (!workflow || !(workflow as any).step10) return;

  const step10: any = (workflow as any).step10;
  const modules: CountableModule[] = (workflow as any).step4?.modules || [];

  await CurriculumWorkflow.updateOne(
    { _id: workflowId },
    {
      $set: {
        'step10.summary': summariseFromStubs(step10.moduleLessonPlans || []),
        'step10.validation': validationFromStubs(modules, step10),
      },
    }
  );
}

/**
 * Put a Step 10 snapshot back, splitting it the way generation does.
 *
 * A snapshot holds whole lesson plans. Writing it into the workflow document as-is would
 * restore the very 16MB overflow this store exists to prevent, so the bodies go to their own
 * rows and only stubs are set on the document.
 *
 * Modules the snapshot does not mention are removed, so a restore returns Step 10 to exactly
 * what it held rather than merging the old state into the new one.
 */
export async function restoreStep10Snapshot(workflowId: string, snapshot: any): Promise<any> {
  const plans: LessonPlanLike[] = snapshot?.moduleLessonPlans || [];

  const keep = new Set(plans.map((p) => p.moduleId).filter(Boolean) as string[]);
  await ModuleLessonPlan.deleteMany({
    workflowId: toObjectId(workflowId),
    moduleId: { $nin: [...keep] },
  });

  for (const plan of plans) {
    if (!plan?.moduleId) continue;
    await ModuleLessonPlan.updateOne(
      { workflowId: toObjectId(workflowId), moduleId: plan.moduleId },
      {
        $set: {
          moduleCode: plan.moduleCode || '',
          moduleTitle: plan.moduleTitle || '',
          moduleDescription: plan.moduleDescription || '',
          totalContactHours: plan.totalContactHours || 0,
          totalLessons: lessonsHeld(plan),
          plannedLessonCount: plan.plannedLessonCount || lessonsHeld(plan),
          lessons: plan.lessons || [],
          pptDecks: plan.pptDecks || [],
        },
      },
      { upsert: true }
    );
  }

  return { ...snapshot, moduleLessonPlans: plans.map((p) => moduleStub(p)) };
}

/**
 * Keep a stored module's title in step with a Step 4 rename.
 *
 * The row holds its own `moduleTitle`, and the export reads the row rather than the stub, so
 * without this a renamed module keeps its old title in every generated document.
 */
export async function renameStoredModule(
  workflowId: string,
  moduleId: string,
  oldTitle: string,
  newTitle: string
): Promise<void> {
  await ModuleLessonPlan.updateOne(
    {
      workflowId: toObjectId(workflowId),
      $or: [{ moduleId }, { moduleTitle: oldTitle }],
    },
    { $set: { moduleTitle: newTitle } }
  );
}

/** Remove every stored lesson plan for a workflow, for when the workflow itself is deleted. */
export async function deleteWorkflowLessonPlans(workflowId: string): Promise<void> {
  await ModuleLessonPlan.deleteMany({ workflowId: toObjectId(workflowId) });
}

/** One lesson, reduced to what a chat assistant needs to find and name it. */
export interface LessonIndexEntry {
  moduleId: string;
  moduleCode: string;
  lessonId: string;
  lessonNumber: number;
  lessonTitle: string;
}

/**
 * A flat index of every lesson in a workflow: id, number, title and owning module.
 *
 * Projected in the database rather than loaded and mapped, because the canvas assistant needs
 * this on every message and the bodies behind it are around 26MB for a full programme. The
 * assistant works from titles and asks for a specific lesson when it needs the content.
 */
export async function loadLessonIndex(workflowId: string): Promise<LessonIndexEntry[]> {
  const rows = await ModuleLessonPlan.find({ workflowId: toObjectId(workflowId) })
    .select('moduleId moduleCode lessons.lessonId lessons.lessonNumber lessons.lessonTitle')
    .lean();

  const index: LessonIndexEntry[] = [];
  for (const row of rows as any[]) {
    for (const lesson of row.lessons || []) {
      index.push({
        moduleId: row.moduleId,
        moduleCode: row.moduleCode,
        lessonId: lesson.lessonId,
        lessonNumber: lesson.lessonNumber,
        lessonTitle: lesson.lessonTitle,
      });
    }
  }
  return index;
}
