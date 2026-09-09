/**
 * One-time migration: move Step 10 lesson bodies out of the workflow document.
 *
 * The whole curriculum is a single MongoDB document capped at 16MB. Step 10 writes about
 * 18KB per lesson and a 45-hour module holds 30 of them, so a 46-module programme needs some
 * 26MB for Step 10 alone. The Bachelor in Business Administration reached 16,776,571 bytes
 * of the 16,777,216 available and every subsequent write failed — silently, because the
 * incremental save logged its error and let generation continue.
 *
 * New generations write to `modulelessonplans` (see step10Store). This heals EXISTING
 * documents, including finished ones that will never generate again, by moving their lesson
 * bodies into that collection and leaving lightweight stubs behind.
 *
 * Usage:
 *   npx tsx src/scripts/offloadStep10LessonPlans.ts              # all workflows
 *   npx tsx src/scripts/offloadStep10LessonPlans.ts <id>         # a single workflow
 *   npx tsx src/scripts/offloadStep10LessonPlans.ts --dry-run    # report only
 *
 * Safe to re-run: a module whose stored row already holds at least as many lessons as the
 * document does is left alone. Each workflow is persisted with updateOne($set) on the now
 * tiny stub array, which succeeds even when the original document is at the ceiling.
 */
import mongoose from 'mongoose';
import config from '../config';
import { CurriculumWorkflow } from '../models/CurriculumWorkflow';
import { ModuleLessonPlan } from '../models/ModuleLessonPlan';
import { expectedLessonCount, moduleStub, lessonsHeld } from '../services/step10Completion';

const DRY_RUN = process.argv.includes('--dry-run');
const explicitId = process.argv.slice(2).find((a) => !a.startsWith('--'));

async function bsonSize(id: mongoose.Types.ObjectId): Promise<number> {
  const [row] = await CurriculumWorkflow.aggregate([
    { $match: { _id: id } },
    { $project: { size: { $bsonSize: '$$ROOT' } } },
  ]);
  return row?.size || 0;
}

async function main(): Promise<void> {
  await mongoose.connect(config.database.mongoUri);
  console.log(DRY_RUN ? 'Connected (dry run).' : 'Connected.');

  const filter: any = explicitId
    ? { _id: new mongoose.Types.ObjectId(explicitId) }
    : { 'step10.moduleLessonPlans.0': { $exists: true } };

  const ids = await CurriculumWorkflow.find(filter).select('_id').lean();
  console.log(`Workflows with Step 10 lesson plans: ${ids.length}`);

  let healed = 0;
  for (const { _id } of ids) {
    // Loaded one at a time: several of these are 16MB documents.
    const wf: any = await CurriculumWorkflow.findById(_id).lean();
    const plans: any[] = wf?.step10?.moduleLessonPlans || [];
    const modules: any[] = wf?.step4?.modules || [];
    const before = await bsonSize(_id as mongoose.Types.ObjectId);

    const withBodies = plans.filter((p) => (p?.lessons || []).length > 0);
    if (withBodies.length === 0) {
      console.log(`  ${_id} — nothing inline (${(before / 1e6).toFixed(2)}MB)`);
      continue;
    }

    for (const plan of plans) {
      const held = (plan?.lessons || []).length;
      if (held === 0) continue;

      const module = modules.find((m: any) => m.id === plan.moduleId);
      // A module truncated by the very failure this migration exists to fix keeps the count
      // it was GENERATED to hold, not the count it managed to save — otherwise the partial
      // module is recorded as its own target and never resumes.
      const planned =
        plan.plannedLessonCount ||
        (module ? expectedLessonCount(module, wf.step10?.plannedLessonCounts) : held);

      const existing = await ModuleLessonPlan.findOne({
        workflowId: _id,
        moduleId: plan.moduleId,
      })
        .select('totalLessons')
        .lean();
      if (existing && (existing as any).totalLessons >= held) continue;

      if (DRY_RUN) {
        console.log(`    would move ${plan.moduleCode} — ${held}/${planned} lessons`);
        continue;
      }

      await ModuleLessonPlan.updateOne(
        { workflowId: _id, moduleId: plan.moduleId },
        {
          $set: {
            moduleCode: plan.moduleCode || '',
            moduleTitle: plan.moduleTitle || '',
            moduleDescription: plan.moduleDescription || '',
            totalContactHours: plan.totalContactHours || 0,
            totalLessons: held,
            plannedLessonCount: planned,
            lessons: plan.lessons,
            pptDecks: plan.pptDecks || [],
          },
        },
        { upsert: true }
      );
    }

    if (DRY_RUN) continue;

    const stubs = plans.map((p) => {
      const module = modules.find((m: any) => m.id === p.moduleId);
      const planned =
        p.plannedLessonCount ||
        (module ? expectedLessonCount(module, wf.step10?.plannedLessonCounts) : lessonsHeld(p));
      return moduleStub({ ...p, plannedLessonCount: planned });
    });

    await CurriculumWorkflow.updateOne({ _id }, { $set: { 'step10.moduleLessonPlans': stubs } });

    const after = await bsonSize(_id as mongoose.Types.ObjectId);
    healed += 1;
    console.log(
      `  ${_id} — moved ${withBodies.length} module(s), ` +
        `${(before / 1e6).toFixed(2)}MB → ${(after / 1e6).toFixed(2)}MB`
    );
  }

  console.log(DRY_RUN ? 'Dry run complete.' : `Done. Healed ${healed} workflow(s).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
