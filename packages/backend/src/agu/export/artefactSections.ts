/**
 * T07-T11 in the course package, laid out in each template's own columns: the marking rubric,
 * the quiz and practice bank, the final exam blueprint and paper, the weekly discussion prompts,
 * and the AI tutor knowledge pack. The exam's blueprint is counted from its paper here, never
 * taken from the model.
 */
import { HeadingLevel, Paragraph, Table } from 'docx';
import { CourseDraft } from '../draft/types';
import { CourseArtefacts, ExamQuestion, QuizItem } from '../draft/artefactTypes';
import { examBlueprint } from '../generation/artefactPrompts';
import { CellContent, h, lines, p, table } from './docxParts';

const LETTERS = 'ABCDE';

/** Which of T07-T11 the artefacts fill, so the package lists only the rest as not drafted. */
export function draftedTemplates(artefacts?: CourseArtefacts): Set<string> {
  const drafted = new Set<string>();
  if (!artefacts) return drafted;
  if (artefacts.rubrics.some((r) => r.rows.length)) drafted.add('T07');
  if (artefacts.quizBank.items.length || artefacts.quizBank.practice.length) drafted.add('T08');
  if (artefacts.finalExam?.paper.length) drafted.add('T09');
  if (artefacts.discussions.length) drafted.add('T10');
  const pack = artefacts.tutorPack;
  if (pack.glossary.length || pack.faqs.length || pack.guardrails.length) drafted.add('T11');
  return drafted;
}

const letterOf = (options: string[], answer: string): string => {
  const at = options.indexOf(answer);
  return at >= 0 ? LETTERS[at] || answer : answer;
};

function optionsCell(item: QuizItem): CellContent {
  if (item.type === 'short_answer') return lines(`Model answer: ${item.answers.join('; ')}`);
  return lines(
    ...item.options.map((o, k) => `${LETTERS[k] || k + 1}. ${o}`),
    `Answer: ${item.answers.map((a) => letterOf(item.options, a)).join(', ')}`
  );
}

function questionCell(q: ExamQuestion): CellContent {
  if (q.type !== 'mcq' || !q.options.length)
    return lines(q.question, `(${q.type.replace(/_/g, ' ')})`);
  return lines(q.question, ...q.options.map((o, k) => `${LETTERS[k] || k + 1}. ${o}`));
}

/** A worked solution's steps on their own lines: "1. ... 2. ..." or "Step 1: ... Step 2: ...". */
function stepLines(text: string): CellContent {
  const steps = text
    .split(/\n+|\s+(?=(?:Step\s+)?\d+[.):]\s)/i)
    .map((s) => s.trim())
    .filter(Boolean);
  return lines(...steps);
}

function rubricSection(artefacts: CourseArtefacts, draft: CourseDraft): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [h('T07 · Marking Rubric', HeadingLevel.HEADING_1)];
  for (const rubric of artefacts.rubrics) {
    const assessment = draft.assessments.find((a) => a.id === rubric.assessmentId);
    out.push(h(`Assessment: ${assessment?.title || rubric.assessmentId}`, HeadingLevel.HEADING_2));
    out.push(
      table(
        [
          'Criterion (CLO)',
          'Weight',
          'Excellent (A range)',
          'Good (B range)',
          'Below standard (< B-)',
        ],
        rubric.rows.map((r) => [
          `${r.criterion} (${r.outcomeId})`,
          `${r.weight}%`,
          r.excellent,
          r.good,
          r.belowStandard,
        ]),
        [22, 8, 24, 24, 22]
      )
    );
  }
  out.push(
    p(
      "The minimum passing grade for the course is B- (2.7). Criteria are loaded into the platform's grading queue by the LMS developer.",
      { italics: true }
    )
  );
  return out;
}

function quizSection(artefacts: CourseArtefacts, weeklyWeight: number): (Paragraph | Table)[] {
  const { plan, items, practice } = artefacts.quizBank;
  return [
    h('T08 · Quiz & Practice Bank', HeadingLevel.HEADING_1),
    h(`Part 1: Weekly graded quizzes (part of the ${weeklyWeight}%)`, HeadingLevel.HEADING_2),
    table(
      ['Week', 'Items', 'Time limit', 'Attempts', `Weight within ${weeklyWeight}%`],
      plan.map((q) => [
        `Week ${q.week}`,
        String(q.items),
        `${q.timeLimitMinutes} minutes`,
        String(q.attempts),
        `${q.weight}%`,
      ]),
      [16, 12, 24, 16, 32]
    ),
    h('Item bank', HeadingLevel.HEADING_3),
    table(
      ['ID', 'Week', 'CLO', 'Question', 'Options / answer', 'Rationale / feedback'],
      items.map((i) => [
        i.id,
        String(i.week),
        i.outcomeId,
        i.question,
        optionsCell(i),
        i.rationale,
      ]),
      [11, 7, 9, 29, 25, 19]
    ),
    h('Part 2: Practice bank (unlimited attempts, ungraded)', HeadingLevel.HEADING_2),
    table(
      ['ID', 'Week', 'CLO', 'Question', 'Answer', 'Feedback shown'],
      practice.map((q) => [q.id, String(q.week), q.outcomeId, q.question, q.answer, q.feedback]),
      [11, 7, 9, 29, 24, 20]
    ),
  ];
}

function examSection(artefacts: CourseArtefacts, draft: CourseDraft): (Paragraph | Table)[] {
  const exam = artefacts.finalExam;
  if (!exam) return [];
  const weight = draft.assessments.find((a) => a.component === 'final_exam')?.weight;
  return [
    h('T09 · Final Exam Blueprint & Paper', HeadingLevel.HEADING_1),
    p(
      'Confidential: for faculty and the LMS developer only. Never shared with students before the exam.',
      {
        bold: true,
      }
    ),
    p(
      `The final exam is proctored: browser lockdown, webcam verification (periodic still photographs) and ID matching.${weight ? ` Weight ${weight}%.` : ''}`,
      { italics: true }
    ),
    table(
      ['Field', 'Value'],
      [
        ['Duration', `${exam.durationMinutes} minutes`],
        ['Total marks', String(exam.totalMarks)],
      ],
      [28, 72]
    ),
    h('Blueprint', HeadingLevel.HEADING_2),
    table(
      ['CLO', 'Item types', 'No. of items', 'Marks', '% of exam'],
      examBlueprint(exam).map((r) => [
        r.outcomeId,
        r.itemTypes.map((x) => x.replace(/_/g, ' ')).join(', '),
        String(r.items),
        String(r.marks),
        `${r.percent}%`,
      ]),
      [12, 40, 16, 14, 18]
    ),
    p('Counted from the paper below.', { italics: true }),
    h('Exam paper', HeadingLevel.HEADING_2),
    table(
      ['Q#', 'CLO', 'Question', 'Marks', 'Model answer / marking guide'],
      exam.paper.map((q) => [
        String(q.number),
        q.outcomeId,
        questionCell(q),
        String(q.marks),
        q.markingGuide,
      ]),
      [7, 9, 42, 8, 34]
    ),
  ];
}

function discussionSection(
  artefacts: CourseArtefacts,
  weeklyWeight: number
): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [
    h('T10 · Discussion / Seminar Prompts', HeadingLevel.HEADING_1),
  ];
  for (const d of artefacts.discussions) {
    out.push(h(`Week ${d.week}`, HeadingLevel.HEADING_2));
    out.push(
      table(
        ['Field', 'Detail'],
        [
          ['Prompt', d.prompt],
          ['CLOs', d.outcomeIds.join(', ') || '—'],
          ['Student requirement', d.studentRequirement],
          ['Faculty moderation plan', d.moderationPlan],
          [
            'Graded? / criteria',
            d.graded
              ? `Graded, ${d.weight}% of the ${weeklyWeight}%: ${d.criteria || 'criteria not stated'}`
              : 'Ungraded',
          ],
          ['Counts toward contact hours (h)', String(d.contactHours)],
        ],
        [30, 70]
      )
    );
  }
  return out;
}

function tutorSection(artefacts: CourseArtefacts): (Paragraph | Table)[] {
  const pack = artefacts.tutorPack;
  const week = (w: number | null) => (w ? String(w) : 'All');
  return [
    h('T11 · AI Tutor Knowledge Pack', HeadingLevel.HEADING_1),
    p(
      "This content is indexed for this course's AI tutor only. The tutor explains and guides; it must refuse to produce graded or summative work. Tutor use counts as engagement, not contact.",
      { italics: true }
    ),
    h('1. Key concepts glossary', HeadingLevel.HEADING_2),
    table(
      ['Term', 'Plain-language definition', 'Week'],
      pack.glossary.map((g) => [g.term, g.definition, String(g.week)]),
      [25, 63, 12]
    ),
    h('2. Frequently asked questions', HeadingLevel.HEADING_2),
    table(
      ['Question', 'Model answer', 'Week'],
      pack.faqs.map((f) => [f.question, f.answer, String(f.week)]),
      [35, 53, 12]
    ),
    h('3. Worked examples', HeadingLevel.HEADING_2),
    table(
      ['Problem', 'Step-by-step solution', 'Week'],
      pack.workedExamples.map((e) => [e.problem, stepLines(e.solution), String(e.week)]),
      [35, 53, 12]
    ),
    h('4. Common misconceptions', HeadingLevel.HEADING_2),
    table(
      ['Misconception', 'Correction'],
      pack.misconceptions.map((m) => [m.misconception, m.correction]),
      [45, 55]
    ),
    h('5. Guardrails', HeadingLevel.HEADING_2),
    p('Topics or tasks the tutor must decline or redirect.', { italics: true }),
    table(
      ['Do not…', 'Instead…'],
      pack.guardrails.map((g) => [g.doNot, g.instead]),
      [50, 50]
    ),
    h('6. Source materials to index', HeadingLevel.HEADING_2),
    table(
      ['File / section', 'Week'],
      pack.sourceMaterials.map((s) => [s.item, week(s.week)]),
      [86, 14]
    ),
  ];
}

export function artefactSections(
  artefacts: CourseArtefacts,
  draft: CourseDraft
): (Paragraph | Table)[] {
  const drafted = draftedTemplates(artefacts);
  const weeklyWeight =
    draft.assessments.find((a) => a.component === 'weekly_quiz_discussion')?.weight ?? 20;
  return [
    ...(drafted.has('T07') ? rubricSection(artefacts, draft) : []),
    ...(drafted.has('T08') ? quizSection(artefacts, weeklyWeight) : []),
    ...(drafted.has('T09') ? examSection(artefacts, draft) : []),
    ...(drafted.has('T10') ? discussionSection(artefacts, weeklyWeight) : []),
    ...(drafted.has('T11') ? tutorSection(artefacts) : []),
  ];
}
