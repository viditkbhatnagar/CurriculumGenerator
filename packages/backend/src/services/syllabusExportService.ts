/**
 * Syllabus DOCX Export Service
 *
 * Renders an approved Step 14 syllabus to a Word document with the standard
 * sections faculty expect: course basics → instructor → description →
 * outcomes → schedule table → assignments table → grading scale → policies.
 */

import { Document, Packer, Paragraph, Table, convertInchesToTwip } from 'docx';
import type { ICurriculumWorkflow, Step14Syllabus } from '../models/CurriculumWorkflow';
import { loggingService } from './loggingService';
import JSZip from 'jszip';
import { xmlSafeDeep } from '../utils/xmlSafe';
import {
  title,
  subtitle,
  h1,
  h2,
  body,
  bullet,
  scheduleTable,
  assignmentsTable,
  gradingScaleTable,
  programmeSyllabusBody,
} from './syllabusDocx';

class SyllabusExportService {
  async generateSyllabusDocument(workflow: ICurriculumWorkflow): Promise<Buffer> {
    // Office files are XML: a control character in the data makes the file corrupt. See xmlSafe.
    workflow = xmlSafeDeep(workflow);
    const step14 = workflow.step14 as Step14Syllabus | undefined;
    if (!step14?.generatedSections) {
      throw new Error('Syllabus has not been generated yet');
    }

    const step1 = (workflow as any).step1 || {};
    const sections = step14.generatedSections;
    const inputs = step14.inputs;

    // Tables can't live inside Paragraph[] but Document section.children
    // accepts (Paragraph | Table)[], so we assemble a single mixed list.
    const docChildren: (Paragraph | Table)[] = [];
    docChildren.push(title(step1.programTitle || workflow.projectName || 'Course Syllabus'));
    if (inputs.courseNumber) docChildren.push(subtitle(inputs.courseNumber));
    docChildren.push(subtitle(inputs.semester));

    docChildren.push(...programmeSyllabusBody(step1, step14));

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: convertInchesToTwip(1),
                bottom: convertInchesToTwip(1),
                left: convertInchesToTwip(1),
                right: convertInchesToTwip(1),
              },
            },
          },
          children: docChildren,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    loggingService.info('Syllabus DOCX generated', {
      workflowId: workflow._id?.toString(),
      paragraphs: docChildren.length,
    });
    return buffer;
  }

  /**
   * Per-module syllabus DOCX. Same instructor/policies/grading scaffolding
   * as the program-wide doc, but the description, outcomes, schedule and
   * assignments are scoped to a single module.
   */
  async generateModuleSyllabusDocument(
    workflow: ICurriculumWorkflow,
    moduleId: string
  ): Promise<Buffer> {
    workflow = xmlSafeDeep(workflow);
    const step14 = workflow.step14 as Step14Syllabus | undefined;
    const sections = step14?.generatedSections;
    if (!sections) throw new Error('Syllabus has not been generated yet');

    const mod = (sections.moduleSyllabi || []).find((m) => m.moduleId === moduleId);
    if (!mod) throw new Error(`No module syllabus found for moduleId=${moduleId}`);

    const inputs = step14!.inputs;
    const step1 = (workflow as any).step1 || {};

    const docChildren: (Paragraph | Table)[] = [];
    docChildren.push(title(`${mod.moduleCode}: ${mod.moduleTitle}`));
    docChildren.push(subtitle(step1.programTitle || workflow.projectName || ''));

    // Module Basics and Instructor Information are intentionally omitted from per-module
    // syllabi — instructor, meeting time, location and hours are decided per-cohort
    // based on faculty availability, so embedding them here produces stale documents.

    // Module description
    if (mod.moduleDescription) {
      docChildren.push(h1('Module Description'));
      docChildren.push(body(mod.moduleDescription));
    }

    // MLOs
    if (mod.moduleLearningOutcomes.length > 0) {
      docChildren.push(h1('Module Learning Outcomes'));
      docChildren.push(body('By the end of this module, students will be able to:'));
      mod.moduleLearningOutcomes.forEach((o, i) => {
        docChildren.push(bullet(`${i + 1}. ${o}`));
      });
    }

    // Schedule
    if (mod.weeklySchedule.length > 0) {
      docChildren.push(h1('Module Schedule'));
      docChildren.push(scheduleTable(mod.weeklySchedule));
    }

    // Assignments
    if (mod.assignments.length > 0) {
      docChildren.push(h1('Assignments'));
      docChildren.push(assignmentsTable(mod.assignments));
    }

    // Grading scale (shared)
    docChildren.push(h2('Grading Scale'));
    docChildren.push(gradingScaleTable(sections.gradingScale));

    // Policies (shared) — keep concise per-module
    docChildren.push(h1('Course Policies'));
    docChildren.push(h2('Attendance and Participation'));
    docChildren.push(body(sections.policies.attendance));
    docChildren.push(h2('Late Work and Make-up'));
    docChildren.push(body(sections.policies.lateWork));
    docChildren.push(h2('Technology Use'));
    docChildren.push(body(sections.policies.technologyUse));
    docChildren.push(h2('Communication'));
    docChildren.push(body(sections.policies.communicationNorms));
    docChildren.push(h2('Academic Integrity'));
    docChildren.push(body(sections.policies.academicIntegrity));
    docChildren.push(h2('Accessibility and Accommodations'));
    docChildren.push(body(sections.policies.accessibility));

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: convertInchesToTwip(1),
                bottom: convertInchesToTwip(1),
                left: convertInchesToTwip(1),
                right: convertInchesToTwip(1),
              },
            },
          },
          children: docChildren,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    loggingService.info('Module syllabus DOCX generated', {
      workflowId: workflow._id?.toString(),
      moduleId,
      moduleCode: mod.moduleCode,
    });
    return buffer;
  }

  /**
   * Zip of one DOCX per module. Saves the user from clicking download N
   * times when they want every module's syllabus.
   */
  async generateAllModuleSyllabiZip(workflow: ICurriculumWorkflow): Promise<Buffer> {
    workflow = xmlSafeDeep(workflow);
    const step14 = workflow.step14 as Step14Syllabus | undefined;
    const moduleSyllabi = step14?.generatedSections?.moduleSyllabi || [];
    if (moduleSyllabi.length === 0) {
      throw new Error('No module syllabi generated yet');
    }

    const zip = new JSZip();
    for (const mod of moduleSyllabi) {
      const buf = await this.generateModuleSyllabusDocument(workflow, mod.moduleId);
      const safe =
        `${mod.moduleCode || mod.moduleId}_${(mod.moduleTitle || '').replace(/[^a-zA-Z0-9]+/g, '_')}`
          .substring(0, 80)
          .replace(/_+$/, '');
      zip.file(`${safe || mod.moduleId}_syllabus.docx`, buf);
    }
    return zip.generateAsync({ type: 'nodebuffer' });
  }
}

export const syllabusExportService = new SyllabusExportService();
