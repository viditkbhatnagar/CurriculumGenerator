/**
 * Whether a course syllabus answers the student's four questions, computed from the syllabus
 * itself.
 *
 * Dr Sherin Thomas (18 November 2026, Bachelor in Business Administration syllabus) found
 * blank columns and an assessment list whose weights did not reach 100. The generator had
 * checked neither. These checks are run in code when Step 14 is generated and stored with it:
 * every section present and non-empty, no empty table cell, the module's weights summing to
 * 100, the outcomes being the module's own and the institution's rules being stated. Failures
 * go to the export's Unresolved Issues list.
 *
 * Pure, so it can be tested.
 */
import type { CourseSyllabus, SyllabusTable } from './courseSyllabus';

export interface CourseCheck {
  key: string;
  label: string;
  ok: boolean;
  detail?: string;
}

export interface CourseCompleteness {
  moduleId: string;
  moduleCode: string;
  moduleTitle: string;
  ok: boolean;
  checks: CourseCheck[];
}

const WEIGHT_TOLERANCE = 0.05;

/** "r2c3 of the schedule" for each empty cell in a table. */
export function emptyCells(name: string, table: SyllabusTable | null): string[] {
  if (!table) return [];
  const out: string[] = [];
  if (table.headers.some((h) => !h.trim())) out.push(`${name} has an unnamed column`);
  table.rows.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (!cell.trim()) out.push(`${name}, row ${r + 1}, column "${table.headers[c] || c + 1}"`);
    })
  );
  return out;
}

/** The module's own outcomes, from Step 4, in order. */
function moduleOutcomes(mod: any): string[] {
  return (mod?.mlos || mod?.learningOutcomes || [])
    .map((o: any) => String(o?.statement || o?.outcome || '').trim())
    .filter(Boolean);
}

export function checkCourseSyllabus(course: CourseSyllabus, mod: any): CourseCompleteness {
  const blanks = [
    ...emptyCells('the schedule', course.scheduleTable),
    ...emptyCells('the work table', course.workTable),
    ...emptyCells('the assessment table', course.componentsTable),
    ...emptyCells('the marking criteria', course.criteriaTable),
    ...course.facts.filter(([, v]) => !v.trim()).map(([k]) => `the fact "${k}"`),
  ];
  const own = moduleOutcomes(mod);
  const sameOutcomes =
    own.length > 0 &&
    own.length === course.outcomes.length &&
    own.every((o, i) => o === course.outcomes[i]);
  const missingRules = course.rules.filter((r) => r.required && !r.text).map((r) => r.label);
  const weightsOk = Math.abs(course.weightTotal - 100) < WEIGHT_TOLERANCE;

  const checks: CourseCheck[] = [
    {
      key: 'learn',
      label: 'What you will learn: description and outcomes are present',
      ok: course.outcomes.length > 0 && course.description.length > 0 && course.facts.length > 1,
      detail: !course.outcomes.length
        ? 'The module has no learning outcomes'
        : !course.description.length
          ? 'The module has no description'
          : undefined,
    },
    {
      key: 'prepare',
      label: 'How to prepare: a week-by-week schedule is present',
      ok: course.weeks.length > 0,
      detail: course.weeks.length ? undefined : 'The module has no lessons (Step 10) and no topics',
    },
    {
      key: 'complete',
      label: 'What work you must complete: at least one piece of work is listed',
      ok: course.workTable.rows.length > 0,
      detail: course.workTable.rows.length
        ? undefined
        : 'No assessment (Step 7) or assignment (Step 12) for this module',
    },
    {
      key: 'assessed',
      label: 'How you will be assessed: graded components are listed',
      ok: course.components.length > 0,
      detail: course.components.length
        ? undefined
        : 'No graded assessment for this module in Step 7',
    },
    {
      key: 'noEmptyCells',
      label: 'No empty table cells',
      ok: blanks.length === 0,
      detail: blanks.length ? blanks.slice(0, 3).join('; ') : undefined,
    },
    {
      key: 'weightsSum100',
      label: 'Assessment weights add up to 100%',
      ok: weightsOk,
      detail: weightsOk ? undefined : `They add up to ${course.weightTotal}%`,
    },
    {
      key: 'outcomesAreMLOs',
      label: "The outcomes are the module's own learning outcomes",
      ok: sameOutcomes,
      detail: sameOutcomes
        ? undefined
        : 'The outcomes shown differ from the Step 4 module outcomes',
    },
    {
      key: 'packsCurrent',
      label: 'The graded work matches the current Step 7 assessment',
      ok: !course.packMismatch,
      detail: course.packMismatch || undefined,
    },
    {
      key: 'institutionRules',
      label: "The institution's pass, grading, late-work, resit and attendance rules are stated",
      ok: missingRules.length === 0,
      detail: missingRules.length
        ? `Not entered: ${missingRules.join(', ').toLowerCase()}`
        : undefined,
    },
  ];
  return {
    moduleId: course.moduleId,
    moduleCode: course.moduleCode,
    moduleTitle: course.moduleTitle,
    ok: checks.every((c) => c.ok),
    checks,
  };
}

/** Completeness for every module, matched to its Step 4 entry by id. */
export function checkAllCourses(courses: CourseSyllabus[], modules: any[]): CourseCompleteness[] {
  return courses.map((c, i) =>
    checkCourseSyllabus(c, modules.find((m) => m?.id === c.moduleId) || modules[i])
  );
}

/**
 * Failures worded for the Unresolved Issues list. The rules the institution has not entered
 * are the same for every module, so they are reported once.
 */
export function courseIssues(results: CourseCompleteness[]): string[] {
  const issues: string[] = [];
  for (const r of results) {
    for (const c of r.checks) {
      if (c.ok || c.key === 'institutionRules') continue;
      issues.push(
        `${r.moduleCode} ${r.moduleTitle}: ${c.label.toLowerCase()} is not met${c.detail ? ` (${c.detail})` : ''}`
      );
    }
  }
  const rulesFailed = results.find((r) =>
    r.checks.some((c) => c.key === 'institutionRules' && !c.ok)
  );
  if (rulesFailed) {
    const detail = rulesFailed.checks.find((c) => c.key === 'institutionRules')?.detail || '';
    issues.push(
      `Course syllabi tell students to check the programme handbook for these institution rules, because none were entered. ${detail}`.trim()
    );
  }
  return issues;
}
