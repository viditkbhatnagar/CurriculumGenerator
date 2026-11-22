/**
 * One course syllabus per module, written to the student and built from the stored steps.
 *
 * Dr Sherin Thomas, 18 November 2026, on the Bachelor in Business Administration syllabus
 * (workflow 6a619d817a037be307a8fa7c): "Ideally the syllabus should be understandable to a
 * student without requiring additional explanation from the faculty. It should clearly answer:
 * What will I learn, how should I prepare, what work must I complete, and how will my
 * performance be assessed?" and "It's blank at some columns."
 *
 * The downloaded document was one syllabus for the whole programme, headed "Course Title:
 * Bachelor in Business Administration" with 180 credits, the eight programme outcomes and a
 * schedule of 24 weeks listing two or three modules each. Its Date, Readings and Due columns
 * were empty throughout; its assessment list held only a "Summative Exam" at 40%; and its grade
 * scale and late-work penalties were text the institution had never stated.
 *
 * The unit is now the module. Each course syllabus answers the four questions in order:
 * what you will learn, how to prepare, what work you must complete, how you will be assessed.
 * A table column with nothing to show is left out, never printed empty. Weights come from
 * Step 7 and are checked to sum to 100 here, in code. Pass requirements, grading scale, late
 * work, resits and attendance come only from what the institution entered; where it has
 * entered nothing the syllabus says so to the student and the gap goes to Unresolved Issues.
 *
 * Pure, so it can be tested. Callers pass a workflow whose Step 10 lessons and Step 12 packs
 * are already loaded (step10Store.withLessons, step12Store.withPacks).
 */
import { topicTitle } from '../utils/topicShape';
import { isUngraded, applyAssessmentWeightings } from '../utils/assessmentWeighting';
import { levelsFor } from './moduleLevels';
import type { AssessmentRules } from './assessmentRules';
import { packMismatch, syllabusBandLabels } from './syllabusAssessmentRules';

export interface SyllabusTable {
  headers: string[];
  rows: string[][];
}

export interface WeekPlan {
  week: number;
  date?: string;
  covers: string[];
  readings: string[];
  preparation: string[];
  due: string[];
}

export interface AssessmentComponent {
  title: string;
  type: string;
  weight: number;
  marks?: number;
}

export interface StudentRule {
  key: string;
  label: string;
  text: string | null;
  /** Counted as missing when the institution has entered nothing. */
  required: boolean;
}

export interface CourseSyllabus {
  moduleId: string;
  moduleCode: string;
  moduleTitle: string;
  facts: Array<[string, string]>;
  description: string;
  outcomes: string[];
  buildsOn: string[];
  weeks: WeekPlan[];
  scheduleTable: SyllabusTable;
  materials: string[];
  workTable: SyllabusTable;
  /** Plain-language notes under the work table, e.g. the programme's final exam. */
  workNotes: string[];
  components: AssessmentComponent[];
  weightTotal: number;
  componentsTable: SyllabusTable;
  criteriaTable: SyllabusTable | null;
  criteriaNote: string;
  /**
   * Why the Step 12 pack does not match Step 7's module summative (Logan Pacey, 21 Nov 2026),
   * or null. While set, the syllabus follows Step 7 and shows no pack criteria.
   */
  packMismatch: string | null;
  rules: StudentRule[];
}

export interface SyllabusInputsLike {
  startDate?: string;
  sessionsPerWeek?: number;
  policies?: Record<string, string | undefined>;
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const MAX_SUMMARY = 260;
const MAX_CELL = 420;

/** First sentences of a passage, cut at a sentence end where possible. */
export function summarise(passage: unknown, max = MAX_SUMMARY): string {
  const s = text(passage).replace(/\s+/g, ' ');
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
  return end > 0 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, '')}…`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `iso` plus `days`, as "12 Jan 2027"; undefined when `iso` is not a date. */
export function datePlus(iso: string | undefined, days: number): string | undefined {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return undefined;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export const REQUIRED_RULES: Array<{ key: string; label: string }> = [
  { key: 'passRequirements', label: 'The pass mark' },
  { key: 'gradingScale', label: 'The grading scale' },
  { key: 'lateWork', label: 'The rules on late work' },
  { key: 'resits', label: 'The rules on resits' },
  { key: 'attendance', label: 'The attendance requirement' },
];

const OPTIONAL_RULES: Array<{ key: string; label: string }> = [
  { key: 'authenticity', label: 'Academic integrity and the use of AI tools' },
  { key: 'accessibility', label: 'Support and reasonable adjustments' },
  { key: 'technologyUse', label: 'Technology use' },
  { key: 'communicationNorms', label: 'Contacting your tutor' },
];

/** Rules as the institution entered them: assessment rules first, then the Step 14 form. */
export function studentRules(
  rules: AssessmentRules | null | undefined,
  inputs: SyllabusInputsLike | undefined
): StudentRule[] {
  const stated = (key: string): string | null => {
    const fromRules = text((rules as Record<string, unknown> | null | undefined)?.[key]);
    return fromRules || text(inputs?.policies?.[key]) || null;
  };
  const out: StudentRule[] = REQUIRED_RULES.map((r) => ({
    ...r,
    text: stated(r.key),
    required: true,
  }));
  for (const r of OPTIONAL_RULES) {
    const t = stated(r.key);
    if (t) out.push({ ...r, text: t, required: false });
  }
  return out;
}

/** The labels of required rules the institution has not entered. */
export function missingStudentRules(
  rules: AssessmentRules | null | undefined,
  inputs: SyllabusInputsLike | undefined
): string[] {
  return studentRules(rules, inputs)
    .filter((r) => r.required && !r.text)
    .map((r) => r.label);
}

const weekOf = (suggested: unknown): number | null => {
  const m = /week\s*(\d+)/i.exec(text(suggested));
  return m ? Number(m[1]) : null;
};

function readingLine(r: any, source: any): string {
  const cite = text(r?.citation) || text(source?.citation) || text(r?.title);
  const where = [
    text(source?.specificChapters) && `chapters: ${text(source.specificChapters)}`,
    text(source?.pageRange) && `pages: ${text(source.pageRange)}`,
  ].filter(Boolean);
  const line = where.length ? `${cite} (${where.join('; ')})` : cite;
  return line.length > MAX_CELL ? `${line.slice(0, MAX_CELL)}…` : line;
}

function weekPlans(
  mod: any,
  lessons: any[],
  readings6: any[],
  inputs: SyllabusInputsLike | undefined
): WeekPlan[] {
  const perWeek = Math.max(1, Math.floor(inputs?.sessionsPerWeek || 2));
  const groups: Array<{ covers: string[]; lessons: any[] }> = [];
  if (lessons.length) {
    for (let i = 0; i < lessons.length; i += perWeek) {
      const slice = lessons.slice(i, i + perWeek);
      groups.push({
        covers: slice.map((l) => text(l.lessonTitle)).filter(Boolean),
        lessons: slice,
      });
    }
  } else {
    for (const t of mod.topics || []) {
      const title = topicTitle(t);
      if (title) groups.push({ covers: [title], lessons: [] });
    }
  }

  const bySource = new Map<string, any>();
  for (const r of readings6) if (r.sourceId) bySource.set(r.sourceId, r);
  const seen = new Set<string>();
  const readingKey = (r: any) => text(r?.sourceId) || text(r?.citation);

  return groups.map((g, i) => {
    const week = i + 1;
    const readings: string[] = [];
    const add = (r: any, label: string) => {
      const key = readingKey(r);
      if (!key || seen.has(key)) return;
      seen.add(key);
      readings.push(`${label}: ${readingLine(r, bySource.get(r.sourceId))}`);
    };
    for (const l of g.lessons) {
      for (const r of l.independentStudy?.coreReadings || []) add(r, 'Core');
      for (const r of l.independentStudy?.supplementaryReadings || []) add(r, 'Further');
    }
    for (const r of readings6) {
      if (weekOf(r.suggestedWeek) === week) add(r, r.category === 'core' ? 'Core' : 'Further');
    }

    const preparation: string[] = [];
    const minutes = g.lessons.reduce(
      (s, l) => s + (Number(l.independentStudy?.estimatedEffort) || 0),
      0
    );
    if (minutes > 0) preparation.push(`About ${minutes} minutes of independent study.`);
    for (const l of g.lessons) {
      const task = summarise(l.independentActivity?.independentTask, 220);
      if (task) preparation.push(task);
    }
    return {
      week,
      date: datePlus(inputs?.startDate, (week - 1) * 7),
      covers: g.covers,
      readings,
      preparation,
      due: [],
    };
  });
}

function materialsOf(lessons: any[]): string[] {
  const out = new Set<string>();
  for (const l of lessons) {
    const items = Array.isArray(l.materials) ? l.materials : [];
    for (const m of items) {
      const name = typeof m === 'string' ? m : text(m?.name) || text(m?.title) || text(m?.item);
      if (name.trim()) out.add(name.trim());
    }
  }
  return [...out].slice(0, 12);
}

function packOf(workflow: any, mod: any): any | null {
  const packs: any[] = workflow.step12?.moduleAssignmentPacks || [];
  return (
    packs.find((p) => p?.moduleId === mod.id && p.variants && Object.keys(p.variants).length) ||
    packs.find((p) => p?.moduleCode && p.moduleCode === (mod.code || mod.moduleCode)) ||
    null
  );
}

const VARIANT_LABEL: Record<string, string> = {
  in_person: 'In person',
  self_study: 'Self-study',
  hybrid: 'Hybrid',
};

const dueLabel = (week: number, startDate: string | undefined): string => {
  const by = datePlus(startDate, (week - 1) * 7 + 6);
  return by ? `Week ${week} (by ${by})` : `Week ${week}`;
};

/** Which graded Step 7 assessments belong to the module, with weights that sum to 100. */
export function moduleComponents(assessments: any[]): {
  components: AssessmentComponent[];
  total: number;
} {
  const graded = assessments.filter((a) => !isUngraded(a));
  const clones = graded.map((a) => ({ ...a }));
  const stored = graded.every((a) => typeof a.weighting === 'number');
  if (!stored) applyAssessmentWeightings(clones, []);
  const components = clones.map((a) => ({
    title: text(a.title),
    type: text(a.assessmentType),
    weight: Number(a.weighting) || 0,
    marks: typeof a.maxMarks === 'number' ? a.maxMarks : undefined,
  }));
  const total = Math.round(components.reduce((s, c) => s + c.weight, 0) * 10) / 10;
  return { components, total };
}

function criteriaOf(
  pack: any,
  statedScale: string | null
): { table: SyllabusTable | null; note: string } {
  const variant: any = pack && Object.values(pack.variants || {})[0];
  const rubric: any[] = Array.isArray(variant?.rubric) ? variant.rubric : [];
  if (!rubric.length) {
    const auto = variant?.markingMode === 'auto_marked';
    return {
      table: null,
      note: auto
        ? 'This work is marked automatically against an answer key, so there are no marking bands.'
        : 'The marking criteria for this work have not been written yet.',
    };
  }
  // The four stored slots are lowest to highest; their names come from the institution's
  // grading scale or are descriptive, never an assumed Fail/Pass/Merit/Distinction.
  const slots = ['fail', 'pass', 'merit', 'distinction'];
  const names = syllabusBandLabels(statedScale, variant.bandLabels);
  const used = slots
    .map((k, i) => ({ k, name: names[i] }))
    .filter(({ k }) => rubric.some((c) => text(c[k])));
  return {
    table: {
      headers: ['Criterion', ...used.map((u) => u.name)],
      rows: rubric.map((c) => [
        text(c.criterionName) || 'Criterion',
        ...used.map((u) => text(c[u.k]) || 'Not described'),
      ]),
    },
    note: '',
  };
}

/** Add a column only when some row has content; fill the other rows with `none`. */
function optionalColumn(
  headers: string[],
  rows: string[][],
  header: string,
  values: string[],
  none: string
): void {
  if (!values.some((v) => v.trim())) return;
  headers.push(header);
  rows.forEach((r, i) => r.push(values[i].trim() || none));
}

export function buildCourseSyllabus(
  workflow: any,
  mod: any,
  inputs?: SyllabusInputsLike
): CourseSyllabus {
  const modules: any[] = workflow.step4?.modules || [];
  const index = modules.findIndex((m) => m === mod || m?.id === mod?.id);
  const code = text(mod.code) || text(mod.moduleCode) || `M${mod.sequence || index + 1}`;
  const title = text(mod.title) || code;

  const level = index >= 0 ? levelsFor(workflow)[index] : undefined;
  const total = Number(mod.totalHours) || 0;
  const contact = Number(mod.contactHours) || 0;
  const self = Number(mod.selfStudyHours ?? mod.independentHours) || Math.max(0, total - contact);
  const facts: Array<[string, string]> = [];
  const fact = (label: string, value: string) => value && facts.push([label, value]);
  fact('Module', `${code}: ${title}`);
  fact('Credits', mod.credits ? String(mod.credits) : '');
  fact('Study time', total ? `${total} hours in all` : '');
  fact('Taught hours', contact ? `${contact} hours with your tutor` : '');
  fact('Independent study', self ? `${self} hours on your own` : '');
  fact('Level', level?.levelLabel || '');

  const prereq = (mod.prerequisites || [])
    .map((id: string) => modules.find((m) => m.id === id || m.code === id))
    .filter(Boolean)
    .map((m: any) => `${text(m.code) || text(m.moduleCode)}: ${text(m.title)}`);

  const plan = (workflow.step10?.moduleLessonPlans || []).find(
    (p: any) => p?.moduleId === mod.id && (p.lessons || []).length
  );
  const lessons: any[] = [...(plan?.lessons || [])].sort(
    (a, b) => (a.lessonNumber || 0) - (b.lessonNumber || 0)
  );
  const readings6 = (workflow.step6?.readings || []).filter((r: any) => r.moduleId === mod.id);
  const weeks = weekPlans(mod, lessons, readings6, inputs);

  // ----- what you must complete -----
  const module7 = (workflow.step7?.formativeAssessments || []).filter(
    (a: any) => a.moduleId === mod.id
  );
  const practice = module7.filter((a: any) => isUngraded(a));
  const graded = module7.filter((a: any) => !isUngraded(a));
  const pack = packOf(workflow, mod);
  const allVariants: Array<[string, any]> = Object.entries(pack?.variants || {});
  // Step 7's module summative is the approved assessment; the Step 12 pack is built from it.
  // When the pack no longer matches, follow Step 7 (Logan Pacey, 21 Nov 2026: an old MCQ pack
  // was listed as "Mini-case exercises") and let the check report that the packs are old.
  const summative7 = graded.find((a: any) => a.purpose === 'module_summative') || graded[0];
  const mismatch =
    pack && summative7 && allVariants[0]
      ? packMismatch({
          step7: summative7,
          variant: allVariants[0][1],
          packAt:
            pack.generatedAt || pack.updatedAt || pack.createdAt || workflow.step12?.generatedAt,
          step7At: summative7.generatedAt || workflow.step7?.generatedAt,
        })
      : null;
  const usePack = Boolean(pack) && !mismatch;
  const variants = usePack ? allVariants : [];
  const rules = studentRules(workflow.assessmentRules, inputs);
  const statedScale = rules.find((r) => r.key === 'gradingScale')?.text || null;
  const lastWeek = weeks.length;
  const dueWeekOf = (i: number, n: number) =>
    Math.min(lastWeek, Math.max(1, Math.round(((i + 1) * lastWeek) / (n + 1))));

  const workRows: string[][] = [];
  const addDue = (week: number, what: string) => {
    if (weeks[week - 1]) weeks[week - 1].due.push(what);
  };
  practice.forEach((a: any, i: number) => {
    const week = lastWeek ? dueWeekOf(i, practice.length) : 0;
    workRows.push([
      text(a.title) || 'Practice activity',
      summarise(a.description) || 'See your tutor for the task.',
      'Practice, not graded',
      week ? dueLabel(week, inputs?.startDate) : 'Week to be set by your tutor',
    ]);
    if (week) addDue(week, `${text(a.title)} (practice)`);
  });
  if (pack || graded.length) {
    const variant: any = variants[0]?.[1];
    const g0 = summative7;
    const name = text(variant?.overview?.title) || text(g0?.title) || 'Module assignment';
    const intro = summarise(
      variant?.brief?.studentFacingIntro || g0?.studentBrief || g0?.description
    );
    const how = variants
      .filter(([, v]) => text(v?.overview?.submissionFormat))
      .map(
        ([k, v]) => `${VARIANT_LABEL[k] || k}: ${summarise(v?.overview?.submissionFormat, 160)}`
      );
    workRows.push([
      name,
      [intro || 'See your tutor for the brief.', ...how].join('\n'),
      'Graded',
      lastWeek ? dueLabel(lastWeek, inputs?.startDate) : 'Week to be set by your tutor',
    ]);
    if (lastWeek) addDue(lastWeek, `${name} (graded)`);
  }
  const workNotes: string[] = [];
  const exam = workflow.step13?.overview;
  if (exam) {
    const length = text(exam.totalDuration);
    workNotes.push(
      `Your programme also ends with a final exam, "${text(exam.examTitle) || 'Final Summative Exam'}"${
        length ? `, which lasts ${length}` : ''
      }. It covers the whole programme, not just this module, and is set after the last module.`
    );
  }
  const workTable: SyllabusTable = {
    headers: ['Work', 'What you do', 'Practice or graded', 'Due'],
    rows: workRows,
  };

  // ----- schedule table, with a column only where there is something to show -----
  const headers = ['Week'];
  const rows = weeks.map((w) => [`Week ${w.week}`]);
  optionalColumn(
    headers,
    rows,
    'Starts',
    weeks.map((w) => w.date || ''),
    ''
  );
  headers.push('What we cover');
  rows.forEach((r, i) => r.push(weeks[i].covers.join('\n') || 'Topic to be confirmed'));
  optionalColumn(
    headers,
    rows,
    'Prepare before the week',
    weeks.map((w) => w.preparation.join('\n')),
    'Nothing set'
  );
  optionalColumn(
    headers,
    rows,
    'Readings',
    weeks.map((w) => w.readings.join('\n')),
    'No set reading'
  );
  optionalColumn(
    headers,
    rows,
    'Due',
    weeks.map((w) => w.due.join('\n')),
    'Nothing due'
  );

  const { components, total: weightTotal } = moduleComponents(module7);
  // One graded piece of work is the one the student is told about under "work to complete":
  // the Step 12 brief and the Step 7 record carry different titles for it, and two names
  // would read as two assessments.
  if (components.length === 1 && workRows.length && usePack) {
    components[0].title = workRows[workRows.length - 1][0];
  }
  const { table: criteriaTable, note: criteriaNote } = mismatch
    ? {
        table: null,
        note: 'The marking criteria for this work are being updated to match the current assessment. Your tutor will confirm them.',
      }
    : criteriaOf(pack, statedScale);
  const hasMarks = components.some((c) => c.marks);
  const componentsTable: SyllabusTable = {
    headers: ['Assessed work', 'Type', 'Weight', ...(hasMarks ? ['Marks'] : [])],
    rows: components.map((c) => [
      c.title || 'Assessed work',
      c.type || 'Assignment',
      `${c.weight}%`,
      ...(hasMarks ? [c.marks ? `${c.marks}` : 'Not set'] : []),
    ]),
  };

  return {
    moduleId: text(mod.id),
    moduleCode: code,
    moduleTitle: title,
    facts,
    description: text(mod.description),
    outcomes: (mod.mlos || mod.learningOutcomes || [])
      .map((o: any) => text(o?.statement || o?.outcome))
      .filter(Boolean),
    buildsOn: prereq,
    weeks,
    scheduleTable: { headers, rows },
    materials: materialsOf(lessons),
    workTable,
    workNotes,
    components,
    weightTotal,
    componentsTable,
    criteriaTable,
    criteriaNote,
    packMismatch: mismatch,
    rules,
  };
}

/** Every module's course syllabus, in programme order. */
export function buildCourseSyllabi(workflow: any, inputs?: SyllabusInputsLike): CourseSyllabus[] {
  return (workflow.step4?.modules || []).map((m: any) => buildCourseSyllabus(workflow, m, inputs));
}
