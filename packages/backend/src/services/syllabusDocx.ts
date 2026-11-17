/**
 * The Word pieces of a Step 14 syllabus, shared by the stand-alone syllabus download
 * (syllabusExportService) and the whole-programme export (wordExportService).
 *
 * Logan Pacey's email of 17 November 2026 (Diploma in Logistics pilot) found that the
 * whole-programme document stopped at Step 13: a syllabus that had been generated and
 * approved appeared only in its own download. Both documents now draw the same body from
 * here, so they cannot drift apart.
 */
import {
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
import type { Step14Syllabus } from '../models/CurriculumWorkflow';

export const FONT_FAMILY = 'Arial';
export const FONT_SIZES = {
  TITLE: 48,
  H1: 32,
  H2: 26,
  BODY: 22,
  TABLE: 20,
  SMALL: 18,
};

export const PARA_SPACING = { before: 120, after: 120 };

export function h3(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 80 },
    children: [new TextRun({ text, bold: true, size: FONT_SIZES.BODY, font: FONT_FAMILY })],
  });
}

export function title(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 240 },
    children: [new TextRun({ text, bold: true, size: FONT_SIZES.TITLE, font: FONT_FAMILY })],
  });
}

export function subtitle(text: string): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, size: FONT_SIZES.H2, font: FONT_FAMILY, color: '555555' })],
  });
}

export function h1(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 120 },
    children: [new TextRun({ text, bold: true, size: FONT_SIZES.H1, font: FONT_FAMILY })],
  });
}

export function h2(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 80 },
    children: [new TextRun({ text, bold: true, size: FONT_SIZES.H2, font: FONT_FAMILY })],
  });
}

export function body(text: string): Paragraph {
  return new Paragraph({
    spacing: PARA_SPACING,
    children: [new TextRun({ text, size: FONT_SIZES.BODY, font: FONT_FAMILY })],
  });
}

export function bullet(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 40, after: 40 },
    indent: { left: convertInchesToTwip(0.25) },
    children: [new TextRun({ text, size: FONT_SIZES.BODY, font: FONT_FAMILY })],
  });
}

export function kvLines(pairs: Array<[string, string | number | undefined | null]>): Paragraph[] {
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

export function creditsLine(step1: any): string | undefined {
  const cf = step1.creditFramework;
  if (!cf) return undefined;
  const parts: string[] = [];
  if (cf.credits) parts.push(`${cf.credits} credits`);
  if (cf.totalHours) parts.push(`${cf.totalHours} total hours`);
  if (cf.contactHours)
    parts.push(`${cf.contactHours} contact / ${cf.independentHours} independent`);
  return parts.join(' · ') || undefined;
}

export function scheduleTable(rows: any[]): Table {
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
  return simpleTable(header, body, [5, 7, 9, 10, 30, 30, 9]);
}

export function assignmentsTable(items: any[]): Table {
  const header = ['Assessment', 'Description', 'Weight', 'Due'];
  const body = items.map((a) => [
    a.title || '',
    (a.description || '').substring(0, 200),
    a.weight ? `${a.weight}%` : '',
    a.dueDate || '',
  ]);
  return simpleTable(header, body, [25, 50, 10, 15]);
}

export function gradingScaleTable(scale: any[]): Table {
  const header = ['Grade', 'Range'];
  const body = scale.map((g) => [g.grade, g.range]);
  return simpleTable(header, body, [30, 70]);
}

/** Generic table builder with header row + body rows + percent column widths */
export function simpleTable(header: string[], body: string[][], widthsPercent: number[]): Table {
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

/**
 * Course basics through policies, for the programme-wide syllabus. With `nested` the headings
 * drop one level (Heading 2 and 3), so the block sits under a section heading of its own.
 */
export function programmeSyllabusBody(
  step1: any,
  step14: Step14Syllabus,
  nested = false
): (Paragraph | Table)[] {
  const sections = step14.generatedSections;
  if (!sections) return [];
  const inputs = step14.inputs || ({} as Step14Syllabus['inputs']);
  const instructor = inputs.instructor || ({} as Step14Syllabus['inputs']['instructor']);
  const top = nested ? h2 : h1;
  const sub = nested ? h3 : h2;
  const policies = sections.policies || ({} as typeof sections.policies);
  const out: (Paragraph | Table)[] = [];

  out.push(top('Course Basics'));
  out.push(
    ...kvLines([
      ['Course Title', step1?.programTitle],
      ['Course Number', inputs.courseNumber],
      ['Credit Hours', creditsLine(step1 || {})],
      ['Semester', inputs.semester],
      ['Meeting Time', inputs.meetingPattern],
      ['Location', inputs.meetingLocation],
      ['Delivery Mode', step1?.delivery?.mode],
    ])
  );

  out.push(top('Instructor Information'));
  out.push(
    ...kvLines([
      ['Name', instructor.name],
      ['Title', instructor.title],
      ['Email', instructor.email],
      ['Office Hours', instructor.officeHours],
      ['Office Location', instructor.officeLocation],
      ['Preferred Communication', instructor.preferredCommunication],
      ['Expected Response Time', instructor.expectedResponseTime],
    ])
  );
  if (inputs.taInfo?.name) {
    out.push(sub('Teaching Assistant / Grader'));
    out.push(
      ...kvLines([
        ['Name', inputs.taInfo.name],
        ['Email', inputs.taInfo.email],
        ['Role', inputs.taInfo.role],
      ])
    );
  }

  out.push(top('Course Description'));
  out.push(body(sections.courseDescription || ''));

  const outcomes = sections.learningOutcomes || [];
  if (outcomes.length > 0) {
    out.push(top('Learning Outcomes'));
    out.push(body('By the end of this course, students will be able to:'));
    outcomes.forEach((outcome, i) => out.push(bullet(`${i + 1}. ${outcome}`)));
  }
  if ((sections.weeklySchedule || []).length > 0) {
    out.push(top('Schedule'));
    out.push(scheduleTable(sections.weeklySchedule));
  }
  if ((sections.assignments || []).length > 0) {
    out.push(top('Assignments and Grading'));
    out.push(assignmentsTable(sections.assignments));
  }
  out.push(sub('Grading Scale'));
  out.push(gradingScaleTable(sections.gradingScale || []));

  out.push(top('Course Policies'));
  const policyBlocks: Array<[string, string | undefined]> = [
    ['Attendance and Participation', policies.attendance],
    ['Late Work and Make-up', policies.lateWork],
    ['Technology Use', policies.technologyUse],
    ['Communication', policies.communicationNorms],
    ['Academic Integrity', policies.academicIntegrity],
    ['Accessibility and Accommodations', policies.accessibility],
  ];
  for (const [heading, text] of policyBlocks) {
    out.push(sub(heading));
    out.push(body(text || ''));
  }
  return out;
}
