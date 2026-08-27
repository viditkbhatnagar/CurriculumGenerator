/**
 * Step 7 as the authoritative assessment design.
 *
 * The programme's reviewer ruled on the duplication between steps: "Step 7 becomes the
 * authoritative assessment design, Step 12 should convert the approved Step 7 summative into
 * the learner-facing Assignment Pack, and Step 13 should generate an exam only where Step 7
 * specifies an exam."
 *
 * Both decisions are pure functions of stored data. They live here rather than in
 * `workflowService` so they can be tested: that module cannot be imported by a test at all,
 * because its pre-existing type errors fail the suite before a single assertion runs.
 */

/** The Step 7 module summative that Step 12's pack is the learner-facing form of. */
export function approvedSummativeFor(workflow: any, module: any): any | undefined {
  const records: any[] = ((workflow?.step7 as any)?.formativeAssessments || []).filter(
    (a: any) => a?.moduleId === module?.id
  );
  if (records.length === 0) return undefined;

  const marked = records.find((a: any) => a?.purpose === 'module_summative');
  if (marked) return marked;

  // A module generated before `purpose` existed holds two graded records and neither is
  // marked as the summative.
  const legacy = records.filter((a: any) => a?.purpose === undefined && a?.graded !== false);
  if (legacy.length === 0) return undefined;
  if (legacy.length === 1) return legacy[0];

  // Prefer the one that evidences the module's whole outcome set, since that is what a
  // summative is for.
  const moduleMloIds = (module?.mlos || []).map((m: any) => String(m?.id)).filter(Boolean);
  if (moduleMloIds.length > 0) {
    const coversAll = legacy.filter((a: any) => {
      const aligned = (a.alignedMLOs || []).map(String);
      return moduleMloIds.every((id: string) => aligned.includes(id));
    });
    if (coversAll.length === 1) return coversAll[0];
  }

  // Then the one carrying the most marks. Where even that ties — two records of equal marks
  // each covering half the outcomes, which is what several modules on the live programme
  // hold — nothing is returned and Step 12 generates as it did before. Anointing an
  // arbitrary half of a module's assessment would be worse than not converting at all.
  const byMarks = [...legacy].sort((a, b) => (b.maxMarks || 0) - (a.maxMarks || 0));
  if ((byMarks[0]?.maxMarks || 0) > (byMarks[1]?.maxMarks || 0)) return byMarks[0];
  return undefined;
}

/**
 * Whether Step 7's assessment design calls for a programme-level exam at all.
 *
 * Each module is graded by its own summative, so an exam is an addition rather than a
 * default — generating one unconditionally gave every programme a second course-wide
 * summative that nothing reconciled with the one Step 7 already held.
 */
export function step7SpecifiesExam(workflow: any): boolean {
  const prefs: any = (workflow?.step7 as any)?.userPreferences || {};

  // The format is a stored enum, so it is compared as one rather than substring-matched.
  // Only `mcq_exam` names an exam by itself. `mixed_format` says the summative has several
  // components without saying what they are, and it is the default every existing programme
  // carries — treating it as an exam made the gate incapable of ever refusing, which is a
  // decoration rather than a check. It falls through to the components below, where this
  // programme's "Practical Exam" and "Cross-Module Objective Test" answer the question
  // properly and a portfolio-and-prototype programme's components do not.
  const format = String(prefs.summativeFormat ?? '');
  if (format === 'mcq_exam') return true;

  // Whole words only: without boundaries "example", "latest" and "greatest" all counted as
  // an exam, so the author's own prose could open the gate by accident.
  const mentionsExam = (v: unknown) =>
    /\b(exams?|examinations?|tests?|mcqs?)\b/i.test(String(v ?? ''));
  if (mentionsExam(prefs.userDefinedSummativeDescription)) return true;

  const components: any[] = ((workflow?.step7 as any)?.summativeAssessments || []).flatMap(
    (sa: any) => sa?.components || []
  );
  return components.some((c) => mentionsExam(c?.componentType) || mentionsExam(c?.name));
}
