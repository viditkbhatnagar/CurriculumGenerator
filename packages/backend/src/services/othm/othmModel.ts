/**
 * A programme mapped onto the three documents of a UK awarding body's qualification (OTHM's
 * layout, as Rejin asked on 13 October 2026): the Qualification Specification, the Unit
 * Specifications and the Assignment Briefs.
 *
 * Programme = qualification (Step 1); module = unit (Step 4); assessment criteria, indicative
 * content and unit aim come from unitCriteria; reading lists and links from Steps 5 and 6; the
 * assessment of each unit from its Step 12 pack, or its Step 7 module summative; policy
 * sections from the institution's assessment rules.
 *
 * Nothing is claimed that the programme does not hold: regulator numbers and dates read "To be
 * assigned", and policy the institution has not stated reads as not stated. Units are graded
 * Pass / Fail and criterion-referenced, as in OTHM qualifications.
 *
 * Pure, so it can be tested.
 */
import { currentCriteria } from './unitCriteria';

export const TO_BE_ASSIGNED = 'To be assigned';
export const NOT_STATED = 'Not yet stated by the institution.';
export const GRADING = 'Pass / Fail';

export interface OthmOutcome {
  number: number;
  statement: string;
  criteria: { ref: string; text: string }[];
  indicativeContent: string[];
  /** No current criteria for this outcome: shown as such rather than invented. */
  missing: boolean;
}

export interface OthmAssessmentRow {
  outcomes: string;
  criteria: string;
  type: string;
  length: string;
}

export interface OthmBrief {
  title: string;
  type: string;
  scenario: string;
  intro: string;
  taskHeading: string;
  instructions: string[];
  deliverables: string[];
  submission: string[];
  evidence: string[];
}

export interface OthmUnit {
  code: string;
  title: string;
  level: string;
  credits: number | string;
  tqt: number | string;
  glh: number | string;
  status: 'Mandatory' | 'Optional';
  grading: string;
  aim: string;
  outcomes: OthmOutcome[];
  assessment: OthmAssessmentRow[];
  readings: string[];
  links: { title: string; url: string }[];
  brief: OthmBrief | null;
}

export interface OthmQualification {
  title: string;
  level: string;
  description: string;
  aims: string[];
  regulatory: [string, string][];
  structure: string;
  creditNote: string;
  entryRequirements: string;
  entryIsProposal: boolean;
  progression: string[];
  delivery: string;
  assessment: string[];
  opportunitiesToPass: string;
  equality: string;
  units: OthmUnit[];
  /** Units whose criteria have not all been written yet. */
  unitsMissingCriteria: string[];
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const titleCase = (s: string) =>
  s.replace(/(^|[\s_-])(\w)/g, (_m, p, c) => `${p === '_' ? ' ' : p}${c.toUpperCase()}`);

/** "All 1 to 3" when a set covers every outcome, as OTHM writes it; otherwise "1, 3". */
export function outcomeRange(numbers: number[], total: number): string {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  if (!sorted.length) return '';
  if (sorted.length === total && total > 1) return `All 1 to ${total}`;
  if (sorted.length === 1) return `${sorted[0]}`;
  return sorted.join(', ');
}

function packFor(workflow: any, module: any): any | undefined {
  const pack = (workflow.step12?.moduleAssignmentPacks || []).find(
    (p: any) => p?.moduleId === module.id || (p?.moduleCode && p.moduleCode === module.code)
  );
  const variants = pack?.variants || {};
  return variants.in_person || variants.hybrid || variants.self_study;
}

function summativeFor(workflow: any, module: any): any | undefined {
  return (workflow.step7?.formativeAssessments || []).find(
    (a: any) => a?.moduleId === module.id && (a.purpose === 'module_summative' || a.graded === true)
  );
}

function unitOutcomes(module: any): OthmOutcome[] {
  return (module.mlos || []).map((mlo: any, i: number) => {
    const number = i + 1;
    const stored = currentCriteria(module, mlo);
    return {
      number,
      statement: str(mlo.statement),
      criteria: (stored?.criteria || []).map((text, j) => ({ ref: `${number}.${j + 1}`, text })),
      indicativeContent: stored?.indicativeContent || [],
      missing: !stored,
    };
  });
}

function assessmentRows(workflow: any, module: any, outcomes: OthmOutcome[]): OthmAssessmentRow[] {
  const numberOf = new Map((module.mlos || []).map((m: any, i: number) => [String(m.id), i + 1]));
  const pack = packFor(workflow, module);
  const summative = summativeFor(workflow, module);
  const ids: string[] = pack
    ? (pack.assessedOutcomes || []).map((o: any) => String(o?.mloId))
    : (summative?.alignedMLOs || []).map(String);
  const numbers = ids.map((id) => numberOf.get(id)).filter((n): n is number => !!n);
  const type = str(pack?.overview?.assignmentType) || str(summative?.assessmentType);
  if (!numbers.length || !type) return [];
  const range = outcomeRange(numbers, outcomes.length);
  const length = (pack?.evidenceRequirements || [])
    .map((e: any) => str(e?.wordCountOrDuration))
    .filter(Boolean)
    .join('; ');
  return [
    {
      outcomes: range,
      criteria: `All under LO ${range.replace(/^All /, '')}`,
      type: titleCase(type),
      length: length || 'As stated in the assignment brief',
    },
  ];
}

function briefFor(workflow: any, module: any, outcomes: OthmOutcome[]): OthmBrief | null {
  const pack = packFor(workflow, module);
  const summative = summativeFor(workflow, module);
  if (!pack && !summative) return null;
  const numberOf = new Map((module.mlos || []).map((m: any, i: number) => [String(m.id), i + 1]));
  const ids: string[] = pack
    ? (pack.assessedOutcomes || []).map((o: any) => String(o?.mloId))
    : (summative?.alignedMLOs || []).map(String);
  const assessed = outcomes.filter((o) => ids.some((id) => numberOf.get(id) === o.number));
  const tags = assessed
    .map((o) =>
      o.criteria.length
        ? `LO${o.number} AC ${o.criteria.map((c) => c.ref).join(', ')}`
        : `LO${o.number}`
    )
    .join('; ');
  // OTHM's instructions restate the assessment criteria the task must evidence, one per bullet.
  const instructions = assessed.flatMap((o) =>
    o.criteria.length ? o.criteria.map((c) => c.text) : [o.statement]
  );
  const evidence: any[] = pack?.evidenceRequirements || [];
  const type =
    str(pack?.overview?.assignmentType) || str(summative?.assessmentType) || 'Assignment';
  return {
    title: str(pack?.overview?.title) || str(summative?.title),
    type: titleCase(type),
    scenario: str(pack?.brief?.workplaceContext) || str(summative?.description),
    intro: str(pack?.brief?.studentFacingIntro) || str(summative?.studentBrief),
    taskHeading: `Task 1 of 1 – ${titleCase(type)}${tags ? ` (${tags})` : ''}`,
    instructions,
    deliverables: (pack?.brief?.deliverables || []).map(str).filter(Boolean),
    submission: evidence
      .map((e) =>
        [str(e?.artefactType), str(e?.wordCountOrDuration), str(e?.fileType)]
          .filter(Boolean)
          .join(' – ')
      )
      .filter(Boolean),
    evidence: evidence
      .map((e) => [str(e?.artefactType), str(e?.wordCountOrDuration)].filter(Boolean).join(' – '))
      .filter(Boolean),
  };
}

function readingsFor(workflow: any, module: any): string[] {
  const readings: any[] = (workflow.step6?.readings || []).filter(
    (r: any) => r?.moduleId === module.id
  );
  const ordered = [
    ...readings.filter((r) => r.category === 'core'),
    ...readings.filter((r) => r.category !== 'core'),
  ];
  return [...new Set(ordered.map((r) => str(r.citation) || str(r.title)).filter(Boolean))].slice(
    0,
    8
  );
}

function linksFor(workflow: any, module: any): { title: string; url: string }[] {
  const seen = new Set<string>();
  return (workflow.step5?.sources || [])
    .filter(
      (s: any) =>
        s?.moduleId === module.id &&
        /^https?:\/\//.test(str(s.url)) &&
        String(s.type || s.category || '').toLowerCase() !== 'academic'
    )
    .filter((s: any) => !seen.has(s.url) && seen.add(s.url))
    .slice(0, 8)
    .map((s: any) => ({ title: str(s.title), url: str(s.url) }));
}

export function othmUnits(workflow: any): OthmUnit[] {
  const level = titleCase(str(workflow?.step1?.academicLevel) || 'Not stated');
  return (workflow?.step4?.modules || []).map((module: any) => {
    const outcomes = unitOutcomes(module);
    return {
      code: str(module.code) || str(module.moduleCode) || str(module.id),
      title: str(module.title),
      level,
      credits: module.credits ?? '',
      tqt: module.totalHours ?? '',
      glh: module.contactHours ?? '',
      status: module.isElective ? 'Optional' : 'Mandatory',
      grading: GRADING,
      aim: str(module.othm?.unitAim) || str(module.description),
      outcomes,
      assessment: assessmentRows(workflow, module, outcomes),
      readings: readingsFor(workflow, module),
      links: linksFor(workflow, module),
      brief: briefFor(workflow, module, outcomes),
    };
  });
}

const textOf = (v: unknown): string => {
  if (typeof v === 'string') return v.trim();
  if (Array.isArray(v)) return v.map(textOf).filter(Boolean).join('\n');
  if (v && typeof v === 'object') {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, x]) => {
        const t = textOf(x);
        return t ? `${titleCase(k.replace(/([A-Z])/g, ' $1'))}: ${t}` : '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return '';
};

export function othmQualification(workflow: any): OthmQualification {
  const s1 = workflow?.step1 || {};
  const cf = s1.creditFramework || {};
  const units = othmUnits(workflow);
  const rules = workflow?.assessmentRules || {};
  const credits = Number(cf.credits) || 0;
  const totalHours = Number(cf.totalHours) || 0;
  const unitCredits = units.reduce((n, u) => n + (Number(u.credits) || 0), 0);
  const mandatory = units.filter((u) => u.status === 'Mandatory').length;
  // Placeholder types some packs carry ("To be determined") are not assessment methods.
  const types = [
    ...new Set(
      units
        .flatMap((u) => u.assessment.map((a) => a.type))
        .filter((t) => !/to be determined|tbd/i.test(t))
    ),
  ];
  const title = str(s1.programTitle) || str(workflow?.projectName);

  const creditNote =
    credits && totalHours
      ? `One credit represents ${Math.round(totalHours / credits)} hours of Total Qualification Time in this programme (${credits} credits, ${totalHours} hours).`
      : 'The credit value and hours have not been set in Step 1.';

  return {
    title,
    level: units[0]?.level || titleCase(str(s1.academicLevel)),
    description: str(s1.programDescription) || str(s1.programPurpose),
    aims: (Array.isArray(s1.programAims) ? s1.programAims : []).map(textOf).filter(Boolean),
    regulatory: [
      ['Qualification Title', title],
      ['Qualification Reference Number', TO_BE_ASSIGNED],
      ['Regulation Start Date', TO_BE_ASSIGNED],
      ['Operational Start Date', TO_BE_ASSIGNED],
      ['Total Credit Value', credits ? `${credits} Credits` : 'Not set'],
      ['Total Qualification Time (TQT)', totalHours ? `${totalHours} Hours` : 'Not set'],
      ['Guided Learning Hours (GLH)', cf.contactHours ? `${cf.contactHours} Hours` : 'Not set'],
      ['Sector Subject Area (SSA)', TO_BE_ASSIGNED],
      ['Overall Grading Type', GRADING],
      ['Assessment Methods', types.length ? types.join(', ') : 'Coursework'],
      ['Language of Assessment', 'English'],
    ],
    structure:
      `The ${title} consists of ${units.length} units (${mandatory} mandatory` +
      `${units.length - mandatory ? `, ${units.length - mandatory} optional` : ''}) for a combined total of ` +
      `${unitCredits} credits.` +
      (credits && unitCredits !== credits
        ? ` The programme declares ${credits} credits; the difference comes from optional units or pathways.`
        : ''),
    creditNote,
    entryRequirements: textOf(s1.entryRequirements) || NOT_STATED,
    entryIsProposal: !!s1.entryRequirements && s1.entryRequirementsOrigin !== 'institution',
    progression: (Array.isArray(s1.careerPathways) ? s1.careerPathways : [])
      .map(textOf)
      .filter(Boolean),
    delivery: str(s1.delivery?.description) || titleCase(str(s1.delivery?.mode)) || NOT_STATED,
    assessment: [
      'All units are internally assessed by the centre. The units are criterion referenced, based on the achievement of all the specified learning outcomes.',
      'To achieve a pass for a unit, learners must provide evidence that they have fulfilled all the learning outcomes and meet the standard specified by every assessment criterion. The judgement is made by the assessor, who should keep an audit trail showing how it was reached.',
      `Pass requirements: ${str(rules.passRequirements) || NOT_STATED}`,
      `Moderation and verification: ${str(rules.moderation) || NOT_STATED}`,
      `Academic integrity: ${str(rules.authenticity) || NOT_STATED}`,
    ],
    opportunitiesToPass: str(rules.resits) || NOT_STATED,
    equality: str(rules.accessibility) || NOT_STATED,
    units,
    unitsMissingCriteria: units.filter((u) => u.outcomes.some((o) => o.missing)).map((u) => u.code),
  };
}
