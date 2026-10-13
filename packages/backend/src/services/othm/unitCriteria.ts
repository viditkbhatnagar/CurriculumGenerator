/**
 * The assessment criteria, indicative content and aim of each unit, in the form of a UK
 * awarding body's unit specification (OTHM's, as Rejin asked on 13 October 2026).
 *
 * An OTHM unit lists, under each learning outcome ("The learner will:"), two to five numbered
 * assessment criteria ("The learner can: 1.1 Examine…") and the indicative content a tutor
 * covers. The generator's modules have learning outcomes but no criteria, so the model writes
 * them, once per unit, from the unit's own outcomes and topics. The result is stored on the
 * Step 4 module, each outcome's entry tied to the wording it was written for, so an outcome
 * edited later reads as not yet written rather than keeping criteria for the old wording.
 *
 * Pure: the model call and the storage are in unitCriteriaRunner.
 */

/** Bump when the prompt or the stored shape changes: units written under an older one redo. */
export const UNIT_CRITERIA_VERSION = 1;

export const MIN_CRITERIA = 2;
export const MAX_CRITERIA = 5;
export const MAX_INDICATIVE = 4;

export interface OutcomeCriteria {
  /** The outcome's wording these were written for. */
  statement: string;
  criteria: string[];
  indicativeContent: string[];
}

export interface UnitCriteria {
  version: number;
  generatedAt: string;
  unitAim: string;
  /** Keyed by the outcome's id. */
  outcomes: Record<string, OutcomeCriteria>;
}

export const SYSTEM_PROMPT = `You write the assessment criteria, indicative content and aim of a unit specification, in the form used by UK awarding bodies such as OTHM.

Rules:
- Use only the unit's own learning outcomes and topics. Do not add topics, facts, organisations or sources that the unit does not contain.
- For EVERY learning outcome, write ${MIN_CRITERIA} to ${MAX_CRITERIA} assessment criteria. Each is one sentence of at most 25 words that begins with a command verb (for example Examine, Explain, Analyse, Evaluate, Critically evaluate, Discuss, Develop, Apply, Design, Justify). Use verbs at or below the outcome's Bloom level. Together the criteria must cover the whole outcome, and each must be something an assessor can judge as met or not met from a learner's work.
- For every outcome, write 1 to ${MAX_INDICATIVE} indicative-content items: what a tutor covers, as concise phrases separated by semicolons (for example "Models e.g. Lewin's change model; Kotter's eight steps; the change curve"). Draw them from the unit's topics.
- Write the unit aim as one or two sentences beginning "The aim of this unit is to".
- Plain British English. Do not number the criteria; the system numbers them.

Return JSON only, in exactly this shape:
{"unitAim":"","outcomes":[{"id":"","criteria":[""],"indicativeContent":[""]}]}`;

export interface UnitForPrompt {
  code?: string;
  title?: string;
  description?: string;
  mlos?: { id?: string; statement?: string; bloomLevel?: string }[];
  topics?: unknown[];
}

const topicTitle = (t: unknown): string => {
  if (typeof t === 'string') return t;
  const o = (t || {}) as { title?: string; name?: string; subtopics?: unknown[] };
  const subs = Array.isArray(o.subtopics) ? o.subtopics.filter((s) => typeof s === 'string') : [];
  const title = o.title || o.name || '';
  return subs.length ? `${title} (${subs.join('; ')})` : title;
};

export function userPrompt(
  unit: UnitForPrompt,
  programme: { title?: string; level?: string }
): string {
  return `Write the assessment criteria, indicative content and aim for this unit.\n\n${JSON.stringify(
    {
      programme: programme.title,
      level: programme.level,
      unit: `${unit.code || ''} ${unit.title || ''}`.trim(),
      description: unit.description,
      learningOutcomes: (unit.mlos || []).map((m) => ({
        id: m.id,
        statement: m.statement,
        bloomLevel: m.bloomLevel,
      })),
      topics: (unit.topics || []).map(topicTitle).filter(Boolean),
    }
  )}`;
}

const clean = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
const list = (v: unknown, n: number, max: number) =>
  (Array.isArray(v) ? v : [])
    .map((x) => clean(x, max))
    .filter(Boolean)
    .slice(0, n);

/**
 * The model's answer, checked against the unit: every outcome must have at least
 * MIN_CRITERIA criteria. Returns null when the answer is unusable or incomplete, so the caller
 * can ask again rather than store a unit with outcomes missing.
 */
export function parseUnitCriteria(
  raw: string,
  unit: UnitForPrompt,
  now: Date = new Date()
): UnitCriteria | null {
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const byId = new Map<string, any>(
    (Array.isArray(data?.outcomes) ? data.outcomes : []).map((o: any) => [String(o?.id), o])
  );
  const outcomes: Record<string, OutcomeCriteria> = {};
  for (const mlo of unit.mlos || []) {
    const answer = byId.get(String(mlo.id));
    const criteria = list(answer?.criteria, MAX_CRITERIA, 300);
    if (!mlo.id || criteria.length < MIN_CRITERIA) return null;
    outcomes[String(mlo.id)] = {
      statement: String(mlo.statement || ''),
      criteria,
      indicativeContent: list(answer?.indicativeContent, MAX_INDICATIVE, 700),
    };
  }
  const unitAim = clean(data?.unitAim, 600);
  if (!unitAim || !Object.keys(outcomes).length) return null;
  return {
    version: UNIT_CRITERIA_VERSION,
    generatedAt: now.toISOString(),
    unitAim,
    outcomes,
  };
}

/**
 * An outcome's stored criteria, if they were written for its present wording under the current
 * version; otherwise undefined (not yet written, or out of date).
 */
export function currentCriteria(
  module: { othm?: UnitCriteria },
  mlo: { id?: string; statement?: string }
): OutcomeCriteria | undefined {
  const stored = module?.othm;
  if (!stored || stored.version !== UNIT_CRITERIA_VERSION) return undefined;
  const entry = stored.outcomes?.[String(mlo.id)];
  return entry && entry.statement === String(mlo.statement || '') ? entry : undefined;
}

/** Whether every outcome of a module has current criteria. */
export function unitCriteriaComplete(module: {
  othm?: UnitCriteria;
  mlos?: { id?: string; statement?: string }[];
}): boolean {
  const mlos = module?.mlos || [];
  return mlos.length > 0 && mlos.every((m) => !!currentCriteria(module, m));
}
