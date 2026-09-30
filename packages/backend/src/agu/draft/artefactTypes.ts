/**
 * The assessment and tutor artefacts drafted from an accepted-shape course outline: AGU's
 * faculty templates T07 (marking rubric), T08 (quiz and practice bank), T09 (final exam
 * blueprint and paper), T10 (discussion prompts) and T11 (AI tutor knowledge pack).
 *
 * Shapes follow the templates' own columns, so the export is a rendering, not a translation.
 * Identifiers (quiz item, practice item and exam question ids) are assigned in code, and the
 * exam blueprint is computed from the paper rather than written by the model, so the two
 * cannot disagree.
 */
import { Finding } from './types';

/** T07. One row per criterion; weights add up to 100. */
export interface RubricRow {
  outcomeId: string;
  criterion: string;
  weight: number;
  /** A range. */
  excellent: string;
  /** B range. */
  good: string;
  /** Below B-, the course's minimum pass. */
  belowStandard: string;
}

export interface MarkingRubric {
  /** The applied assignment (T06) this rubric marks. */
  assessmentId: string;
  rows: RubricRow[];
}

/** T08 part 1: one graded quiz per week. `weight` is its share of the weekly 20% component. */
export interface QuizPlan {
  week: number;
  items: number;
  timeLimitMinutes: number;
  attempts: number;
  weight: number;
}

export type QuizItemType = 'mcq' | 'multiple_select' | 'true_false' | 'short_answer';

export interface QuizItem {
  id: string;
  week: number;
  outcomeId: string;
  type: QuizItemType;
  question: string;
  /** Empty for short-answer items. */
  options: string[];
  /** The correct option text(s); for a short answer, the model answer. */
  answers: string[];
  rationale: string;
}

/** T08 part 2: unlimited attempts, ungraded. */
export interface PracticeItem {
  id: string;
  week: number;
  outcomeId: string;
  question: string;
  answer: string;
  feedback: string;
}

export interface QuizBank {
  plan: QuizPlan[];
  items: QuizItem[];
  practice: PracticeItem[];
}

export type ExamItemType =
  | 'mcq'
  | 'short_answer'
  | 'calculation'
  | 'case_analysis'
  | 'extended_response';

export interface ExamQuestion {
  number: number;
  outcomeId: string;
  type: ExamItemType;
  question: string;
  options: string[];
  marks: number;
  /** Model answer or marking guide, with how the marks are earned. */
  markingGuide: string;
}

/** T09 blueprint row, computed from the paper. */
export interface ExamBlueprintRow {
  outcomeId: string;
  itemTypes: ExamItemType[];
  items: number;
  marks: number;
  percent: number;
}

export interface FinalExam {
  durationMinutes: number;
  totalMarks: number;
  paper: ExamQuestion[];
}

/** T10, one per week. */
export interface DiscussionPrompt {
  week: number;
  prompt: string;
  outcomeIds: string[];
  studentRequirement: string;
  moderationPlan: string;
  graded: boolean;
  criteria?: string;
  /** Share of the weekly 20% component; 0 when ungraded. */
  weight: number;
  /** Hours this discussion counts toward contact, from the week's monitored study. */
  contactHours: number;
}

/** T11. Indexed for this course's tutor only; the tutor explains and never does graded work. */
export interface TutorPack {
  glossary: { term: string; definition: string; week: number }[];
  faqs: { question: string; answer: string; week: number }[];
  workedExamples: { problem: string; solution: string; week: number }[];
  misconceptions: { misconception: string; correction: string }[];
  guardrails: { doNot: string; instead: string }[];
  /** Built in code from the readings and the package's own documents. */
  sourceMaterials: { item: string; week: number | null }[];
}

export interface CourseArtefacts {
  rubrics: MarkingRubric[];
  quizBank: QuizBank;
  finalExam: FinalExam | null;
  discussions: DiscussionPrompt[];
  tutorPack: TutorPack;
  /** Hash of the outline the artefacts were drafted from: a changed outline makes them stale. */
  outlineHash: string;
  promptVersion: string;
  generatedAt: string;
}

export type ArtefactStatus =
  | 'not_started'
  | 'generating'
  | 'failed'
  | 'needs_faculty'
  | 'ready_for_review'
  | 'faculty_accepted';

export interface ArtefactResult {
  artefacts: CourseArtefacts;
  findings: Finding[];
}
