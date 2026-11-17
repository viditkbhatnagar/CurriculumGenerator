/**
 * What a module summative's content must look like, given its format.
 *
 * Logan Pacey's email of 17 November 2026 on the Diploma in Logistics pilot (workflow
 * 6af5a0a3b706bd9a5b7af54a) found module summatives graded by "MCQ knowledge checks". Choosing a
 * written or practical format for them is not enough on its own: the summative prompt still
 * said "multiple choice first" (rule 18 told the model every task must be a multiple-choice
 * item, and rule 19 how to write the options), so a "Mini-case exercises" summative came back
 * as a case stem followed by a dozen MCQs. A written or practical summative is a brief the
 * learner works on, with tasks, mark allocations and marking guidance. The format names are
 * the formative vocabulary reused, so the brief's wording follows what the summative IS
 * (a case analysis report, a simulation, a technical build) and not the formative label.
 *
 * Formatives are untouched: they stay multiple-choice first. Pure, so it can be tested.
 */
import { isAutoMarked } from './assessmentKind';

/** The question types a written or practical summative's tasks may use. */
export const WRITTEN_TASK_TYPES = ['short_answer', 'practical', 'file_upload'] as const;

/** Whether a summative of this format is a written or practical piece of work. */
export function isWrittenSummative(format: unknown): boolean {
  return !isAutoMarked(format);
}

interface BriefSpec {
  /** What the learner hands in, in the words the brief should use. */
  deliverable: string;
  /** What the tasks ask the learner to do. */
  taskWording: string;
}

const BRIEF_BY_FORMAT: Record<string, BriefSpec> = {
  'Mini-case exercises': {
    deliverable: 'a written case analysis report',
    taskWording:
      'analyse the case supplied in full and answer each task in a structured written report, justifying every conclusion with evidence from the case',
  },
  'Practice simulations': {
    deliverable: 'a completed simulation exercise with a decision log and written justification',
    taskWording:
      'work through the simulated situation, make and record decisions at each stage, and justify them in writing or in a practical submission',
  },
  'Short written reflections': {
    deliverable: 'a written analytical report',
    taskWording:
      'produce a critical written report that evaluates the evidence supplied and reaches a justified position; this is an assessed report, not a personal reflection diary',
  },
  'Scenario-based micro-tasks': {
    deliverable: 'a set of completed scenario-based practical tasks',
    taskWording:
      'carry out each scenario task as a practitioner would and submit the work product with a short written rationale',
  },
  'Coding / technical tasks': {
    deliverable: 'a working technical build with documentation',
    taskWording:
      'build the technical artefact to the stated specification and submit it with documentation of the choices made',
  },
  'Worksheets / problem sets': {
    deliverable: 'a worked problem set with full working shown',
    taskWording:
      'solve each problem, showing every step of the working and stating the result and its meaning',
  },
  'Discussion prompts': {
    deliverable: 'a written position paper',
    taskWording:
      'write a reasoned position paper that takes and defends a stance on each prompt, using the evidence supplied',
  },
};

const DEFAULT_SPEC: BriefSpec = {
  deliverable: 'a written or practical piece of work',
  taskWording:
    'complete each task as a written or practical submission, justifying the approach taken',
};

export function briefSpecFor(format: unknown): BriefSpec {
  return BRIEF_BY_FORMAT[String(format ?? '')] || DEFAULT_SPEC;
}

/** What each task must ask of the learner, by Bloom level, for a written or practical summative. */
export const WRITTEN_TASK_SHAPES_BY_BLOOM: Record<string, string> = {
  remember: 'a short written answer stating or listing the facts asked for',
  understand:
    "a short written explanation, interpretation or comparison in the learner's own words",
  apply:
    'a practical task: a case or figures are given and the learner carries out the method and submits the worked result',
  analyse:
    'a written analysis of a case, dataset or process: the learner diagnoses causes and supports the diagnosis from the evidence supplied',
  evaluate:
    'a written evaluation against stated criteria: the learner judges options or a course of action and justifies the verdict',
  create:
    'a production task: the learner produces the artefact (plan, design, dashboard, report) and submits it',
};

/** How many tasks a written summative carries: fewer, larger pieces of work. */
export function writtenSummativePlan(outcomeCount: number): {
  min: number;
  max: number;
  guidance: string;
} {
  const floor = Math.max(1, outcomeCount);
  return {
    min: Math.max(2, floor),
    max: Math.max(4, floor),
    guidance:
      'written or practical tasks (short_answer, practical or file_upload), each carrying its own mark allocation and marking guidance; no multiple-choice items',
  };
}

/** The prompt block that replaces "multiple choice first" for a written or practical summative. */
export function writtenSummativeDirective(format: string, artefactNames: string[]): string {
  const spec = briefSpecFor(format);
  return `**QUESTION TYPE — WRITTEN OR PRACTICAL TASKS (THIS IS A GRADED SUMMATIVE)**
The format "${format}" is a graded piece of work, not a quiz. The learner hands in ${spec.deliverable}. Each task asks them to ${spec.taskWording}.
Every task has questionType "short_answer", "practical" or "file_upload". Do NOT write multiple-choice items and do NOT include "options". Each task carries "points" (its mark allocation) and its "correctAnswer" holds the indicative content and marking points a marker looks for, specific enough to award partial credit.
${
  artefactNames.length
    ? `The work must produce: ${artefactNames.join(', ')}.`
    : 'Name the thing handed in, in studentBrief.deliverables.'
}`;
}

interface QuestionLike {
  questionType?: string;
}

/** The share of an assessment's questions that are multiple choice; null when it has none. */
export function mcqShare(assessment: { questions?: QuestionLike[] } | undefined): number | null {
  const questions = Array.isArray(assessment?.questions) ? assessment!.questions! : [];
  if (!questions.length) return null;
  const mcq = questions.filter((q) => {
    const type = String(q?.questionType ?? '').toLowerCase();
    return type === 'mcq' || type.includes('multiple');
  }).length;
  return mcq / questions.length;
}

/** A written or practical summative whose questions are mostly multiple choice does not fit. */
export const MAX_MCQ_SHARE_IN_WRITTEN_SUMMATIVE = 0.5;

/**
 * The problem with a graded summative's content, or null when it fits its format. Only a
 * written or practical summative can fail: a quiz summative is meant to be multiple choice.
 */
export function summativeContentProblem(assessment: {
  assessmentType?: string;
  purpose?: string;
  questions?: QuestionLike[];
}): string | null {
  // Formatives are multiple choice by design, whatever their format is called. Without this,
  // the end-to-end run of 17 November 2026 regenerated every non-quiz formative as written
  // work and Step 7 fell to 15% auto-gradable.
  if (assessment?.purpose !== 'module_summative') return null;
  if (!isWrittenSummative(assessment?.assessmentType)) return null;
  const share = mcqShare(assessment);
  if (share === null || share <= MAX_MCQ_SHARE_IN_WRITTEN_SUMMATIVE) return null;
  return `This is a written or practical summative ("${assessment.assessmentType}") but ${Math.round(share * 100)}% of its questions are multiple choice. Rewrite it as written or practical tasks (short_answer, practical or file_upload) with mark allocations.`;
}
