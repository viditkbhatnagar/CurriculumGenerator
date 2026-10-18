/**
 * Step 3's programme learning outcomes, checked in code against the aims, competencies and
 * job tasks they claim to serve.
 *
 * Rejin's audit (17 October 2026):
 * - the Step 1 aims never reached Step 3, so nothing tied an outcome to an aim;
 * - the coverage figures and validation flags ("allMeasurable": true, "coveragePercent": 85)
 *   were the model's own report on its own work, and the prompt pre-filled 85;
 * - outcomes only had to cover 70% of the competencies Step 2 called essential;
 * - job tasks were linked by re-typed wording.
 *
 * Outcomes now carry aim, competency and task ids; ids that were never supplied are dropped;
 * and every figure is counted here, the same way at generation and after an edit. An essential
 * competency that no outcome carries is either deferred to module level by name, with a reason,
 * or reported as uncovered. Nothing passes on an empty list.
 *
 * Pure, so it can be tested.
 */
import { normaliseBloomLevel } from '../utils/bloomLevels';
import { jobTaskIndex, JobTask } from './competencyFramework';

export interface Aim {
  id: string;
  text: string;
}

/** Step 1's aims with stable ids ("A1"…), in their order. */
export function aimIndex(programAims: unknown): Aim[] {
  return (Array.isArray(programAims) ? programAims : [])
    .map((a) => String(typeof a === 'string' ? a : (a as any)?.text || (a as any)?.statement || ''))
    .map((text) => text.trim())
    .filter(Boolean)
    .map((text, i) => ({ id: `A${i + 1}`, text }));
}

const LOWER = ['remember', 'understand', 'apply'];
const HIGHER = ['analyze', 'evaluate', 'create'];
const BLOOM_ORDER = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];
/** The prompt asks for 25 words; more than this is reported, not rejected. */
export const PLO_WORD_LIMIT = 30;

function kscItems(step2: any): any[] {
  const competencies = step2?.competencyItems?.length
    ? step2.competencyItems
    : step2?.attitudeItems || [];
  return [...(step2?.knowledgeItems || []), ...(step2?.skillItems || []), ...competencies];
}

function ids(value: unknown): string[] {
  return (Array.isArray(value) ? value : []).map((v) => String(v).trim()).filter(Boolean);
}

/**
 * One outcome with its links kept only where they point at something that exists, and the
 * task wording filled from the SME's text.
 */
export function tidyOutcome(
  plo: any,
  context: { kscIds: Set<string>; aims: Aim[]; tasks: JobTask[] }
): any {
  const aimIds = new Set(context.aims.map((a) => a.id));
  const tasksById = new Map(context.tasks.map((t) => [t.id, t]));
  const linkedKSCs = ids(plo?.linkedKSCs).filter((id) => context.kscIds.has(id));
  const jobTaskIds = ids(plo?.jobTaskIds)
    .map((id) => id.toUpperCase())
    .filter((id) => tasksById.has(id));
  const level = normaliseBloomLevel(plo?.bloomLevel);
  return {
    ...plo,
    ...(level ? { bloomLevel: level } : {}),
    linkedKSCs,
    aimIds: ids(plo?.aimIds)
      .map((id) => id.toUpperCase())
      .filter((id) => aimIds.has(id)),
    jobTaskIds,
    // Kept for the screens and exports that show task wording; filled from the SME's text.
    jobTaskMapping: jobTaskIds.map((id) => tasksById.get(id)!.task),
    // The old field showed an assessment method chosen before Step 7 existed. It now shows
    // the kind of evidence the outcome needs, which Step 7 designs against.
    assessmentAlignment: plo?.evidenceRequired || plo?.assessmentAlignment || '',
  };
}

export interface CoverageReport {
  essentialCompetencies: number;
  competenciesCovered: number;
  /** Kept under its old name for the screens; it now counts essential items, as it says. */
  totalEssentialCompetencies: number;
  coveragePercent: number;
  uncoveredEssential: string[];
  deferredToModules: Array<{ id: string; reason: string }>;
  aimsCovered: number;
  totalAims: number;
  uncoveredAims: string[];
  /** Ids of the SME's tasks some outcome prepares for (the stored shape is a list). */
  jobTasksCovered: string[];
  totalJobTasks: number;
  uncoveredJobTasks: string[];
  bloomDistribution: Record<string, number>;
  validation: {
    allEssentialAccountedFor: boolean;
    allAimsCovered: boolean;
    allUnique: boolean;
    withinWordLimit: boolean;
    hasLowerLevel: boolean;
    hasHigherLevel: boolean;
  };
  overLongOutcomes: string[];
  computedBy: 'code';
}

/** Every figure the screens and exports show for Step 3, counted from the outcomes on file. */
export function step3CoverageReport(
  outcomes: any[],
  step2: any,
  step1: any,
  deferred: unknown = []
): CoverageReport {
  const aims = aimIndex(step1?.programAims);
  const tasks = jobTaskIndex(step1?.jobRoles);
  const essential = kscItems(step2)
    .filter((i) => i?.importance === 'essential')
    .map((i) => String(i.id));
  const linked = new Set(outcomes.flatMap((o) => ids(o?.linkedKSCs)));
  const deferredToModules = (Array.isArray(deferred) ? deferred : [])
    .map((d: any) => ({ id: String(d?.id || '').trim(), reason: String(d?.reason || '').trim() }))
    .filter((d) => d.id && d.reason && essential.includes(d.id) && !linked.has(d.id));
  const deferredIds = new Set(deferredToModules.map((d) => d.id));
  const covered = essential.filter((id) => linked.has(id));
  const uncoveredEssential = essential.filter((id) => !linked.has(id) && !deferredIds.has(id));

  const aimsLinked = new Set(outcomes.flatMap((o) => ids(o?.aimIds)));
  const tasksLinked = new Set(outcomes.flatMap((o) => ids(o?.jobTaskIds)));

  const bloomDistribution: Record<string, number> = Object.fromEntries(
    BLOOM_ORDER.map((l) => [l, 0])
  );
  for (const o of outcomes) {
    const level = normaliseBloomLevel(o?.bloomLevel);
    if (level) bloomDistribution[level] += 1;
  }
  const statements = outcomes.map((o) =>
    String(o?.statement || '')
      .trim()
      .toLowerCase()
  );
  const overLongOutcomes = outcomes
    .filter(
      (o) =>
        String(o?.statement || '')
          .split(/\s+/)
          .filter(Boolean).length > PLO_WORD_LIMIT
    )
    .map((o) => String(o?.code || o?.id));

  const has = outcomes.length > 0;
  return {
    essentialCompetencies: essential.length,
    competenciesCovered: covered.length,
    totalEssentialCompetencies: essential.length,
    coveragePercent: essential.length ? Math.round((covered.length / essential.length) * 100) : 0,
    uncoveredEssential,
    deferredToModules,
    aimsCovered: aims.filter((a) => aimsLinked.has(a.id)).length,
    totalAims: aims.length,
    uncoveredAims: aims.filter((a) => !aimsLinked.has(a.id)).map((a) => a.id),
    jobTasksCovered: tasks.filter((t) => tasksLinked.has(t.id)).map((t) => t.id),
    totalJobTasks: tasks.length,
    uncoveredJobTasks: tasks.filter((t) => !tasksLinked.has(t.id)).map((t) => t.id),
    bloomDistribution,
    validation: {
      allEssentialAccountedFor: has && essential.length > 0 && uncoveredEssential.length === 0,
      allAimsCovered: has && aims.length > 0 && aims.every((a) => aimsLinked.has(a.id)),
      allUnique: has && new Set(statements).size === statements.length,
      withinWordLimit: has && overLongOutcomes.length === 0,
      hasLowerLevel: LOWER.some((l) => bloomDistribution[l] > 0),
      hasHigherLevel: HIGHER.some((l) => bloomDistribution[l] > 0),
    },
    overLongOutcomes,
    computedBy: 'code',
  };
}
