/**
 * Checks a course draft against the catalogue, AGU's course shape and the rule pack.
 *
 * The v3 workflow's validation reported success from constants and from counts: "case studies
 * integrated" above a count of zero, hours "matching" around an undefined field. Every check
 * here reads the stored draft and reports what it found, and a check that has nothing to look
 * at fails rather than passes. Findings are either blocking (the draft cannot be offered as
 * faculty-review ready) or warnings (faculty should look).
 *
 * Pure, no I/O, so each rule can be tested.
 */
import { CatalogueCourse, CatalogueEdition } from '../catalogue/types';
import { findProhibitedClaims } from '../rules/usUtahRules';
import { CourseDraft, Finding } from '../draft/types';

const HOURS_TOLERANCE = 0.5;

/** Verbs that describe observable behaviour, by Bloom level (lower case, first word). */
const MEASURABLE_VERBS = new Set([
  'define',
  'describe',
  'explain',
  'identify',
  'summarise',
  'summarize',
  'classify',
  'compare',
  'interpret',
  'illustrate',
  'apply',
  'calculate',
  'demonstrate',
  'use',
  'implement',
  'solve',
  'construct',
  'model',
  'analyse',
  'analyze',
  'examine',
  'differentiate',
  'investigate',
  'diagnose',
  'evaluate',
  'assess',
  'critique',
  'justify',
  'recommend',
  'appraise',
  'prioritise',
  'prioritize',
  'design',
  'develop',
  'formulate',
  'create',
  'propose',
  'build',
  'produce',
  'communicate',
  'present',
  'visualise',
  'visualize',
  'select',
  'estimate',
  'forecast',
  'measure',
]);
const VAGUE_VERBS = new Set([
  'understand',
  'know',
  'appreciate',
  'learn',
  'be aware',
  'familiarise',
]);

const near = (a: number, b: number) => Math.abs(a - b) <= HOURS_TOLERANCE;
const sum = (xs: number[]) => xs.reduce((n, x) => n + (Number.isFinite(x) ? x : 0), 0);

function checkLocked(draft: CourseDraft, course: CatalogueCourse | undefined): Finding[] {
  if (!course) {
    return [
      {
        code: 'CATALOGUE_UNKNOWN',
        severity: 'blocking',
        message: `${draft.courseCode} is not a course in the catalogue.`,
      },
    ];
  }
  const out: Finding[] = [];
  const l = draft.locked;
  if (l.title !== course.title)
    out.push({
      code: 'LOCKED_TITLE',
      severity: 'blocking',
      message: `Title "${l.title}" differs from the catalogue title "${course.title}".`,
      source: course.source,
    });
  if (l.semesterCredits !== course.semesterCredits)
    out.push({
      code: 'LOCKED_CREDITS',
      severity: 'blocking',
      message: `Credits ${l.semesterCredits} differ from the catalogue's ${course.semesterCredits}.`,
      source: course.source,
    });
  if (
    l.hours.total !== course.hours.total ||
    l.hours.contact !== course.hours.contact ||
    l.hours.independent !== course.hours.independent
  ) {
    out.push({
      code: 'LOCKED_HOURS',
      severity: 'blocking',
      message: 'Planned hours differ from the catalogue (135 total: 45 contact, 90 independent).',
      source: course.source,
    });
  }
  if (course.description && l.description !== course.description)
    out.push({
      code: 'LOCKED_DESCRIPTION',
      severity: 'blocking',
      message:
        'The catalogue description has been changed; propose changes separately rather than editing the locked text.',
      source: course.source,
    });
  return out;
}

function checkOutcomes(draft: CourseDraft, catalogue: CatalogueEdition): Finding[] {
  const out: Finding[] = [];
  const { min, max } = catalogue.courseShape.outcomeCount.value;
  const n = draft.outcomes.length;
  if (n < min || n > max) {
    out.push({
      code: 'OUTCOME_COUNT',
      severity: 'blocking',
      message: `${n} course learning outcomes; AGU asks for ${min}-${max}.`,
      source: catalogue.courseShape.outcomeCount.source,
    });
  }
  const seen = new Set<string>();
  draft.outcomes.forEach((o, i) => {
    const path = `outcomes[${i}]`;
    const statement = (o.statement || '').trim();
    const verb =
      statement
        .split(/\s+/)[0]
        ?.toLowerCase()
        .replace(/[^a-z]/g, '') || '';
    if (!statement)
      out.push({
        code: 'OUTCOME_EMPTY',
        severity: 'blocking',
        message: `${o.id} has no statement.`,
        path,
      });
    else if (VAGUE_VERBS.has(verb))
      out.push({
        code: 'OUTCOME_NOT_MEASURABLE',
        severity: 'blocking',
        message: `${o.id} starts with "${verb}", which cannot be observed or assessed.`,
        path,
      });
    else if (!MEASURABLE_VERBS.has(verb))
      out.push({
        code: 'OUTCOME_VERB',
        severity: 'warning',
        message: `${o.id} starts with "${verb}"; check that it names an observable behaviour.`,
        path,
      });
    // More than one assessable action joined together is an overloaded outcome.
    const actions = statement
      .toLowerCase()
      .split(/[\s,;]+/)
      .filter((w) => MEASURABLE_VERBS.has(w));
    if (actions.length > 2)
      out.push({
        code: 'OUTCOME_OVERLOADED',
        severity: 'warning',
        message: `${o.id} combines ${actions.length} actions (${actions.join(', ')}); split it so each can be assessed.`,
        path,
      });
    const key = statement.toLowerCase();
    if (key && seen.has(key))
      out.push({
        code: 'OUTCOME_DUPLICATE',
        severity: 'blocking',
        message: `${o.id} repeats another outcome.`,
        path,
      });
    seen.add(key);
  });
  return out;
}

function checkWeeksAndHours(draft: CourseDraft, catalogue: CatalogueEdition): Finding[] {
  const shape = catalogue.courseShape;
  const out: Finding[] = [];
  const weeks = draft.weeks;
  if (weeks.length !== shape.weeks.value) {
    out.push({
      code: 'WEEK_COUNT',
      severity: 'blocking',
      message: `${weeks.length} weeks; AGU courses run ${shape.weeks.value}.`,
      source: shape.weeks.source,
    });
  }
  const themes = new Set<string>();
  weeks.forEach((w, i) => {
    const path = `weeks[${i}]`;
    if (!w.theme?.trim())
      out.push({
        code: 'WEEK_THEME',
        severity: 'blocking',
        message: `Week ${w.number} has no theme.`,
        path,
      });
    else if (themes.has(w.theme.trim().toLowerCase()))
      out.push({
        code: 'WEEK_DUPLICATE',
        severity: 'blocking',
        message: `Week ${w.number} repeats another week's theme.`,
        path,
      });
    themes.add((w.theme || '').trim().toLowerCase());
    const lecture = w.liveLecture;
    if (!lecture?.title?.trim() || !(lecture.topics || []).some((t) => t?.trim())) {
      out.push({
        code: 'LECTURE_UNNAMED',
        severity: 'blocking',
        message: `Week ${w.number}'s live lecture has no title or no named topic.`,
        path: `${path}.liveLecture`,
      });
    }
    if (!near(lecture?.hours ?? 0, shape.liveLectureHours.value)) {
      out.push({
        code: 'LECTURE_HOURS',
        severity: 'blocking',
        message: `Week ${w.number}'s live lecture is ${lecture?.hours ?? 0}h; AGU lectures are ${shape.liveLectureHours.value}h.`,
        path: `${path}.liveLecture`,
        source: shape.liveLectureHours.source,
      });
    }
    const runSheet = [...(lecture?.runSheet || [])].sort((a, b) => a.startMinute - b.startMinute);
    const covered =
      runSheet.length > 0 &&
      runSheet[0].startMinute === 0 &&
      runSheet.every((s, k) => k === 0 || s.startMinute === runSheet[k - 1].endMinute) &&
      runSheet[runSheet.length - 1].endMinute === (lecture?.hours ?? 0) * 60;
    if (!covered)
      out.push({
        code: 'RUN_SHEET_GAPS',
        severity: 'warning',
        message: `Week ${w.number}'s run sheet does not cover the lecture from start to finish without gaps.`,
        path: `${path}.liveLecture.runSheet`,
        source: 'AGU template T03',
      });
    (w.monitoredStudy || []).forEach((m, k) => {
      if (!m.facultyRole?.trim() || !m.evidenceLogged?.trim()) {
        out.push({
          code: 'CONTACT_UNEVIDENCED',
          severity: 'blocking',
          message: `Week ${w.number} monitored activity "${m.activity}" does not say what faculty do or what the platform logs, so it cannot count as contact.`,
          path: `${path}.monitoredStudy[${k}]`,
          source: shape.contactHourDefinition.source,
        });
      }
    });
  });

  const live = sum(weeks.map((w) => w.liveLecture?.hours ?? 0));
  const monitored = sum(weeks.flatMap((w) => (w.monitoredStudy || []).map((m) => m.hours)));
  const independent = sum(weeks.flatMap((w) => (w.independentStudy || []).map((m) => m.hours)));
  if (!near(live + monitored, shape.contactHours.value)) {
    out.push({
      code: 'CONTACT_HOURS',
      severity: 'blocking',
      message: `Contact hours add up to ${live + monitored} (${live} live + ${monitored} monitored); the course needs ${shape.contactHours.value}.`,
      source: shape.contactHours.source,
    });
  }
  if (!near(independent, shape.independentHours.value)) {
    out.push({
      code: 'INDEPENDENT_HOURS',
      severity: 'blocking',
      message: `Independent study adds up to ${independent}h; the course needs ${shape.independentHours.value}.`,
      source: shape.independentHours.source,
    });
  }
  return out;
}

function checkAlignment(
  draft: CourseDraft,
  course: CatalogueCourse | undefined,
  catalogue: CatalogueEdition
): Finding[] {
  const out: Finding[] = [];
  const outcomeIds = new Set(draft.outcomes.map((o) => o.id));
  const taught = new Set(draft.weeks.flatMap((w) => w.outcomeIds || []));
  const assessed = new Set(draft.assessments.flatMap((a) => a.outcomeIds || []));
  for (const o of draft.outcomes) {
    if (!taught.has(o.id))
      out.push({
        code: 'OUTCOME_NOT_TAUGHT',
        severity: 'blocking',
        message: `${o.id} is not taught in any week.`,
      });
    if (!assessed.has(o.id))
      out.push({
        code: 'OUTCOME_NOT_ASSESSED',
        severity: 'blocking',
        message: `${o.id} is not assessed by any assessment.`,
      });
  }
  for (const id of [...taught, ...assessed]) {
    if (!outcomeIds.has(id))
      out.push({
        code: 'OUTCOME_UNKNOWN_REF',
        severity: 'blocking',
        message: `A week or assessment refers to ${id}, which is not one of the course outcomes.`,
      });
  }

  if (draft.assessments.length === 0) {
    out.push({
      code: 'ASSESSMENT_NONE',
      severity: 'blocking',
      message: 'The draft has no assessments.',
    });
    return out;
  }
  const total = sum(draft.assessments.map((a) => a.weight));
  if (total !== 100)
    out.push({
      code: 'ASSESSMENT_WEIGHTS',
      severity: 'blocking',
      message: `Assessment weights add up to ${total}%, not 100%.`,
    });

  if (course?.role !== 'capstone') {
    const scheme = catalogue.courseShape.assessment.value;
    const byComponent: Record<string, number> = {};
    for (const a of draft.assessments)
      byComponent[a.component] = (byComponent[a.component] || 0) + a.weight;
    const expected: Record<string, number> = {
      applied_assignment: scheme[0].weight,
      weekly_quiz_discussion: scheme[1].weight,
      final_exam: scheme[2].weight,
    };
    for (const [component, weight] of Object.entries(expected)) {
      if ((byComponent[component] || 0) !== weight) {
        out.push({
          code: 'ASSESSMENT_SCHEME',
          severity: 'blocking',
          message: `${component.replace(/_/g, ' ')} carries ${byComponent[component] || 0}%; AGU's scheme is 40/20/40.`,
          source: catalogue.courseShape.assessment.source,
        });
      }
    }
    const finals = draft.assessments.filter((a) => a.component === 'final_exam');
    if (finals.some((f) => !f.proctored))
      out.push({
        code: 'FINAL_NOT_PROCTORED',
        severity: 'blocking',
        message: 'The final exam must be proctored.',
        source: 'Catalog v1.4 §9.8',
      });
  }
  draft.assessments.forEach((a, i) => {
    if (!(a.outcomeIds || []).length)
      out.push({
        code: 'ASSESSMENT_UNALIGNED',
        severity: 'blocking',
        message: `"${a.title}" assesses no outcome.`,
        path: `assessments[${i}]`,
      });
    if (!a.aiUse?.trim())
      out.push({
        code: 'ASSESSMENT_AI_RULES',
        severity: 'blocking',
        message: `"${a.title}" does not state what AI use is permitted; the integrity policy defines misuse against those rules.`,
        path: `assessments[${i}]`,
        source: 'Catalog v1.4 academic integrity',
      });
  });
  return out;
}

function checkResources(draft: CourseDraft): Finding[] {
  const out: Finding[] = [];
  const required = draft.readings.filter((r) => r.required);
  if (required.length === 0)
    out.push({
      code: 'READINGS_NONE',
      severity: 'blocking',
      message: 'The draft has no required readings.',
    });
  draft.readings.forEach((r, i) => {
    if (r.required && (r.access === 'unknown' || r.access === 'paywalled')) {
      out.push({
        code: 'READING_ACCESS',
        severity: 'blocking',
        message: `Required reading "${r.citation}" is ${r.access === 'paywalled' ? 'behind a paywall' : 'of unknown access'}; AGU has no library, so every required item must be open, original or cleared.`,
        path: `readings[${i}]`,
        source: 'AGU template T05',
      });
    }
  });
  const weeksWithReading = new Set(required.map((r) => r.week));
  for (const w of draft.weeks) {
    if (!weeksWithReading.has(w.number))
      out.push({
        code: 'WEEK_NO_READING',
        severity: 'warning',
        message: `Week ${w.number} has no required reading.`,
      });
  }
  draft.cases.forEach((c, i) => {
    if (c.source !== 'original' && c.source !== 'hypothetical' && !c.rights?.trim()) {
      out.push({
        code: 'CASE_RIGHTS',
        severity: 'blocking',
        message: `Case "${c.title}" has no rights status.`,
        path: `cases[${i}]`,
        source: 'AGU template T05',
      });
    }
  });
  return out;
}

function checkClaims(draft: CourseDraft): Finding[] {
  return draft.narrative.flatMap((n) =>
    findProhibitedClaims(n.text).map((m) => ({
      code: `CLAIM_${m.ruleId.toUpperCase()}`,
      severity: m.severity,
      message: `${m.message} In ${n.field}: "${m.sentence}"`,
      path: n.field,
      source: m.source,
    }))
  );
}

export function validateDraft(draft: CourseDraft, catalogue: CatalogueEdition): Finding[] {
  const course = catalogue.courses.find((c) => c.code === draft.courseCode);
  return [
    ...checkLocked(draft, course),
    ...checkOutcomes(draft, catalogue),
    ...checkWeeksAndHours(draft, catalogue),
    ...checkAlignment(draft, course, catalogue),
    ...checkResources(draft),
    ...checkClaims(draft),
  ];
}

/** Faculty-review ready means no blocking finding. Warnings are for faculty to judge. */
export function isReviewReady(findings: Finding[]): boolean {
  return !findings.some((f) => f.severity === 'blocking');
}
