/**
 * Step 13's exam checks, computed from the exam itself.
 *
 * The generator stored four flags and the Step 13 screen read four others. Only
 * `allPLOsCovered` was common to both, so the other three rows rendered as failures on every
 * exam. The stored flags were thin as well:
 * - "total marks correct" meant `totalMarks > 0`;
 * - "marking scheme complete" meant Section A had one entry;
 * - PLO coverage passed when Step 3 held no outcomes.
 *
 * Meanwhile, live exams contradicted themselves and still reported valid (found 2026-10-01):
 * - a breakdown listing one section of a two-section exam;
 * - "2 scenarios, 35 marks" over three scenarios worth 60;
 * - a marking scheme covering 15 of 18 questions.
 *
 * One set of checks now serves the generator, the screen and the export. Pure, so it can be
 * tested.
 */

interface Marked {
  marks?: number;
  linkedPLOs?: unknown[];
}
interface QuestionA extends Marked {
  questionId?: string;
  correctAnswer?: unknown;
}
interface QuestionB extends Marked {
  modelAnswer?: string;
}
interface ScenarioB {
  scenarioId?: string;
  totalMarks?: number;
  questions?: QuestionB[];
}
interface TaskC extends Marked {
  taskId?: string;
  modelAnswer?: string;
}

export interface ExamLike {
  overview?: {
    totalMarks?: number;
    sectionBreakdown?: { section?: string; marks?: number; questionCount?: number }[];
  };
  summary?: { totalQuestions?: number; totalScenarios?: number; totalTasks?: number };
  sectionA?: QuestionA[];
  sectionB?: ScenarioB[];
  sectionBIncluded?: boolean;
  sectionC?: TaskC[];
  markingScheme?: {
    sectionA?: { questionId?: string; modelAnswer?: string }[];
    sectionB?: { scenarioId?: string }[];
    sectionC?: { taskId?: string }[];
  };
}

export interface Step13Validation {
  /** The total, each section's stated marks and counts, and each scenario's total agree with the questions. */
  marksAddUp: boolean;
  /** Section A and C hold work, and Section B does whenever the exam includes it. */
  allSectionsPresent: boolean;
  /** null when Step 3 holds no outcomes. */
  allPLOsCovered: boolean | null;
  /** Every question, scenario and task has its own marking-scheme entry. */
  markingSchemeComplete: boolean;
  /** Every Section A question has an answer, and every B question and C task a model answer. */
  modelAnswersComplete: boolean;
  /**
   * The summary's question, scenario and task totals, and each section's count in the breakdown,
   * all equal what countExamItems finds in the exam. Null when the exam has no summary.
   */
  countsConsistent: boolean | null;
}

/** What an exam holds, counted once, in named units. */
export interface ExamCounts {
  /** Section A questions. */
  sectionAQuestions: number;
  /** Section B scenarios, and the questions nested inside them. */
  sectionBScenarios: number;
  sectionBQuestions: number;
  /** Section C tasks. */
  sectionCTasks: number;
  /** Every question that carries marks: Section A plus the questions inside Section B scenarios. */
  totalQuestions: number;
  totalScenarios: number;
  totalTasks: number;
}

/**
 * Count an exam's items.
 *
 * Logan Pacey's email of 17 November 2026 on the Diploma in Logistics pilot (workflow
 * 6af5a0a3b706bd9a5b7af54a) noticed an exam that said 27 questions on one screen and listed
 * sections adding to 23. Both were right in their own units: the summary added 16 questions,
 * 8 questions nested in scenarios and 3 tasks; the breakdown counted 16 questions, 4 scenarios
 * and 3 tasks. One function now counts, and every figure shown is taken from it with its unit.
 */
export function countExamItems(exam: ExamLike): ExamCounts {
  const a = exam.sectionA || [];
  const b = exam.sectionBIncluded === false ? [] : exam.sectionB || [];
  const c = exam.sectionC || [];
  const sectionBQuestions = b.reduce((n, s) => n + (s?.questions || []).length, 0);
  return {
    sectionAQuestions: a.length,
    sectionBScenarios: b.length,
    sectionBQuestions,
    sectionCTasks: c.length,
    totalQuestions: a.length + sectionBQuestions,
    totalScenarios: b.length,
    totalTasks: c.length,
  };
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A section's count with its unit, e.g. "4 scenarios (8 questions)". */
export function sectionCountLabel(letter: 'A' | 'B' | 'C', counts: ExamCounts): string {
  if (letter === 'A') return plural(counts.sectionAQuestions, 'question');
  if (letter === 'B') {
    return `${plural(counts.sectionBScenarios, 'scenario')} (${plural(counts.sectionBQuestions, 'question')})`;
  }
  return plural(counts.sectionCTasks, 'task');
}

/**
 * A copy of the exam whose summary counts and section-breakdown rows are taken from its own
 * items. Exams stored before countExamItems carry a summary that mixes units (27 where the
 * items are 24 questions, 4 scenarios and 3 tasks); read paths use this so they show the
 * counts without regenerating. The input is not changed.
 */
export function refreshExamCounts<T extends ExamLike>(exam: T): T {
  const counts = countExamItems(exam);
  const next: any = structuredClone(exam);
  next.summary = {
    ...(next.summary || {}),
    totalQuestions: counts.totalQuestions,
    totalScenarios: counts.totalScenarios,
    totalTasks: counts.totalTasks,
    countLabel: examCountLabel(counts),
    // The per-section figures the Step 13 screen shows; scenarios for B, as in the breakdown.
    sectionACount: counts.sectionAQuestions,
    sectionBCount: counts.sectionBScenarios,
    sectionCCount: counts.sectionCTasks,
  };
  for (const row of next.overview?.sectionBreakdown || []) {
    const letter = /^\s*section\s+([ABC])\b/i.exec(row?.section || '')?.[1]?.toUpperCase() as
      | 'A'
      | 'B'
      | 'C'
      | undefined;
    if (!letter) continue;
    row.unit = letter === 'A' ? 'questions' : letter === 'B' ? 'scenarios' : 'tasks';
    row.questionCount =
      letter === 'A'
        ? counts.sectionAQuestions
        : letter === 'B'
          ? counts.sectionBScenarios
          : counts.sectionCTasks;
    row.countLabel = sectionCountLabel(letter, counts);
  }
  return next;
}

/** The whole exam in one line, e.g. "24 questions, 4 scenarios, 3 tasks". */
export function examCountLabel(counts: ExamCounts): string {
  return [
    plural(counts.totalQuestions, 'question'),
    plural(counts.totalScenarios, 'scenario'),
    plural(counts.totalTasks, 'task'),
  ].join(', ');
}

const marksOf = (list: Marked[]) => list.reduce((n, item) => n + (Number(item?.marks) || 0), 0);
const filled = (text: unknown) => typeof text === 'string' && text.trim().length > 0;
const strings = (list: unknown[] | undefined) =>
  (list || []).filter((v): v is string => typeof v === 'string');

export interface OutcomeLike {
  id?: string;
  code?: string;
}

export function step13Validation(exam: ExamLike, outcomes: OutcomeLike[]): Step13Validation {
  const a = exam.sectionA || [];
  const b = exam.sectionBIncluded === false ? [] : exam.sectionB || [];
  const c = exam.sectionC || [];
  const bQuestions = b.flatMap((s) => s?.questions || []);
  const counts = countExamItems(exam);
  const summary = exam.summary;
  const countsConsistent = summary
    ? summary.totalQuestions === counts.totalQuestions &&
      summary.totalScenarios === counts.totalScenarios &&
      summary.totalTasks === counts.totalTasks &&
      (exam.overview?.sectionBreakdown || []).every((entry) => {
        const letter = /^\s*section\s+([ABC])\b/i.exec(entry?.section || '')?.[1]?.toUpperCase();
        const expected =
          letter === 'A'
            ? counts.sectionAQuestions
            : letter === 'B'
              ? counts.sectionBScenarios
              : letter === 'C'
                ? counts.sectionCTasks
                : null;
        return expected !== null && Number(entry?.questionCount) === expected;
      })
    : null;

  const sections = [
    { letter: 'A', marks: marksOf(a), count: a.length },
    { letter: 'B', marks: marksOf(bQuestions), count: b.length },
    { letter: 'C', marks: marksOf(c), count: c.length },
  ].filter((s) => s.count > 0);
  const total = sections.reduce((n, s) => n + s.marks, 0);
  const breakdown = exam.overview?.sectionBreakdown || [];
  const statedFor = (letter: string) =>
    breakdown.filter((entry) =>
      new RegExp(`^\\s*section\\s+${letter}\\b`, 'i').test(entry?.section || '')
    );
  const breakdownAgrees =
    breakdown.length === sections.length &&
    sections.every((s) => {
      const stated = statedFor(s.letter);
      return (
        stated.length === 1 &&
        Number(stated[0].marks) === s.marks &&
        Number(stated[0].questionCount) === s.count
      );
    });

  const covered = new Set([
    ...a.flatMap((q) => strings(q?.linkedPLOs)),
    ...bQuestions.flatMap((q) => strings(q?.linkedPLOs)),
    ...c.flatMap((t) => strings(t?.linkedPLOs)),
  ]);
  // The generator shows the model each PLO's id; older exams cite codes. Either counts.
  const plos = (outcomes || []).filter((o) => o?.id || o?.code);

  const scheme = exam.markingScheme || {};
  const schemeA = new Map((scheme.sectionA || []).map((e) => [e?.questionId, e] as const));
  const schemeB = new Set((scheme.sectionB || []).map((e) => e?.scenarioId));
  const schemeC = new Set((scheme.sectionC || []).map((e) => e?.taskId));

  return {
    marksAddUp:
      total > 0 &&
      Number(exam.overview?.totalMarks) === total &&
      b.every((s) => Number(s?.totalMarks) === marksOf(s?.questions || [])) &&
      breakdownAgrees,
    allSectionsPresent:
      a.length > 0 && c.length > 0 && (exam.sectionBIncluded === false || b.length > 0),
    allPLOsCovered: plos.length
      ? plos.every((o) => covered.has(o.id || '') || covered.has(o.code || ''))
      : null,
    markingSchemeComplete:
      a.length > 0 &&
      a.every((q) => filled(schemeA.get(q?.questionId)?.modelAnswer)) &&
      b.every((s) => schemeB.has(s?.scenarioId)) &&
      c.every((t) => schemeC.has(t?.taskId)),
    modelAnswersComplete:
      a.length > 0 &&
      a.every(
        (q) =>
          q?.correctAnswer !== undefined &&
          q?.correctAnswer !== null &&
          String(q.correctAnswer).trim() !== ''
      ) &&
      bQuestions.every((q) => filled(q?.modelAnswer)) &&
      c.every((t) => filled(t?.modelAnswer)),
    countsConsistent,
  };
}
