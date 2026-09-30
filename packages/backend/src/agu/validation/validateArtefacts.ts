/**
 * Checks on the drafted T07-T11 artefacts, computed from what is stored.
 *
 * Each check tests a rule a faculty reviewer or the LMS developer would otherwise find by hand:
 * rubric weights that do not add up, an outcome the exam never tests, a quiz key that is not
 * one of its options, exam questions already given away in the practice bank or the tutor pack,
 * a tutor with no rule against doing the assignment. A check with nothing to measure fails
 * rather than passes, as everywhere else in the engine.
 *
 * Pure, no I/O, so it can be tested.
 */
import { CourseDraft, Finding, Severity } from '../draft/types';
import { CourseArtefacts, QuizItem } from '../draft/artefactTypes';
import { examBlueprint, rubricAssessments } from '../generation/artefactPrompts';
import { findProhibitedClaims } from '../rules/usUtahRules';
import { outlineHash } from '../draft/outlineHash';

const MIN_EXAM_MINUTES = 60;
const MAX_EXAM_MINUTES = 180;
/** An outcome the exam assesses with less than this share of the marks is barely sampled. */
const MIN_OUTCOME_SHARE_PERCENT = 10;
/** Two questions this similar (shared content words) are the same question. */
const DUPLICATE_SIMILARITY = 0.6;
/** Bias checks need enough items to mean anything. */
const BIAS_MIN_ITEMS = 6;
const BIAS_MAX_SHARE = 0.5;
const MIN_OPTIONS = 3;
const MAX_OPTIONS = 5;
const THIN_PACK = { glossary: 8, faqs: 5, workedExamples: 2, misconceptions: 3 };
const TOLERANCE = 0.01;

const finding = (
  code: string,
  severity: Severity,
  message: string,
  path?: string,
  source?: string
): Finding => ({
  code,
  severity,
  message,
  ...(path ? { path } : {}),
  ...(source ? { source } : {}),
});

const sum = (xs: number[]) => xs.reduce((n, x) => n + (x || 0), 0);
const near = (a: number, b: number) => Math.abs(a - b) <= TOLERANCE;

const STOP_WORDS = new Set(
  'the a an of to and or in on for is are be was were what which how why does do with that this it as by at from your you their its should would could most best who when into than then there these those can will not'.split(
    ' '
  )
);

function contentWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  );
}

/** Share of content words two texts have in common (Jaccard); 0 for texts too short to judge. */
export function textSimilarity(a: string, b: string): number {
  const A = contentWords(a);
  const B = contentWords(b);
  if (A.size < 5 || B.size < 5) return 0;
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  return shared / (A.size + B.size - shared);
}

const NOT_AN_OPTION = /\b(all|none|both) of the above\b/i;

function checkRubrics(artefacts: CourseArtefacts, draft: CourseDraft, out: Finding[]): void {
  for (const assessment of rubricAssessments(draft)) {
    const rubric = artefacts.rubrics.find((r) => r.assessmentId === assessment.id);
    const path = `rubrics.${assessment.id}`;
    if (!rubric || rubric.rows.length === 0) {
      out.push(
        finding(
          'RUBRIC_MISSING',
          'blocking',
          `${assessment.title} has no marking rubric.`,
          path,
          'T07'
        )
      );
      continue;
    }
    const total = sum(rubric.rows.map((r) => r.weight));
    if (!near(total, 100)) {
      out.push(
        finding(
          'RUBRIC_WEIGHTS',
          'blocking',
          `The ${assessment.title} rubric's criteria weigh ${total}%, not 100%.`,
          path,
          'T07'
        )
      );
    }
    for (const id of assessment.outcomeIds) {
      if (!rubric.rows.some((r) => r.outcomeId === id)) {
        out.push(
          finding(
            'RUBRIC_OUTCOME_GAP',
            'blocking',
            `${assessment.title} assesses ${id}, but no rubric criterion marks it.`,
            path,
            'T07'
          )
        );
      }
    }
    rubric.rows.forEach((row, i) => {
      if (!assessment.outcomeIds.includes(row.outcomeId)) {
        out.push(
          finding(
            'RUBRIC_OUTCOME_EXTRA',
            'warning',
            `Rubric criterion ${i + 1} marks ${row.outcomeId}, which ${assessment.title} is not said to assess.`,
            path
          )
        );
      }
      if (
        row.weight <= 0 ||
        ![row.criterion, row.excellent, row.good, row.belowStandard].every(Boolean)
      ) {
        out.push(
          finding(
            'RUBRIC_ROW_INCOMPLETE',
            'blocking',
            `Rubric criterion ${i + 1} of ${assessment.title} needs a name, a weight above zero and all three band descriptors.`,
            `${path}.rows[${i}]`,
            'T07'
          )
        );
      }
    });
  }
}

function itemProblem(item: QuizItem): string | null {
  const options = item.options;
  const lowered = options.map((o) => o.toLowerCase());
  const allInOptions = item.answers.every((a) => options.includes(a));
  if (item.type === 'short_answer') return item.answers.length ? null : 'has no model answer';
  if (new Set(lowered).size !== lowered.length) return 'repeats an option';
  if (item.type === 'true_false') {
    return options.length === 2 && item.answers.length === 1 && allInOptions
      ? null
      : 'needs True/False options and one answer from them';
  }
  if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) {
    return `has ${options.length} options; ${MIN_OPTIONS}-${MAX_OPTIONS} are needed`;
  }
  if (item.type === 'mcq' && item.answers.length !== 1) {
    return `has ${item.answers.length} answers; a multiple-choice item has exactly one`;
  }
  if (
    item.type === 'multiple_select' &&
    (item.answers.length < 1 || item.answers.length >= options.length)
  ) {
    return 'must have some, but not all, options correct';
  }
  if (!allInOptions) return 'has an answer that is not one of its options';
  return null;
}

/** Items whose key is the uniquely longest option, and the commonest key position. */
function answerBias(items: QuizItem[]): { longest: number; position: number; n: number } {
  const keyed = items.filter(
    (i) => i.type === 'mcq' && i.answers.length === 1 && i.options.includes(i.answers[0])
  );
  let longest = 0;
  const positions = new Map<number, number>();
  for (const item of keyed) {
    const key = item.answers[0];
    const others = item.options.filter((o) => o !== key);
    if (others.every((o) => o.length < key.length)) longest++;
    const at = item.options.indexOf(key);
    positions.set(at, (positions.get(at) || 0) + 1);
  }
  return { longest, position: Math.max(0, ...positions.values()), n: keyed.length };
}

function checkQuizzes(artefacts: CourseArtefacts, draft: CourseDraft, out: Finding[]): void {
  const weekly = draft.assessments.find((a) => a.component === 'weekly_quiz_discussion');
  if (!weekly) return;
  const { plan, items, practice } = artefacts.quizBank;

  for (const week of draft.weeks) {
    const planned = plan.find((p) => p.week === week.number);
    const held = items.filter((i) => i.week === week.number);
    const path = `quizBank.week${week.number}`;
    if (!planned) {
      out.push(
        finding(
          'QUIZ_PLAN_WEEKS',
          'blocking',
          `Week ${week.number} has no graded quiz planned.`,
          path,
          'T08'
        )
      );
    } else if (held.length < planned.items) {
      out.push(
        finding(
          'QUIZ_ITEM_COUNT',
          'blocking',
          `Week ${week.number}'s quiz is planned at ${planned.items} items but ${held.length} were written.`,
          path,
          'T08'
        )
      );
    } else if (held.length > planned.items) {
      out.push(
        finding(
          'QUIZ_ITEM_COUNT',
          'warning',
          `Week ${week.number} holds ${held.length} quiz items for a quiz planned at ${planned.items}; faculty choose which to use.`,
          path
        )
      );
    }
    if (!practice.some((p) => p.week === week.number)) {
      out.push(
        finding(
          'PRACTICE_WEEK_EMPTY',
          'blocking',
          `Week ${week.number} has no practice items.`,
          path,
          'T08'
        )
      );
    }
    for (const item of held) {
      if (!week.outcomeIds.includes(item.outcomeId)) {
        out.push(
          finding(
            'QUIZ_OUTCOME_NOT_WEEK',
            'warning',
            `${item.id} tests ${item.outcomeId}, which week ${week.number} does not teach.`,
            `quizBank.items.${item.id}`
          )
        );
      }
    }
  }

  for (const item of items) {
    const problem = itemProblem(item);
    if (problem) {
      out.push(
        finding(
          'QUIZ_ITEM_INVALID',
          'blocking',
          `${item.id} ${problem}.`,
          `quizBank.items.${item.id}`,
          'T08'
        )
      );
    }
    if (item.options.some((o) => NOT_AN_OPTION.test(o))) {
      out.push(
        finding(
          'QUIZ_OPTION_WEAK',
          'warning',
          `${item.id} offers "all/none of the above", which tests elimination rather than the outcome.`,
          `quizBank.items.${item.id}`
        )
      );
    }
  }

  const bias = answerBias(items);
  if (bias.n >= BIAS_MIN_ITEMS && bias.longest / bias.n > BIAS_MAX_SHARE) {
    out.push(
      finding(
        'QUIZ_LENGTH_BIAS',
        'warning',
        `In ${bias.longest} of ${bias.n} multiple-choice items the correct option is the longest, so length gives the answer away.`,
        'quizBank.items'
      )
    );
  }
  if (bias.n >= BIAS_MIN_ITEMS && bias.position / bias.n > BIAS_MAX_SHARE) {
    out.push(
      finding(
        'QUIZ_POSITION_BIAS',
        'warning',
        `${bias.position} of ${bias.n} multiple-choice items put the correct option in the same position.`,
        'quizBank.items'
      )
    );
  }

  // The 20% is split between the weekly quizzes and any graded discussions.
  const discussionWeight = sum(artefacts.discussions.filter((d) => d.graded).map((d) => d.weight));
  const quizWeight = sum(plan.map((p) => p.weight));
  if (!near(quizWeight + discussionWeight, weekly.weight)) {
    out.push(
      finding(
        'WEEKLY_WEIGHTS',
        'blocking',
        `Weekly quizzes (${quizWeight}%) and graded discussions (${discussionWeight}%) add up to ${quizWeight + discussionWeight}%, not the ${weekly.weight}% of ${weekly.title}.`,
        'quizBank.plan',
        'T08'
      )
    );
  }
  for (const id of weekly.outcomeIds) {
    const quizzed = items.some((i) => i.outcomeId === id);
    const discussed = artefacts.discussions.some((d) => d.graded && d.outcomeIds.includes(id));
    if (!quizzed && !discussed) {
      out.push(
        finding(
          'WEEKLY_OUTCOME_GAP',
          'blocking',
          `${weekly.title} is said to assess ${id}, but no quiz item or graded discussion does.`,
          'quizBank',
          'T08'
        )
      );
    }
  }

  for (const p of practice) {
    const twin = items.find((i) => textSimilarity(i.question, p.question) >= DUPLICATE_SIMILARITY);
    if (twin) {
      out.push(
        finding(
          'PRACTICE_REPEATS_QUIZ',
          'warning',
          `Practice item ${p.id} is close to graded item ${twin.id}; with unlimited attempts it rehearses the graded answer.`,
          `quizBank.practice.${p.id}`
        )
      );
    }
  }
}

function checkExam(artefacts: CourseArtefacts, draft: CourseDraft, out: Finding[]): void {
  const final = draft.assessments.find((a) => a.component === 'final_exam');
  if (!final) return;
  const exam = artefacts.finalExam;
  if (!exam || exam.paper.length === 0) {
    out.push(
      finding(
        'EXAM_MISSING',
        'blocking',
        'The proctored final exam has no paper.',
        'finalExam',
        'T09'
      )
    );
    return;
  }
  const marks = sum(exam.paper.map((q) => q.marks));
  if (!near(marks, exam.totalMarks)) {
    out.push(
      finding(
        'EXAM_MARKS',
        'blocking',
        `The exam's questions carry ${marks} marks, not its total of ${exam.totalMarks}.`,
        'finalExam',
        'T09'
      )
    );
  }
  if (exam.durationMinutes < MIN_EXAM_MINUTES || exam.durationMinutes > MAX_EXAM_MINUTES) {
    out.push(
      finding(
        'EXAM_DURATION',
        'warning',
        `The exam runs ${exam.durationMinutes} minutes; ${MIN_EXAM_MINUTES}-${MAX_EXAM_MINUTES} is the expected range.`,
        'finalExam'
      )
    );
  }
  const blueprint = examBlueprint(exam);
  for (const id of final.outcomeIds) {
    const row = blueprint.find((r) => r.outcomeId === id);
    if (!row) {
      out.push(
        finding(
          'EXAM_OUTCOME_GAP',
          'blocking',
          `The final exam is said to assess ${id}, but no question tests it.`,
          'finalExam.paper',
          'T09'
        )
      );
      continue;
    }
    if (row.percent < MIN_OUTCOME_SHARE_PERCENT) {
      out.push(
        finding(
          'EXAM_OUTCOME_SHARE',
          'warning',
          `${id} carries ${row.percent}% of the exam's marks; one question barely samples an outcome.`,
          'finalExam.paper'
        )
      );
    }
    const level = draft.outcomes.find((o) => o.id === id)?.bloomLevel;
    const onlyRecall = row.itemTypes.every((t) => t === 'mcq' || t === 'short_answer');
    if ((level === 'evaluate' || level === 'create') && onlyRecall) {
      out.push(
        finding(
          'EXAM_BLOOM',
          'warning',
          `${id} is a "${level}" outcome but the exam tests it only with multiple-choice or short-answer questions.`,
          'finalExam.paper'
        )
      );
    }
  }
  for (const row of blueprint) {
    if (!final.outcomeIds.includes(row.outcomeId)) {
      out.push(
        finding(
          'EXAM_OUTCOME_EXTRA',
          'warning',
          `The exam tests ${row.outcomeId}, which the final exam is not said to assess.`,
          'finalExam.paper'
        )
      );
    }
  }
  for (const q of exam.paper) {
    const path = `finalExam.paper[${q.number - 1}]`;
    if (!q.markingGuide) {
      out.push(
        finding(
          'EXAM_MARKING_GUIDE',
          'blocking',
          `Question ${q.number} has no marking guide.`,
          path,
          'T09'
        )
      );
    }
    if (q.marks <= 0) {
      out.push(
        finding(
          'EXAM_QUESTION_MARKS',
          'blocking',
          `Question ${q.number} carries no marks.`,
          path,
          'T09'
        )
      );
    }
    if (q.type === 'mcq' && q.options.length < MIN_OPTIONS) {
      out.push(
        finding(
          'EXAM_MCQ_OPTIONS',
          'blocking',
          `Question ${q.number} is multiple choice with ${q.options.length} options.`,
          path,
          'T09'
        )
      );
    }
  }

  // The exam is proctored; a question the student has already met in the quiz or practice bank,
  // or can ask the tutor about, is no longer a test.
  const seen = [
    ...artefacts.quizBank.items.map((i) => ({ label: `quiz item ${i.id}`, text: i.question })),
    ...artefacts.quizBank.practice.map((p) => ({
      label: `practice item ${p.id}`,
      text: p.question,
    })),
    ...artefacts.tutorPack.faqs.map((f, i) => ({ label: `tutor FAQ ${i + 1}`, text: f.question })),
    ...artefacts.tutorPack.workedExamples.map((e, i) => ({
      label: `tutor worked example ${i + 1}`,
      text: e.problem,
    })),
  ];
  for (const q of exam.paper) {
    const twin = seen.find((s) => textSimilarity(s.text, q.question) >= DUPLICATE_SIMILARITY);
    if (twin) {
      out.push(
        finding(
          'EXAM_LEAK',
          'blocking',
          `Exam question ${q.number} is close to ${twin.label}, which students see before the exam.`,
          `finalExam.paper[${q.number - 1}]`,
          'T09'
        )
      );
    }
  }
}

const DISCUSSION_ACTIVITY = /discussion|forum|seminar|thread/i;

function checkDiscussions(artefacts: CourseArtefacts, draft: CourseDraft, out: Finding[]): void {
  for (const week of draft.weeks) {
    const d = artefacts.discussions.find((x) => x.week === week.number);
    const path = `discussions.week${week.number}`;
    if (!d) {
      out.push(
        finding(
          'DISCUSSION_WEEKS',
          'blocking',
          `Week ${week.number} has no discussion prompt.`,
          path,
          'T10'
        )
      );
      continue;
    }
    if (!d.prompt || !d.studentRequirement || !d.moderationPlan || (d.graded && !d.criteria)) {
      out.push(
        finding(
          'DISCUSSION_INCOMPLETE',
          'blocking',
          `Week ${week.number}'s discussion needs a prompt, a student requirement, a moderation plan${d.graded ? ' and grading criteria' : ''}.`,
          path,
          'T10'
        )
      );
    }
    const moderated = week.monitoredStudy.filter((m) => DISCUSSION_ACTIVITY.test(m.activity));
    const moderatedHours = sum(moderated.map((m) => m.hours));
    if (moderated.length > 0 && !near(d.contactHours, moderatedHours)) {
      out.push(
        finding(
          'DISCUSSION_CONTACT',
          'warning',
          `Week ${week.number}'s discussion counts ${d.contactHours} contact hours; the week's moderated discussion in the contact-hour map is ${moderatedHours}.`,
          path
        )
      );
    } else if (moderated.length === 0 && d.contactHours > 0) {
      out.push(
        finding(
          'DISCUSSION_CONTACT',
          'warning',
          `Week ${week.number}'s discussion counts ${d.contactHours} contact hours, but the contact-hour map has no moderated discussion that week.`,
          path
        )
      );
    }
  }
}

function checkTutorPack(artefacts: CourseArtefacts, out: Finding[]): void {
  const pack = artefacts.tutorPack;
  const rules = pack.guardrails.map((g) => `${g.doNot} ${g.instead}`);
  if (!rules.some((r) => /assignment|brief|report|deliverable|project/i.test(r))) {
    out.push(
      finding(
        'TUTOR_GUARDRAILS',
        'blocking',
        'No tutor guardrail stops it doing the applied assignment.',
        'tutorPack.guardrails',
        'T11'
      )
    );
  }
  if (!rules.some((r) => /exam|final/i.test(r))) {
    out.push(
      finding(
        'TUTOR_GUARDRAILS',
        'blocking',
        'No tutor guardrail stops it answering final exam questions.',
        'tutorPack.guardrails',
        'T11'
      )
    );
  }
  const thin = (Object.keys(THIN_PACK) as (keyof typeof THIN_PACK)[]).filter(
    (k) => pack[k].length < THIN_PACK[k]
  );
  if (thin.length > 0) {
    out.push(
      finding(
        'TUTOR_THIN',
        'warning',
        `The tutor pack is thin: ${thin.map((k) => `${pack[k].length} ${k}`).join(', ')}.`,
        'tutorPack'
      )
    );
  }
}

/** Every piece of text AGU would publish in the artefacts, with where it sits. */
function artefactText(artefacts: CourseArtefacts): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  const walk = (value: unknown, path: string) => {
    if (typeof value === 'string') out.push({ path, text: value });
    else if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${path}[${i}]`));
    else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k);
    }
  };
  const { rubrics, quizBank, finalExam, discussions, tutorPack } = artefacts;
  // Source materials are citations of other people's work, not AGU's own claims.
  const { sourceMaterials: _sources, ...tutorWritten } = tutorPack;
  walk({ rubrics, quizBank, finalExam, discussions, tutorPack: tutorWritten }, '');
  return out;
}

function checkClaims(artefacts: CourseArtefacts, out: Finding[]): void {
  for (const { path, text } of artefactText(artefacts)) {
    for (const match of findProhibitedClaims(text)) {
      out.push(
        finding(
          'ARTEFACT_CLAIM',
          match.severity,
          `${match.message} ("${match.sentence.slice(0, 120)}")`,
          path,
          match.source
        )
      );
    }
  }
}

export function validateArtefacts(artefacts: CourseArtefacts, draft: CourseDraft): Finding[] {
  const out: Finding[] = [];
  if (artefacts.outlineHash !== outlineHash(draft)) {
    out.push(
      finding(
        'ARTEFACTS_STALE',
        'blocking',
        'The outline changed after these artefacts were drafted; regenerate them so they match the course.',
        'artefacts'
      )
    );
  }
  checkRubrics(artefacts, draft, out);
  checkQuizzes(artefacts, draft, out);
  checkExam(artefacts, draft, out);
  checkDiscussions(artefacts, draft, out);
  checkTutorPack(artefacts, out);
  checkClaims(artefacts, out);
  return out;
}
