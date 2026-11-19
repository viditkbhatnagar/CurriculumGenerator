/**
 * Syllabus DOCX Export Service
 *
 * Renders Step 14 to Word. The programme download is a programme overview followed by one
 * complete course syllabus per module; the per-module download and the zip are the same course
 * syllabi singly. All three read the stored steps through services/courseSyllabus, so they
 * cannot disagree (Dr Sherin Thomas, 18 November 2026).
 */

import { Document, Packer, Paragraph, Table, convertInchesToTwip } from 'docx';
import type { ICurriculumWorkflow, Step14Syllabus } from '../models/CurriculumWorkflow';
import { loggingService } from './loggingService';
import JSZip from 'jszip';
import { xmlSafeDeep } from '../utils/xmlSafe';
import { title, subtitle, courseSyllabusBody, programmeSyllabusBody } from './syllabusDocx';
import { buildCourseSyllabus } from './courseSyllabus';
import { withLessons } from './step10Store';
import { withPacks } from './step12Store';

const PAGE = {
  page: {
    margin: {
      top: convertInchesToTwip(1),
      bottom: convertInchesToTwip(1),
      left: convertInchesToTwip(1),
      right: convertInchesToTwip(1),
    },
  },
};

/** The workflow with Step 10 lessons and Step 12 packs loaded, and control characters removed. */
async function loadedWorkflow(workflow: ICurriculumWorkflow): Promise<any> {
  return xmlSafeDeep(await withPacks(await withLessons(workflow)));
}

class SyllabusExportService {
  async generateSyllabusDocument(source: ICurriculumWorkflow): Promise<Buffer> {
    const workflow = await loadedWorkflow(source);
    const step14 = workflow.step14 as Step14Syllabus | undefined;
    if (!step14?.generatedSections) {
      throw new Error('Syllabus has not been generated yet');
    }
    const step1 = workflow.step1 || {};
    const docChildren: (Paragraph | Table)[] = [
      title(step1.programTitle || workflow.projectName || 'Programme Syllabus'),
      subtitle('Programme overview and course syllabi'),
      ...programmeSyllabusBody(workflow, step14),
    ];
    const buffer = await Packer.toBuffer(
      new Document({ sections: [{ properties: PAGE, children: docChildren }] })
    );
    loggingService.info('Syllabus DOCX generated', {
      workflowId: workflow._id?.toString(),
      paragraphs: docChildren.length,
    });
    return buffer;
  }

  /** One module's course syllabus. */
  async generateModuleSyllabusDocument(
    source: ICurriculumWorkflow,
    moduleId: string
  ): Promise<Buffer> {
    return this.moduleDocument(await loadedWorkflow(source), moduleId);
  }

  private async moduleDocument(workflow: any, moduleId: string): Promise<Buffer> {
    const step14 = workflow.step14 as Step14Syllabus | undefined;
    if (!step14?.generatedSections) throw new Error('Syllabus has not been generated yet');
    const mod = (workflow.step4?.modules || []).find((m: any) => m.id === moduleId);
    if (!mod) throw new Error(`No module found for moduleId=${moduleId}`);

    const course = buildCourseSyllabus(workflow, mod, step14.inputs);
    const children: (Paragraph | Table)[] = [
      title(`${course.moduleCode}: ${course.moduleTitle}`),
      subtitle(workflow.step1?.programTitle || workflow.projectName || ''),
      ...courseSyllabusBody(course),
    ];
    const buffer = await Packer.toBuffer(
      new Document({ sections: [{ properties: PAGE, children }] })
    );
    loggingService.info('Module syllabus DOCX generated', {
      workflowId: workflow._id?.toString(),
      moduleId,
      moduleCode: course.moduleCode,
    });
    return buffer;
  }

  /** Zip of one DOCX per module, so nobody clicks download once for each. */
  async generateAllModuleSyllabiZip(source: ICurriculumWorkflow): Promise<Buffer> {
    const workflow = await loadedWorkflow(source);
    const modules: any[] = workflow.step4?.modules || [];
    if (modules.length === 0 || !workflow.step14?.generatedSections) {
      throw new Error('No module syllabi generated yet');
    }
    const zip = new JSZip();
    for (const mod of modules) {
      const buf = await this.moduleDocument(workflow, mod.id);
      const code = mod.code || mod.moduleCode || mod.id;
      const safe = `${code}_${(mod.title || '').replace(/[^a-zA-Z0-9]+/g, '_')}`
        .substring(0, 80)
        .replace(/_+$/, '');
      zip.file(`${safe || mod.id}_syllabus.docx`, buf);
    }
    return zip.generateAsync({ type: 'nodebuffer' });
  }
}

export const syllabusExportService = new SyllabusExportService();
