/**
 * The Word pieces of a Step 14 syllabus, shared by the stand-alone syllabus downloads
 * (syllabusExportService) and the whole-programme export (wordExportService).
 *
 * Logan Pacey's email of 17 November 2026 (Diploma in Logistics pilot) found that the
 * whole-programme document stopped at Step 13; both documents now draw the same body from
 * here, so they cannot drift apart. Dr Sherin Thomas's feedback of 18 November 2026 (Bachelor
 * in Business Administration) then found the body itself wrong: one syllabus for the whole
 * programme, labelled as a course, with blank columns and invented policies. It is now a
 * programme overview followed by one course syllabus per module (services/courseSyllabus),
 * each answering what the student will learn, how to prepare, what work to complete and how
 * they will be assessed.
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
  PageBreak,
  convertInchesToTwip,
} from 'docx';
import type { Step14Syllabus } from '../models/CurriculumWorkflow';
import { buildCourseSyllabi, CourseSyllabus, SyllabusTable } from './courseSyllabus';

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
                ...cell.split('\n').map(
                  (line) =>
                    new Paragraph({
                      children: [
                        new TextRun({ text: line, size: FONT_SIZES.SMALL, font: FONT_FAMILY }),
                      ],
                    })
                ),
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

export function syllabusTable(table: SyllabusTable): Table {
  const first = Math.round(100 / (table.headers.length * 2));
  const widths = table.headers.map((_, i) =>
    i === 0 ? Math.max(first, 8) : (100 - Math.max(first, 8)) / (table.headers.length - 1)
  );
  return simpleTable(table.headers, table.rows, widths);
}

type HeadingFn = (text: string) => Paragraph;

/** Heading functions for a block whose main headings sit at `level` (0 is Heading 1). */
function headings(level: 0 | 1 | 2): { top: HeadingFn; section: HeadingFn; sub: HeadingFn } {
  if (level === 0) return { top: h1, section: h2, sub: h3 };
  if (level === 1) return { top: h2, section: h3, sub: h3 };
  return { top: h3, section: h3, sub: h3 };
}

const HANDBOOK = (label: string) =>
  `${label.replace(/^The /, 'Your programme handbook sets the ')}. It has not been entered into this syllabus yet, so ask your programme office until it is.`;

/**
 * One course syllabus: the four questions a student asks, in order. `level` is the heading
 * level of the four main headings (0 for a stand-alone document, lower when under others).
 */
export function courseSyllabusBody(
  course: CourseSyllabus,
  level: 0 | 1 | 2 = 0
): (Paragraph | Table)[] {
  const { top, section, sub } = headings(level);
  const out: (Paragraph | Table)[] = [];

  out.push(top('What you will learn'));
  out.push(...kvLines(course.facts));
  if (course.description) out.push(body(course.description));
  out.push(body('By the end of this module you will be able to:'));
  course.outcomes.forEach((o, i) => out.push(bullet(`${i + 1}. ${o}`)));
  if (course.buildsOn.length) {
    out.push(body('This module builds on what you learned in:'));
    course.buildsOn.forEach((m) => out.push(bullet(m)));
  } else {
    out.push(
      body('This module has no prerequisite module, so you can start it without earlier study.')
    );
  }

  out.push(top('How to prepare'));
  if (course.weeks.length) {
    out.push(
      body(
        'Work through the weeks in order. Each row says what we cover and what to prepare or read before the week begins.'
      )
    );
    out.push(syllabusTable(course.scheduleTable));
  } else {
    out.push(body('The week-by-week plan for this module is not available yet.'));
  }
  if (course.materials.length) {
    out.push(sub('Materials you will need'));
    course.materials.forEach((m) => out.push(bullet(m)));
  }

  out.push(top('What work you must complete'));
  if (course.workTable.rows.length) {
    out.push(
      body('This is everything you hand in or practise during the module, and when it is due.')
    );
    out.push(syllabusTable(course.workTable));
  } else {
    out.push(body('The work for this module is not available yet.'));
  }
  course.workNotes.forEach((n) => out.push(body(n)));

  out.push(top('How you will be assessed'));
  if (course.components.length) {
    out.push(body('Your module mark is made up of the work below. The weights add up to 100%.'));
    out.push(syllabusTable(course.componentsTable));
  } else {
    out.push(body('The graded work for this module is not available yet.'));
  }
  out.push(section('How your work is marked'));
  if (course.criteriaTable) {
    out.push(
      body(
        'Your work is judged against these criteria. Each row describes what each band looks like.'
      )
    );
    out.push(syllabusTable(course.criteriaTable));
  } else {
    out.push(body(course.criteriaNote));
  }
  out.push(section('Rules that apply to you'));
  for (const rule of course.rules) {
    out.push(sub(rule.label));
    out.push(body(rule.text || HANDBOOK(rule.label)));
  }
  return out;
}

/**
 * The programme overview, then one course syllabus per module. `workflow` must have its Step
 * 10 lessons and Step 12 packs loaded. With `nested` the headings drop one level, so the block
 * sits under a section heading of its own.
 */
export function programmeSyllabusBody(
  workflow: any,
  step14: Step14Syllabus,
  nested = false
): (Paragraph | Table)[] {
  const sections = step14.generatedSections;
  if (!sections) return [];
  const step1 = workflow.step1 || {};
  const inputs = step14.inputs || ({} as Step14Syllabus['inputs']);
  const instructor = inputs.instructor || ({} as Step14Syllabus['inputs']['instructor']);
  const { top, sub } = headings(nested ? 1 : 0);
  const out: (Paragraph | Table)[] = [];

  out.push(top('Programme Overview'));
  out.push(
    ...kvLines([
      ['Programme', step1.programTitle],
      ['Credits and hours', creditsLine(step1)],
      ['Delivery mode', step1.delivery?.mode],
      ['Semester', inputs.semester],
      ['Course number', inputs.courseNumber],
      ['Meeting time', inputs.meetingPattern],
      ['Location', inputs.meetingLocation],
    ])
  );
  if (sections.courseDescription) out.push(body(sections.courseDescription));
  const outcomes = sections.learningOutcomes || [];
  if (outcomes.length) {
    out.push(sub('What the whole programme prepares you to do'));
    outcomes.forEach((o, i) => out.push(bullet(`${i + 1}. ${o}`)));
  }
  const exam = workflow.step13?.overview;
  if (exam) {
    out.push(sub('Final exam'));
    out.push(
      ...kvLines([
        ['Exam', exam.examTitle],
        ['Length', exam.totalDuration],
        ['Permitted materials', exam.permittedMaterials],
      ])
    );
  }

  const courses = buildCourseSyllabi(workflow, inputs);
  out.push(sub('Your course syllabi'));
  out.push(
    body(
      'Each module below has its own course syllabus. It answers four questions: what you will learn, how to prepare, what work you must complete and how you will be assessed.'
    )
  );
  out.push(
    simpleTable(
      ['Module', 'Title', 'Credits', 'Level'],
      courses.map((c) => [
        c.moduleCode,
        c.moduleTitle,
        c.facts.find(([k]) => k === 'Credits')?.[1] || 'Not set',
        c.facts.find(([k]) => k === 'Level')?.[1] || 'Not set',
      ]),
      [12, 58, 12, 18]
    )
  );

  const hasInstructor = Object.values(instructor).some((v) => v);
  if (hasInstructor) {
    out.push(sub('Your tutor'));
    out.push(
      ...kvLines([
        ['Name', instructor.name],
        ['Title', instructor.title],
        ['Email', instructor.email],
        ['Office hours', instructor.officeHours],
        ['Office location', instructor.officeLocation],
        ['Preferred communication', instructor.preferredCommunication],
        ['Expected response time', instructor.expectedResponseTime],
      ])
    );
  }

  for (const course of courses) {
    out.push(new Paragraph({ children: [new PageBreak()] }));
    out.push(top(`${course.moduleCode}: ${course.moduleTitle}`));
    out.push(...courseSyllabusBody(course, nested ? 2 : 1));
  }
  return out;
}
