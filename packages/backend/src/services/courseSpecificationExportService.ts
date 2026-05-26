/**
 * Course Specification DOCX Export Service
 *
 * Produces a programme-level course-specification document in the MCAST
 * (Malta College of Arts, Science & Technology) format requested by AGCQ:
 *
 *   Page 1     Cover         (MQF level, programme code, title, "Course Specification")
 *   Page 2     Course Description + Programme Learning Outcomes + Entry Requirements
 *   Page 3     Current Approved Programme Structure (units table)
 *   Page 4..N  One section per unit (code/title, MQF, credits, description, outcomes)
 *
 * Reads from step1 (programme metadata), step3 (PLOs) and step4 (modules
 * → "units"). Per-cohort fields (instructor, schedule) are deliberately
 * omitted — the same reason the per-module syllabus drops them.
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
  PageBreak,
  Header,
  Footer,
  PageNumber,
  convertInchesToTwip,
} from 'docx';
import type { ICurriculumWorkflow } from '../models/CurriculumWorkflow';
import { loggingService } from './loggingService';

const FONT_FAMILY = 'Calibri';
const FONT_SIZES = {
  COVER_TITLE: 36,
  COVER_LABEL: 32,
  COVER_SMALL: 24,
  H1: 32,
  H2: 26,
  BODY: 22,
  TABLE: 20,
  SMALL: 18,
  FOOTER: 18,
};

interface UnitDescriptor {
  code: string;
  title: string;
  ects: number;
  year: number;
  mqfLevel: number;
  description: string;
  outcomes: string[];
}

class CourseSpecificationExportService {
  async generateDocument(workflow: ICurriculumWorkflow): Promise<Buffer> {
    const step1 = (workflow as any).step1 || {};
    const step3 = (workflow as any).step3 || {};
    const step4 = (workflow as any).step4 || {};

    if (!step4.modules || step4.modules.length === 0) {
      throw new Error(
        'Course Specification needs Step 4 (Course Framework & MLOs) to be generated first'
      );
    }

    const programmeTitle = step1.programTitle || workflow.projectName || 'Course Specification';
    const programmeCode = this.deriveProgrammeCode(workflow, step1);
    const mqfLevel = this.deriveMqfLevel(step1);
    const headerText = `${programmeCode} Course Specification`;

    const units = this.buildUnits(step4.modules, mqfLevel);

    // ---- Cover page ----
    const coverChildren: Paragraph[] = [
      this.spacer(6),
      this.centered(`MQF Level ${mqfLevel}`, FONT_SIZES.COVER_LABEL, true),
      this.spacer(4),
      this.centered(programmeCode, FONT_SIZES.COVER_TITLE, true),
      this.spacer(1),
      this.centered(programmeTitle, FONT_SIZES.COVER_LABEL, true),
      this.spacer(4),
      this.centered('Course Specification', FONT_SIZES.COVER_LABEL, true),
      // Page break to start the body content on a fresh page.
      new Paragraph({ children: [new PageBreak()] }),
    ];

    // ---- Programme-level content ----
    const bodyChildren: (Paragraph | Table)[] = [];

    bodyChildren.push(this.h1('Course Description'));
    const description = this.programmeDescription(step1);
    description.forEach((para) => bodyChildren.push(this.body(para)));

    if (step3.outcomes && step3.outcomes.length > 0) {
      bodyChildren.push(this.h1('Programme Learning Outcomes'));
      bodyChildren.push(this.body('At the end of the programme the learner will be able to:'));
      step3.outcomes.forEach((plo: any, idx: number) => {
        bodyChildren.push(this.numbered(idx + 1, plo.statement || ''));
      });
    }

    const entry = step1.entryRequirements;
    if (entry && String(entry).trim()) {
      bodyChildren.push(this.h1('Entry Requirements'));
      String(entry)
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line) => bodyChildren.push(this.body(line)));
    }

    bodyChildren.push(this.h1('Current Approved Programme Structure'));
    bodyChildren.push(this.structureTable(units));

    // ---- Per-unit pages ----
    units.forEach((unit) => {
      bodyChildren.push(new Paragraph({ children: [new PageBreak()] }));
      bodyChildren.push(this.unitTitle(`${unit.code} ${unit.title}`));
      bodyChildren.push(this.unitMetaLine('Unit level (MQF):', String(unit.mqfLevel)));
      bodyChildren.push(this.unitMetaLine('Credits:', String(unit.ects)));
      bodyChildren.push(this.thinRule());

      bodyChildren.push(this.h2('Unit description'));
      const descParas = (unit.description || '')
        .split(/\n+/)
        .map((p) => p.trim())
        .filter(Boolean);
      if (descParas.length === 0) {
        bodyChildren.push(
          this.body('(Description pending — add it on Step 4 of the curriculum generator.)')
        );
      } else {
        descParas.forEach((p) => bodyChildren.push(this.body(p)));
      }

      bodyChildren.push(this.h2('Learning Outcomes'));
      bodyChildren.push(this.bodyBold('On completion of this unit the student will be able to:'));
      if (unit.outcomes.length === 0) {
        bodyChildren.push(this.body('(No learning outcomes recorded for this unit yet.)'));
      } else {
        unit.outcomes.forEach((stmt, idx) => bodyChildren.push(this.numbered(idx + 1, stmt)));
      }
    });

    const sectionHeader = new Header({
      children: [
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [
            new TextRun({
              text: headerText,
              size: FONT_SIZES.FOOTER,
              font: FONT_FAMILY,
              color: '555555',
            }),
          ],
        }),
      ],
    });

    const sectionFooter = new Footer({
      children: [
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({
              children: [PageNumber.CURRENT],
              size: FONT_SIZES.FOOTER,
              font: FONT_FAMILY,
              color: '555555',
            }),
            new TextRun({
              text: ' | P a g e',
              size: FONT_SIZES.FOOTER,
              font: FONT_FAMILY,
              color: '555555',
            }),
          ],
        }),
      ],
    });

    const margins = {
      top: convertInchesToTwip(1),
      bottom: convertInchesToTwip(1),
      left: convertInchesToTwip(1),
      right: convertInchesToTwip(1),
    };

    const doc = new Document({
      sections: [
        // Cover page — no header/footer to match the reference document.
        {
          properties: { page: { margin: margins } },
          children: coverChildren,
        },
        // Body — running header + page numbers.
        {
          properties: { page: { margin: margins } },
          headers: { default: sectionHeader },
          footers: { default: sectionFooter },
          children: bodyChildren,
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    loggingService.info('Course specification DOCX generated', {
      workflowId: workflow._id?.toString(),
      programmeCode,
      units: units.length,
    });
    return buffer;
  }

  // ──────────────────────────────────────────────────────────────────
  // Data adapters
  // ──────────────────────────────────────────────────────────────────

  private buildUnits(modules: any[], programmeMqf: number): UnitDescriptor[] {
    return modules.map((mod) => ({
      code: mod.moduleCode || mod.code || '',
      title: mod.title || '',
      ects: this.creditsForUnit(mod),
      year: this.yearForUnit(mod),
      mqfLevel: programmeMqf,
      description: mod.description || '',
      outcomes: (mod.mlos || []).map((m: any) => (m.statement || '').trim()).filter(Boolean),
    }));
  }

  private creditsForUnit(mod: any): number {
    if (typeof mod.credits === 'number' && mod.credits > 0) return mod.credits;
    // ECTS rule-of-thumb: 1 credit ≈ 25 hours of learner work.
    const hours = mod.totalHours || 0;
    if (hours > 0) return Math.round(hours / 25);
    return 0;
  }

  private yearForUnit(mod: any): number {
    // Year is not stored on the module. We approximate by splitting the
    // module list into halves based on sequenceOrder — modules in the
    // lower half become Year 1, upper half Year 2. SMEs can adjust the
    // table by hand if their programme runs differently.
    const seq = mod.sequenceOrder || mod.sequence || 0;
    return seq <= 5 ? 1 : 2;
  }

  private programmeDescription(step1: any): string[] {
    const raw = step1.programDescription || step1.executiveSummary || '';
    return String(raw)
      .split(/\n+/)
      .map((p: string) => p.trim())
      .filter(Boolean);
  }

  private deriveProgrammeCode(workflow: ICurriculumWorkflow, step1: any): string {
    // No dedicated code field on the workflow today. Use programmeCode
    // if step1 happens to carry one (forward-compatible), otherwise
    // fall back to the projectName for traceability.
    return (
      step1.programmeCode ||
      step1.programCode ||
      workflow.projectName ||
      step1.programTitle ||
      'PROGRAMME'
    );
  }

  private deriveMqfLevel(step1: any): number {
    if (typeof step1.mqfLevel === 'number') return step1.mqfLevel;
    switch (step1.academicLevel) {
      case 'certificate':
        return 3;
      case 'micro-credential':
        return 4;
      case 'diploma':
        return 4;
      default:
        return 4;
    }
  }

  // ──────────────────────────────────────────────────────────────────
  // Paragraph helpers
  // ──────────────────────────────────────────────────────────────────

  private centered(text: string, size: number, bold = false): Paragraph {
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 120 },
      children: [new TextRun({ text, bold, size, font: FONT_FAMILY })],
    });
  }

  private spacer(lines: number): Paragraph {
    return new Paragraph({
      spacing: { before: lines * 120, after: 0 },
      children: [new TextRun({ text: '', size: FONT_SIZES.BODY, font: FONT_FAMILY })],
    });
  }

  private h1(text: string): Paragraph {
    return new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 360, after: 160 },
      children: [
        new TextRun({
          text,
          bold: true,
          size: FONT_SIZES.H1,
          font: FONT_FAMILY,
          underline: { type: 'single' },
        }),
      ],
    });
  }

  private h2(text: string): Paragraph {
    return new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 280, after: 120 },
      children: [new TextRun({ text, bold: true, size: FONT_SIZES.H2, font: FONT_FAMILY })],
    });
  }

  private body(text: string): Paragraph {
    return new Paragraph({
      spacing: { before: 100, after: 100 },
      alignment: AlignmentType.JUSTIFIED,
      children: [new TextRun({ text, size: FONT_SIZES.BODY, font: FONT_FAMILY })],
    });
  }

  private bodyBold(text: string): Paragraph {
    return new Paragraph({
      spacing: { before: 100, after: 100 },
      children: [new TextRun({ text, bold: true, size: FONT_SIZES.BODY, font: FONT_FAMILY })],
    });
  }

  private numbered(n: number, text: string): Paragraph {
    return new Paragraph({
      spacing: { before: 80, after: 80 },
      indent: { left: convertInchesToTwip(0.3) },
      children: [
        new TextRun({
          text: `${n}. ${text}`,
          italics: true,
          size: FONT_SIZES.BODY,
          font: FONT_FAMILY,
        }),
      ],
    });
  }

  private unitTitle(text: string): Paragraph {
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 240 },
      children: [new TextRun({ text, bold: true, size: FONT_SIZES.H1, font: FONT_FAMILY })],
    });
  }

  private unitMetaLine(label: string, value: string): Paragraph {
    return new Paragraph({
      spacing: { before: 80, after: 80 },
      children: [
        new TextRun({
          text: `${label}\t\t`,
          bold: true,
          size: FONT_SIZES.BODY,
          font: FONT_FAMILY,
        }),
        new TextRun({ text: value, size: FONT_SIZES.BODY, font: FONT_FAMILY }),
      ],
    });
  }

  private thinRule(): Paragraph {
    return new Paragraph({
      spacing: { before: 40, after: 200 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 1 },
      },
      children: [new TextRun({ text: '', size: 2 })],
    });
  }

  // ──────────────────────────────────────────────────────────────────
  // Tables
  // ──────────────────────────────────────────────────────────────────

  private structureTable(units: UnitDescriptor[]): Table {
    const headerLabels = ['Unit Code', 'Unit Title', 'ECTS', 'Year'];
    const widths = [22, 56, 11, 11];

    const headerRow = new TableRow({
      tableHeader: true,
      children: headerLabels.map(
        (label, i) =>
          new TableCell({
            width: { size: widths[i], type: WidthType.PERCENTAGE },
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

    const bodyRows = units.map(
      (u) =>
        new TableRow({
          children: [
            this.cell(u.code, widths[0]),
            this.cell(u.title, widths[1]),
            this.cell(String(u.ects), widths[2]),
            this.cell(String(u.year), widths[3]),
          ],
        })
    );

    const totalEcts = units.reduce((sum, u) => sum + (u.ects || 0), 0);
    const totalRow = new TableRow({
      children: [
        new TableCell({
          width: { size: widths[0] + widths[1], type: WidthType.PERCENTAGE },
          columnSpan: 2,
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Total ECVET/ECTS',
                  bold: true,
                  size: FONT_SIZES.TABLE,
                  font: FONT_FAMILY,
                }),
              ],
            }),
          ],
        }),
        this.cell(String(totalEcts), widths[2], true),
        this.cell('/', widths[3], true),
      ],
    });

    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        left: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        right: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: '888888' },
        insideVertical: { style: BorderStyle.SINGLE, size: 2, color: '888888' },
      },
      rows: [headerRow, ...bodyRows, totalRow],
    });
  }

  private cell(text: string, widthPercent: number, bold = false): TableCell {
    return new TableCell({
      width: { size: widthPercent, type: WidthType.PERCENTAGE },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text,
              bold,
              size: FONT_SIZES.SMALL,
              font: FONT_FAMILY,
            }),
          ],
        }),
      ],
    });
  }
}

export const courseSpecificationExportService = new CourseSpecificationExportService();
