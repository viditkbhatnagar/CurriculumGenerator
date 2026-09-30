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
import { guideContextFromWorkflow, guideModule } from './facultyGuide/facultyGuideModel';
import { facultyGuideBuffer } from './facultyGuide/facultyGuideDocx';
import { expectedLessonCount, isPlanComplete, plannedLessonTarget } from './step10Completion';

/**
 * Bumped whenever the faculty guide's layout changes, so the export cache cannot keep serving
 * the previous layout for unchanged lessons.
 *
 * 2: keeps check answers, case activities and pacing; labels checks by type; flags partial modules.
 * 3: an appendix sets out each Step 7 formative check with its questions and model answers.
 */
export const FACULTY_GUIDE_FORMAT_VERSION = 3;

/** How a module is named in its file inside the archive. */
function moduleFileName(stepNumber: number, index: number, stub: any, step4Module: any): string {
  // Both parts are reduced to letters, digits and hyphens: the name also goes into a
  // Content-Disposition header, where a quote breaks it and a line break makes setHeader throw.
  const safe = (text: string) =>
    text
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  const code =
    safe(String(stub?.moduleCode || step4Module?.code || '')) ||
    `M${String(index + 1).padStart(2, '0')}`;
  const title = safe(String(stub?.moduleTitle || step4Module?.title || '')) || 'Module';
  return `Step${stepNumber}-${code}-${title}.docx`;
}

/**
 * Build a zip holding one Word document per module for Step 10.
 *
 * `workflow` carries the Step 10 STUBS (see step10Store) — each module's lessons are fetched
 * only while its own document is being written, so the whole programme's teaching content is
 * never resident at once.
 */
/**
 * The Step 10 stubs in Step 4 order, not in the order the modules finished generating.
 *
 * The stub array is in completion order: with modules generating five at a time it ends up
 * shuffled (M45 before M43), and a reviewer looking for module 12 should not have to hunt
 * through the archive for it. Anything Step 4 no longer lists still comes last, because
 * dropping it would make the archive quietly shorter than the programme behind it.
 */
function stubsInStep4Order(stubs: any[], step4Modules: any[]): any[] {
  const ordered: any[] = [];
  const byId = new Map(stubs.filter((m) => m?.moduleId).map((m) => [m.moduleId, m]));
  for (const m of step4Modules) {
    const stub = m?.id ? byId.get(m.id) : undefined;
    if (stub) {
      ordered.push(stub);
      byId.delete(m.id);
    }
  }
  for (const leftover of byId.values()) ordered.push(leftover);
  return ordered;
}

export async function generateStep10Zip(workflowId: string, workflow: any): Promise<Buffer> {
  const stubs: any[] = workflow?.step10?.moduleLessonPlans || [];
  if (stubs.length === 0) {
    throw new Error('Step 10 has no module lesson plans to export');
  }

  const step4Modules: any[] = workflow?.step4?.modules || [];

  const ordered = stubsInStep4Order(stubs, step4Modules);
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
        // Step 3 carries the programme outcome wording, so each module's document can stand
        // on its own rather than sending the reader to another step for what a code means.
        step3: workflow.step3,
        step4: workflow.step4,
        // Case study titles, so each module's document names its cases rather than citing ids.
        step8: workflow.step8,
        step10: { ...workflow.step10, moduleLessonPlans: [plan] },
        // The decks actually generated, so a lesson lists its slide deck only when one exists.
        step11: workflow.step11,
      };

      const buf = await wordExportService.generateStepDocument(moduleWorkflow, 10, {
        moduleScoped: true,
      });
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

/**
 * One module's faculty delivery guide as a Word document, or null if it holds no lessons.
 *
 * A module holding only some of its lessons still gets a guide, but one that says so in its
 * title and its file name. The download button appears as soon as Step 10 has started, and the
 * guide used to open "Teach all 7 sessions below" for a module with 7 of its 30 lessons.
 */
export async function facultyGuideForModule(
  workflowId: string,
  workflow: any,
  stub: any
): Promise<{ name: string; buffer: Buffer } | null> {
  const step4Modules: any[] = workflow?.step4?.modules || [];
  const index = Math.max(
    0,
    step4Modules.findIndex((m) => m.id === stub.moduleId)
  );
  const step4Module = step4Modules.find((m) => m.id === stub.moduleId);
  const plan = await loadModulePlan(workflowId, stub.moduleId);
  if (!plan || (plan.lessons || []).length === 0) return null;

  // Measured against the lesson count the generator planned, by the rule the queue and the
  // screen use, so the guide and the Step 10 tick cannot disagree about a module.
  const expected = expectedLessonCount(
    step4Module ?? { id: stub.moduleId },
    workflow?.step10?.plannedLessonCounts
  );
  const plannedSessions = isPlanComplete(plan, expected)
    ? undefined
    : plannedLessonTarget(plan, expected);

  const guide = guideModule(
    {
      code: step4Module?.code || stub.moduleCode,
      title: step4Module?.title || stub.moduleTitle,
      contactHours: step4Module?.contactHours,
      mlos: step4Module?.mlos,
    },
    plan.lessons,
    guideContextFromWorkflow(workflow, step4Module),
    plannedSessions
  );
  const buffer = await facultyGuideBuffer(guide, workflow?.step1?.programTitle);
  const name = moduleFileName(10, index, stub, step4Module)
    .replace(/^Step10-/, 'Faculty-Guide-')
    .replace(/\.docx$/, `${plannedSessions ? '-INCOMPLETE' : ''}.docx`);
  return { name, buffer };
}

/** How a module is named in the archive's note: code and title, else whatever identifies it. */
function moduleLabel(code?: string, title?: string, id?: string): string {
  return [code, title].filter(Boolean).join(' ') || id || 'unnamed module';
}

function missingModulesNote(noPlan: string[], failed: string[]): string {
  const list = (items: string[]) => items.map((m) => `  - ${m}`).join('\n');
  const sections = [
    ...(noPlan.length > 0
      ? [
          `No lesson plan has been generated for these modules yet, so they have no faculty ` +
            `guide:\n\n${list(noPlan)}`,
        ]
      : []),
    ...(failed.length > 0
      ? [`These modules have a lesson plan, but their guide could not be built:\n\n${list(failed)}`]
      : []),
  ];
  return (
    `${sections.join('\n\n')}\n\n` +
    `Every other module's guide is included. A guide whose title says it is incomplete covers ` +
    `only the sessions generated so far.\n`
  );
}

/**
 * Build a zip holding one faculty delivery guide per module, a module at a time for the same
 * memory reason as the Step 10 archive.
 */
export async function generateFacultyGuideZip(workflowId: string, workflow: any): Promise<Buffer> {
  const stubs: any[] = workflow?.step10?.moduleLessonPlans || [];
  if (stubs.length === 0) {
    throw new Error('Step 10 has no module lesson plans to build a faculty guide from');
  }
  const step4Modules: any[] = workflow?.step4?.modules || [];
  const ordered = stubsInStep4Order(stubs, step4Modules);

  const archive = archiver('zip', { zlib: { level: 9 } });
  const chunks: Buffer[] = [];
  archive.on('data', (c: Buffer) => chunks.push(c));
  const finished = new Promise<void>((resolve, reject) => {
    archive.on('error', reject);
    archive.on('end', () => resolve());
  });

  const noPlan: string[] = [];
  const failed: string[] = [];
  for (const stub of ordered) {
    const step4Module = step4Modules.find((m) => m.id === stub.moduleId);
    const label = moduleLabel(
      stub.moduleCode || step4Module?.code,
      stub.moduleTitle || step4Module?.title,
      stub.moduleId
    );
    try {
      const doc = await facultyGuideForModule(workflowId, workflow, stub);
      if (!doc) {
        noPlan.push(label);
        continue;
      }
      archive.append(doc.buffer, { name: doc.name });
    } catch (error) {
      failed.push(label);
      loggingService.error('Could not add a module to the faculty guide archive', {
        workflowId,
        moduleId: stub.moduleId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Modules Step 4 lists that Step 10 has no entry for at all. Looping over the stubs alone
  // left them out of the archive without a word. One with no contact hours has nothing to teach
  // and no plan by design, so it is not missing.
  const stubbed = new Set(stubs.map((s) => s.moduleId));
  for (const m of step4Modules) {
    if (!m?.id || stubbed.has(m.id)) continue;
    if (expectedLessonCount(m, workflow?.step10?.plannedLessonCounts) <= 0) continue;
    noPlan.push(moduleLabel(m.code, m.title, m.id));
  }

  if (noPlan.length > 0 || failed.length > 0) {
    // Named in the archive, because a silently shorter zip reads as "that is all there was".
    archive.append(missingModulesNote(noPlan, failed), { name: 'MISSING-MODULES.txt' });
  }
  await archive.finalize();
  await finished;
  return Buffer.concat(chunks);
}
