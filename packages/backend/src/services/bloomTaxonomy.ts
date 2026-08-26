/**
 * Bloom's taxonomy rules for Step 7 assessment generation.
 *
 * Kept apart from the generator service because every function here is a pure decision about
 * the taxonomy — which format can evidence a level, how many tasks a level warrants, whether
 * a question meets the level of the outcome it is mapped to — and because the service pulls
 * in the OpenAI client, the logger and the Mongoose models, none of which a rule about
 * Bloom's taxonomy needs. Splitting them is what made these rules testable at all.
 */

/** Bloom levels in order, so "at least this demanding" is answerable. */
export const BLOOM_ORDER = ['remember', 'understand', 'apply', 'analyse', 'evaluate', 'create'];

export const normaliseBloom = (level: string | undefined): string => {
  const value = String(level || '')
    .toLowerCase()
    .trim();
  // British and American spellings both appear in stored outcomes.
  if (value === 'analyze') return 'analyse';
  return BLOOM_ORDER.includes(value) ? value : 'understand';
};

/**
 * Which formative formats can actually evidence a given Bloom level.
 *
 * A multiple-choice knowledge check cannot show that a learner can evaluate a client's
 * current-state process or create a work breakdown structure — it can only show they
 * recognise the right answer. An author who ticks every format still needs the format
 * chosen per module, because a Level 4 introduction and a Level 6 consulting module are
 * not assessed the same way.
 */
const FORMATS_BY_BLOOM: Record<string, string[]> = {
  remember: ['Short quizzes', 'MCQ knowledge checks', 'Worksheets / problem sets'],
  understand: [
    'Short quizzes',
    'MCQ knowledge checks',
    'Worksheets / problem sets',
    'Short written reflections',
    'Discussion prompts',
  ],
  apply: [
    'Scenario-based micro-tasks',
    'Worksheets / problem sets',
    'Practice simulations',
    'Coding / technical tasks',
  ],
  analyse: [
    'Mini-case exercises',
    'Scenario-based micro-tasks',
    'Practice simulations',
    'Coding / technical tasks',
    'Discussion prompts',
  ],
  evaluate: [
    'Mini-case exercises',
    'Practice simulations',
    'Short written reflections',
    'Discussion prompts',
    'Scenario-based micro-tasks',
  ],
  create: [
    'Mini-case exercises',
    'Practice simulations',
    'Coding / technical tasks',
    'Scenario-based micro-tasks',
  ],
};

/**
 * What a task must actually ask the learner to do, per Bloom level.
 *
 * Supplied by the programme's subject-matter expert, and it fixes something the format
 * names alone could not. Choosing "mini-case exercise" for a create-level outcome still
 * left the assessment asking questions about a plan rather than requiring the learner to
 * produce one: across the programme, 36 of 47 create-level outcomes name a concrete
 * artefact — a dashboard, report, proposal, roadmap — and no assessment collected it.
 *
 * Her wording is kept verbatim so the intent is not paraphrased away, including the point
 * that quizzes and multiple-choice are perfectly valid at understand level provided they
 * test comprehension rather than recall.
 */
export const TASK_SHAPES_BY_BLOOM: Record<string, string> = {
  remember:
    'recall and recognition items, used sparingly and only as scaffolding towards a higher-level task',
  understand:
    'explaining a concept, interpreting information, classifying examples, comparing concepts, summarising meaning, or selecting the correct explanation in a scenario — quizzes and MCQs are valid here PROVIDED they assess comprehension, not simple memorisation',
  apply:
    'working a method or framework on a given case: calculations with interpretation, applying a model to a scenario, producing a worked output',
  analyse: 'case analysis, data or problem analysis, scenario diagnosis',
  evaluate: 'critical evaluation, comparison with justification, recommendations',
  create:
    'a project or design task, a strategy proposal, an implementation plan, or a presentation/report — the learner must PRODUCE the artefact, not answer questions about producing one',
};

/**
 * How each artefact is actually named in a deliverable.
 *
 * A learning outcome says "presentation"; a brief says "4-6 slide deck with speaker notes".
 * Both are the same artefact, and matching on the outcome's own word alone reports a gap
 * that is not there — it did exactly that for Leadership & Personal Effectiveness, whose
 * deliverable is a slide deck with a recorded narration.
 */
const ARTEFACT_SYNONYMS: Record<string, string[]> = {
  presentation: ['presentation', 'slide deck', 'slides', 'pitch', 'narration', 'deck'],
  dashboard: ['dashboard', 'power bi', 'powerbi', 'visualisation', 'visualization', 'chart pack'],
  report: ['report', 'write-up', 'memo', 'briefing note', 'written submission'],
  plan: ['plan', 'schedule', 'timetable', 'gantt', 'wbs', 'work breakdown'],
  proposal: ['proposal', 'business case', 'recommendation paper', 'pitch document'],
  roadmap: ['roadmap', 'phased plan', 'implementation sequence'],
  model: ['model', 'spreadsheet', 'workbook', 'xlsx', 'excel file', 'calculation sheet'],
  strategy: ['strategy', 'strategic plan', 'positioning statement'],
  map: ['map', 'process map', 'journey map', 'strategy map'],
  forecast: ['forecast', 'projection', 'cash flow'],
  budget: ['budget', 'costing'],
  brief: ['brief', 'briefing'],
  portfolio: ['portfolio'],
  framework: ['framework'],
  pack: ['pack'],
};

/**
 * Artefacts a create-level outcome commonly names. Used to check that the assessment
 * actually collects what the outcome promises.
 */
const ARTEFACT_WORDS = [
  'dashboard',
  'report',
  'plan',
  'proposal',
  'presentation',
  'roadmap',
  'model',
  'brief',
  'strategy',
  'map',
  'portfolio',
  'framework',
  'pack',
  'budget',
  'forecast',
];

/** The artefacts this module's outcomes require the learner to produce, if any. */
export function requiredArtefacts(module: any): string[] {
  const wanted = new Set<string>();
  for (const mlo of module?.mlos || []) {
    const level = normaliseBloom(mlo?.bloomLevel);
    if (level !== 'create' && level !== 'evaluate') continue;
    const statement = String(mlo?.statement || '').toLowerCase();
    for (const word of ARTEFACT_WORDS) {
      if (statement.includes(word)) wanted.add(word);
    }
  }
  return [...wanted];
}

/**
 * Which artefacts a module's outcomes promise but its assessments never collect.
 *
 * An outcome reading "create an interactive KPI dashboard" is not evidenced by questions
 * about dashboards, so this compares what the outcomes name against what the briefs
 * actually ask to be handed in — allowing for the fact that a deliverable describes the
 * artefact in its own words. Returns the artefacts that are genuinely uncollected.
 */
export function uncollectedArtefacts(
  module: any,
  assessments: { studentBrief?: { deliverables?: string[]; task?: string } }[]
): string[] {
  const wanted = requiredArtefacts(module);
  if (wanted.length === 0) return [];

  // Only fragments that actually hand something in count. A deliverable reading "Dashboard
  // wireframe description" names the artefact without collecting it, and matching on the
  // name alone let 11 of 43 create-aligned assessments report the outcome as evidenced.
  const submitted = assessments
    .flatMap((a) => [...(a.studentBrief?.deliverables || []), a.studentBrief?.task || ''])
    .filter((fragment) => fragment && !isDescriptionOnly(fragment))
    .join(' ')
    .toLowerCase();

  return wanted.filter((artefact) => {
    const names = ARTEFACT_SYNONYMS[artefact] || [artefact];
    return !names.some((name) => submitted.includes(name));
  });
}

export interface AssessmentSlot {
  /** The format this assessment must take. */
  format: string;
  /** The outcomes this assessment is responsible for evidencing. */
  mloIds: string[];
  /** The most demanding level among those outcomes — the level this assessment must reach. */
  bloom: string;
  /**
   * Formative activity (ungraded, during learning) or the module's summative (graded, at the
   * end, evidencing every outcome the module claims).
   */
  purpose: 'formative' | 'module_summative';
}

export interface FormatPlan {
  /** One format per assessment, chosen for the outcomes it has to evidence. */
  formats: string[];
  /** One slot per assessment, carrying the outcomes it owns and the level it must reach. */
  slots: AssessmentSlot[];
  /** The most demanding Bloom level this module's outcomes ask for. */
  highestBloom: string;
  /** Set when the author's permitted formats cannot evidence that level. */
  warning: string | null;
}

/**
 * Split a module's outcomes across its assessments.
 *
 * Every assessment used to be shown the module's entire outcome list and left to choose which
 * two to four it would cover, so nothing decided in advance which assessment carried the
 * demanding outcome — or checked afterwards that anything did. Dealing the outcomes out
 * highest-level-first means each assessment owns a known set, its Bloom level is known before
 * the call rather than reported by the model after it, and a module with two create-level
 * outcomes collects two artefacts instead of twice describing one.
 */
export function assignMlosToSlots(module: any, count: number): string[][] {
  const mlos = (module?.mlos || []).filter((mlo: any) => mlo?.id);
  const slots: string[][] = Array.from({ length: Math.max(count, 1) }, () => []);
  if (mlos.length === 0) return slots;

  const ordered = [...mlos].sort(
    (a: any, b: any) => bloomIndex(b?.bloomLevel) - bloomIndex(a?.bloomLevel)
  );
  // Deal round-robin from the top so the demanding outcomes land in different assessments
  // rather than stacking into the first one.
  ordered.forEach((mlo: any, i: number) => {
    slots[i % slots.length].push(String(mlo.id));
  });
  // An assessment with no outcome cannot be marked against anything; give it the module's
  // most demanding one rather than leaving it unmapped.
  for (const slot of slots) {
    if (slot.length === 0) slot.push(String(ordered[0].id));
  }
  return slots;
}

/**
 * Choose the format for each of a module's assessments.
 *
 * Constrained to what the author permitted — their list is a decision, not a suggestion —
 * but ordered by what the module's outcomes actually require, so the demanding modules get
 * the case exercises and simulations rather than everything collapsing to the first two
 * entries on the list. Where the permitted list cannot evidence the module's highest Bloom
 * level, that is reported rather than silently accepted.
 */
export function planFormativeFormats(
  module: any,
  allowedTypes: string[],
  count: number
): FormatPlan {
  const allowed = (allowedTypes || []).filter((type) => type && type !== 'None');
  const blooms = (module?.mlos || []).map((mlo: any) => normaliseBloom(mlo?.bloomLevel));
  const highestBloom = blooms.length
    ? blooms.reduce((a: string, b: string) =>
        BLOOM_ORDER.indexOf(b) > BLOOM_ORDER.indexOf(a) ? b : a
      )
    : 'understand';

  if (allowed.length === 0) {
    return {
      formats: [],
      slots: [],
      highestBloom,
      warning: `Module "${module?.title || module?.id}" has no permitted formative assessment types, so no assessment can be generated for it. Choose at least one format in Step 7.`,
    };
  }

  const mloSlots = assignMlosToSlots(module, count);
  const levelOf = new Map<string, string>();
  for (const mlo of module?.mlos || []) {
    if (mlo?.id) levelOf.set(String(mlo.id), normaliseBloom(mlo?.bloomLevel));
  }

  // Rotate so modules sharing a Bloom level do not all receive an identical pair — "blended
  // mix" should mean something across the programme, not only within a module. `sequence` is
  // read as well as `sequenceOrder` because the two Step 4 paths write different keys, and a
  // missing one collapsed the rotation to zero for every module.
  const rotation = Number(module?.sequenceOrder ?? module?.sequence ?? 0) || 0;

  const allMloIds = (module?.mlos || []).map((m: any) => String(m?.id)).filter(Boolean);
  const unsuitedLevels: string[] = [];
  const slots: AssessmentSlot[] = mloSlots.slice(0, count).map((subset, i) => {
    // The last slot is the module's summative. OTHM: summative assessment "evaluates
    // achievement against learning outcomes and assessment criteria" — against all of them,
    // so it carries the module's whole outcome set rather than a share of it. The earlier
    // slots are formative checks used during learning and take a subset.
    const isSummative = i === count - 1;
    const purpose: 'formative' | 'module_summative' = isSummative
      ? 'module_summative'
      : 'formative';
    const mloIds = isSummative && allMloIds.length ? allMloIds : subset;
    const levels = mloIds.map((id) => levelOf.get(id) || 'understand');
    // The format follows the level THIS assessment has to evidence, not the module's
    // highest: an assessment carrying only the understand-level outcome is legitimately a
    // comprehension quiz even in a module that also reaches create.
    const bloom = levels.length
      ? levels.reduce((a, b) => (bloomIndex(b) > bloomIndex(a) ? b : a))
      : highestBloom;
    const suited = (FORMATS_BY_BLOOM[bloom] || []).filter((f) => allowed.includes(f));
    if (suited.length === 0) unsuitedLevels.push(bloom);
    const pool = suited.length > 0 ? suited : allowed;
    return { format: pool[(rotation + i) % pool.length], mloIds, bloom, purpose };
  });

  const warning = unsuitedLevels.length
    ? `Module "${module?.title || module?.id}" has outcomes at Bloom level "${[...new Set(unsuitedLevels)].join(', ')}", which none of the permitted formative formats (${allowed.join(', ')}) can evidence. Consider allowing mini-case exercises or practice simulations.`
    : null;

  return { formats: slots.map((s) => s.format), slots, highestBloom, warning };
}

/** Position of a level in the taxonomy, or -1 for anything unrecognised. */
export function bloomIndex(level: string | undefined): number {
  return BLOOM_ORDER.indexOf(normaliseBloom(level));
}

/**
 * How many tasks an assessment should carry, and of what kind, at a given Bloom level.
 *
 * Every assessment used to be told to produce "10-12 detailed questions", varied between
 * MCQ, short answer and scenario, rising in difficulty from Easy to Hard. That is the shape
 * of a quiz, and it was demanded of a create-level practice simulation as firmly as of an
 * introductory knowledge check — so a module whose outcome says "create an interactive KPI
 * dashboard" was assessed by a dozen short items, 79% of them below create level. The count
 * has to fall as the level rises: an outcome at create is evidenced by one substantial piece
 * of work, not by twelve questions about it.
 */
const QUESTION_PLAN_BY_BLOOM: Record<string, { min: number; max: number; guidance: string }> = {
  remember: {
    min: 10,
    max: 12,
    guidance:
      'short recall items — MCQ and one-line answers are appropriate, and difficulty may rise from Easy to Hard across the set',
  },
  understand: {
    min: 10,
    max: 12,
    guidance:
      'comprehension items — MCQ and short answers are appropriate, but each item must ask the learner to explain, interpret, classify, compare or select the right explanation for a situation, never to recall a definition',
  },
  apply: {
    min: 6,
    max: 8,
    guidance:
      'worked tasks — each gives a case, dataset or figures and requires the method to be carried out and the result interpreted; a bare MCQ cannot evidence this level unless it follows a substantive worked step',
  },
  analyse: {
    min: 4,
    max: 6,
    guidance:
      'diagnostic tasks — each supplies a case, dataset or scenario for the learner to break down, and asks what is happening and why; no item may be answerable without engaging with the material supplied',
  },
  evaluate: {
    min: 3,
    max: 5,
    guidance:
      'judgement tasks — each requires a reasoned verdict, a comparison against stated criteria, or a recommendation with its justification; the justification is the evidence, so an item that only asks which option is best does not qualify',
  },
  create: {
    min: 2,
    max: 4,
    guidance:
      'production tasks — the learner PRODUCES the artefact the outcome names (the plan, model, dashboard, proposal, report or presentation) and hands it in; describing, outlining, wireframing or listing what it would contain does NOT evidence this level. Supporting items may set up the work, but at least one task must collect the artefact itself',
  },
};

export function questionPlanForBloom(level: string | undefined) {
  return QUESTION_PLAN_BY_BLOOM[normaliseBloom(level)] || QUESTION_PLAN_BY_BLOOM.understand;
}

/**
 * The Bloom levels an assessment actually covers, read from the curriculum.
 *
 * Previously the model was asked for this and the Word export printed its answer as the
 * document's Bloom claim. It is a lookup — the module's outcomes already carry their levels —
 * and a lookup cannot inflate. Asked for it directly, the model returned levels no aligned
 * outcome held, including "remember" on modules whose only outcome was at understand.
 */
export function deriveTargetBloomLevels(assessment: any, module: any): string[] {
  const byId = new Map<string, string>();
  for (const mlo of module?.mlos || []) {
    if (mlo?.id) byId.set(String(mlo.id), normaliseBloom(mlo?.bloomLevel));
  }
  const levels = (assessment?.alignedMLOs || [])
    .map((id: any) => byId.get(String(id)))
    .filter(Boolean) as string[];
  return [...new Set(levels)].sort((a, b) => bloomIndex(a) - bloomIndex(b));
}

export interface BloomAudit {
  /** The highest level the aligned outcomes demand. */
  required: string | null;
  /** The highest level any task in this assessment reaches. */
  reached: string | null;
  /** True when the assessment as a whole meets the level its outcomes demand. */
  meetsFloor: boolean;
  /** Questions sitting below the level of the outcome they are mapped to. */
  belowFloor: { questionNumber: number; level: string; mlo: string; required: string }[];
  /** Questions naming an MLO the module does not have. */
  unmappedQuestions: number[];
}

/**
 * Check an assessment against the Bloom level its own outcomes demand.
 *
 * Rule 16 of the prompt — "every question must work at or above the Bloom level of the MLO it
 * assesses" — was an instruction to the model and nothing else: across the whole backend the
 * taxonomy order was consulted in exactly one place, to pick a format.
 *
 * It could not have been checked even in principle, because a question never recorded WHICH
 * outcome it assessed. Scored against a proxy floor — the least demanding outcome the whole
 * assessment was mapped to — 54 of 716 questions in the generated Bachelor in Business
 * Administration fell below it, across 20 of 46 modules. `alignedMLO` is what makes the
 * question answerable exactly rather than approximately.
 */
export function auditAssessmentBloom(assessment: any, module: any): BloomAudit {
  const byId = new Map<string, string>();
  for (const mlo of module?.mlos || []) {
    if (mlo?.id) byId.set(String(mlo.id), normaliseBloom(mlo?.bloomLevel));
  }

  const alignedLevels = deriveTargetBloomLevels(assessment, module);
  const required = alignedLevels.length ? alignedLevels[alignedLevels.length - 1] : null;

  const questions = assessment?.questions || [];
  const belowFloor: BloomAudit['belowFloor'] = [];
  const unmappedQuestions: number[] = [];
  let reachedIdx = -1;

  for (const q of questions) {
    const level = normaliseBloom(q?.bloomLevel);
    reachedIdx = Math.max(reachedIdx, bloomIndex(level));

    const mloId = q?.alignedMLO ? String(q.alignedMLO) : null;
    if (!mloId || !byId.has(mloId)) {
      if (mloId) unmappedQuestions.push(Number(q?.questionNumber) || 0);
      continue;
    }
    const floor = byId.get(mloId)!;
    if (bloomIndex(level) < bloomIndex(floor)) {
      belowFloor.push({
        questionNumber: Number(q?.questionNumber) || 0,
        level,
        mlo: mloId,
        required: floor,
      });
    }
  }

  const reached = reachedIdx >= 0 ? BLOOM_ORDER[reachedIdx] : null;
  const meetsFloor = required === null ? true : reachedIdx >= bloomIndex(required);

  return { required, reached, meetsFloor, belowFloor, unmappedQuestions };
}

export interface BloomReport {
  /** True when every assessment reaches the level its own outcomes demand. */
  floorMet: boolean;
  /** How many questions sit at each level. */
  distribution: Record<string, number>;
  /** Assessments that never reach their outcomes' level, named for the author. */
  shortfalls: {
    moduleId: string;
    moduleTitle?: string;
    assessmentId?: string;
    required: string;
    reached: string | null;
  }[];
  /** Questions below the level of the outcome they are mapped to. */
  questionsBelowFloor: number;
  totalQuestions: number;
}

/**
 * Audit a whole programme's formative assessments against the outcomes they claim to assess.
 *
 * Step 3 has computed a Bloom distribution for its outcomes since it was written; Step 7
 * computed nothing, so the only way to discover that assessments sat below their outcomes was
 * to read the exported document and check them by hand — which is how the author found it.
 */
export function auditProgrammeBloom(formatives: any[], modules: any[]): BloomReport {
  const byId = new Map<string, any>(modules.map((m: any) => [String(m?.id), m]));
  const distribution: Record<string, number> = Object.fromEntries(
    BLOOM_ORDER.map((level) => [level, 0])
  );
  const shortfalls: BloomReport['shortfalls'] = [];
  let questionsBelowFloor = 0;
  let totalQuestions = 0;

  for (const fa of formatives || []) {
    const module = byId.get(String(fa?.moduleId));
    if (!module) continue;

    const audit = auditAssessmentBloom(fa, module);
    for (const q of fa?.questions || []) {
      totalQuestions += 1;
      const level = normaliseBloom(q?.bloomLevel);
      distribution[level] = (distribution[level] || 0) + 1;
    }
    questionsBelowFloor += audit.belowFloor.length;

    if (!audit.meetsFloor && audit.required) {
      shortfalls.push({
        moduleId: String(fa?.moduleId),
        moduleTitle: module?.title,
        assessmentId: fa?.id,
        required: audit.required,
        reached: audit.reached,
      });
    }
  }

  return {
    floorMet: shortfalls.length === 0 && questionsBelowFloor === 0,
    distribution,
    shortfalls,
    questionsBelowFloor,
    totalQuestions,
  };
}

/** The question types the LMS and the exporter know how to render. */
const QUESTION_TYPES = [
  'mcq',
  'short_answer',
  'scenario',
  'calculation',
  'practical',
  'file_upload',
] as const;

/**
 * Fold a question type onto the fixed set.
 *
 * Left free, the model produced nineteen distinct values on one programme, including four
 * spellings of short answer ("short_answer", "shortAnswer", "short answer", "short-answer")
 * and two of file upload — so anything keying on the type, the auto-grader included, saw
 * four different question types where there was one.
 */
export function normaliseQuestionType(value: string | undefined): string {
  const key = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if ((QUESTION_TYPES as readonly string[]).includes(key)) return key;
  if (key.includes('mcq') || key.includes('multiple_choice')) return 'mcq';
  if (key.includes('short') || key.includes('written')) return 'short_answer';
  if (key.includes('calc') || key.includes('numeric')) return 'calculation';
  if (key.includes('upload') || key.includes('file') || key.includes('submission'))
    return 'file_upload';
  if (
    key.includes('design') ||
    key.includes('creat') ||
    key.includes('build') ||
    key.includes('model') ||
    key.includes('structured') ||
    key.includes('task')
  )
    return 'practical';
  if (key) return 'scenario';
  return 'short_answer';
}

/**
 * Words that turn "produce the artefact" into "write about the artefact".
 *
 * The artefact check matched the artefact's name anywhere in the brief, so "Dashboard
 * wireframe description" satisfied an outcome reading "create interactive KPI dashboards".
 * Eleven of 43 create-aligned assessments passed that way.
 */
const DESCRIPTION_HEDGES = [
  /\bdescribe\b/,
  /\bdescription\b/,
  /\boutlines?\b/,
  /\bwireframes?\b/,
  /\bsketch(es|ed)?\b/,
  /\bmock-?ups?\b/,
  /\bnotes on\b/,
  /\bexplain how you would\b/,
  /\bsummary of what\b/,
  /\bwhat (it|the .{1,30}) would (contain|include|look like)\b/,
];

/**
 * True when a fragment only describes the artefact rather than handing it in.
 *
 * Matched on whole words: the deliverable that started this was "Dashboard wireframe
 * description", but the task beside it read "Outline an accessible interactive KPI
 * dashboard", and a substring list looking for "outline of" or "outline the" caught neither
 * the second nor, therefore, the assessment.
 */
export function isDescriptionOnly(deliverable: string): boolean {
  const text = String(deliverable || '').toLowerCase();
  return DESCRIPTION_HEDGES.some((hedge) => hedge.test(text));
}
