/**
 * Requests for the T07-T11 artefacts, and the parsing that decides what of each answer is kept.
 *
 * Drafted from the stored outline, in four kinds of request: the rubric, discussion prompts and
 * quiz plan together (because the quizzes and graded discussions share one 20% component and
 * have to be split in one decision); one request per week for its quiz and practice items; the
 * final exam, told which quiz and practice questions exist so it does not repeat them; and the
 * tutor pack, told the exam's questions so it cannot give them away.
 *
 * As with the outline, the model proposes and this module decides: outcome references are
 * checked against the outline, identifiers are assigned here, answers are matched to their
 * options, and anything that cannot be traced is dropped with a finding.
 *
 * Pure, no I/O, so it can be tested.
 */
import { CatalogueCourse } from '../catalogue/types';
import { Assessment, CourseDraft, CourseWeek, Finding } from '../draft/types';
import {
  DiscussionPrompt,
  ExamBlueprintRow,
  ExamItemType,
  ExamQuestion,
  FinalExam,
  MarkingRubric,
  PracticeItem,
  QuizItem,
  QuizItemType,
  QuizPlan,
  TutorPack,
} from '../draft/artefactTypes';
import { FacultyInputs } from './outlinePrompt';

export const ARTEFACT_PROMPT_VERSION = 'agu-artefacts-2';

/** Every exam paper is marked out of this, so the blueprint's percentages read directly. */
export const EXAM_TOTAL_MARKS = 100;
/** Ungraded practice items per week: enough to practise each of the week's outcomes. */
export const PRACTICE_ITEMS_PER_WEEK = 6;

const QUIZ_TYPES: QuizItemType[] = ['mcq', 'multiple_select', 'true_false', 'short_answer'];
const EXAM_TYPES: ExamItemType[] = [
  'mcq',
  'short_answer',
  'calculation',
  'case_analysis',
  'extended_response',
];

export const ARTEFACT_SYSTEM = `You write assessment and study materials for American Global University (AGU), a Utah-registered online institution, as a faculty-review draft that a named faculty member will accept, change or reject. Write for US and international graduate business students studying online. Never state institutional facts beyond those given; never claim accreditation, state approval, credit transfer, licensure, vendor certification, placement or earnings; never use UK frameworks or UK-only regulation. Return ONLY valid JSON.`;

const num = (v: unknown, fallback = 0) =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const list = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const pad = (n: number) => String(n).padStart(2, '0');

const componentOf = (draft: CourseDraft, component: Assessment['component']) =>
  draft.assessments.filter((a) => a.component === component);

/** The assessments a T07 rubric is written for. */
export const rubricAssessments = (draft: CourseDraft): Assessment[] =>
  draft.assessments.filter(
    (a) => a.component === 'applied_assignment' || a.component === 'capstone_component'
  );

function toolsClause(inputs: FacultyInputs): string {
  return `Students use only the tools this course names (${inputs.tools || 'none named'}). Do not ask them to write code or install software unless those tools require it.`;
}

/** The outline as the model needs it: outcomes, weeks, assessments and readings. */
export function outlineContext(
  course: CatalogueCourse,
  draft: CourseDraft,
  inputs: FacultyInputs
): string {
  const outcomes = draft.outcomes.map((o) => `${o.id} [${o.bloomLevel}]: ${o.statement}`);
  const weeks = draft.weeks.map((w) => {
    const monitored = w.monitoredStudy.map((m) => `${m.activity} (${m.hours} h)`).join('; ');
    return `Week ${w.number}: ${w.theme}. Outcomes: ${w.outcomeIds.join(', ') || 'none'}. Lecture "${w.liveLecture.title}": ${w.liveLecture.topics.join('; ')}. Monitored study: ${monitored || 'none'}.`;
  });
  const assessments = draft.assessments.map(
    (a) =>
      `${a.id} ${a.component} "${a.title}", ${a.weight}%, due week ${a.weekDue}, outcomes ${a.outcomeIds.join(', ')}${a.proctored ? ', proctored' : ''}. AI use: ${a.aiUse || 'not stated'}.${a.brief ? ` Brief: ${a.brief}` : ''}`
  );
  const readings = draft.readings.map(
    (r) => `Week ${r.week}${r.required ? '' : ' (optional)'}: ${r.citation}`
  );
  return `COURSE: ${course.code} ${course.title} (${course.roleLabel}; ${course.semesterCredits} US semester credit hours; four weeks, online)
Catalogue description: ${course.description || 'none'}
Faculty emphasis: ${inputs.emphasis || 'not given'}. Learners: ${inputs.learners || 'working professionals studying online'}. Tools: ${inputs.tools || 'not given'}.

COURSE LEARNING OUTCOMES
${outcomes.join('\n')}

WEEKS
${weeks.join('\n')}

ASSESSMENTS
${assessments.join('\n')}

READINGS
${readings.join('\n') || 'none'}`;
}

/** Rubric (T07), discussion prompts (T10) and the weekly quiz plan (T08 part 1), in one request. */
export function buildPlanPrompt(
  course: CatalogueCourse,
  draft: CourseDraft,
  inputs: FacultyInputs
): { system: string; user: string } {
  const weekly = componentOf(draft, 'weekly_quiz_discussion')[0];
  const rubricFor = rubricAssessments(draft);
  const weeks = draft.weeks.map((w) => w.number).join(', ');
  const user = `${outlineContext(course, draft, inputs)}

TASK 1 · T07 MARKING RUBRIC for ${rubricFor.map((a) => `${a.id} "${a.title}"`).join(' and ') || 'no assignment (return an empty list)'}.
Criteria cover every outcome the assignment assesses, one or more criteria per outcome. Weights are whole numbers that add up to exactly 100 for each rubric. Each criterion has three descriptors: "excellent" (A range), "good" (B range) and "belowStandard" (below B-, the course's minimum pass). A descriptor says what the submitted work shows, tied to the brief's deliverables; never generic wording such as "demonstrates excellent understanding".

TASK 2 · T10 DISCUSSION PROMPTS: one per week (weeks ${weeks}). Each prompt asks students to apply the week's ideas to a decision or situation. Give the outcomes it serves (from that week's outcomes), the student requirement (for example one post and two replies, with word counts and due days), the faculty moderation plan (when and how faculty respond), whether it is graded and on what criteria, its weight, and "contactHours": the hours of that week's faculty-moderated discussion in the monitored study listed above (0 if the week has none).

TASK 3 · T08 WEEKLY QUIZ PLAN: one graded quiz per week (weeks ${weeks}), each 6 to 12 items, with a time limit in minutes, the number of attempts and its weight.

WEIGHTS: ${weekly ? `the weekly quizzes and discussions component (${weekly.id}) is worth ${weekly.weight}%. The four quiz weights plus the weights of graded discussions add up to exactly ${weekly.weight}.` : 'this course has no weekly quiz and discussion component; set every weight to 0.'}

RETURN JSON:
{"rubrics":[{"assessmentId":"A1","rows":[{"outcomeId":"CLO1","criterion":"...","weight":20,"excellent":"...","good":"...","belowStandard":"..."}]}],
 "discussions":[{"week":1,"prompt":"...","outcomeIds":["CLO1"],"studentRequirement":"...","moderationPlan":"...","graded":true,"criteria":"...","weight":2,"contactHours":2.5}],
 "quizPlan":[{"week":1,"items":8,"timeLimitMinutes":20,"attempts":2,"weight":3}]}`;
  return { system: ARTEFACT_SYSTEM, user };
}

/** Graded quiz items and practice items (T08) for one week. */
export function buildQuizWeekPrompt(
  course: CatalogueCourse,
  draft: CourseDraft,
  inputs: FacultyInputs,
  week: CourseWeek,
  plan: QuizPlan
): { system: string; user: string } {
  const outcomes = draft.outcomes.filter((o) => week.outcomeIds.includes(o.id));
  const readings = draft.readings.filter((r) => r.week === week.number).map((r) => r.citation);
  const user = `${outlineContext(course, draft, inputs)}

TASK · T08 QUIZ AND PRACTICE ITEMS FOR WEEK ${week.number}: ${week.theme}
This week's outcomes: ${outcomes.map((o) => `${o.id} [${o.bloomLevel}] ${o.statement}`).join('; ')}
Lecture topics: ${week.liveLecture.topics.join('; ')}
Readings: ${readings.join('; ') || 'none this week'}

Write exactly ${plan.items} graded quiz items and ${PRACTICE_ITEMS_PER_WEEK} practice items.
Graded items:
- each tests one of this week's outcomes, and together they cover every one of them;
- mostly "mcq" with four options, with some "multiple_select", "true_false" and "short_answer";
- scenario-based where the outcome allows; a quiz checks understanding at or below the outcome's level, the exam is the test;
- "answers" holds the exact text of the correct option (all correct options for multiple_select); for short_answer, a model answer;
- options are plausible and parallel in grammar. Write each wrong option as specific and as long as the correct one: the correct option must not be the longest in most items (in the first CR08 draft it was the longest in 15 of 23, so length gave the answer away);
- never "all of the above" or "none of the above"; put the correct answer in each position about equally often;
- "rationale" says why the answer is right and why the likeliest wrong option is wrong, in one to three sentences.
Practice items are ungraded with unlimited attempts: different questions from the graded ones, each with an answer and the feedback the student sees.
${toolsClause(inputs)}

RETURN JSON:
{"items":[{"outcomeId":"CLO1","type":"mcq","question":"...","options":["...","...","...","..."],"answers":["..."],"rationale":"..."}],
 "practice":[{"outcomeId":"CLO1","question":"...","answer":"...","feedback":"..."}]}`;
  return { system: ARTEFACT_SYSTEM, user };
}

/** The proctored final exam paper (T09). The blueprint is computed from it, not requested. */
export function buildExamPrompt(
  course: CatalogueCourse,
  draft: CourseDraft,
  inputs: FacultyInputs,
  existingQuestions: string[]
): { system: string; user: string } {
  const exam = componentOf(draft, 'final_exam')[0];
  const assessed = draft.outcomes.filter((o) => exam?.outcomeIds.includes(o.id));
  const user = `${outlineContext(course, draft, inputs)}

TASK · T09 PROCTORED FINAL EXAM (${exam ? `${exam.id}, ${exam.weight}%, week ${exam.weekDue}` : 'final exam'})
It assesses: ${assessed.map((o) => `${o.id} [${o.bloomLevel}]`).join(', ')}.
Propose a duration between 60 and 180 minutes and write a paper worth exactly ${EXAM_TOTAL_MARKS} marks that:
- assesses every outcome listed, each with at least 10 marks, weighted toward the outcomes the course spends most time on;
- tests evaluate and create outcomes with case_analysis or extended_response questions, not multiple choice;
- gives every question a marking guide: the points a full-mark answer makes and how its marks are earned (for mcq, the correct option);
- is new: do not reuse or paraphrase any of the quiz and practice questions below, which students will already have seen.
Question types: mcq (four options), short_answer, calculation, case_analysis, extended_response. The exam is taken under proctoring (browser lockdown, webcam, ID match), closed to AI tools.
${toolsClause(inputs)}

QUIZ AND PRACTICE QUESTIONS ALREADY WRITTEN (do not reuse or paraphrase)
${existingQuestions.map((q) => `- ${q.slice(0, 160)}`).join('\n') || '- none'}

RETURN JSON:
{"durationMinutes":120,"questions":[{"outcomeId":"CLO1","type":"mcq","question":"...","options":["...","...","...","..."],"marks":2,"markingGuide":"..."}]}`;
  return { system: ARTEFACT_SYSTEM, user };
}

/** The AI tutor knowledge pack (T11), told the exam's questions so it cannot give them away. */
export function buildTutorPackPrompt(
  course: CatalogueCourse,
  draft: CourseDraft,
  inputs: FacultyInputs,
  examQuestions: string[]
): { system: string; user: string } {
  const assignment = rubricAssessments(draft)
    .map((a) => `${a.id} "${a.title}"`)
    .join(' and ');
  const user = `${outlineContext(course, draft, inputs)}

TASK · T11 AI TUTOR KNOWLEDGE PACK
This course's AI tutor explains concepts and guides practice. It must refuse to produce graded or summative work, and time with it counts as engagement, not contact. Write:
- "glossary": 12 to 20 key terms, each with a plain-language definition of one or two sentences and the week it is introduced;
- "faqs": 8 to 12 questions students are likely to ask, with model answers and the week;
- "workedExamples": 4 to 6 problems like the weekly practice (not like the assignment or the exam), each solved step by step, with the week;
- "misconceptions": 6 to 10 common misconceptions, each with its correction;
- "guardrails": 5 to 8 rules, each a "doNot" (a request the tutor declines or redirects) and an "instead" (what it does). Cover at least: writing or completing the applied assignment${assignment ? ` (${assignment})` : ''}; answering or hinting at final exam questions; answering graded quiz questions; writing discussion posts for a student.
Never include, answer or paraphrase any of the final exam questions below.
${toolsClause(inputs)}

FINAL EXAM QUESTIONS (never reproduce)
${examQuestions.map((q) => `- ${q.slice(0, 160)}`).join('\n') || '- none'}

RETURN JSON:
{"glossary":[{"term":"...","definition":"...","week":1}],"faqs":[{"question":"...","answer":"...","week":1}],"workedExamples":[{"problem":"...","solution":"...","week":1}],"misconceptions":[{"misconception":"...","correction":"..."}],"guardrails":[{"doNot":"...","instead":"..."}]}`;
  return { system: ARTEFACT_SYSTEM, user };
}

// ---------------------------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------------------------

interface Parsed<T> {
  value: T;
  findings: Finding[];
}

const knownOutcome = (draft: CourseDraft) => {
  const ids = new Set(draft.outcomes.map((o) => o.id));
  return (id: unknown): string | null => {
    const clean = text(id).toUpperCase().replace(/\s+/g, '');
    return ids.has(clean) ? clean : null;
  };
};

const weekNumbers = (draft: CourseDraft) => new Set(draft.weeks.map((w) => w.number));

export function rubricsFromAnswer(raw: any, draft: CourseDraft): Parsed<MarkingRubric[]> {
  const findings: Finding[] = [];
  const outcome = knownOutcome(draft);
  const allowed = new Set(rubricAssessments(draft).map((a) => a.id));
  const rubrics: MarkingRubric[] = [];
  for (const r of list(raw?.rubrics)) {
    const assessmentId = text(r?.assessmentId);
    if (!allowed.has(assessmentId) || rubrics.some((x) => x.assessmentId === assessmentId)) {
      continue;
    }
    const rows = list(r?.rows).flatMap((row, i) => {
      const outcomeId = outcome(row?.outcomeId);
      if (!outcomeId) {
        findings.push({
          code: 'RUBRIC_OUTCOME_UNKNOWN',
          severity: 'warning',
          message: `Rubric criterion ${i + 1} of ${assessmentId} named no outcome of this course and was dropped.`,
          path: `rubrics.${assessmentId}`,
        });
        return [];
      }
      return [
        {
          outcomeId,
          criterion: text(row?.criterion),
          weight: Math.round(num(row?.weight)),
          excellent: text(row?.excellent),
          good: text(row?.good),
          belowStandard: text(row?.belowStandard),
        },
      ];
    });
    rubrics.push({ assessmentId, rows });
  }
  return { value: rubrics, findings };
}

export function discussionsFromAnswer(raw: any, draft: CourseDraft): Parsed<DiscussionPrompt[]> {
  const outcome = knownOutcome(draft);
  const weeks = weekNumbers(draft);
  const byWeek = new Map<number, DiscussionPrompt>();
  for (const d of list(raw?.discussions)) {
    const week = num(d?.week, -1);
    if (!weeks.has(week) || byWeek.has(week)) continue;
    const graded = d?.graded === true;
    byWeek.set(week, {
      week,
      prompt: text(d?.prompt),
      outcomeIds: list(d?.outcomeIds)
        .map(outcome)
        .filter((id): id is string => !!id),
      studentRequirement: text(d?.studentRequirement),
      moderationPlan: text(d?.moderationPlan),
      graded,
      criteria: text(d?.criteria) || undefined,
      weight: graded ? Math.max(0, num(d?.weight)) : 0,
      contactHours: Math.max(0, num(d?.contactHours)),
    });
  }
  return { value: Array.from(byWeek.values()).sort((a, b) => a.week - b.week), findings: [] };
}

export function quizPlanFromAnswer(raw: any, draft: CourseDraft): QuizPlan[] {
  const weeks = weekNumbers(draft);
  const byWeek = new Map<number, QuizPlan>();
  for (const q of list(raw?.quizPlan)) {
    const week = num(q?.week, -1);
    if (!weeks.has(week) || byWeek.has(week)) continue;
    byWeek.set(week, {
      week,
      items: Math.round(clamp(num(q?.items, 8), 1, 30)),
      timeLimitMinutes: Math.round(clamp(num(q?.timeLimitMinutes, 20), 5, 120)),
      attempts: Math.round(clamp(num(q?.attempts, 2), 1, 10)),
      weight: Math.max(0, num(q?.weight)),
    });
  }
  return Array.from(byWeek.values()).sort((a, b) => a.week - b.week);
}

const LETTER = /^\(?([A-Ea-e])[).:]?$/;

/**
 * The option texts an answer refers to. Models answer with the option's text, a letter ("B",
 * "(b)") or a near copy of the text; all three are resolved to the option itself, so the stored
 * key is always one of the options shown to the student. Anything else is kept as written and
 * reported by the validator.
 */
export function resolveAnswers(options: string[], answers: string[]): string[] {
  return answers.map((answer) => {
    const a = answer.trim();
    const exact = options.find((o) => o === a);
    if (exact) return exact;
    const loose = options.find((o) => o.toLowerCase() === a.toLowerCase());
    if (loose) return loose;
    const letter = LETTER.exec(a);
    if (letter) {
      const index = letter[1].toUpperCase().charCodeAt(0) - 65;
      if (options[index]) return options[index];
    }
    const prefixed = /^\(?([A-Ea-e])[).:]\s+(.+)$/.exec(a);
    if (prefixed) {
      const match = options.find((o) => o.toLowerCase() === prefixed[2].trim().toLowerCase());
      if (match) return match;
    }
    return a;
  });
}

export function quizWeekFromAnswer(
  raw: any,
  week: CourseWeek,
  draft: CourseDraft
): Parsed<{ items: QuizItem[]; practice: PracticeItem[] }> {
  const findings: Finding[] = [];
  const outcome = knownOutcome(draft);
  const items: QuizItem[] = [];
  for (const it of list(raw?.items)) {
    const outcomeId = outcome(it?.outcomeId);
    const question = text(it?.question);
    if (!outcomeId || !question) {
      findings.push({
        code: 'QUIZ_ITEM_UNTRACEABLE',
        severity: 'warning',
        message: `A week ${week.number} quiz item had no question or named no outcome of this course, and was dropped.`,
        path: `quizBank.items.week${week.number}`,
      });
      continue;
    }
    const type = (QUIZ_TYPES.includes(it?.type) ? it.type : 'mcq') as QuizItemType;
    let options = list(it?.options).map(text).filter(Boolean);
    if (type === 'true_false' && options.length === 0) options = ['True', 'False'];
    if (type === 'short_answer') options = [];
    const answers = list(it?.answers).map(text).filter(Boolean);
    items.push({
      id: `W${week.number}-Q${pad(items.length + 1)}`,
      week: week.number,
      outcomeId,
      type,
      question,
      options,
      answers: type === 'short_answer' ? answers : resolveAnswers(options, answers),
      rationale: text(it?.rationale),
    });
  }
  const practice: PracticeItem[] = [];
  for (const it of list(raw?.practice)) {
    const outcomeId = outcome(it?.outcomeId);
    const question = text(it?.question);
    if (!outcomeId || !question) continue;
    practice.push({
      id: `W${week.number}-P${pad(practice.length + 1)}`,
      week: week.number,
      outcomeId,
      question,
      answer: text(it?.answer),
      feedback: text(it?.feedback),
    });
  }
  return { value: { items, practice }, findings };
}

export function examFromAnswer(raw: any, draft: CourseDraft): Parsed<FinalExam> {
  const findings: Finding[] = [];
  const outcome = knownOutcome(draft);
  const paper: ExamQuestion[] = [];
  for (const q of list(raw?.questions)) {
    const outcomeId = outcome(q?.outcomeId);
    const question = text(q?.question);
    if (!outcomeId || !question) {
      findings.push({
        code: 'EXAM_QUESTION_UNTRACEABLE',
        severity: 'warning',
        message: `An exam question had no text or named no outcome of this course, and was dropped.`,
        path: 'finalExam.paper',
      });
      continue;
    }
    const type = (EXAM_TYPES.includes(q?.type) ? q.type : 'short_answer') as ExamItemType;
    paper.push({
      number: paper.length + 1,
      outcomeId,
      type,
      question,
      options: type === 'mcq' ? list(q?.options).map(text).filter(Boolean) : [],
      marks: Math.max(0, num(q?.marks)),
      markingGuide: text(q?.markingGuide),
    });
  }
  return {
    value: {
      durationMinutes: Math.round(num(raw?.durationMinutes, 120)),
      totalMarks: EXAM_TOTAL_MARKS,
      paper,
    },
    findings,
  };
}

/** T09's blueprint, counted from the paper so it cannot claim a coverage the paper lacks. */
export function examBlueprint(exam: FinalExam): ExamBlueprintRow[] {
  const byOutcome = new Map<string, ExamBlueprintRow>();
  const total = exam.paper.reduce((n, q) => n + q.marks, 0);
  for (const q of exam.paper) {
    const row = byOutcome.get(q.outcomeId) || {
      outcomeId: q.outcomeId,
      itemTypes: [],
      items: 0,
      marks: 0,
      percent: 0,
    };
    row.items += 1;
    row.marks += q.marks;
    if (!row.itemTypes.includes(q.type)) row.itemTypes.push(q.type);
    byOutcome.set(q.outcomeId, row);
  }
  return Array.from(byOutcome.values())
    .map((r) => ({ ...r, percent: total > 0 ? Math.round((r.marks / total) * 1000) / 10 : 0 }))
    .sort((a, b) => a.outcomeId.localeCompare(b.outcomeId, undefined, { numeric: true }));
}

export function tutorPackFromAnswer(raw: any, draft: CourseDraft): TutorPack {
  const weeks = weekNumbers(draft);
  const week = (v: unknown) => {
    const n = num(v, 1);
    return weeks.has(n) ? n : 1;
  };
  return {
    glossary: list(raw?.glossary)
      .map((g) => ({ term: text(g?.term), definition: text(g?.definition), week: week(g?.week) }))
      .filter((g) => g.term && g.definition),
    faqs: list(raw?.faqs)
      .map((f) => ({ question: text(f?.question), answer: text(f?.answer), week: week(f?.week) }))
      .filter((f) => f.question && f.answer),
    workedExamples: list(raw?.workedExamples)
      .map((e) => ({ problem: text(e?.problem), solution: text(e?.solution), week: week(e?.week) }))
      .filter((e) => e.problem && e.solution),
    misconceptions: list(raw?.misconceptions)
      .map((m) => ({ misconception: text(m?.misconception), correction: text(m?.correction) }))
      .filter((m) => m.misconception && m.correction),
    guardrails: list(raw?.guardrails)
      .map((g) => ({ doNot: text(g?.doNot), instead: text(g?.instead) }))
      .filter((g) => g.doNot && g.instead),
    sourceMaterials: tutorSourceMaterials(draft),
  };
}

/**
 * What the tutor indexes: the course's verified readings and the package's own documents. Built
 * here rather than by the model, which would otherwise list files that do not exist.
 */
export function tutorSourceMaterials(draft: CourseDraft): TutorPack['sourceMaterials'] {
  return [
    { item: 'T02 Syllabus', week: null },
    ...draft.weeks.map((w) => ({
      item: `T03 Weekly plan and lecture run sheet: Week ${w.number}, ${w.liveLecture.title}`,
      week: w.number,
    })),
    ...draft.readings.map((r) => ({ item: r.citation, week: r.week })),
  ];
}
