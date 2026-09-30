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
 * Pure functions only, so the mapping can be tested.
 */

export interface GuideContext {
  /** MLO id -> statement, from the Step 4 module. */
  mloStatements: Record<string, string>;
  /** Lower-cased glossary term -> definition, from Step 9. */
  glossary: Record<string, string>;
  /** Case study id -> title, from Step 8. */
  caseTitles: Record<string, string>;
}

export interface GuideActivity {
  label: string;
  minutes?: number;
  title: string;
  /** What the lecturer does, from the activity's instructor actions. */
  steps: string[];
  /** The activity description, kept only when it has no instructor actions to show instead. */
  detail?: string;
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
  keyConcepts: { name: string; definition?: string }[];
  activities: GuideActivity[];
  prompts: { ask: string[]; watchFor: string[] };
  checks: string[];
  resources: {
    readings: string[];
    cases: string[];
    materials: string[];
    adaptations: string[];
    studentPreparation?: string;
    aiUse?: string;
  };
  takeaways: string[];
}

export interface GuideModule {
  code: string;
  title: string;
  contactHours?: number;
  minimumRequirements: string[];
  sessions: GuideSession[];
}

const ACTIVITY_LABELS: Record<string, string> = {
  mini_lecture: 'Mini-lecture',
  demonstration: 'Demonstration',
  discussion: 'Discussion',
  practice: 'Practice',
  role_play: 'Role play',
  case_analysis: 'Case analysis',
  group_work: 'Group work',
  assessment: 'Check',
  ai_activity: 'AI activity',
  break: 'Break',
};

const CHECK_LABELS: Record<string, string> = {
  mcq: 'Quiz',
  quick_poll: 'Poll',
  discussion_question: 'Discussion question',
  reflection: 'Reflection',
};

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()) : [];

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

/** Split a guidance paragraph into its sentences, one bullet each. */
export function sentences(text: unknown): string[] {
  const t = str(text);
  if (!t) return [];
  return t
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function activityLabel(type: unknown, index: number, total: number): string {
  if (index === 0) return 'Opening';
  if (index === total - 1 && total > 1) return 'Wrap-up';
  return ACTIVITY_LABELS[String(type)] || 'Activity';
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items.map((s) => s.trim()).filter(Boolean)));
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
  const coreReadings: any[] = lesson?.independentStudy?.coreReadings || [];
  const readingRefs: any[] = lesson?.materials?.readingReferences || [];
  const citations = unique(
    [...coreReadings, ...readingRefs].map((r) => str(r?.citation)).filter((c): c is string => !!c)
  );

  return {
    number: lesson?.lessonNumber ?? index + 1,
    topic,
    durationMinutes: typeof lesson?.duration === 'number' ? lesson.duration : undefined,
    focus: {
      keyConcepts: subtopics,
      whyItMatters: linkedMLOs
        .map((id) => (context.mloStatements[id] ? `${id}: ${context.mloStatements[id]}` : ''))
        .filter(Boolean),
      connectionToPrevious: previousTopic
        ? `Builds on the previous session: ${previousTopic}`
        : undefined,
    },
    alignment: {
      mlos: linkedMLOs,
      plos: strings(lesson?.linkedPLOs),
      assessment: unique(
        (lesson?.formativeChecks || [])
          .map((c: any) => (str(c?.type) ? CHECK_LABELS[c.type] || c.type : ''))
          .filter(Boolean)
      ),
      reference: citations[0],
    },
    // The framing only: what to teach and at what depth. The step-by-step instructor actions
    // sit under their activity in section 5; putting both here made one section 35 bullets.
    teachingGuidance: sentences(notes.pedagogicalGuidance),
    keyConcepts: subtopics.map((name) => {
      const definition = context.glossary[name.toLowerCase()];
      return definition ? { name, definition } : { name };
    }),
    activities: activitiesRaw.map((a, i) => {
      const steps = strings(a?.instructorActions);
      return {
        label: activityLabel(a?.type, i, activitiesRaw.length),
        minutes: typeof a?.duration === 'number' ? a.duration : undefined,
        title: str(a?.title) || ACTIVITY_LABELS[String(a?.type)] || 'Activity',
        steps,
        detail: steps.length ? undefined : str(a?.description),
      };
    }),
    prompts: {
      ask: strings(notes.discussionPrompts),
      watchFor: strings(notes.commonMisconceptions),
    },
    checks: [
      ...(lesson?.formativeChecks || [])
        .map((c: any) => {
          const q = str(c?.question);
          if (!q) return '';
          const label = CHECK_LABELS[String(c?.type)] || 'Check';
          return `${label}: ${q}`;
        })
        .filter(Boolean),
      ...(str(lesson?.topicCoverage?.studentEvidence)
        ? [`Evidence of learning: ${lesson.topicCoverage.studentEvidence.trim()}`]
        : []),
    ],
    resources: {
      readings: citations,
      cases: strings(lesson?.materials?.caseFiles).map((id) => context.caseTitles[id] || id),
      materials: unique(activitiesRaw.flatMap((a) => strings(a?.resources))),
      adaptations: strings(notes.adaptationOptions),
      studentPreparation: str(lesson?.independentActivity?.independentTask),
      aiUse: str(lesson?.independentActivity?.aiPlatformSupport),
    },
    takeaways: strings(lesson?.objectives),
  };
}

export function guideModule(
  module: {
    code?: string;
    title?: string;
    contactHours?: number;
    mlos?: { id?: string; statement?: string }[];
  },
  lessons: any[],
  context: GuideContext
): GuideModule {
  const ordered = [...(lessons || [])].sort(
    (a, b) => (a?.lessonNumber ?? 0) - (b?.lessonNumber ?? 0)
  );
  const sessions: GuideSession[] = [];
  ordered.forEach((lesson, i) => {
    sessions.push(guideSession(lesson, i, context, i > 0 ? sessions[i - 1].topic : undefined));
  });
  return {
    code: module.code || '',
    title: module.title || '',
    contactHours: module.contactHours,
    minimumRequirements: (module.mlos || [])
      .filter((m) => m?.id && m?.statement)
      .map((m) => `${m.id}: ${m.statement}`),
    sessions,
  };
}

/** The lookups a module's guide needs, taken from the workflow's own steps. */
export function guideContextFromWorkflow(workflow: any, step4Module: any): GuideContext {
  const mloStatements: Record<string, string> = {};
  for (const m of step4Module?.mlos || []) {
    if (m?.id && typeof m.statement === 'string') mloStatements[m.id] = m.statement;
  }
  const glossary: Record<string, string> = {};
  for (const t of workflow?.step9?.terms || []) {
    if (typeof t?.term === 'string' && typeof t?.definition === 'string') {
      glossary[t.term.trim().toLowerCase()] = t.definition.trim();
    }
  }
  const caseTitles: Record<string, string> = {};
  for (const c of workflow?.step8?.caseStudies || []) {
    if (c?.id && typeof c.title === 'string') caseTitles[c.id] = c.title;
  }
  return { mloStatements, glossary, caseTitles };
}
