/**
 * A session of the faculty delivery guide, condensed for a lecturer to scan.
 *
 * Dr. Sherin Thomas, 2 October 2026: keep the nine-part structure, but make it "bullet-point
 * based and highly scannable"; add a short check per session; give each key concept a short
 * definition and a business example, drafted by AI from the lesson's own text and checked
 * against it. A session of the M01 guide ran to about 2,600 words.
 *
 * The model is given the session exactly as the guide already sets it out (GuideSession), not
 * the raw lesson, and asked to shorten it without adding facts. Each item it returns is then
 * checked against that text: an item whose words are mostly not in the session is flagged
 * for the lecturer to check, not silently printed as if it came from the lesson.
 *
 * Pure: the model call and the storage are in condenseRunner.
 */
import type { GuideSession } from './facultyGuideModel';

/** Bump when the prompt or the shape changes: lessons condensed under an older version redo. */
export const CONDENSED_GUIDE_VERSION = 1;

export interface Flagged<T> {
  value: T;
  /** Most of its words are not in the lesson's text: check it before teaching. */
  check?: boolean;
}

export interface CondensedConcept {
  name: string;
  definition: string;
  example: string;
  check?: boolean;
}

export interface CondensedActivity {
  title: string;
  minutes?: number;
  lecturer: string;
  students: string;
}

export interface CondensedSession {
  version: number;
  mustTeach: Flagged<string>[];
  guidance: Flagged<string>[];
  keyConcepts: CondensedConcept[];
  /** One per activity of the session, in the same order; empty when the model's did not line up. */
  activities: CondensedActivity[];
  prompts: Flagged<string>[];
  quickCheck: { question: string; answer: string; check?: boolean }[];
  prepare: Flagged<string>[];
  takeaways: Flagged<string>[];
}

export const LIMITS = {
  mustTeach: 5,
  guidance: 5,
  keyConcepts: 6,
  prompts: 4,
  quickCheck: 3,
  prepare: 3,
  takeaways: 4,
} as const;

export const SYSTEM_PROMPT = `You condense one session of a university lesson plan into a faculty delivery guide that a lecturer can scan in under a minute.

Rules:
- Use only the content of the session you are given. Do not add facts, figures, names, organisations, sources or claims that are not in it.
- Write short bullet points: no more than 20 words each, plain British English, no full stops at the end of bullets.
- Keep the lecturer's perspective: what to teach, how to run it, how to check learning.
- Key concepts: for each, a definition of at most two sentences and one short business example. Take the example from the session's own case, activities or examples wherever it has one.
- Quick check: two or three short questions a lecturer can ask at the end of the session, each with a one-sentence model answer, answerable from this session's content.
- Activities: exactly one entry per activity you are given, in the same order, with what the lecturer does and what students do.

Return JSON only, in exactly this shape:
{"mustTeach":[""],"guidance":[""],"keyConcepts":[{"name":"","definition":"","example":""}],"activities":[{"title":"","lecturer":"","students":""}],"prompts":[""],"quickCheck":[{"question":"","answer":""}],"prepare":[""],"takeaways":[""]}`;

/** The session as the model sees it: the guide's own content, without layout. */
export function sessionForPrompt(s: GuideSession): Record<string, unknown> {
  return {
    topic: s.topic,
    minutes: s.durationMinutes,
    keyConcepts: s.focus.keyConcepts,
    outcomes: s.focus.whyItMatters,
    teachingGuidance: s.teachingGuidance,
    pacing: s.pacing,
    glossary: s.keyConcepts.filter((k) => k.definition),
    practicalActivity: s.practicalActivity,
    activities: s.activities.map((a) => ({
      title:
        a.label && !a.title.toLowerCase().startsWith(a.label.toLowerCase())
          ? `${a.label}: ${a.title}`
          : a.title,
      minutes: a.minutes,
      description: a.description,
      method: a.teachingMethod,
      lecturer: a.steps,
      students: a.studentActions,
    })),
    caseActivity: s.caseActivity
      ? {
          title: s.caseActivity.title,
          purpose: s.caseActivity.purpose,
          instructions: s.caseActivity.instructions,
        }
      : undefined,
    discussionPrompts: s.prompts.ask,
    misconceptions: s.prompts.watchFor,
    checks: s.checks.map((c) => ({ question: c.question, answer: c.correctAnswer })),
    readings: s.resources.readings,
    materials: s.resources.materials,
    preparation: s.resources.studentPreparation,
    takeaways: s.takeaways,
  };
}

export function userPrompt(s: GuideSession): string {
  return `Condense this session.\n\n${JSON.stringify(sessionForPrompt(s))}`;
}

const STOP = new Set(
  'a an the and or but of to in on at for with by from as is are be this that these those it its their they them we you your can will should into than then so such use using how what which who when where why each per not no more most also'.split(
    ' '
  )
);
const words = (t: string) =>
  (t.toLowerCase().match(/[a-z0-9]+/g) ?? ([] as string[])).filter(
    (w: string) => w.length > 2 && !STOP.has(w)
  );

/** Every word the session's own text contains, to check the model's items against. */
export function sessionVocabulary(s: GuideSession): Set<string> {
  return new Set(words(JSON.stringify(sessionForPrompt(s))));
}

/** The share of an item's words that the session's text contains, 0..1. */
export function support(text: string, vocabulary: Set<string>): number {
  const own = words(text);
  if (!own.length) return 1;
  return own.filter((w) => vocabulary.has(w)).length / own.length;
}

/**
 * Condensing reuses the lesson's words, so most of an item's words should be in it. Below
 * this share an item is flagged. Definitions, examples and quick checks are new writing by
 * design, so they are held to a lower share.
 */
export const SUPPORT_FLOOR = 0.6;
export const DRAFTED_SUPPORT_FLOOR = 0.4;

const text = (v: unknown, max = 400) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const list = (v: unknown, n: number) =>
  (Array.isArray(v) ? v : [])
    .map((x) => text(x))
    .filter(Boolean)
    .slice(0, n);

/**
 * The model's answer, checked and clipped to the shape and limits above, with each item
 * flagged when the session's text does not support it. Returns null when the answer is not
 * usable at all, so the guide falls back to the full session.
 */
export function parseCondensed(raw: string, s: GuideSession): CondensedSession | null {
  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const vocabulary = sessionVocabulary(s);
  const flagged = (items: string[], floor = SUPPORT_FLOOR): Flagged<string>[] =>
    items.map((value) => (support(value, vocabulary) < floor ? { value, check: true } : { value }));

  const concepts: CondensedConcept[] = (Array.isArray(data.keyConcepts) ? data.keyConcepts : [])
    .map((c: any) => ({
      name: text(c?.name, 120),
      definition: text(c?.definition),
      example: text(c?.example),
    }))
    .filter((c: CondensedConcept) => c.name && c.definition)
    .slice(0, LIMITS.keyConcepts)
    .map((c: CondensedConcept) =>
      support(`${c.definition} ${c.example}`, vocabulary) < DRAFTED_SUPPORT_FLOOR
        ? { ...c, check: true }
        : c
    );

  const rawActivities = Array.isArray(data.activities) ? data.activities : [];
  // An activity list that does not line up with the session's cannot be matched to it.
  const activities: CondensedActivity[] =
    rawActivities.length === s.activities.length
      ? rawActivities.map((a: any, i: number) => ({
          title: text(a?.title, 160) || s.activities[i].title,
          minutes: s.activities[i].minutes,
          lecturer: text(a?.lecturer, 300),
          students: text(a?.students, 300),
        }))
      : [];

  const quickCheck = (Array.isArray(data.quickCheck) ? data.quickCheck : [])
    .map((q: any) => ({ question: text(q?.question, 300), answer: text(q?.answer, 400) }))
    .filter((q: { question: string; answer: string }) => q.question && q.answer)
    .slice(0, LIMITS.quickCheck)
    .map((q: { question: string; answer: string }) =>
      support(`${q.question} ${q.answer}`, vocabulary) < DRAFTED_SUPPORT_FLOOR
        ? { ...q, check: true }
        : q
    );

  const result: CondensedSession = {
    version: CONDENSED_GUIDE_VERSION,
    mustTeach: flagged(list(data.mustTeach, LIMITS.mustTeach)),
    guidance: flagged(list(data.guidance, LIMITS.guidance)),
    keyConcepts: concepts,
    activities,
    prompts: flagged(list(data.prompts, LIMITS.prompts)),
    quickCheck,
    prepare: flagged(list(data.prepare, LIMITS.prepare)),
    takeaways: flagged(list(data.takeaways, LIMITS.takeaways)),
  };
  // Nothing to teach from means the answer was not usable.
  return result.mustTeach.length ? result : null;
}

/** A stored condensed session, if it is current; anything else is treated as absent. */
export function storedCondensed(value: unknown): CondensedSession | undefined {
  const v = value as CondensedSession | undefined;
  return v && v.version === CONDENSED_GUIDE_VERSION && Array.isArray(v.mustTeach) ? v : undefined;
}
