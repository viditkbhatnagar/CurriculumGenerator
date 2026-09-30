/**
 * Renders a module's faculty delivery guide (see facultyGuideModel) as a Word document.
 *
 * Uses real Word headings and bullet lists, so the document has a navigable outline and a
 * screen reader can announce its structure. The curriculum export draws bullets as "•"
 * characters inside plain paragraphs, which the 21 Sep 2026 review flagged as an accessibility
 * and navigation problem.
 */
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { GuideModule, GuideSession } from './facultyGuideModel';

const FONT = 'Arial';
const BODY = 21; // half-points: 10.5pt
const NONE = 'Not recorded for this session.';

const text = (t: string, opts: { bold?: boolean; italics?: boolean } = {}) =>
  new TextRun({ text: t, font: FONT, size: BODY, ...opts });

const para = (t: string, opts: { italics?: boolean } = {}) =>
  new Paragraph({ children: [text(t, opts)], spacing: { after: 80 } });

const bullet = (t: string, level = 0) =>
  new Paragraph({ children: [text(t)], bullet: { level }, spacing: { after: 40 } });

/** "Label: value" as a bullet with the label in bold. */
const labelled = (label: string, value: string, level = 0) =>
  new Paragraph({
    children: [text(`${label}: `, { bold: true }), text(value)],
    bullet: { level },
    spacing: { after: 40 },
  });

const heading = (t: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) =>
  new Paragraph({ text: t, heading: level, spacing: { before: 200, after: 80 } });

function bulletsOrNone(items: string[], level = 0): Paragraph[] {
  return items.length ? items.map((i) => bullet(i, level)) : [para(NONE, { italics: true })];
}

function sessionBlock(s: GuideSession): Paragraph[] {
  const out: Paragraph[] = [];
  const duration = s.durationMinutes ? ` (${s.durationMinutes} min)` : '';
  out.push(heading(`Session ${s.number}: ${s.topic}${duration}`, HeadingLevel.HEADING_2));

  out.push(heading('1. Session Focus', HeadingLevel.HEADING_3));
  out.push(labelled('Main topic', s.topic));
  if (s.focus.keyConcepts.length)
    out.push(labelled('Key concepts', s.focus.keyConcepts.join('; ')));
  if (s.focus.whyItMatters.length) {
    out.push(labelled('Why this topic matters', 'it builds towards'));
    s.focus.whyItMatters.forEach((w) => out.push(bullet(w, 1)));
  }
  if (s.focus.connectionToPrevious) {
    out.push(
      labelled(
        'Connection to previous learning',
        s.focus.connectionToPrevious.replace(/^Builds on the previous session: /, '')
      )
    );
  }

  out.push(heading('2. Alignment', HeadingLevel.HEADING_3));
  out.push(labelled('MLO', s.alignment.mlos.join(', ') || 'none recorded'));
  out.push(labelled('PLO', s.alignment.plos.join(', ') || 'none recorded'));
  out.push(labelled('Assessment link', s.alignment.assessment.join(', ') || 'none recorded'));
  if (s.alignment.reference) out.push(labelled('Reference', s.alignment.reference));

  out.push(heading('3. Faculty Teaching Guidance', HeadingLevel.HEADING_3));
  out.push(...bulletsOrNone(s.teachingGuidance));

  out.push(heading('4. Key Concepts to Cover', HeadingLevel.HEADING_3));
  if (s.keyConcepts.length) {
    for (const c of s.keyConcepts) {
      out.push(bullet(c.name));
      if (c.definition) out.push(labelled('Definition', c.definition, 1));
    }
  } else {
    out.push(para(NONE, { italics: true }));
  }

  out.push(heading('5. Teaching & Learning Activities', HeadingLevel.HEADING_3));
  if (s.activities.length) {
    for (const a of s.activities) {
      const mins = a.minutes ? ` (${a.minutes} min)` : '';
      out.push(labelled(`${a.label}${mins}`, a.title));
      a.steps.forEach((step) => out.push(bullet(step, 1)));
      if (a.detail) out.push(bullet(a.detail, 1));
    }
  } else {
    out.push(para(NONE, { italics: true }));
  }

  out.push(heading('6. Faculty Facilitation Prompts', HeadingLevel.HEADING_3));
  if (s.prompts.ask.length || s.prompts.watchFor.length) {
    s.prompts.ask.forEach((q) => out.push(labelled('Ask', q)));
    s.prompts.watchFor.forEach((m) => out.push(labelled('Watch for the misconception', m)));
  } else {
    out.push(para(NONE, { italics: true }));
  }

  out.push(heading('7. Check for Learning', HeadingLevel.HEADING_3));
  out.push(...bulletsOrNone(s.checks));

  out.push(heading('8. Resources / Preparation', HeadingLevel.HEADING_3));
  const r = s.resources;
  const any =
    r.readings.length ||
    r.cases.length ||
    r.materials.length ||
    r.adaptations.length ||
    r.studentPreparation ||
    r.aiUse;
  if (r.readings.length) {
    out.push(labelled('Essential reading', `${r.readings.length} item(s)`));
    r.readings.forEach((c) => out.push(bullet(c, 1)));
  }
  if (r.cases.length) out.push(labelled('Case study', r.cases.join('; ')));
  if (r.materials.length) out.push(labelled('Slides / resources', r.materials.join('; ')));
  if (r.studentPreparation)
    out.push(labelled('Student preparation and independent task', r.studentPreparation));
  if (r.aiUse) out.push(labelled('AI use', r.aiUse));
  if (r.adaptations.length) {
    out.push(labelled('Adaptations', `${r.adaptations.length} option(s)`));
    r.adaptations.forEach((a) => out.push(bullet(a, 1)));
  }
  if (!any) out.push(para(NONE, { italics: true }));

  out.push(heading('9. Session Takeaways', HeadingLevel.HEADING_3));
  if (s.takeaways.length) {
    out.push(para('By the end of the session, students should be able to:'));
    s.takeaways.forEach((t) => out.push(bullet(t)));
  } else {
    out.push(para(NONE, { italics: true }));
  }
  return out;
}

export function facultyGuideDocument(guide: GuideModule, programmeTitle?: string): Document {
  const children: Paragraph[] = [];
  children.push(
    heading(`Faculty Delivery Guide: ${guide.code} ${guide.title}`.trim(), HeadingLevel.TITLE)
  );
  if (programmeTitle) children.push(para(programmeTitle, { italics: true }));
  children.push(
    para(
      'This guide sets the minimum teaching and learning each session must cover. Slides and ' +
        'delivery style are the lecturer’s own choice, provided these requirements and the ' +
        'intended learning outcomes are met.'
    )
  );

  children.push(heading('Minimum Teaching Requirements', HeadingLevel.HEADING_1));
  const hours = guide.contactHours ? `, ${guide.contactHours} contact hours` : '';
  children.push(bullet(`Teach all ${guide.sessions.length} sessions below${hours}.`));
  if (guide.minimumRequirements.length) {
    children.push(bullet('Every module learning outcome must be taught and checked:'));
    guide.minimumRequirements.forEach((m) => children.push(bullet(m, 1)));
  }

  children.push(heading('Sessions', HeadingLevel.HEADING_1));
  for (const s of guide.sessions) children.push(...sessionBlock(s));

  return new Document({
    creator: 'Curriculum Generator',
    title: `Faculty Delivery Guide ${guide.code}`,
    styles: { default: { document: { run: { font: FONT, size: BODY } } } },
    sections: [{ children }],
  });
}

export async function facultyGuideBuffer(
  guide: GuideModule,
  programmeTitle?: string
): Promise<Buffer> {
  return Packer.toBuffer(facultyGuideDocument(guide, programmeTitle));
}
