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
  };
}
