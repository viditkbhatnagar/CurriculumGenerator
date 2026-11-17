/**
 * What kind of assessment a format name describes: one a machine marks, or one a person marks.
 *
 * Logan Pacey's email of 17 November 2026 on the Diploma in Logistics pilot (workflow
 * 6af5a0a3b706bd9a5b7af54a) found that the Step 12 assignment packs for modules 1 to 3 were
 * all "MCQ knowledge checks", in all three delivery modes, each weighted 100 and each carrying
 * a Fail/Pass/Merit/Distinction rubric. A multiple-choice quiz has no rubric to mark against
 * and nothing to differ between an in-person and a self-study delivery, so the pack was
 * contradicting its own type. The rule that decides whether a type is auto-marked lives here
 * so Step 7 (which chooses the type), Step 12 (which builds the marking material) and the
 * checks that compare them all read the same answer.
 *
 * Pure: no models, no logger, so it can be tested.
 */

/** Format names that are marked by key rather than by a marker's judgement. */
const AUTO_MARKED_PATTERN = /\b(mcqs?|multiple[- ]choice|quizzes|quiz|knowledge checks?)\b/i;

/** Whether an assessment of this type is marked against an answer key, not a rubric. */
export function isAutoMarked(assessmentType: unknown): boolean {
  return AUTO_MARKED_PATTERN.test(String(assessmentType ?? ''));
}
