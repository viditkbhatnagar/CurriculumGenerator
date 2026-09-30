/**
 * Renders a module's faculty delivery guide (see facultyGuideModel) as a Word document.
 *
 * Uses real Word headings and bullet lists, so the document has a navigable outline and a
 * screen reader can announce its structure. The curriculum export draws bullets as "•"
 * characters inside plain paragraphs, which the 21 Sep 2026 review flagged as an accessibility
 * and navigation problem.
 */
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import {
  GuideActivity,
  GuideCaseActivity,
  GuideCharacter,
  GuideCheck,
  GuideFormative,
  GuideModule,
  GuideRolePlay,
  GuideSession,
  incompleteNote,
} from './facultyGuideModel';
import { xmlSafeDeep } from '../../utils/xmlSafe';

const FONT = 'Arial';
const BODY = 21; // half-points: 10.5pt
const NONE = 'Not recorded for this session.';

const text = (t: string, opts: { bold?: boolean; italics?: boolean } = {}) =>
  new TextRun({ text: t, font: FONT, size: BODY, ...opts });

const para = (t: string, opts: { bold?: boolean; italics?: boolean } = {}) =>
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

/** A bold label that introduces the bullets beneath it. */
const caption = (label: string, level = 0) =>
  new Paragraph({
    children: [text(`${label}:`, { bold: true })],
    bullet: { level },
    spacing: { after: 40 },
  });

const heading = (t: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) =>
  new Paragraph({ text: t, heading: level, spacing: { before: 200, after: 80 } });

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

/** "Label: value" when there is a value, and nothing when there is not. */
const optional = (label: string, value: string | undefined, level = 0): Paragraph[] =>
  value ? [labelled(label, value, level)] : [];

/** One item reads "Label: item"; several read as the label with a bullet for each. */
function labelledList(label: string, items: string[], level = 0): Paragraph[] {
  if (items.length === 0) return [];
  if (items.length === 1) return [labelled(label, items[0], level)];
  return [caption(label, level), ...items.map((i) => bullet(i, level + 1))];
}

/** A label carrying the number of items, with the items beneath it. */
function countedList(label: string, noun: string, items: string[]): Paragraph[] {
  if (items.length === 0) return [];
  return [labelled(label, `${items.length} ${noun}`), ...items.map((i) => bullet(i, 1))];
}

/** A section with nothing behind it says so rather than vanishing. */
const orNone = (paragraphs: Paragraph[]): Paragraph[] =>
  paragraphs.length ? paragraphs : [para(NONE, { italics: true })];

const section = (title: string) => heading(title, HeadingLevel.HEADING_3);

function focusSection(s: GuideSession): Paragraph[] {
  const { keyConcepts, whyItMatters, connectionToPrevious } = s.focus;
  return [
    section('1. Session Focus'),
    labelled('Main topic', s.topic),
    ...(keyConcepts.length ? [labelled('Key concepts', keyConcepts.join('; '))] : []),
    ...(whyItMatters.length
      ? [
          labelled('Why this topic matters', 'it builds towards'),
          ...whyItMatters.map((w) => bullet(w, 1)),
        ]
      : []),
    ...optional(
      'Connection to previous learning',
      connectionToPrevious?.replace(/^Builds on the previous session: /, '')
    ),
  ];
}

function alignmentSection(s: GuideSession): Paragraph[] {
  const a = s.alignment;
  return [
    section('2. Alignment'),
    labelled('MLO', a.mlos.join(', ') || 'none recorded'),
    labelled('PLO', a.plos.join(', ') || 'none recorded'),
    labelled('Assessment link', a.assessment.join(', ') || 'none recorded'),
    ...optional('Reference', a.reference),
  ];
}

function guidanceSection(s: GuideSession): Paragraph[] {
  return [
    section('3. Faculty Teaching Guidance'),
    ...orNone([...s.teachingGuidance.map((g) => bullet(g)), ...labelledList('Pacing', s.pacing)]),
  ];
}

function conceptsSection(s: GuideSession): Paragraph[] {
  return [
    section('4. Key Concepts to Cover'),
    ...orNone(
      s.keyConcepts.flatMap((c) => [bullet(c.name), ...optional('Definition', c.definition, 1)])
    ),
  ];
}

function activityBlock(a: GuideActivity): Paragraph[] {
  const mins = a.minutes ? ` (${a.minutes} min)` : '';
  return [
    labelled(`${a.label}${mins}`, a.title),
    ...(a.description ? [bullet(a.description, 1)] : []),
    ...optional('Teaching method', a.teachingMethod, 1),
    ...(a.usesAI
      ? [labelled('Applied AI', 'students use a generative AI tool in this activity', 1)]
      : []),
    ...a.steps.map((step) => bullet(step, 1)),
    ...labelledList('Students', a.studentActions, 1),
  ];
}

function characterLine(c: GuideCharacter): string {
  const role = c.role ? ` (${c.role})` : '';
  return `${c.name}${role}${c.background ? `: ${c.background}` : ''}`;
}

function rolePlayBlock(rolePlay: GuideRolePlay): Paragraph[] {
  return [
    ...rolePlay.characters.flatMap((c) => [
      labelled('Role-play character', characterLine(c), 1),
      ...labelledList('Objectives', c.objectives, 2),
    ]),
    ...labelledList('Role-play decision prompts', rolePlay.decisionPrompts, 1),
    ...labelledList('Role-play debrief questions', rolePlay.debriefQuestions, 1),
  ];
}

function caseActivityBlock(c: GuideCaseActivity): Paragraph[] {
  const meta = [c.kind, c.minutes ? `${c.minutes} min` : ''].filter(Boolean).join(', ');
  const hooks = [
    ...labelledList('Key facts', c.hooks.keyFacts, 2),
    ...labelledList('Misconceptions', c.hooks.misconceptions, 2),
    ...labelledList('Decision points', c.hooks.decisionPoints, 2),
  ];
  return [
    labelled(`Case activity${meta ? ` (${meta})` : ''}`, c.title),
    ...optional('Purpose', c.purpose, 1),
    ...labelledList('Instructions', c.instructions, 1),
    ...labelledList('Students produce', c.expectedOutputs, 1),
    ...(hooks.length ? [caption('Assessment hooks', 1), ...hooks] : []),
    ...(c.rolePlay ? rolePlayBlock(c.rolePlay) : []),
  ];
}

function activitiesSection(s: GuideSession): Paragraph[] {
  return [
    section('5. Teaching & Learning Activities'),
    ...orNone([
      ...optional('Practical / AI / case activity', s.practicalActivity),
      ...s.activities.flatMap(activityBlock),
      ...(s.caseActivity ? caseActivityBlock(s.caseActivity) : []),
    ]),
  ];
}

function promptsSection(s: GuideSession): Paragraph[] {
  return [
    section('6. Faculty Facilitation Prompts'),
    ...orNone([
      ...s.prompts.ask.map((q) => labelled('Ask', q)),
      ...s.prompts.watchFor.map((m) => labelled('Watch for the misconception', m)),
    ]),
  ];
}

function checkBlock(c: GuideCheck): Paragraph[] {
  const kind = `${c.label}${c.minutes ? ` (${c.minutes} min)` : ''}`;
  return [
    c.question ? labelled(kind, c.question) : bullet(kind),
    ...c.options.map((option) => bullet(option, 1)),
    ...optional('Correct answer', c.correctAnswer, 1),
    ...optional('Explanation', c.explanation, 1),
    ...optional('Outcome checked', c.mlo, 1),
    ...optional('Full task and model answers', c.ref ? `Appendix, ${c.ref}` : undefined, 1),
  ];
}

function checksSection(s: GuideSession): Paragraph[] {
  return [
    section('7. Check for Learning'),
    ...orNone([
      ...s.checks.flatMap(checkBlock),
      ...optional('Evidence of learning', s.evidenceOfLearning),
    ]),
  ];
}

function resourcesSection(s: GuideSession): Paragraph[] {
  const r = s.resources;
  const effort = r.independentStudyMinutes ? `${r.independentStudyMinutes} minutes` : undefined;
  return [
    section('8. Resources / Preparation'),
    ...orNone([
      ...countedList('Essential reading', 'item(s)', r.readings),
      ...countedList('Supplementary reading', 'item(s)', r.supplementaryReadings),
      ...optional('Estimated independent study', effort),
      ...(r.cases.length ? [labelled('Case study', r.cases.join('; '))] : []),
      ...(r.materials.length ? [labelled('Slides / resources', r.materials.join('; '))] : []),
      ...optional('Student preparation and independent task', r.studentPreparation),
      ...optional('Source material for the independent task', r.sourceMapping),
      ...optional('Evidence students submit from the independent task', r.studentEvidence),
      ...optional('AI use', r.aiUse),
      ...countedList('Adaptations', 'option(s)', r.adaptations),
    ]),
  ];
}

function takeawaysSection(s: GuideSession): Paragraph[] {
  return [
    section('9. Session Takeaways'),
    ...(s.takeaways.length
      ? [
          para('By the end of the session, students should be able to:'),
          ...s.takeaways.map((t) => bullet(t)),
        ]
      : [para(NONE, { italics: true })]),
  ];
}

function sessionBlock(s: GuideSession): Paragraph[] {
  const duration = s.durationMinutes ? ` (${s.durationMinutes} min)` : '';
  return [
    heading(`Session ${s.number}: ${s.topic}${duration}`, HeadingLevel.HEADING_2),
    ...focusSection(s),
    ...alignmentSection(s),
    ...guidanceSection(s),
    ...conceptsSection(s),
    ...activitiesSection(s),
    ...promptsSection(s),
    ...checksSection(s),
    ...resourcesSection(s),
    ...takeawaysSection(s),
  ];
}

/** Several lines under one label; one line reads "Label: line". */
function linesUnder(label: string, lines: string[], level: number): Paragraph[] {
  if (lines.length === 0) return [];
  if (lines.length === 1) return [labelled(label, lines[0], level)];
  return [caption(label, level), ...lines.map((l) => bullet(l, level + 1))];
}

const splitLines = (t: string | undefined) =>
  (t || '')
    .split(/\n+/)
    .map((l) => l.replace(/^\s*[-•]\s*/, '').trim())
    .filter(Boolean);

/** One Step 7 formative assessment, in full, for the appendix. */
function formativeBlock(f: GuideFormative): Paragraph[] {
  return [
    heading(`${f.ref}. ${f.title}`, HeadingLevel.HEADING_2),
    ...optional('Type', f.type),
    ...optional('Purpose', f.purpose),
    ...linesUnder('How to run it', f.instructions, 0),
    ...f.questions.flatMap((q) => [
      ...linesUnder(`Q${q.number}${q.type ? ` (${q.type})` : ''}`, splitLines(q.text), 0),
      ...q.options.map((o) => bullet(o, 1)),
      ...linesUnder('Model answer', splitLines(q.answer), 1),
      ...optional('Why', q.rationale, 1),
    ]),
    ...labelledList('Success criteria', f.criteria),
    ...optional('Feedback guidance', f.feedbackGuidance),
    ...labelledList('Student self-check', f.selfCheck),
  ];
}

/**
 * The first requirement: how many sessions to teach.
 *
 * A partly generated module must not say "all", and must not quote the module's contact hours,
 * which the sessions present do not add up to.
 */
function sessionCountRequirement(guide: GuideModule): string {
  const held = guide.sessions.length;
  if (incompleteNote(guide) && guide.plannedSessions) {
    const missing = guide.plannedSessions - held;
    return (
      `Teach the ${plural(held, 'session')} below. A further ` +
      `${plural(missing, 'planned session')} ${missing === 1 ? 'is' : 'are'} not yet available.`
    );
  }
  const hours = guide.contactHours ? `, ${guide.contactHours} contact hours` : '';
  return `Teach all ${plural(held, 'session')} below${hours}.`;
}

export function facultyGuideDocument(guide: GuideModule, programmeTitle?: string): Document {
  // A lesson held U+0014 and made the BBA M42 guide invalid XML. See xmlSafe.
  guide = xmlSafeDeep(guide);
  programmeTitle = programmeTitle && xmlSafeDeep(programmeTitle);
  const note = incompleteNote(guide);
  const title = `Faculty Delivery Guide: ${guide.code} ${guide.title}`.trim();
  const children: Paragraph[] = [
    heading(note ? `${title} (incomplete)` : title, HeadingLevel.TITLE),
    ...(programmeTitle ? [para(programmeTitle, { italics: true })] : []),
    ...(note ? [para(`This guide is incomplete: ${note}`, { bold: true })] : []),
    para(
      'This guide sets the minimum teaching and learning each session must cover. Slides and ' +
        'delivery style are the lecturer’s own choice, provided these requirements and the ' +
        'intended learning outcomes are met.'
    ),
    heading('Minimum Teaching Requirements', HeadingLevel.HEADING_1),
    bullet(sessionCountRequirement(guide)),
    ...(guide.minimumRequirements.length
      ? [
          bullet('Every module learning outcome must be taught and checked:'),
          ...guide.minimumRequirements.map((m) => bullet(m, 1)),
        ]
      : []),
    heading('Sessions', HeadingLevel.HEADING_1),
    ...guide.sessions.flatMap(sessionBlock),
    ...(guide.formatives.length
      ? [
          heading('Appendix: Formative Checks Used in This Module', HeadingLevel.HEADING_1),
          para(
            'Each check is set out once here, with its questions and model answers; sessions ' +
              'refer to it by number. From the module’s Step 7 formative assessments.',
            { italics: true }
          ),
          ...guide.formatives.flatMap(formativeBlock),
        ]
      : []),
  ];

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
