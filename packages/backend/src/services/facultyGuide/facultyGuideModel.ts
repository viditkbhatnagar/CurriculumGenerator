/**
 * The faculty delivery guide: a module's lesson plans reorganised for the lecturer who has to
 * teach them.
 *
 * The SME for the 46-module BBA accepted the Step 10 content but found the files read like
 * academic lesson-plan documents: dense paragraphs and tables a lecturer cannot scan while
 * preparing a session. The request (29 Sep 2026) was to keep every piece of substance and
 * present it as short bullets under nine headings per session, with the alignment kept to a
 * few lines rather than Bloom/EQF/PLO tables.
 *
 * Everything here is taken from fields the lesson already stores; nothing is generated. A
 * section with nothing behind it is left empty rather than filled with invented text.
 *
 * "Every piece of substance" is held to by test rather than by care. The first version read
 * only some of a lesson's fields and quietly lost the rest: quiz options and answers, the
 * case-study activity, pacing notes, the practical activity, supplementary reading. The
 * coverage test in facultyGuideModel.test.ts fills in every stored field and requires each one
 * to reach the Word document, or to be named there with the reason it is left out.
 *
 * Pure functions only, so the mapping can be tested.
 */

/**
 * Lookups the guide needs, taken from the workflow's own steps.
 *
 * Maps rather than plain objects: every key here is text from the data (a glossary term, a case
 * id), and a plain object answers a term called "constructor" with `Object` itself, which then
 * reaches the Word writer as a function.
 */
export interface GuideContext {
  /** MLO id -> statement, from the Step 4 module. */
  mloStatements: ReadonlyMap<string, string>;
  /** Lower-cased glossary term -> definition, from Step 9. */
  glossary: ReadonlyMap<string, string>;
  /** Case study id -> title, from Step 8. */
  caseTitles: ReadonlyMap<string, string>;
  /**
   * Formative assessment id -> its full task, from Step 7. A lesson's check stores only the
   * assessment's title and id (`checkId`); the questions, model answers and criteria are here.
   */
  formatives?: ReadonlyMap<string, GuideFormativeTask>;
}

export interface GuideFormativeQuestion {
  number: number;
  text: string;
  type?: string;
  options: string[];
  answer?: string;
  rationale?: string;
}

/** A Step 7 formative assessment as the guide's appendix sets it out. */
export interface GuideFormativeTask {
  id: string;
  title: string;
  type?: string;
  purpose?: string;
  instructions: string[];
  questions: GuideFormativeQuestion[];
  criteria: string[];
  feedbackGuidance?: string;
  selfCheck: string[];
}

export interface GuideFormative extends GuideFormativeTask {
  /** "F1", "F2"...: numbered in the order the module's sessions first use them. */
  ref: string;
}

export interface GuideActivity {
  label: string;
  minutes?: number;
  title: string;
  /** The activity's own description, kept beside the steps rather than instead of them. */
  description?: string;
  teachingMethod?: string;
  /** Students use a generative AI tool, in an activity whose label does not already say so. */
  usesAI: boolean;
  /** What the lecturer does, from the activity's instructor actions. */
  steps: string[];
  /** What students do, from the activity's student actions. */
  studentActions: string[];
}

export interface GuideCheck {
  /** The kind of check, from its stored type and whether it has options to choose between. */
  label: string;
  /** The Step 7 formative assessment this check is, when it names one. */
  formativeId?: string;
  /** Its number in the module's appendix, set once the module is assembled. */
  ref?: string;
  question?: string;
  minutes?: number;
  /** The module outcome the check tests. */
  mlo?: string;
  options: string[];
  correctAnswer?: string;
  explanation?: string;
}

export interface GuideCharacter {
  name: string;
  role?: string;
  background?: string;
  objectives: string[];
}

export interface GuideRolePlay {
  characters: GuideCharacter[];
  decisionPrompts: string[];
  debriefQuestions: string[];
}

export interface GuideCaseActivity {
  title: string;
  kind?: string;
  minutes?: number;
  /** The time as stored when it is text, e.g. "Preparation 20–30 minutes; class 60–75 minutes". */
  time?: string;
  purpose?: string;
  instructions: string[];
  expectedOutputs: string[];
  hooks: { keyFacts: string[]; misconceptions: string[]; decisionPoints: string[] };
  rolePlay?: GuideRolePlay;
}

export interface GuideSession {
  number: number;
  topic: string;
  durationMinutes?: number;
  focus: {
    keyConcepts: string[];
    whyItMatters: string[];
    connectionToPrevious?: string;
  };
  alignment: { mlos: string[]; plos: string[]; assessment: string[]; reference?: string };
  teachingGuidance: string[];
  pacing: string[];
  keyConcepts: { name: string; definition?: string }[];
  practicalActivity?: string;
  activities: GuideActivity[];
  caseActivity?: GuideCaseActivity;
  prompts: { ask: string[]; watchFor: string[] };
  checks: GuideCheck[];
  evidenceOfLearning?: string;
  resources: {
    readings: string[];
    supplementaryReadings: string[];
    independentStudyMinutes?: number;
    cases: string[];
    materials: string[];
    adaptations: string[];
    studentPreparation?: string;
    sourceMapping?: string;
    studentEvidence?: string;
    aiUse?: string;
  };
  takeaways: string[];
}

export interface GuideModule {
  code: string;
  title: string;
  contactHours?: number;
  minimumRequirements: string[];
  /**
   * The Step 7 formative assessments the sessions use, each set out once with its questions and
   * model answers. Repeating them under every session that uses them would bury the concise
   * session guidance the SME asked for; sessions refer to them by number instead.
   */
  formatives: GuideFormative[];
  /**
   * How many sessions the module is planned to hold. Set only when `sessions` holds fewer, so
   * its presence is what marks the guide as incomplete.
   */
  plannedSessions?: number;
  sessions: GuideSession[];
}

const AI_ACTIVITY_LABEL = 'AI activity';

const ACTIVITY_LABELS: ReadonlyMap<string, string> = new Map([
  ['mini_lecture', 'Mini-lecture'],
  ['demonstration', 'Demonstration'],
  ['discussion', 'Discussion'],
  ['practice', 'Practice'],
  ['role_play', 'Role play'],
  ['case_analysis', 'Case analysis'],
  ['group_work', 'Group work'],
  ['assessment', 'Check'],
  ['ai_activity', AI_ACTIVITY_LABEL],
  ['break', 'Break'],
]);

// `mcq` is absent on purpose: what it is called depends on the check. See `checkLabel`.
const CHECK_LABELS: ReadonlyMap<string, string> = new Map([
  ['quick_poll', 'Poll'],
  ['discussion_question', 'Discussion question'],
  ['reflection', 'Reflection'],
]);

const CASE_ACTIVITY_LABELS: ReadonlyMap<string, string> = new Map([
  ['practice', 'Practice'],
  ['discussion', 'Discussion'],
  ['assessment_ready', 'Assessment-ready'],
]);

/** What the lesson generator records for a check it could not link to any module outcome. */
const UNLINKED_MLO = 'unknown-mlo';

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()) : [];

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

const positive = (v: unknown): number | undefined =>
  typeof v === 'number' && v > 0 ? v : undefined;

/** "short_answer" -> "Short answer", for a stored type this guide has no wording for. */
function humanise(key: string): string {
  const words = key.replace(/[_-]+/g, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// A would-be sentence break: whitespace after a full stop, question or exclamation mark, before
// something that can open a sentence.
const SENTENCE_BREAK = /(?<=[.!?])\s+(?=[A-Z0-9"“(])/g;

// Abbreviations whose full stop ends no sentence, whatever follows it. "etc." and "et al." can
// also end one; keeping a sentence joined to the next is the harmless way to get that wrong,
// where cutting "Dr." from "Patel" leaves two bullets that mean nothing alone.
const ABBREVIATION =
  /(?:^|[\s("“'‘])(?:approx|e\.g|i\.e|cf|vs|etc|dr|prof|mr|mrs|ms|figs?|et al)\.$/i;

// "No. 4" and "p. 12" are abbreviations only before a number. "Answer yes or no." is a sentence.
const NUMBER_ABBREVIATION = /(?:^|[\s("“'‘])(?:nos?|pp?)\.$/i;

/** Index pairs of every matched "(" and ")", so a break inside one can be ignored. */
function bracketedRanges(text: string): [number, number][] {
  const open: number[] = [];
  const ranges: [number, number][] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') open.push(i);
    else if (text[i] === ')' && open.length > 0) ranges.push([open.pop() as number, i]);
  }
  return ranges;
}

function endsOnAbbreviation(previous: string, next: string): boolean {
  return ABBREVIATION.test(previous) || (NUMBER_ABBREVIATION.test(previous) && /^\d/.test(next));
}

/**
 * Split a guidance paragraph into its sentences, one bullet each.
 *
 * A full stop is not a sentence end inside an abbreviation ("approx. 15 minutes", "Dr. Patel",
 * "Fig. 3") or inside brackets: the model writes prompts such as (e.g., 'What changes hands?
 * Who is Accountable?'), which would otherwise become three bullets and a fragment.
 */
export function sentences(text: unknown): string[] {
  const t = str(text);
  if (!t) return [];

  const bracketed = bracketedRanges(t);
  const pieces: string[] = [];
  let start = 0;
  for (const match of t.matchAll(SENTENCE_BREAK)) {
    const at = match.index as number;
    if (bracketed.some(([open, close]) => open < at && at < close)) continue;
    pieces.push(t.slice(start, at));
    start = at + match[0].length;
  }
  pieces.push(t.slice(start));

  const out: string[] = [];
  for (const piece of pieces.map((p) => p.trim()).filter(Boolean)) {
    const previous = out[out.length - 1];
    if (previous !== undefined && endsOnAbbreviation(previous, piece)) {
      out[out.length - 1] = `${previous} ${piece}`;
    } else {
      out.push(piece);
    }
  }
  return out;
}

function activityLabel(type: unknown, index: number, total: number): string {
  if (index === 0) return 'Opening';
  if (index === total - 1 && total > 1) return 'Wrap-up';
  return ACTIVITY_LABELS.get(String(type)) ?? 'Activity';
}

/**
 * What to call a check.
 *
 * The stored type cannot be trusted on its own for `mcq`. lessonPlanService maps every
 * assessment format it does not recognise (worksheet, simulation, micro-tasks) to `mcq`, so a
 * check titled "Manager-in-Action Worksheet" arrives typed as a quiz question, with no options.
 * Every check in the pilot guides read "Quiz: <task title>" for that reason. An `mcq` is called a
 * multiple-choice question only when it has options to choose between.
 */
function checkLabel(type: unknown, options: string[]): string {
  const stored = str(type)?.toLowerCase();
  if (!stored || stored === 'mcq') return options.length ? 'Multiple-choice question' : 'Check';
  return CHECK_LABELS.get(stored) ?? humanise(stored);
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items.map((s) => s.trim()).filter(Boolean)));
}

interface ReadingEntry {
  citation: string;
  /** The citation with the reading time and level the plan gives it, as printed. */
  line: string;
}

/**
 * One entry per distinct citation across the given reading lists.
 *
 * The same source usually sits in both the core readings and the materials list, one copy
 * carrying its reading time and the other its level, so the details are pooled rather than
 * taken from whichever list comes first.
 */
function readingEntries(...lists: unknown[]): ReadingEntry[] {
  const details = new Map<string, { minutes?: number; level?: string }>();
  for (const list of lists) {
    for (const reading of Array.isArray(list) ? list : []) {
      const citation = str(reading?.citation);
      if (!citation) continue;
      const held = details.get(citation);
      details.set(citation, {
        minutes: held?.minutes ?? positive(reading?.estimatedMinutes),
        level: held?.level ?? str(reading?.complexityLevel),
      });
    }
  }
  return Array.from(details, ([citation, d]) => {
    const detail = [d.minutes ? `${d.minutes} min` : '', d.level ?? ''].filter(Boolean).join(', ');
    return { citation, line: detail ? `${citation} (${detail})` : citation };
  });
}

/** Text compared ignoring case and a closing full stop. */
const loosely = (s: string): string => s.toLowerCase().replace(/[.\s]+$/, '');

function guideActivities(activities: any[]): GuideActivity[] {
  return activities.map((a, i) => {
    const title = str(a?.title) || ACTIVITY_LABELS.get(String(a?.type)) || 'Activity';
    const description = str(a?.description);
    const label = activityLabel(a?.type, i, activities.length);
    return {
      label,
      minutes: typeof a?.duration === 'number' ? a.duration : undefined,
      title,
      // A description that only repeats the title adds a line and no information.
      description: description && loosely(description) !== loosely(title) ? description : undefined,
      teachingMethod: str(a?.teachingMethod),
      usesAI: a?.involvesAI === true && label !== AI_ACTIVITY_LABEL,
      steps: strings(a?.instructorActions),
      studentActions: strings(a?.studentActions),
    };
  });
}

function guideChecks(raw: unknown): GuideCheck[] {
  return (Array.isArray(raw) ? raw : []).flatMap((c: any): GuideCheck[] => {
    const question = str(c?.question);
    const options = strings(c?.options);
    const correctAnswer = str(c?.correctAnswer);
    const explanation = str(c?.explanation);
    if (!question && !options.length && !correctAnswer && !explanation) return [];
    const mlo = str(c?.linkedMLO);
    return [
      {
        label: checkLabel(c?.type, options),
        formativeId: str(c?.checkId),
        question,
        minutes: positive(c?.duration),
        mlo: mlo && mlo !== UNLINKED_MLO ? mlo : undefined,
        options,
        correctAnswer,
        explanation,
      },
    ];
  });
}

function guideRolePlay(raw: any): GuideRolePlay | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const characters: GuideCharacter[] = (
    Array.isArray(raw.characterBriefs) ? raw.characterBriefs : []
  )
    .map((c: any) => ({
      name: str(c?.characterName),
      role: str(c?.role),
      background: str(c?.background),
      objectives: strings(c?.objectives),
    }))
    .filter((c: any) => c.name || c.role || c.background || c.objectives.length)
    .map((c: any) => ({ ...c, name: c.name || 'Character' }));
  const decisionPrompts = strings(raw.decisionPrompts);
  const debriefQuestions = strings(raw.debriefQuestions);
  if (!characters.length && !decisionPrompts.length && !debriefQuestions.length) return undefined;
  return { characters, decisionPrompts, debriefQuestions };
}

/**
 * The lesson's integrated case activity, which the first version never read: only the case's
 * id in `materials.caseFiles` reached the guide, as a bare title under Resources.
 */
function guideCaseActivity(raw: any, context: GuideContext): GuideCaseActivity | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const id = str(raw.caseStudyId);
  const title = str(raw.caseTitle) || (id ? (context.caseTitles.get(id) ?? id) : undefined);
  const purpose = str(raw.learningPurpose);
  const instructions = sentences(raw.instructorInstructions);
  // A block with no name, purpose or instructions has nothing a lecturer can act on.
  if (!title && !purpose && !instructions.length) return undefined;
  const hooks = raw.assessmentHooks || {};
  const type = str(raw.activityType)?.toLowerCase();
  return {
    title: title || 'Case study',
    kind: type ? (CASE_ACTIVITY_LABELS.get(type) ?? humanise(type)) : undefined,
    minutes: positive(raw.duration),
    // Step 8 stores its estimate as text and lesson generation passes it through, so a number
    // is not the only form a time comes in; the text was being dropped.
    time: typeof raw.duration === 'string' ? str(raw.duration) : undefined,
    purpose,
    instructions,
    expectedOutputs: strings(raw.studentOutputExpectations),
    hooks: {
      keyFacts: strings(hooks.keyFacts),
      misconceptions: strings(hooks.misconceptions),
      decisionPoints: strings(hooks.decisionPoints),
    },
    rolePlay: guideRolePlay(raw.rolePlay),
  };
}

function guideResources(
  lesson: any,
  activities: any[],
  readings: ReadingEntry[],
  context: GuideContext
): GuideSession['resources'] {
  const independent = lesson?.independentActivity || {};
  return {
    readings: readings.map((r) => r.line),
    supplementaryReadings: readingEntries(lesson?.independentStudy?.supplementaryReadings).map(
      (r) => r.line
    ),
    independentStudyMinutes: positive(lesson?.independentStudy?.estimatedEffort),
    // A case id can repeat in `caseFiles` (the case is appended again when its activity is
    // attached), and two ids can name one title, so the titles are de-duplicated.
    cases: unique(
      strings(lesson?.materials?.caseFiles).map((id) => context.caseTitles.get(id) ?? id)
    ),
    materials: unique(activities.flatMap((a) => strings(a?.resources))),
    adaptations: strings(lesson?.instructorNotes?.adaptationOptions),
    studentPreparation: str(independent.independentTask),
    sourceMapping: str(independent.sourceMaterialMapping),
    studentEvidence: str(independent.studentEvidence),
    aiUse: str(independent.aiPlatformSupport),
  };
}

export function guideSession(
  lesson: any,
  index: number,
  context: GuideContext,
  previousTopic?: string
): GuideSession {
  const topic =
    str(lesson?.topicCoverage?.exactTopic) || str(lesson?.lessonTitle) || `Session ${index + 1}`;
  const activitiesRaw: any[] = Array.isArray(lesson?.activities)
    ? [...lesson.activities].sort((a, b) => (a?.sequenceOrder ?? 0) - (b?.sequenceOrder ?? 0))
    : [];
  const notes = lesson?.instructorNotes || {};
  const linkedMLOs = strings(lesson?.linkedMLOs);
  const subtopics = strings(lesson?.topicCoverage?.subtopics);
  const readings = readingEntries(
    lesson?.independentStudy?.coreReadings,
    lesson?.materials?.readingReferences
  );
  const checks = guideChecks(lesson?.formativeChecks);

  return {
    number: lesson?.lessonNumber ?? index + 1,
    topic,
    durationMinutes: typeof lesson?.duration === 'number' ? lesson.duration : undefined,
    focus: {
      keyConcepts: subtopics,
      whyItMatters: linkedMLOs.flatMap((id) => {
        const statement = context.mloStatements.get(id);
        return statement ? [`${id}: ${statement}`] : [];
      }),
      connectionToPrevious: previousTopic
        ? `Builds on the previous session: ${previousTopic}`
        : undefined,
    },
    alignment: {
      mlos: linkedMLOs,
      plos: strings(lesson?.linkedPLOs),
      assessment: unique(checks.map((c) => c.label)),
      reference: readings[0]?.citation,
    },
    // The framing only: what to teach and at what depth. The step-by-step instructor actions
    // sit under their activity in section 5; putting both here made one section 35 bullets.
    teachingGuidance: sentences(notes.pedagogicalGuidance),
    pacing: sentences(notes.pacingSuggestions),
    keyConcepts: subtopics.map((name) => {
      const definition = context.glossary.get(name.trim().toLowerCase());
      return definition ? { name, definition } : { name };
    }),
    practicalActivity: str(lesson?.topicCoverage?.practicalActivity),
    activities: guideActivities(activitiesRaw),
    caseActivity: guideCaseActivity(lesson?.caseStudyActivity, context),
    prompts: {
      ask: strings(notes.discussionPrompts),
      watchFor: strings(notes.commonMisconceptions),
    },
    checks,
    evidenceOfLearning: str(lesson?.topicCoverage?.studentEvidence),
    resources: guideResources(lesson, activitiesRaw, readings, context),
    takeaways: strings(lesson?.objectives),
  };
}

/**
 * @param plannedSessions How many sessions the module is planned to hold, when the lessons
 *   supplied fall short of it. Ignored unless it exceeds the lessons held.
 */
export function guideModule(
  module: {
    code?: string;
    title?: string;
    contactHours?: number;
    mlos?: { id?: string; statement?: string }[];
  },
  lessons: any[],
  context: GuideContext,
  plannedSessions?: number
): GuideModule {
  const ordered = [...(lessons || [])].sort(
    (a, b) => (a?.lessonNumber ?? 0) - (b?.lessonNumber ?? 0)
  );
  const sessions: GuideSession[] = [];
  ordered.forEach((lesson, i) => {
    sessions.push(guideSession(lesson, i, context, i > 0 ? sessions[i - 1].topic : undefined));
  });
  // Number each formative the first time a session uses it, and point every use at that number.
  const formatives: GuideFormative[] = [];
  const refs = new Map<string, string>();
  for (const check of sessions.flatMap((s) => s.checks)) {
    const task = check.formativeId ? context.formatives?.get(check.formativeId) : undefined;
    if (!task) continue;
    if (!refs.has(task.id)) {
      const ref = `F${formatives.length + 1}`;
      refs.set(task.id, ref);
      formatives.push({ ...task, ref });
    }
    check.ref = refs.get(task.id);
  }
  return {
    code: module.code || '',
    title: module.title || '',
    contactHours: module.contactHours,
    minimumRequirements: (module.mlos || [])
      .filter((m) => m?.id && m?.statement)
      .map((m) => `${m.id}: ${m.statement}`),
    formatives,
    plannedSessions:
      plannedSessions && plannedSessions > sessions.length ? plannedSessions : undefined,
    sessions,
  };
}

/** Text the model wrote with line breaks and "- " bullets, as separate lines. */
function textLines(v: unknown): string[] {
  return (str(v) || '')
    .split(/\n+/)
    .map((line) => line.replace(/^\s*[-•]\s*/, '').trim())
    .filter(Boolean);
}

/** A stored Step 7 formative assessment, reduced to what the appendix prints. */
export function formativeTask(raw: any): GuideFormativeTask | undefined {
  const id = str(raw?.id);
  const title = str(raw?.title);
  if (!id || !title) return undefined;
  return {
    id,
    title,
    type: str(raw?.assessmentType),
    // `purpose` holds the category ("formative"), which the appendix heading already says; the
    // description is what tells a lecturer what the task is for.
    purpose: str(raw?.description) || str(raw?.purpose),
    instructions: textLines(raw?.instructions),
    questions: (Array.isArray(raw?.questions) ? raw.questions : [])
      .map(
        (q: any, i: number): GuideFormativeQuestion => ({
          number: typeof q?.questionNumber === 'number' ? q.questionNumber : i + 1,
          text: str(q?.questionText) || str(q?.question) || '',
          type: str(q?.questionType),
          options: strings(q?.options),
          answer: str(q?.correctAnswer),
          rationale: str(q?.rationale),
        })
      )
      .filter((q: GuideFormativeQuestion) => q.text),
    criteria: strings(raw?.assessmentCriteria),
    feedbackGuidance: str(raw?.feedbackGuidance),
    selfCheck: strings(raw?.selfCheckCriteria),
  };
}

/**
 * Says so when a guide covers only part of its module, and returns undefined when it covers all.
 *
 * The export is offered from the moment Step 10 starts, so a module can hold 7 of its 30
 * lessons. A guide that opened "Teach all 7 sessions below" presented that as the whole course.
 */
export function incompleteNote(guide: GuideModule): string | undefined {
  const { plannedSessions, sessions } = guide;
  if (!plannedSessions || sessions.length >= plannedSessions) return undefined;
  const verb = sessions.length === 1 ? 'is' : 'are';
  return `${sessions.length} of ${plannedSessions} planned sessions ${verb} generated; the rest are not yet available.`;
}

/** The lookups a module's guide needs, taken from the workflow's own steps. */
export function guideContextFromWorkflow(workflow: any, step4Module: any): GuideContext {
  const mloStatements = new Map<string, string>();
  for (const m of step4Module?.mlos || []) {
    if (m?.id && typeof m.statement === 'string') mloStatements.set(String(m.id), m.statement);
  }
  const glossary = new Map<string, string>();
  for (const t of workflow?.step9?.terms || []) {
    if (typeof t?.term === 'string' && typeof t?.definition === 'string') {
      glossary.set(t.term.trim().toLowerCase(), t.definition.trim());
    }
  }
  const caseTitles = new Map<string, string>();
  for (const c of workflow?.step8?.caseStudies || []) {
    const title = str(c?.title);
    if (c?.id && title) caseTitles.set(String(c.id), title);
  }
  const formatives = new Map<string, GuideFormativeTask>();
  for (const raw of workflow?.step7?.formativeAssessments || []) {
    const task = formativeTask(raw);
    if (task) formatives.set(task.id, task);
  }
  return { mloStatements, glossary, caseTitles, formatives };
}
