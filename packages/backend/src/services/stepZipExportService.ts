/**
 * Whole-step exports that are too large to build as one Word document.
 *
 * Step 10 for the 46-module Bachelor in Business Administration is 1,380 lessons and 59,416
 * paragraphs. Built as a single document that costs about 1.9GB of peak memory — measured, not
 * estimated — against the 2GB the API container has in total, so the request did not merely
 * fail: it exhausted the container and took the whole backend down with it. The reviewer saw
 * "Failed to download Step 10 document", and everyone else on the system saw a restart.
 *
 * The cost is in the docx library rather than in our content: the paragraph tree for a whole
 * programme is ~440MB and packing it spikes ~900MB on top. `Packer.toStream` is worse, not
 * better (~1.2GB), because the library assembles the archive in memory either way. There is no
 * flag that fixes this — the document has to be smaller.
 *
 * So a whole-step download builds one module at a time and streams each into a zip. Peak memory
 * is one module's document rather than the programme's, and every lesson is still exported: the
 * reviewer gets one file containing 46 Word documents rather than one Word document that cannot
 * be produced.
 */

import archiver from 'archiver';
import { loggingService } from './loggingService';
import { wordExportService } from './wordExportService';
import { loadModulePlan } from './step10Store';

/** How a module is named in its file inside the archive. */
function moduleFileName(stepNumber: number, index: number, stub: any, step4Module: any): string {
  const code = stub?.moduleCode || step4Module?.code || `M${String(index + 1).padStart(2, '0')}`;
  const title = String(stub?.moduleTitle || step4Module?.title || 'Module')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `Step${stepNumber}-${code}-${title}.docx`;
}

/**
 * Build a zip holding one Word document per module for Step 10.
 *
 * `workflow` carries the Step 10 STUBS (see step10Store) — each module's lessons are fetched
 * only while its own document is being written, so the whole programme's teaching content is
 * never resident at once.
 */
export async function generateStep10Zip(workflowId: string, workflow: any): Promise<Buffer> {
  const stubs: any[] = workflow?.step10?.moduleLessonPlans || [];
  if (stubs.length === 0) {
    throw new Error('Step 10 has no module lesson plans to export');
  }

  const step4Modules: any[] = workflow?.step4?.modules || [];

  /**
   * Written in Step 4 order, not in the order the modules happened to finish generating.
   *
   * The stub array is in completion order — with modules generating five at a time it ends up
   * shuffled (M45 before M43) — and a reviewer looking for module 12 should not have to hunt
   * through the archive for it.
   */
  const ordered: any[] = [];
  const byId = new Map(stubs.filter((m) => m?.moduleId).map((m) => [m.moduleId, m]));
  for (const m of step4Modules) {
    const stub = m?.id ? byId.get(m.id) : undefined;
    if (stub) {
      ordered.push(stub);
      byId.delete(m.id);
    }
  }
  // Anything Step 4 no longer lists still gets exported; dropping it would make the archive
  // quietly shorter than the programme behind it.
  for (const leftover of byId.values()) ordered.push(leftover);
  const archive = archiver('zip', { zlib: { level: 9 } });
  const chunks: Buffer[] = [];
  archive.on('data', (c: Buffer) => chunks.push(c));

  const failed: string[] = [];
  const finished = new Promise<void>((resolve, reject) => {
    archive.on('error', reject);
    archive.on('end', () => resolve());
  });

  for (let i = 0; i < ordered.length; i++) {
    const stub = ordered[i];
    const step4Module = step4Modules.find((m) => m.id === stub.moduleId);
    try {
      const plan = await loadModulePlan(workflowId, stub.moduleId);
      if (!plan || (plan.lessons || []).length === 0) {
        failed.push(stub.moduleCode || stub.moduleId);
        continue;
      }

      // One module's worth of workflow. Deliberately rebuilt each pass so the previous
      // module's lessons become collectable before the next document is built.
      const moduleWorkflow: any = {
        projectName: workflow.projectName,
        step1: workflow.step1,
        step2: workflow.step2,
        step4: workflow.step4,
        step10: { ...workflow.step10, moduleLessonPlans: [plan] },
      };

      const buf = await wordExportService.generateStepDocument(moduleWorkflow, 10);
      archive.append(buf, { name: moduleFileName(10, i, stub, step4Module) });
    } catch (error) {
      // One unbuildable module must not cost the other forty-five. It is recorded and named
      // in the archive, because a silently shorter zip reads as "that is all there was".
      failed.push(stub.moduleCode || stub.moduleId || `module-${i + 1}`);
      loggingService.error('Could not add a module to the Step 10 archive', {
        workflowId,
        moduleId: stub.moduleId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (failed.length > 0) {
    archive.append(
      `These modules could not be exported and are missing from this archive:\n\n` +
        failed.map((f) => `  - ${f}`).join('\n') +
        `\n\nEvery other module in the programme is included.\n`,
      { name: 'MODULES-MISSING-FROM-THIS-ARCHIVE.txt' }
    );
  }

  await archive.finalize();
  await finished;

  const zip = Buffer.concat(chunks);
  loggingService.info('Step 10 archive built', {
    workflowId,
    modules: ordered.length - failed.length,
    failed: failed.length,
    bytes: zip.length,
  });
  return zip;
}
