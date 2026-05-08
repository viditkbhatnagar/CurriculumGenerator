/**
 * Syllabus DOCX Export Service
 *
 * Renders an approved Step 14 syllabus to a Word document with the standard
 * sections faculty expect: course basics → instructor → description →
 * outcomes → schedule table → assignments table → grading scale → policies.
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  convertInchesToTwip,
} from 'docx';
import type {
  ICurriculumWorkflow,
  Step14Syllabus,
  ModuleSyllabus,
} from '../models/CurriculumWorkflow';
import { loggingService } from './loggingService';
import JSZip from 'jszip';

const FONT_FAMILY = 'Arial';
const FONT_SIZES = {
  TITLE: 48,
  H1: 32,
  H2: 26,
  BODY: 22,
  TABLE: 20,
  SMALL: 18,
};

const PARA_SPACING = { before: 120, after: 120 };

class SyllabusExportService {
  async generateSyllabusDocument(workflow: ICurriculumWorkflow): Promise<Buffer> {
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
    docChildren.push(this.title(step1.programTitle || workflow.projectName || 'Course Syllabus'));
    if (inputs.courseNumber) docChildren.push(this.subtitle(inputs.courseNumber));
    docChildren.push(this.subtitle(inputs.semester));

    docChildren.push(this.h1('Course Basics'));
    docChildren.push(
      ...this.kvLines([
        ['Course Title', step1.programTitle],
        ['Course Number', inputs.courseNumber],
        ['Credit Hours', this.creditsLine(step1)],
        ['Semester', inputs.semester],
        ['Meeting Time', inputs.meetingPattern],
        ['Location', inputs.meetingLocation],
        ['Delivery Mode', step1.delivery?.mode],
      ])
    );

    docChildren.push(this.h1('Instructor Information'));
    docChildren.push(
      ...this.kvLines([
        ['Name', inputs.instructor.name],
        ['Title', inputs.instructor.title],
        ['Email', inputs.instructor.email],
        ['Office Hours', inputs.instructor.officeHours],
        ['Office Location', inputs.instructor.officeLocation],
        ['Preferred Communication', inputs.instructor.preferredCommunication],
        ['Expected Response Time', inputs.instructor.expectedResponseTime],
      ])
    );
    if (inputs.taInfo?.name) {
      docChildren.push(this.h2('Teaching Assistant / Grader'));
      docChildren.push(
        ...this.kvLines([
          ['Name', inputs.taInfo.name],
          ['Email', inputs.taInfo.email],
          ['Role', inputs.taInfo.role],
        ])
      );
    }

    docChildren.push(this.h1('Course Description'));
    docChildren.push(this.body(sections.courseDescription));

    if (sections.learningOutcomes.length > 0) {
      docChildren.push(this.h1('Learning Outcomes'));
      docChildren.push(this.body('By the end of this course, students will be able to:'));
      sections.learningOutcomes.forEach((outcome, i) => {
        docChildren.push(this.bullet(`${i + 1}. ${outcome}`));
      });
    }

    if (sections.weeklySchedule.length > 0) {
      docChildren.push(this.h1('Schedule'));
      docChildren.push(this.scheduleTable(sections.weeklySchedule));
    }

    if (sections.assignments.length > 0) {
      docChildren.push(this.h1('Assignments and Grading'));
      docChildren.push(this.assignmentsTable(sections.assignments));
    }

    docChildren.push(this.h2('Grading Scale'));
    docChildren.push(this.gradingScaleTable(sections.gradingScale));

    docChildren.push(this.h1('Course Policies'));
    docChildren.push(this.h2('Attendance and Participation'));
    docChildren.push(this.body(sections.policies.attendance));
    docChildren.push(this.h2('Late Work and Make-up'));
    docChildren.push(this.body(sections.policies.lateWork));
    docChildren.push(this.h2('Technology Use'));
    docChildren.push(this.body(sections.policies.technologyUse));
    docChildren.push(this.h2('Communication'));
    docChildren.push(this.body(sections.policies.communicationNorms));
    docChildren.push(this.h2('Academic Integrity'));
    docChildren.push(this.body(sections.policies.academicIntegrity));
    docChildren.push(this.h2('Accessibility and Accommodations'));
    docChildren.push(this.body(sections.policies.accessibility));

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
    const step14 = workflow.step14 as Step14Syllabus | undefined;
    const sections = step14?.generatedSections;
    if (!sections) throw new Error('Syllabus has not been generated yet');

    const mod = (sections.moduleSyllabi || []).find((m) => m.moduleId === moduleId);
    if (!mod) throw new Error(`No module syllabus found for moduleId=${moduleId}`);

    const inputs = step14!.inputs;
    const step1 = (workflow as any).step1 || {};

    const docChildren: (Paragraph | Table)[] = [];
    docChildren.push(this.title(`${mod.moduleCode}: ${mod.moduleTitle}`));
    docChildren.push(
      this.subtitle(`${step1.programTitle || workflow.projectName} — ${inputs.semester}`)
    );

    // Module basics
    docChildren.push(this.h1('Module Basics'));
    docChildren.push(
      ...this.kvLines([
        ['Module', `${mod.moduleCode} — ${mod.moduleTitle}`],
        ['Course Number', inputs.courseNumber],
        ['Semester', inputs.semester],
        ['Meeting Time', inputs.meetingPattern],
        ['Location', inputs.meetingLocation],
        ['Contact Hours', mod.contactHours ? `${mod.contactHours} h` : undefined],
        ['Delivery Mode', step1.delivery?.mode],
      ])
    );

    // Instructor (shared across modules)
    docChildren.push(this.h1('Instructor Information'));
    docChildren.push(
      ...this.kvLines([
        ['Name', inputs.instructor.name],
        ['Title', inputs.instructor.title],
        ['Email', inputs.instructor.email],
        ['Office Hours', inputs.instructor.officeHours],
        ['Office Location', inputs.instructor.officeLocation],
        ['Preferred Communication', inputs.instructor.preferredCommunication],
        ['Expected Response Time', inputs.instructor.expectedResponseTime],
      ])
    );

    // Module description
    if (mod.moduleDescription) {
      docChildren.push(this.h1('Module Description'));
      docChildren.push(this.body(mod.moduleDescription));
    }

    // MLOs
    if (mod.moduleLearningOutcomes.length > 0) {
      docChildren.push(this.h1('Module Learning Outcomes'));
      docChildren.push(this.body('By the end of this module, students will be able to:'));
      mod.moduleLearningOutcomes.forEach((o, i) => {
        docChildren.push(this.bullet(`${i + 1}. ${o}`));
      });
    }

    // Schedule
    if (mod.weeklySchedule.length > 0) {
      docChildren.push(this.h1('Module Schedule'));
      docChildren.push(this.scheduleTable(mod.weeklySchedule));
    }

    // Assignments
    if (mod.assignments.length > 0) {
      docChildren.push(this.h1('Assignments'));
      docChildren.push(this.assignmentsTable(mod.assignments));
    }

    // Grading scale (shared)
    docChildren.push(this.h2('Grading Scale'));
    docChildren.push(this.gradingScaleTable(sections.gradingScale));

    // Policies (shared) — keep concise per-module
    docChildren.push(this.h1('Course Policies'));
    docChildren.push(this.h2('Attendance and Participation'));
    docChildren.push(this.body(sections.policies.attendance));
    docChildren.push(this.h2('Late Work and Make-up'));
    docChildren.push(this.body(sections.policies.lateWork));
    docChildren.push(this.h2('Technology Use'));
    docChildren.push(this.body(sections.policies.technologyUse));
    docChildren.push(this.h2('Communication'));
    docChildren.push(this.body(sections.policies.communicationNorms));
    docChildren.push(this.h2('Academic Integrity'));
    docChildren.push(this.body(sections.policies.academicIntegrity));
    docChildren.push(this.h2('Accessibility and Accommodations'));
    docChildren.push(this.body(sections.policies.accessibility));

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

  // ---------- helpers ----------
  private title(text: string): Paragraph {
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 240 },
      children: [new TextRun({ text, bold: true, size: FONT_SIZES.TITLE, font: FONT_FAMILY })],
    });
  }

  private subtitle(text: string): Paragraph {
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 60 },
      children: [new TextRun({ text, size: FONT_SIZES.H2, font: FONT_FAMILY, color: '555555' })],
    });
  }

  private h1(text: string): Paragraph {
    return new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 360, after: 120 },
      children: [new TextRun({ text, bold: true, size: FONT_SIZES.H1, font: FONT_FAMILY })],
    });
  }

  private h2(text: string): Paragraph {
    return new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 80 },
      children: [new TextRun({ text, bold: true, size: FONT_SIZES.H2, font: FONT_FAMILY })],
    });
  }

  private body(text: string): Paragraph {
    return new Paragraph({
      spacing: PARA_SPACING,
      children: [new TextRun({ text, size: FONT_SIZES.BODY, font: FONT_FAMILY })],
    });
  }

  private bullet(text: string): Paragraph {
    return new Paragraph({
      spacing: { before: 40, after: 40 },
      indent: { left: convertInchesToTwip(0.25) },
      children: [new TextRun({ text, size: FONT_SIZES.BODY, font: FONT_FAMILY })],
    });
  }

  private kvLines(pairs: Array<[string, string | number | undefined | null]>): Paragraph[] {
    const out: Paragraph[] = [];
    pairs.forEach(([label, value]) => {
      if (value === undefined || value === null || value === '') return;
      out.push(
        new Paragraph({
          spacing: { before: 40, after: 40 },
          children: [
            new TextRun({
              text: `${label}: `,
              bold: true,
              size: FONT_SIZES.BODY,
              font: FONT_FAMILY,
            }),
            new TextRun({
              text: String(value),
              size: FONT_SIZES.BODY,
              font: FONT_FAMILY,
            }),
          ],
        })
      );
    });
    return out;
  }

  private creditsLine(step1: any): string | undefined {
    const cf = step1.creditFramework;
    if (!cf) return undefined;
    const parts: string[] = [];
    if (cf.credits) parts.push(`${cf.credits} credits`);
    if (cf.totalHours) parts.push(`${cf.totalHours} total hours`);
    if (cf.contactHours)
      parts.push(`${cf.contactHours} contact / ${cf.independentHours} independent`);
    return parts.join(' · ') || undefined;
  }

  private scheduleTable(rows: any[]): Table {
    const header = ['Wk', 'Session', 'Date', 'Module', 'Topics', 'Readings', 'Due'];
    const body = rows.map((r) => [
      String(r.week),
      String(r.sessionNumber),
      r.date || '',
      r.moduleCode || '',
      (r.topics || []).join('; '),
      (r.readings || []).map((x: string) => x.substring(0, 80)).join(' | '),
      (r.dueItems || []).join('; '),
    ]);
    return this.simpleTable(header, body, [5, 7, 9, 10, 30, 30, 9]);
  }

  private assignmentsTable(items: any[]): Table {
    const header = ['Assessment', 'Description', 'Weight', 'Due'];
    const body = items.map((a) => [
      a.title || '',
      (a.description || '').substring(0, 200),
      a.weight ? `${a.weight}%` : '',
      a.dueDate || '',
    ]);
    return this.simpleTable(header, body, [25, 50, 10, 15]);
  }

  private gradingScaleTable(scale: any[]): Table {
    const header = ['Grade', 'Range'];
    const body = scale.map((g) => [g.grade, g.range]);
    return this.simpleTable(header, body, [30, 70]);
  }

  /** Generic table builder with header row + body rows + percent column widths */
  private simpleTable(header: string[], body: string[][], widthsPercent: number[]): Table {
    const headerRow = new TableRow({
      tableHeader: true,
      children: header.map(
        (label, i) =>
          new TableCell({
            width: { size: widthsPercent[i] || 100 / header.length, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: label,
                    bold: true,
                    size: FONT_SIZES.TABLE,
                    font: FONT_FAMILY,
                  }),
                ],
              }),
            ],
          })
      ),
    });

    const bodyRows = body.map(
      (row) =>
        new TableRow({
          children: row.map(
            (cell, i) =>
              new TableCell({
                width: {
                  size: widthsPercent[i] || 100 / row.length,
                  type: WidthType.PERCENTAGE,
                },
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: cell,
                        size: FONT_SIZES.SMALL,
                        font: FONT_FAMILY,
                      }),
                    ],
                  }),
                ],
              })
          ),
        })
    );

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: 'cccccc' },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: 'cccccc' },
        left: { style: BorderStyle.SINGLE, size: 4, color: 'cccccc' },
        right: { style: BorderStyle.SINGLE, size: 4, color: 'cccccc' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'dddddd' },
        insideVertical: { style: BorderStyle.SINGLE, size: 2, color: 'dddddd' },
      },
      rows: [headerRow, ...bodyRows],
    });
  }
}

export const syllabusExportService = new SyllabusExportService();
