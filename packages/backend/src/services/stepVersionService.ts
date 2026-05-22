/**
 * Step version history.
 *
 * Before a workflow step is regenerated, its current data is snapshotted
 * so a prior version can be restored. Snapshots are JSON blobs stored via
 * sourceFileStore (AWS S3 when configured, MongoDB GridFS otherwise) —
 * only a small pointer { step, fileId, savedAt } is kept on the workflow
 * document, so the bulk JSON never bloats Mongo or risks the 16MB limit.
 */
import { CurriculumWorkflow } from '../models/CurriculumWorkflow';
import * as sourceFileStore from './sourceFileStore';
import { loggingService } from './loggingService';

// How many snapshots to retain per step — older ones are pruned.
const MAX_VERSIONS_PER_STEP = 8;

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

/**
 * Snapshot the current data of step `stepNumber` before it is
 * regenerated. No-op when the step has no data yet (first generation).
 * Best-effort — a snapshot failure never throws, so it cannot block a
 * regeneration.
 */
export async function snapshotStep(workflowId: string, stepNumber: number): Promise<void> {
  try {
    const workflow: any = await CurriculumWorkflow.findById(workflowId).select(
      `step${stepNumber} stepVersions`
    );
    if (!workflow) return;

    const stepData = workflow[`step${stepNumber}`];
    if (!stepData || (typeof stepData === 'object' && Object.keys(stepData).length === 0)) {
      return; // nothing generated yet — nothing to snapshot
    }

    const buffer = Buffer.from(JSON.stringify(stepData), 'utf-8');
    const stored = await sourceFileStore.uploadBuffer(
      buffer,
      `step${stepNumber}-${workflowId}-${Date.now()}.json`,
      'application/json'
    );

    await CurriculumWorkflow.updateOne(
      { _id: workflowId },
      {
        $push: {
          stepVersions: {
            step: stepNumber,
            fileId: stored.fileId,
            savedAt: new Date(),
            sizeBytes: buffer.length,
          },
        },
      }
    );

    // Prune — keep only the most recent MAX_VERSIONS_PER_STEP for this step.
    const existingForStep = ((workflow.stepVersions as any[]) || []).filter(
      (v) => v.step === stepNumber
    );
    const overflow = existingForStep.length + 1 - MAX_VERSIONS_PER_STEP;
    if (overflow > 0) {
      const oldest = existingForStep
        .slice()
        .sort((a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime())
        .slice(0, overflow);
      for (const old of oldest) {
        await sourceFileStore.deleteFile(old.fileId).catch(() => {});
        await CurriculumWorkflow.updateOne(
          { _id: workflowId },
          { $pull: { stepVersions: { fileId: old.fileId } } }
        );
      }
    }

    loggingService.info('Step version snapshotted', {
      workflowId,
      step: stepNumber,
      fileId: stored.fileId,
    });
  } catch (err) {
    loggingService.warn('Failed to snapshot step version — regeneration continues', {
      workflowId,
      stepNumber,
      err,
    });
  }
}

/** Fetch a stored snapshot and parse its JSON back into step data. */
export async function loadSnapshot(fileId: string): Promise<unknown> {
  const stream = await sourceFileStore.getDownloadStream(fileId);
  const buffer = await streamToBuffer(stream);
  return JSON.parse(buffer.toString('utf-8'));
}
