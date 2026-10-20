/**
 * Reading and writing Step 12 assignment packs, which live outside the workflow document.
 *
 * The document holds a stub per module (services/step12Stubs) and the packs live one row per
 * module in `moduleassignmentpacks`. See models/ModuleAssignmentPack for why: the BBA had
 * 1.46MB of its 16MB left and the packs it still needed came to 1.2-1.6MB.
 *
 * Rules, as for Step 10 (services/step10Store):
 * - A failed save stops generation: writes here throw.
 * - The row is written before the stub, so a crash between them leaves content without a
 *   stub (rebuilt by `offloadLegacyPacks`), never a stub without content.
 * - `withPacks` returns a plain object, so no caller can attach the packs to a live document
 *   and save them back into it.
 */

import mongoose from 'mongoose';
import { ModuleAssignmentPack } from '../models/ModuleAssignmentPack';
import { CurriculumWorkflow } from '../models/CurriculumWorkflow';
import { loggingService } from './loggingService';
import { hydratePackEntries, isPackStub, packStub } from './step12Stubs';

const toObjectId = (workflowId: string | mongoose.Types.ObjectId) =>
  typeof workflowId === 'string' ? new mongoose.Types.ObjectId(workflowId) : workflowId;

/** Store one module's packs and return the stub the document should hold for it. */
export async function savePackRow(workflowId: string, pack: any) {
  if (!pack?.moduleId) throw new Error('step12Store: a pack needs a moduleId');
  await ModuleAssignmentPack.updateOne(
    { workflowId: toObjectId(workflowId), moduleId: String(pack.moduleId) },
    {
      $set: {
        moduleCode: String(pack.moduleCode || ''),
        moduleTitle: String(pack.moduleTitle || ''),
        variants: pack.variants || {},
      },
    },
    { upsert: true }
  );
  return packStub(pack);
}

export async function loadPackRows(workflowId: string): Promise<any[]> {
  return ModuleAssignmentPack.find({ workflowId: toObjectId(workflowId) }).lean();
}

/** One module's packs: its stored row, or a legacy full entry still in the document. */
export async function loadModulePack(workflowId: string, moduleId: string): Promise<any | null> {
  const row: any = await ModuleAssignmentPack.findOne({
    workflowId: toObjectId(workflowId),
    moduleId,
  }).lean();
  if (row) {
    return {
      moduleId: row.moduleId,
      moduleCode: row.moduleCode,
      moduleTitle: row.moduleTitle,
      variants: row.variants || {},
    };
  }
  const wf: any = await CurriculumWorkflow.findById(workflowId)
    .select('step12.moduleAssignmentPacks')
    .lean();
  const entry = (wf?.step12?.moduleAssignmentPacks || []).find(
    (p: any) => p?.moduleId === moduleId
  );
  return entry && !isPackStub(entry) ? entry : null;
}

/**
 * The workflow as a plain object with Step 12's stubs replaced by the stored packs. Accepts a
 * Mongoose document or a plain object (e.g. the result of step10Store.withLessons).
 */
export async function withPacks(workflow: any): Promise<any> {
  if (!workflow) return workflow;
  const plain = typeof workflow.toObject === 'function' ? workflow.toObject() : { ...workflow };
  const entries: any[] = plain.step12?.moduleAssignmentPacks || [];
  if (!entries.some(isPackStub)) return plain;
  const rows = await loadPackRows(String(plain._id));
  return {
    ...plain,
    step12: { ...plain.step12, moduleAssignmentPacks: hydratePackEntries(entries, rows) },
  };
}

/**
 * Move every pack still held in full in the document into its own row and leave a stub.
 * Idempotent, and safe to call before any Step 12 write. Returns how many packs moved.
 */
export async function offloadLegacyPacks(workflowId: string): Promise<number> {
  const wf: any = await CurriculumWorkflow.findById(workflowId)
    .select('step12.moduleAssignmentPacks')
    .lean();
  const entries: any[] = wf?.step12?.moduleAssignmentPacks || [];
  const legacy = entries.filter((e) => e && !isPackStub(e) && e.moduleId);
  if (legacy.length === 0) return 0;

  for (const pack of legacy) await savePackRow(workflowId, pack);
  const stubs = entries.map((e) => (e && !isPackStub(e) && e.moduleId ? packStub(e) : e));
  await CurriculumWorkflow.updateOne(
    { _id: toObjectId(workflowId) },
    { $set: { 'step12.moduleAssignmentPacks': stubs } }
  );
  loggingService.info('Step 12 packs moved out of the workflow document', {
    workflowId,
    moved: legacy.length,
  });
  return legacy.length;
}

/** Restore a Step 12 snapshot: its packs go to rows, the document gets stubs. */
export async function restoreStep12Snapshot(workflowId: string, snapshot: any): Promise<any> {
  const packs: any[] = snapshot?.moduleAssignmentPacks || [];
  const stubs = [];
  for (const pack of packs)
    stubs.push(isPackStub(pack) ? pack : await savePackRow(workflowId, pack));
  const keep = new Set(packs.map((p) => String(p.moduleId)));
  await ModuleAssignmentPack.deleteMany({
    workflowId: toObjectId(workflowId),
    moduleId: { $nin: Array.from(keep) },
  });
  return { ...snapshot, moduleAssignmentPacks: stubs };
}

export async function deleteWorkflowPacks(workflowId: string): Promise<void> {
  await ModuleAssignmentPack.deleteMany({ workflowId: toObjectId(workflowId) });
}
