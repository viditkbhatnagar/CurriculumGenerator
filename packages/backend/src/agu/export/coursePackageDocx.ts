/**
 * Renders a stored AGU course draft into AGU's own faculty templates as one Word document.
 *
 * Section by section it follows the Wave 1 templates faculty are contracted to fill: T01
 * course specification, T02 syllabus, T03 weekly plan and live-lecture run sheets, T04
 * contact-hour map, T05 reading and case list, T06 applied-assignment brief. Templates the
 * draft does not cover yet are listed as not drafted rather than filled with placeholders,
 * and the document closes with the evidence and disclosure record: what was sourced, what was
 * dropped, what is still blocking. Real Word headings and tables throughout.
 */
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { CatalogueCourse, CatalogueEdition } from '../catalogue/types';
import { DISCLOSURES } from '../rules/usUtahRules';
import { CourseDraft, Finding } from '../draft/types';

const FONT = 'Arial';
const BODY = 20;

export interface PackageInput {
  draft: CourseDraft;
  course: CatalogueCourse;
  catalogue: CatalogueEdition;
  findings: Finding[];
  status: string;
  version: number;
  tools?: string;
  sourcesOffered: number;
  stageRuns: {
    stage: string;
    status: string;
    startedAt: Date | string;
    model?: string;
    error?: string;
  }[];
}

const t = (text: string, opts: { bold?: boolean; italics?: boolean } = {}) =>
  new TextRun({ text, font: FONT, size: BODY, ...opts });
const p = (text: string, opts: { bold?: boolean; italics?: boolean } = {}) =>
  new Paragraph({ children: [t(text, opts)], spacing: { after: 100 } });
const h = (text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) =>
  new Paragraph({ text, heading: level, spacing: { before: 240, after: 100 } });
const bullet = (text: string) => new Paragraph({ children: [t(text)], bullet: { level: 0 } });

function table(header: string[], rows: string[][]): Table {
  const cell = (text: string, bold = false) =>
    new TableCell({ children: [new Paragraph({ children: [t(text, { bold })] })] });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: header.map((x) => cell(x, true)) }),
      ...rows.map((r) => new TableRow({ children: r.map((x) => cell(x)) })),
    ],
  });
}

const sum = (xs: number[]) => Math.round(xs.reduce((n, x) => n + (x || 0), 0) * 100) / 100;
const disclosure = (id: string) => DISCLOSURES.find((d) => d.id === id)?.text || '';

export function coursePackageDocument(input: PackageInput): Document {
  const { draft, course, catalogue, findings } = input;
  const outcomes = draft.outcomes;
  const assessedBy = (id: string) =>
    draft.assessments
      .filter((a) => a.outcomeIds.includes(id))
      .map((a) => a.title)
      .join('; ') || 'not assessed';
  const live = sum(draft.weeks.map((w) => w.liveLecture.hours));
  const monitored = sum(draft.weeks.flatMap((w) => w.monitoredStudy.map((m) => m.hours)));
  const independent = sum(draft.weeks.flatMap((w) => w.independentStudy.map((m) => m.hours)));
  const blocking = findings.filter((f) => f.severity === 'blocking');
  const warnings = findings.filter((f) => f.severity === 'warning');
  const children: (Paragraph | Table)[] = [];

  children.push(
    new Paragraph({ text: `${course.code} ${course.title}`, heading: HeadingLevel.TITLE }),
    p(`Course package, version ${input.version}: ${input.status.replace(/_/g, ' ')}`, {
      bold: true,
    }),
    p(disclosure('draft_status'), { italics: true }),
    p(
      blocking.length
        ? `${blocking.length} blocking finding(s) remain; see the evidence and disclosure record at the end. This draft is not faculty-review ready.`
        : 'No blocking findings on the stored draft.',
      { italics: true }
    )
  );

  // T01 Course Specification
  children.push(h('T01 · Course Specification', HeadingLevel.HEADING_1));
  children.push(
    table(
      ['Field', 'Value'],
      [
        ['Course code', course.code],
        ['Course title', course.title],
        [
          'Credits and hours',
          `${course.semesterCredits} SCH · ${course.hours.total} h (${course.hours.contact} contact / ${course.hours.independent} independent) over ${catalogue.courseShape.weeks.value} weeks`,
        ],
        ['Catalogue faculty', course.catalogueFaculty],
        [
          'Catalogue edition',
          `v${catalogue.edition.version} (${catalogue.edition.approvalStatus.replace(/_/g, ' ')})`,
        ],
        ['Starting point', 'New design drafted from the catalogue description'],
      ]
    )
  );
  children.push(
    h('1. Course description', HeadingLevel.HEADING_2),
    p(course.description || 'The catalogue gives no topical description for this course.')
  );
  children.push(h('2. Course role in the stack', HeadingLevel.HEADING_2));
  children.push(
    table(
      ['Role', 'Prerequisite / gateway', 'Delivery'],
      [
        [
          course.roleLabel,
          course.mbaGateway ? `MBA candidates: after ${course.mbaGateway}` : 'None',
          course.deliveryWindow,
        ],
      ]
    )
  );
  children.push(h('3. Course learning outcomes (CLOs)', HeadingLevel.HEADING_2));
  children.push(
    table(
      ['CLO', 'Outcome', 'Bloom level', 'Assessed by'],
      outcomes.map((o) => [o.id, o.statement, o.bloomLevel, assessedBy(o.id)])
    )
  );
  children.push(h('4. Four-week structure', HeadingLevel.HEADING_2));
  children.push(
    table(
      [
        'Week',
        'Theme',
        'CLOs',
        `Live lecture (${catalogue.courseShape.liveLectureHours.value}h)`,
        'Monitored study',
        'Independent study',
      ],
      draft.weeks.map((w) => [
        String(w.number),
        w.theme,
        w.outcomeIds.join(', '),
        `${w.liveLecture.title}: ${w.liveLecture.topics.join('; ')}`,
        w.monitoredStudy.map((m) => `${m.activity} (${m.hours}h)`).join('; '),
        w.independentStudy.map((m) => `${m.activity} (${m.hours}h)`).join('; '),
      ])
    )
  );
  children.push(h('5. Hours summary', HeadingLevel.HEADING_2));
  children.push(
    table(
      ['Category', 'Hours'],
      [
        ['Live lectures', String(live)],
        ['Faculty-monitored study (contact)', String(monitored)],
        ['Total contact', String(sum([live, monitored]))],
        ['Independent study', String(independent)],
        ['Total', String(sum([live, monitored, independent]))],
      ]
    )
  );
  children.push(h('6. Assessment plan', HeadingLevel.HEADING_2));
  children.push(
    table(
      ['Component', 'Weight', 'Week due', 'CLOs'],
      draft.assessments.map((a) => [
        a.title,
        `${a.weight}%`,
        String(a.weekDue),
        a.outcomeIds.join(', '),
      ])
    )
  );
  children.push(
    h('7. Tools, data or sandboxes required', HeadingLevel.HEADING_2),
    p(input.tools || 'None stated.')
  );
  children.push(p(disclosure('credit_qualifier'), { italics: true }));

  // T02 Syllabus
  children.push(h('T02 · Syllabus (student-facing)', HeadingLevel.HEADING_1));
  children.push(
    table(
      ['Item', 'Detail'],
      [
        ['Credits', `${course.semesterCredits} SCH`],
        [
          'Learning hours',
          `${course.hours.total} (${course.hours.contact} contact / ${course.hours.independent} independent)`,
        ],
        ['Length', `${catalogue.courseShape.weeks.value} weeks`],
        [
          'Live lectures',
          `One ${catalogue.courseShape.liveLectureHours.value}-hour live lecture per week`,
        ],
        [
          'Instructor response time',
          'Within two business days (Mountain Time, excluding institutional holidays)',
        ],
      ]
    )
  );
  children.push(
    h('Learning outcomes', HeadingLevel.HEADING_2),
    ...outcomes.map((o) => bullet(`${o.id}: ${o.statement}`))
  );
  children.push(h('Weekly schedule', HeadingLevel.HEADING_2));
  children.push(
    table(
      ['Week', 'Topic', 'Live lecture', 'Due'],
      draft.weeks.map((w) => [
        String(w.number),
        w.theme,
        w.liveLecture.title,
        w.gradedItemsDue.join('; ') || '—',
      ])
    )
  );
  children.push(h('Assessment and grading', HeadingLevel.HEADING_2));
  children.push(
    table(
      ['Component', 'Weight', 'Due'],
      draft.assessments.map((a) => [a.title, `${a.weight}%`, `Week ${a.weekDue}`])
    )
  );
  children.push(
    p(
      'Minimum passing grade: B- (2.7). No Pass/Fail and no Incomplete grades. The final exam is proctored (browser lockdown, webcam verification, ID match).'
    )
  );
  children.push(
    h('Use of AI tools', HeadingLevel.HEADING_2),
    ...draft.assessments.map((a) => bullet(`${a.title}: ${a.aiUse}`))
  );
  children.push(
    p(
      'The course AI tutor supports learning and explains concepts. It will not produce graded work.'
    )
  );
  children.push(h('Academic integrity and accessibility', HeadingLevel.HEADING_2));
  children.push(
    p(
      'All work must be original and properly attributed. Summative submissions are screened by an originality / AI-writing check. Accommodation requests are handled under AGU’s accommodation policy.'
    )
  );
  children.push(
    h('Institutional disclosures', HeadingLevel.HEADING_2),
    p(disclosure('registration')),
    p(disclosure('programmatic_accreditation'))
  );

  // T03 Weekly Plan & Live Session Run Sheet
  children.push(h('T03 · Weekly Plan & Live Session Run Sheets', HeadingLevel.HEADING_1));
  for (const w of draft.weeks) {
    children.push(h(`Week ${w.number}: ${w.theme}`, HeadingLevel.HEADING_2));
    children.push(
      table(
        ['Item', 'Plan'],
        [
          ['CLOs addressed', w.outcomeIds.join(', ')],
          [
            `Live lecture (${w.liveLecture.hours}h)`,
            `${w.liveLecture.title}: ${w.liveLecture.topics.join('; ')}`,
          ],
          [
            'Monitored-study activities (faculty role)',
            w.monitoredStudy.map((m) => `${m.activity}: ${m.facultyRole}`).join('; ') || '—',
          ],
          ['Independent study', w.independentStudy.map((m) => m.activity).join('; ') || '—'],
          ['Graded items due', w.gradedItemsDue.join('; ') || '—'],
        ]
      )
    );
    children.push(
      h(`Lecture ${w.number} run sheet: ${w.liveLecture.title}`, HeadingLevel.HEADING_3)
    );
    children.push(
      table(
        ['Time (min)', 'Segment', 'Activity / method', 'Materials'],
        w.liveLecture.runSheet.map((s) => [
          `${s.startMinute}–${s.endMinute}`,
          s.segment,
          s.activity,
          s.materials || '—',
        ])
      )
    );
  }

  // T04 Contact-Hour Map
  children.push(h('T04 · Contact-Hour Map', HeadingLevel.HEADING_1));
  children.push(p(catalogue.courseShape.contactHourDefinition.value, { italics: true }));
  children.push(
    table(
      [
        'Week',
        'Live lecture (h)',
        'Monitored-study activity',
        'Faculty action',
        'Evidence logged',
        'Hours',
      ],
      draft.weeks
        .flatMap((w) =>
          w.monitoredStudy.length
            ? w.monitoredStudy.map((m, i) => [
                i === 0 ? String(w.number) : '',
                i === 0 ? String(w.liveLecture.hours) : '',
                m.activity,
                m.facultyRole,
                m.evidenceLogged,
                String(m.hours),
              ])
            : [[String(w.number), String(w.liveLecture.hours), '—', '—', '—', '0']]
        )
        .concat([['Total', String(live), '', '', '', String(sum([live, monitored]))]])
    )
  );
  children.push(
    table(
      ['Week', 'Independent activity', 'Hours'],
      draft.weeks
        .flatMap((w) =>
          w.independentStudy.map((m) => [String(w.number), m.activity, String(m.hours)])
        )
        .concat([['Total', '', String(independent)]])
    )
  );

  // T05 Reading & Case List
  children.push(h('T05 · Reading & Case List', HeadingLevel.HEADING_1));
  children.push(
    p(
      'AGU has no library. Every required item is openly accessible, original, or cleared for use and supplied through the platform.',
      { italics: true }
    )
  );
  children.push(
    draft.readings.length
      ? table(
          ['Week', 'Citation', 'Required / optional', 'Access', 'Link'],
          draft.readings.map((r) => [
            String(r.week),
            r.citation,
            r.required ? 'Required' : 'Optional',
            r.access,
            r.link || '—',
          ])
        )
      : p('No verified readings: faculty must supply them.')
  );
  children.push(h('Case studies', HeadingLevel.HEADING_2));
  children.push(
    draft.cases.length
      ? table(
          ['Week', 'Case title', 'Source', 'Rights status'],
          draft.cases.map((c) => [
            String(c.week),
            c.title,
            c.source === 'hypothetical'
              ? 'Hypothetical teaching case (not a real company event)'
              : c.source,
            c.rights || '—',
          ])
        )
      : p('No cases drafted.')
  );

  // T06 Applied assignment brief
  children.push(h('T06 · Assessment Brief (Applied Assignment)', HeadingLevel.HEADING_1));
  const applied = draft.assessments.filter(
    (a) => a.component === 'applied_assignment' || a.component === 'capstone_component'
  );
  if (applied.length) {
    for (const a of applied) {
      children.push(h(a.title, HeadingLevel.HEADING_2));
      children.push(
        table(
          ['Field', 'Value'],
          [
            ['Weight', `${a.weight}%`],
            ['Due', `Week ${a.weekDue}`],
            ['CLOs assessed', a.outcomeIds.join(', ')],
            ['Use of AI tools', a.aiUse],
          ]
        )
      );
      children.push(p(a.brief || 'Task brief not drafted yet.'));
    }
  } else {
    children.push(p('No applied assignment in this draft.'));
  }

  children.push(h('Not drafted in this version', HeadingLevel.HEADING_1));
  [
    'T07 Marking rubric',
    'T08 Quiz & practice bank',
    'T09 Final exam blueprint & paper',
    'T10 Discussion / seminar prompts',
    'T11 AI tutor knowledge pack',
    course.role === 'capstone' ? 'T13 Capstone assessment design' : '',
  ]
    .filter(Boolean)
    .forEach((x) => children.push(bullet(x)));

  // Evidence and disclosure record
  children.push(h('Evidence and disclosure record', HeadingLevel.HEADING_1));
  children.push(
    bullet(
      `Outcomes, weeks, assessments and cases are proposals for faculty review; locked facts come from the catalogue.`
    )
  );
  children.push(
    bullet(
      `Readings: ${draft.readings.length} chosen from ${input.sourcesOffered} verified open-access sources; anything else the model cited was dropped.`
    )
  );
  children.push(
    bullet(
      `Cases: every generated case is a hypothetical teaching scenario, not a real company event.`
    )
  );
  children.push(h('Findings', HeadingLevel.HEADING_2));
  if (!findings.length) children.push(p('No findings.'));
  blocking.forEach((f) => children.push(bullet(`Blocking · ${f.code}: ${f.message}`)));
  warnings.forEach((f) => children.push(bullet(`Warning · ${f.code}: ${f.message}`)));
  children.push(h('Stage history', HeadingLevel.HEADING_2));
  input.stageRuns.forEach((r) =>
    children.push(
      bullet(
        `${r.stage} · ${r.status} · ${new Date(r.startedAt).toISOString()}${r.model ? ` · ${r.model}` : ''}${r.error ? ` · ${r.error}` : ''}`
      )
    )
  );

  return new Document({
    creator: 'Curriculum Generator',
    title: `${course.code} course package`,
    styles: { default: { document: { run: { font: FONT, size: BODY } } } },
    sections: [{ properties: {}, children }],
  });
}

export async function coursePackageBuffer(input: PackageInput): Promise<Buffer> {
  return Packer.toBuffer(coursePackageDocument(input));
}
