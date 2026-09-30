/**
 * Which part of the drafted artefacts a finding is about, so a repair round re-asks only for
 * that part: the plan request (rubric, discussions, quiz plan), one week's quiz and practice
 * items, the exam, or the tutor pack. A finding no request can fix (a stale outline, an
 * outcome no item covers) returns null and is left to faculty.
 *
 * Pure, no I/O, so it can be tested.
 */
import { Finding } from '../draft/types';
import { CourseArtefacts } from '../draft/artefactTypes';

export function partOf(finding: Finding, artefacts?: CourseArtefacts): string | null {
  const path = finding.path || '';
  const week = /week(\d+)|\bW(\d+)-[QP]/.exec(path);
  if (/^(RUBRIC_|DISCUSSION_|WEEKLY_WEIGHTS|QUIZ_PLAN_WEEKS)/.test(finding.code)) return 'plan';
  if (/^(QUIZ_ITEM_COUNT|QUIZ_ITEM_INVALID|PRACTICE_WEEK_EMPTY)$/.test(finding.code) && week) {
    return `week${week[1] || week[2]}`;
  }
  if (finding.code.startsWith('EXAM_')) return 'exam';
  if (finding.code === 'TUTOR_GUARDRAILS') return 'tutor';
  if (finding.code === 'ARTEFACT_CLAIM') {
    if (/^(rubrics|discussions)/.test(path)) return 'plan';
    if (path.startsWith('quizBank')) {
      // A claim in a quiz or practice item is repaired with that item's week.
      const at = /quizBank\.(items|practice)\[(\d+)\]/.exec(path);
      const list = at ? artefacts?.quizBank[at[1] as 'items' | 'practice'] : undefined;
      const item = at && list ? list[Number(at[2])] : undefined;
      return item ? `week${item.week}` : 'plan';
    }
    if (path.startsWith('finalExam')) return 'exam';
    if (path.startsWith('tutorPack')) return 'tutor';
  }
  return null;
}
