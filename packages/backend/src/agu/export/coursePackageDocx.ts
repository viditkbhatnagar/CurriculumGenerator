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
import { Document, HeadingLevel, Packer, Paragraph, Table } from 'docx';
import { CatalogueCourse, CatalogueEdition } from '../catalogue/types';
import { DISCLOSURES, RULE_PACK_VERSION } from '../rules/usUtahRules';
import { CourseDraft, Finding } from '../draft/types';
import { CourseArtefacts } from '../draft/artefactTypes';
import { BODY, FONT, bullet, h, linkParagraph, p, sum, table } from './docxParts';
import { artefactSections, draftedTemplates } from './artefactSections';
import { xmlSafeDeep } from '../../utils/xmlSafe';

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
  /** T07-T11, when they have been drafted, with their findings and status. */
  artefacts?: CourseArtefacts;
  artefactFindings?: Finding[];
  artefactStatus?: string;
}

/**
 * A brief that enumerates its deliverables inline, "(1) a one-page brief; (2) a data log...",
 * printed as one paragraph is hard to check against a rubric. The enumeration becomes a list;
 * anything before the first item stays as the lead-in. Fewer than two items: left as written.
 */
export function briefItems(brief: string): { lead: string; items: string[] } {
  const parts = brief.split(/\s*\((\d{1,2})\)\s+/);
  // A capturing split gives [lead, "1", item1, "2", item2, ...].
  if (parts.length < 5) return { lead: brief.trim(), items: [] };
  const items: string[] = [];
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const item = parts[i + 1].trim().replace(/[;,]?\s*(and)?\s*$/i, '');
    if (item) items.push(`(${parts[i]}) ${item}`);
  }
  return { lead: parts[0].trim(), items };
}

function briefParagraphs(brief: string | undefined): Paragraph[] {
  if (!brief?.trim()) return [p('Task brief not drafted yet.')];
  const { lead, items } = briefItems(brief);
  return [...(lead ? [p(lead)] : []), ...items.map((item) => bullet(item))];
}

const disclosure = (id: string) => DISCLOSURES.find((d) => d.id === id)?.text || '';

/**
 * The disclosures the rule pack requires in one document (`requiredIn`), in the pack's order,
 * under their heading. They used to be placed by hand, and the course specification (the
 * document most often read on its own) carried neither the registration nor the accreditation
 * statement, and the contact-hour map lacked the credit qualifier.
 */
const disclosuresFor = (document: string): Paragraph[] => {
  const texts = DISCLOSURES.filter((d) => d.requiredIn.includes(document)).map((d) => d.text);
  return texts.length
    ? [h('Institutional disclosures', HeadingLevel.HEADING_2), ...texts.map((t) => p(t))]
    : [];
};

export function coursePackageDocument(input: PackageInput): Document {
  // Office files are XML: a control character in model output makes the file corrupt.
  input = xmlSafeDeep(input);
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
  const artefactFindings = input.artefacts ? input.artefactFindings || [] : [];
  const artefactBlocking = artefactFindings.filter((f) => f.severity === 'blocking');
  const drafted = draftedTemplates(input.artefacts);
  const children: (Paragraph | Table)[] = [];

  children.push(
    new Paragraph({ text: `${course.code} ${course.title}`, heading: HeadingLevel.TITLE }),
    p(
      `Course package, version ${input.version}. Outline: ${input.status.replace(/_/g, ' ')}. Assessments and tutor pack (T07-T11): ${input.artefacts ? (input.artefactStatus || 'drafted').replace(/_/g, ' ') : 'not drafted'}.`,
      { bold: true }
    ),
    p(disclosure('draft_status'), { italics: true }),
    p(
      blocking.length + artefactBlocking.length
        ? `${blocking.length + artefactBlocking.length} blocking finding(s) remain; see the evidence and disclosure record at the end. This draft is not faculty-review ready.`
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
      ],
      [28, 72]
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
      outcomes.map((o) => [o.id, o.statement, o.bloomLevel, assessedBy(o.id)]),
      [10, 48, 12, 30]
    )
  );
  // An overview only: each week's lecture topics and activities are set out in T03 and T04.
  children.push(h('4. Four-week structure', HeadingLevel.HEADING_2));
  children.push(
    table(
      ['Week', 'Theme', 'CLOs', 'Live lecture', 'Monitored (h)', 'Independent (h)'],
      draft.weeks.map((w) => [
        String(w.number),
        w.theme,
        w.outcomeIds.join(', '),
        `${w.liveLecture.title} (${w.liveLecture.hours} h)`,
        String(sum(w.monitoredStudy.map((m) => m.hours))),
        String(sum(w.independentStudy.map((m) => m.hours))),
      ]),
      [10, 21, 12, 25, 16, 16]
    )
  );
  children.push(p('Activities and hours for each week are set out in T03 and T04 below.'));
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
      ],
      [70, 30]
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
      ]),
      [46, 12, 14, 28]
    )
  );
  children.push(
    h('7. Tools, data or sandboxes required', HeadingLevel.HEADING_2),
    p(input.tools || 'None stated.')
  );
  children.push(...disclosuresFor('course_specification'));

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
      ],
      [28, 72]
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
      ]),
      [8, 34, 34, 24]
    )
  );
  children.push(h('Assessment and grading', HeadingLevel.HEADING_2));
  children.push(
    table(
      ['Component', 'Weight', 'Due'],
      draft.assessments.map((a) => [a.title, `${a.weight}%`, `Week ${a.weekDue}`]),
      [64, 16, 20]
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
  children.push(...disclosuresFor('syllabus'));

  // T03 Weekly Plan & Live Session Run Sheet
  children.push(h('T03 · Weekly Plan & Live Session Run Sheets', HeadingLevel.HEADING_1));
  for (const w of draft.weeks) {
    children.push(h(`Week ${w.number}: ${w.theme}`, HeadingLevel.HEADING_2));
    children.push(p(`CLOs addressed: ${w.outcomeIds.join(', ') || 'none'}`, { bold: true }));
    children.push(
      h(`Live lecture (${w.liveLecture.hours} h): ${w.liveLecture.title}`, HeadingLevel.HEADING_3),
      ...w.liveLecture.topics.map((topic) => bullet(topic))
    );
    children.push(h('Run sheet', HeadingLevel.HEADING_3));
    children.push(
      w.liveLecture.runSheet.length
        ? table(
            ['Time (min)', 'Segment', 'Activity / method', 'Materials'],
            w.liveLecture.runSheet.map((s) => [
              `${s.startMinute}–${s.endMinute}`,
              s.segment,
              s.activity,
              s.materials || '—',
            ]),
            [12, 18, 50, 20]
          )
        : p('No run sheet drafted for this lecture.')
    );
    children.push(h('Faculty-monitored study (contact)', HeadingLevel.HEADING_3));
    children.push(
      w.monitoredStudy.length
        ? table(
            ['Activity', 'Faculty role', 'Evidence logged', 'Hours'],
            w.monitoredStudy.map((m) => [
              m.activity,
              m.facultyRole,
              m.evidenceLogged,
              String(m.hours),
            ]),
            [36, 30, 24, 10]
          )
        : p('No monitored study drafted for this week.')
    );
    children.push(h('Independent study', HeadingLevel.HEADING_3));
    children.push(
      w.independentStudy.length
        ? table(
            ['Activity', 'Hours'],
            w.independentStudy.map((m) => [m.activity, String(m.hours)]),
            [88, 12]
          )
        : p('No independent study drafted for this week.')
    );
    children.push(
      p(`Graded items due: ${w.gradedItemsDue.join('; ') || 'none this week'}`, { italics: true })
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
        .concat([['Total', String(live), '', '', '', String(sum([live, monitored]))]]),
      [10, 11, 27, 21, 21, 10]
    )
  );
  children.push(
    table(
      ['Week', 'Independent activity', 'Hours'],
      draft.weeks
        .flatMap((w) =>
          w.independentStudy.map((m) => [String(w.number), m.activity, String(m.hours)])
        )
        .concat([['Total', '', String(independent)]]),
      [10, 78, 12]
    )
  );
  children.push(...disclosuresFor('contact_hour_map'));

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
            linkParagraph(r.link),
          ]),
          [10, 44, 13, 11, 22]
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
          ]),
          [10, 38, 26, 26]
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
          ],
          [28, 72]
        )
      );
      children.push(...briefParagraphs(a.brief));
    }
  } else {
    children.push(p('No applied assignment in this draft.'));
  }

  if (input.artefacts) children.push(...artefactSections(input.artefacts, draft));

  const notDrafted = [
    ['T07', 'T07 Marking rubric'],
    ['T08', 'T08 Quiz & practice bank'],
    ['T09', 'T09 Final exam blueprint & paper'],
    ['T10', 'T10 Discussion / seminar prompts'],
    ['T11', 'T11 AI tutor knowledge pack'],
    ...(course.role === 'capstone' ? [['T13', 'T13 Capstone assessment design']] : []),
  ].filter(([code]) => !drafted.has(code));
  if (notDrafted.length) {
    children.push(h('Not drafted in this version', HeadingLevel.HEADING_1));
    notDrafted.forEach(([, label]) => children.push(bullet(label)));
  }

  // Evidence and disclosure record
  children.push(h('Evidence and disclosure record', HeadingLevel.HEADING_1));
  children.push(
    bullet(
      `Outcomes, weeks, assessments and cases are proposals for faculty review; locked facts come from the catalogue.`
    )
  );
  // Distinct sources: one source can be assigned to two weeks, and "12 chosen" overstated it.
  const distinctReadings = new Set(draft.readings.map((r) => r.sourceId || r.citation)).size;
  children.push(
    bullet(
      `Readings: ${draft.readings.length} assigned from ${distinctReadings} distinct sources, chosen from ${input.sourcesOffered} verified open-access sources; anything else the model cited was dropped.`
    )
  );
  children.push(
    bullet(
      `Checked against the ${RULE_PACK_VERSION} rule pack and catalogue v${input.catalogue.edition.version}.`
    )
  );
  children.push(
    bullet(
      `Cases: every generated case is a hypothetical teaching scenario, not a real company event.`
    )
  );
  if (input.artefacts) {
    children.push(
      bullet(
        'Assessments and tutor pack: rubric, quiz and practice items, exam questions and tutor content are proposals written from this outline for faculty review. The exam blueprint is counted from the paper.'
      )
    );
  }
  children.push(h('Findings', HeadingLevel.HEADING_2));
  if (!findings.length) children.push(p('No findings.'));
  blocking.forEach((f) => children.push(bullet(`Blocking · ${f.code}: ${f.message}`)));
  warnings.forEach((f) => children.push(bullet(`Warning · ${f.code}: ${f.message}`)));
  if (input.artefacts) {
    children.push(h('Assessment and tutor-pack findings (T07-T11)', HeadingLevel.HEADING_3));
    if (!artefactFindings.length) children.push(p('No findings.'));
    [...artefactBlocking, ...artefactFindings.filter((f) => f.severity === 'warning')].forEach(
      (f) =>
        children.push(
          bullet(`${f.severity === 'blocking' ? 'Blocking' : 'Warning'} · ${f.code}: ${f.message}`)
        )
    );
  }
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
