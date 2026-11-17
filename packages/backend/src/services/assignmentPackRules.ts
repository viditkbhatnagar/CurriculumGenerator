/**
 * Rules that tie a Step 12 assignment pack to the Step 7 assessment it converts.
 *
 * Logan Pacey's email of 17 November 2026 on the Diploma in Logistics pilot (workflow
 * 6af5a0a3b706bd9a5b7af54a) found that the packs for modules 1 to 3 were "MCQ knowledge
 * checks" in all three delivery modes, each weighted 100, each with a Fail/Pass/Merit/
 * Distinction rubric. Four things were wrong at once. A multiple-choice quiz was given a
 * banded rubric it cannot be marked against. The grade bands were written into the prompt
 * although Step 7 tells the model to use the institution's scheme or descriptive levels. The
 * weighting was hard-coded to 100 although Step 7 holds a split. And the three delivery modes
 * differed only in logistics, so an in-person and a self-study learner were doing the same
 * thing in the same way.
 *
 * Everything here is decided in code, not asked of the model: the marking material follows the
 * assessment type, the weighting comes from Step 7, each delivery mode has its own form, and
 * the checks at the end are computed from the stored pack. Pure, so it can be tested.
 */
import { isAutoMarked } from './assessmentKind';

export type PackVariantName = 'in_person' | 'self_study' | 'hybrid';
export type MarkingMode = 'auto_marked' | 'rubric';

/** Used when the institution has not stated a grading scheme. Lowest to highest. */
export const DESCRIPTIVE_BANDS = [
  'Not yet demonstrated',
  'Satisfactory',
  'Good',
  'Excellent',
] as const;

/** The Step 7 summative as Step 12 receives it. */
export interface ApprovedAssessment {
  assessmentType?: string;
  maxMarks?: number;
  weighting?: number;
  alignedMLOs?: string[];
  questions?: any[];
}

export interface DeliveryForm {
  label: string;
  description: string;
}

export function markingModeFor(assessmentType: unknown): MarkingMode {
  return isAutoMarked(assessmentType) ? 'auto_marked' : 'rubric';
}

/**
 * How an assessment is delivered in each mode. The outcomes, marks and criteria are the same
 * in every mode; only the form of the work and where it is done change.
 */
export function deliveryFormFor(variant: PackVariantName, assessmentType: unknown): DeliveryForm {
  if (markingModeFor(assessmentType) === 'auto_marked') {
    return {
      in_person: {
        label: 'Invigilated test',
        description:
          'Taken in a supervised session on paper or on a device; marked against the answer key.',
      },
      self_study: {
        label: 'Online timed test',
        description:
          'Taken online within a set window, with automatic marking against the answer key.',
      },
      hybrid: {
        label: 'Online test, supervised or remote',
        description:
          'The same test, taken either in a supervised session or online with remote invigilation.',
      },
    }[variant];
  }
  return {
    in_person: {
      label: 'Presented or practical form',
      description:
        'Delivered face to face: a live presentation, supervised practical or observed workplace task, marked against the rubric.',
    },
    self_study: {
      label: 'Digital submission',
      description:
        'Submitted online as a written report, recorded presentation or portfolio. A short auto-marked check may be added as one component, never as the whole assessment.',
    },
    hybrid: {
      label: 'Mixed form',
      description:
        'A written or portfolio component submitted online, together with a live or recorded presentation of it.',
    },
  }[variant];
}

/** A pass mark stated in the institution's pass requirements as a percentage, in marks. */
export function passMarkFrom(passRequirements: unknown, maxMarks: number): number | null {
  const match = /(\d{1,3}(?:\.\d+)?)\s*%/.exec(String(passRequirements ?? ''));
  if (!match || !(maxMarks > 0)) return null;
  const percent = Number(match[1]);
  if (percent <= 0 || percent > 100) return null;
  return Math.round((percent / 100) * maxMarks * 100) / 100;
}

/**
 * Four band names, lowest to highest. The institution's scheme is used when the model has
 * returned exactly four labels for it; otherwise the descriptive levels Step 7 uses. Grade
 * names are never assumed.
 */
export function bandLabelsFor(gradingScheme: unknown, modelLabels: unknown): string[] {
  const stated = typeof gradingScheme === 'string' && gradingScheme.trim().length > 0;
  if (stated && Array.isArray(modelLabels)) {
    const labels = modelLabels.map((l) => String(l ?? '').trim()).filter(Boolean);
    if (labels.length === 4 && new Set(labels).size === 4) return labels;
  }
  return [...DESCRIPTIVE_BANDS];
}

/** The key and mark scheme for an auto-marked assessment, taken from the approved questions. */
export function buildMarkScheme(
  approved: ApprovedAssessment,
  passRequirements?: unknown
): { answerKey: any[]; markScheme: { maxMarks: number; passMark: number | null } } {
  const questions = (approved.questions || []).filter((q) => q && q.correctAnswer !== undefined);
  const maxMarks = Number(approved.maxMarks) > 0 ? Number(approved.maxMarks) : 0;
  const pointsGiven = questions.every((q) => Number(q.points) > 0);
  const each = questions.length ? maxMarks / questions.length : 0;
  const answerKey = questions.map((q, i) => ({
    questionNumber: q.questionNumber ?? i + 1,
    question: String(q.questionText ?? ''),
    correctAnswer: String(q.correctAnswer ?? ''),
    rationale: q.rationale ? String(q.rationale) : undefined,
    marks: pointsGiven ? Number(q.points) : Math.round(each * 100) / 100,
  }));
  return {
    answerKey,
    markScheme: { maxMarks, passMark: passMarkFrom(passRequirements, maxMarks) },
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Bind a generated pack to the approved assessment. Returns the corrected pack and a note for
 * each thing the model had got wrong, so a correction is visible rather than silent. The input
 * is not changed.
 */
export function enforcePackRules(
  pack: any,
  variant: PackVariantName,
  approved: ApprovedAssessment | undefined,
  rules?: { gradingScheme?: unknown; passRequirements?: unknown }
): { pack: any; corrections: string[] } {
  const corrections: string[] = [];
  const next = structuredClone(pack);
  const type = approved?.assessmentType ?? next.overview?.assignmentType;
  const mode = markingModeFor(type);
  next.markingMode = mode;
  next.form = deliveryFormFor(variant, type);
  next.overview = { ...(next.overview || {}) };

  if (approved?.assessmentType && next.overview.assignmentType !== approved.assessmentType) {
    corrections.push(
      `type "${next.overview.assignmentType ?? ''}" replaced by the approved "${approved.assessmentType}"`
    );
    next.overview.assignmentType = approved.assessmentType;
  }

  const weighting = Number(approved?.weighting);
  if (approved && Number.isFinite(weighting) && weighting > 0) {
    if (Number(next.overview.weighting) !== weighting) {
      corrections.push(
        `weighting ${next.overview.weighting ?? 'missing'} set to Step 7's ${weighting}`
      );
    }
    next.overview.weighting = weighting;
  }
  const maxMarks = Number(approved?.maxMarks) > 0 ? Number(approved?.maxMarks) : null;
  next.maxMarks = maxMarks ?? undefined;

  if (mode === 'auto_marked') {
    if ((next.rubric || []).length > 0) corrections.push('banded rubric removed from a quiz pack');
    next.rubric = [];
    delete next.bandLabels;
    if (approved) Object.assign(next, buildMarkScheme(approved, rules?.passRequirements));
    return { pack: next, corrections };
  }

  delete next.answerKey;
  delete next.markScheme;
  const labels = bandLabelsFor(rules?.gradingScheme, next.bandLabels);
  if (JSON.stringify(labels) !== JSON.stringify(next.bandLabels)) {
    corrections.push(`bands set to ${labels.join(' / ')}`);
  }
  next.bandLabels = labels;

  // Marks per criterion follow from the weights; the last takes the remainder so they sum
  // exactly to maxMarks.
  const rubric: any[] = Array.isArray(next.rubric) ? next.rubric : [];
  if (maxMarks !== null && rubric.length) {
    let given = 0;
    next.rubric = rubric.map((c, i) => {
      const marks =
        i === rubric.length - 1
          ? round2(maxMarks - given)
          : round2(((Number(c?.weight) || 0) / 100) * maxMarks);
      given = round2(given + marks);
      return { ...c, marks };
    });
  }
  return { pack: next, corrections };
}

/** The problems with one stored pack, as plain sentences. Empty means it passes. */
export function checkPack(pack: any, approved?: ApprovedAssessment): string[] {
  const problems: string[] = [];
  const type = approved?.assessmentType ?? pack?.overview?.assignmentType;
  const rubric: any[] = Array.isArray(pack?.rubric) ? pack.rubric : [];

  if (markingModeFor(type) === 'auto_marked') {
    if (rubric.length > 0) problems.push('a quiz pack carries a banded rubric');
    const key: any[] = Array.isArray(pack?.answerKey) ? pack.answerKey : [];
    if (key.length === 0) problems.push('a quiz pack has no answer key');
    const total = key.reduce((n, k) => n + (Number(k?.marks) || 0), 0);
    const max = Number(pack?.markScheme?.maxMarks);
    if (key.length && Math.abs(total - max) > 0.05) {
      problems.push(`answer key marks total ${round2(total)}, not ${max}`);
    }
  } else {
    if (rubric.length === 0) problems.push('no rubric');
    const weights = rubric.reduce((n, c) => n + (Number(c?.weight) || 0), 0);
    if (rubric.length && Math.abs(weights - 100) > 0.1) {
      problems.push(`rubric weights total ${round2(weights)}, not 100`);
    }
    const max = Number(approved?.maxMarks ?? pack?.maxMarks);
    if (rubric.length && max > 0) {
      const marks = rubric.reduce((n, c) => n + (Number(c?.marks) || 0), 0);
      if (Math.abs(marks - max) > 0.05)
        problems.push(`rubric marks total ${round2(marks)}, not ${max}`);
    }
    if (rubric.some((c) => 'fail' in (c || {}) && !Array.isArray(pack?.bandLabels))) {
      problems.push('rubric has no band labels');
    }
  }

  const weighting = Number(approved?.weighting);
  if (approved && Number.isFinite(weighting) && weighting > 0) {
    if (Number(pack?.overview?.weighting) !== weighting) {
      problems.push(
        `weighting ${pack?.overview?.weighting ?? 'missing'}, Step 7 says ${weighting}`
      );
    }
  }
  if (approved?.assessmentType && pack?.overview?.assignmentType !== approved.assessmentType) {
    problems.push(
      `type "${pack?.overview?.assignmentType}" differs from Step 7's "${approved.assessmentType}"`
    );
  }
  return problems;
}

/** Whether the delivery modes keep the same outcomes, marks and criteria. Empty means they do. */
export function checkVariantsAlike(variants: Partial<Record<PackVariantName, any>>): string[] {
  const packs = Object.values(variants).filter(Boolean);
  if (packs.length < 2) return [];
  const sig = (p: any) =>
    JSON.stringify({
      outcomes: (p.assessedOutcomes || []).map((o: any) => o?.mloId).sort(),
      weighting: p.overview?.weighting,
      criteria: (p.rubric || []).map((c: any) => [c?.criterionName, c?.weight]),
      marks: p.markScheme?.maxMarks ?? p.maxMarks ?? null,
    });
  const first = sig(packs[0]);
  const problems: string[] = [];
  if (packs.some((p) => sig(p) !== first)) {
    problems.push('delivery modes differ in outcomes, weighting, criteria or marks');
  }
  const forms = packs.map((p) => p.form?.label).filter(Boolean);
  if (forms.length > 1 && new Set(forms).size === 1) {
    problems.push('delivery modes share one form');
  }
  return problems;
}

/** Every check over one module's packs, for storing beside them. */
export function moduleChecks(
  variants: Partial<Record<PackVariantName, any>>,
  approved?: ApprovedAssessment
): { problems: string[]; passed: boolean } {
  const problems = [
    ...Object.entries(variants).flatMap(([name, pack]) =>
      pack ? checkPack(pack, approved).map((p) => `${name}: ${p}`) : []
    ),
    ...checkVariantsAlike(variants),
  ];
  return { problems, passed: problems.length === 0 };
}

/**
 * The check result to store on each variant: its own problems plus the ones that concern the
 * three modes together. Stored with the pack so a failure shows on the Step 12 screen and in
 * the export, not only in a log line.
 */
export function packChecksByVariant(
  variants: Partial<Record<PackVariantName, any>>,
  approved?: ApprovedAssessment
): Partial<Record<PackVariantName, { passed: boolean; problems: string[] }>> {
  const shared = checkVariantsAlike(variants);
  const out: Partial<Record<PackVariantName, { passed: boolean; problems: string[] }>> = {};
  for (const [name, pack] of Object.entries(variants) as [PackVariantName, any][]) {
    if (!pack) continue;
    const problems = [...checkPack(pack, approved), ...shared];
    out[name] = { passed: problems.length === 0, problems };
  }
  return out;
}
