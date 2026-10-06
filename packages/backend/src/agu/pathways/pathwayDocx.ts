/**
 * An MBA pathway as one Word document: what the award is, the 16 courses in delivery order with
 * their state, and, for each published course, its description, outcomes and modules. A
 * pathway with courses still unpublished is marked a draft and lists what is outstanding.
 */
import { Document, HeadingLevel, Packer, Paragraph } from 'docx';
import { bullet, h, p, table } from '../export/docxParts';
import type { PathwayStatus } from './mbaPathways';
import { xmlSafeDeep } from '../../utils/xmlSafe';

const STATE_LABEL: Record<string, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  submitted: 'Awaiting approval',
  published: 'Published',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Programme = any;

export async function pathwayDocxBuffer(
  pathway: PathwayStatus,
  programmes: Map<string, Programme>,
  composition: string
): Promise<Buffer> {
  pathway = xmlSafeDeep(pathway);
  const outstanding = pathway.courses.filter((c) => c.state !== 'published');
  const children: (Paragraph | ReturnType<typeof table>)[] = [
    h(pathway.name, HeadingLevel.TITLE),
    p(
      pathway.ready
        ? 'All 16 courses are published.'
        : `Draft: ${pathway.totals.published} of ${pathway.totals.courses} courses are published. This pathway is not ready to offer until every course is approved and published.`,
      { bold: !pathway.ready }
    ),
    h('The award', HeadingLevel.HEADING_1),
    bullet(composition),
    bullet(
      `${pathway.totals.courses} courses, ${pathway.totals.credits} semester credits, ${pathway.totals.hours} learning hours.`
    ),
    ...Array.from(new Set(pathway.courses.map((c) => c.gateway).filter(Boolean))).map((g) =>
      bullet(`Gateway: ${g} must be completed before the specialization courses.`)
    ),
    h('Courses', HeadingLevel.HEADING_1),
    table(
      ['Code', 'Course', 'Role', 'Delivery', 'State'],
      pathway.courses.map((c) => [c.code, c.title, c.role, c.deliveryWindow, STATE_LABEL[c.state]]),
      [9, 37, 16, 24, 14]
    ),
  ];
  if (outstanding.length) {
    children.push(
      h('Outstanding', HeadingLevel.HEADING_1),
      ...outstanding.map((c) =>
        bullet(`${c.code} ${c.title}: ${STATE_LABEL[c.state].toLowerCase()}`)
      )
    );
  }
  for (const course of pathway.courses.filter((c) => c.state === 'published')) {
    const prog = xmlSafeDeep(programmes.get(course.code) || {});
    children.push(h(`${course.code} ${course.title}`, HeadingLevel.HEADING_1));
    if (prog?.step1?.programDescription) children.push(p(String(prog.step1.programDescription)));
    const outcomes: Programme[] = prog?.step3?.outcomes || [];
    if (outcomes.length) {
      children.push(
        h('Learning outcomes', HeadingLevel.HEADING_2),
        ...outcomes.map((o) => bullet(`${o.code || o.id}: ${o.statement || ''}`))
      );
    }
    const modules: Programme[] = prog?.step4?.modules || [];
    if (modules.length) {
      children.push(
        h('Modules', HeadingLevel.HEADING_2),
        ...modules.map((m) => bullet(`${m.code || ''} ${m.title || ''}`.trim()))
      );
    }
  }
  const doc = new Document({
    creator: 'Curriculum Generator',
    title: pathway.name,
    sections: [{ children }],
  });
  return Packer.toBuffer(doc);
}
