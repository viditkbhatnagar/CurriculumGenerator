/**
 * The rules Step 2's competency framework is held to in code, not in the prompt.
 *
 * Rejin's audit (17 October 2026) found three ways the model was left to fill a container:
 * - every programme, from a 135-hour course to a 4,500-hour degree, was told to produce 15–25
 *   items in fixed proportions (30–40% knowledge, 40–50% skills, 15–25% behaviours), so thin
 *   evidence was topped up from the model's own knowledge;
 * - each item's "source" was free text after a system prompt naming SHRM, PMI, SFIA, CIPD and
 *   ASCM, so it could name a body no retrieved passage came from;
 * - job tasks were linked by re-typed wording, which the model could paraphrase or invent.
 *
 * Now the count is a ceiling that grows with programme size and the evidence may undershoot;
 * each item names the passage label it rests on (or says it rests on none), which is checked
 * against the passages actually supplied; tasks are linked by id and their wording is filled in
 * from the SME's own text; and the distribution is counted, not reported by the model.
 *
 * Pure, so it can be tested.
 */

/**
 * At most this many items for a programme of this many hours. Grows with the logarithm of
 * size: a 135-hour course gets 9, a 600-hour certificate 22, a 4,500-hour degree 39. It is a
 * ceiling, not a target, and no published standard sets it: Rejin asked what evidence
 * supported 15–25, and the answer was none, so the limit only stops runaway lists.
 */
export function competencyCeiling(totalHours: unknown): number {
  const hours = Number(totalHours) || 0;
  if (hours <= 0) return 20;
  return Math.max(8, Math.min(40, Math.round(6 * Math.log2(Math.max(hours, 100) / 50))));
}

export interface JobTask {
  id: string;
  role: string;
  task: string;
}

/** The SME's job tasks with stable ids ("JT1"…), in the order they were entered. */
export function jobTaskIndex(jobRoles: unknown): JobTask[] {
  const roles = Array.isArray(jobRoles) ? jobRoles : [];
  const tasks: JobTask[] = [];
  for (const r of roles) {
    if (!r || typeof r !== 'object') continue;
    const role = String((r as any).title || (r as any).name || '').trim();
    for (const t of Array.isArray((r as any).tasks) ? (r as any).tasks : []) {
      const task = String(t || '').trim();
      if (task) tasks.push({ id: `JT${tasks.length + 1}`, role, task });
    }
  }
  return tasks;
}

export function jobTaskPromptLines(roles: unknown, tasks: JobTask[]): string {
  const list = Array.isArray(roles) ? roles : [];
  if (!list.length) return '- No job roles were supplied';
  return list
    .map((r: any) => {
      const role = typeof r === 'string' ? r : String(r?.title || r?.name || '');
      const own = tasks.filter((t) => t.role === role);
      return own.length
        ? `- ${role}\n${own.map((t) => `  ${t.id}: ${t.task}`).join('\n')}`
        : `- ${role} (no tasks supplied)`;
    })
    .join('\n');
}

export type EvidenceKind = 'knowledge base' | 'occupational standard' | 'SME input' | 'none';

const EVIDENCE_LABELS: Record<Exclude<EvidenceKind, 'knowledge base'>, string> = {
  'occupational standard': 'National occupational standards (matched to the job roles)',
  'SME input': 'SME job roles and tasks',
  none: 'General knowledge (no supplied source)',
};

export interface Step2Item {
  id?: string;
  importance?: string;
  evidence?: unknown;
  linkedJobTaskIds?: unknown;
  [key: string]: unknown;
}

/**
 * What an item's `evidence` field resolves to. "SOURCE 3" must be a passage that was actually
 * supplied; anything that is not is recorded as resting on no supplied source.
 */
export function resolveEvidence(
  evidence: unknown,
  passageSources: string[]
): { kind: EvidenceKind; source: string; passage?: number } {
  const value = String(evidence ?? '').trim();
  const passage = /^\[?\s*source\s*(\d+)/i.exec(value);
  if (passage) {
    const n = Number(passage[1]);
    if (n >= 1 && n <= passageSources.length) {
      return { kind: 'knowledge base', source: passageSources[n - 1], passage: n };
    }
    return { kind: 'none', source: EVIDENCE_LABELS.none };
  }
  if (/^occupation/i.test(value))
    return { kind: 'occupational standard', source: EVIDENCE_LABELS['occupational standard'] };
  if (/^sme/i.test(value)) return { kind: 'SME input', source: EVIDENCE_LABELS['SME input'] };
  return { kind: 'none', source: EVIDENCE_LABELS.none };
}

function tidyItem(item: Step2Item, passageSources: string[], tasks: JobTask[]): Step2Item {
  const evidence = resolveEvidence(item.evidence, passageSources);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const ids = (Array.isArray(item.linkedJobTaskIds) ? item.linkedJobTaskIds : [])
    .map((id) => String(id).trim().toUpperCase())
    .filter((id, i, all) => byId.has(id) && all.indexOf(id) === i);
  return {
    ...item,
    evidenceKind: evidence.kind,
    ...(evidence.passage ? { evidencePassage: evidence.passage } : {}),
    source: evidence.source,
    linkedJobTaskIds: ids,
    linkedJobTasks: ids.map((id) => byId.get(id)!.task),
  };
}

export interface Step2Output {
  knowledgeItems?: Step2Item[];
  skillItems?: Step2Item[];
  competencyItems?: Step2Item[];
  benchmarkingReport?: Record<string, unknown>;
  evidenceGaps?: unknown;
  [key: string]: unknown;
}

/**
 * Step 2's output with each item's evidence and job tasks checked against what was supplied,
 * and the distribution counted. Benchmark programmes the SME named are listed as named, never
 * as analysed: only their names reach the model.
 */
export function tidyStep2Output(
  parsed: Step2Output,
  context: {
    passageSources: string[];
    tasks: JobTask[];
    benchmarkPrograms?: Array<{ programName?: string; institution?: string }>;
  }
): Step2Output {
  const tidy = (items: unknown) =>
    (Array.isArray(items) ? items : []).map((i) =>
      tidyItem(i as Step2Item, context.passageSources, context.tasks)
    );
  const knowledgeItems = tidy(parsed.knowledgeItems);
  const skillItems = tidy(parsed.skillItems);
  const competencyItems = tidy(parsed.competencyItems);
  const all = [...knowledgeItems, ...skillItems, ...competencyItems];
  const pct = (n: number) => (all.length ? Math.round((n / all.length) * 100) : 0);
  const covered = new Set(all.flatMap((i) => i.linkedJobTaskIds as string[]));

  return {
    ...parsed,
    knowledgeItems,
    skillItems,
    competencyItems,
    evidenceGaps: Array.isArray(parsed.evidenceGaps) ? parsed.evidenceGaps : [],
    benchmarkingReport: {
      ...(parsed.benchmarkingReport || {}),
      programsAnalyzed: (context.benchmarkPrograms || []).map((b) => ({
        programName: b.programName,
        institution: b.institution,
        relevance: 'named by the SME; curriculum not supplied, so not analysed',
      })),
      distributionSummary: {
        knowledgePercent: pct(knowledgeItems.length),
        skillPercent: pct(skillItems.length),
        competencyPercent: pct(competencyItems.length),
        essentialCount: all.filter((i) => i.importance === 'essential').length,
        desirableCount: all.filter((i) => i.importance !== 'essential').length,
      },
      evidenceSummary: {
        knowledgeBase: all.filter((i) => i.evidenceKind === 'knowledge base').length,
        occupationalStandard: all.filter((i) => i.evidenceKind === 'occupational standard').length,
        smeInput: all.filter((i) => i.evidenceKind === 'SME input').length,
        noSuppliedSource: all.filter((i) => i.evidenceKind === 'none').length,
      },
      jobTaskCoverage: {
        covered: context.tasks.filter((t) => covered.has(t.id)).length,
        total: context.tasks.length,
        uncovered: context.tasks.filter((t) => !covered.has(t.id)).map((t) => t.id),
      },
    },
  };
}
