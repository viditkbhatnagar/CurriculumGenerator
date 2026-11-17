/**
 * The case-study and formative-check slides of a Step 11 deck, built in code from the lesson.
 *
 * Logan Pacey's email of 17 November 2026 on the Diploma in Logistics pilot (workflow
 * 6af5a0a3b706bd9a5b7af54a) found that none of the 61 decks held a case-study or a formative
 * slide, although the page promised both. Step 10 gave every lesson formative checks, and eight
 * lessons a case study; the model that writes the slides was never asked for either and its
 * slide types could not express them. They are now added after the model's slides, before the
 * summary, from what the lesson already holds, so they cannot be left out or invented:
 * - a lesson with a case gets a scenario slide and a decision-points slide, taken from the Step
 *   8 case it points to (by id, then by title) or from the facts stored on the lesson;
 * - every lesson gets one formative-check slide, with the answer and explanation in the notes.
 *
 * Pure functions only. The one import is the sibling rules module, itself import-free.
 */
import { SUMMARY_TITLE, normaliseMloId } from './deckRules';

export interface RequiredSlide {
  slideNumber: number;
  slideType: string;
  title: string;
  content: Record<string, any>;
  speakerNotes: string;
}

const MAX_BULLET = 240;
const MAX_TITLE = 60;
const EXCERPT_CHARS = 600;
const MAX_BULLETS = 5;

const clip = (text: unknown, max: number): string => {
  const s = String(text ?? '').trim();
  return s.length > max ? `${s.slice(0, max - 3).trimEnd()}...` : s;
};

/** The Step 8 case a lesson's case activity points to: by id, then by title. */
export function caseFor(lesson: any, caseStudies: any[] = []): any | undefined {
  const activity = lesson?.caseStudyActivity;
  if (!activity) return undefined;
  const id = activity.caseStudyId;
  const title = String(activity.caseTitle || activity.title || '')
    .trim()
    .toLowerCase();
  return (
    (id && caseStudies.find((c) => c?.id === id)) ||
    (title &&
      caseStudies.find(
        (c) =>
          String(c?.title || '')
            .trim()
            .toLowerCase() === title
      )) ||
    undefined
  );
}

/** The opening of a scenario as bullets: whole sentences, about EXCERPT_CHARS in all. */
export function scenarioExcerpt(scenario: string): string[] {
  const sentences = String(scenario || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
  const out: string[] = [];
  let used = 0;
  for (const s of sentences) {
    if (out.length >= MAX_BULLETS || (out.length && used + s.length > EXCERPT_CHARS)) break;
    out.push(clip(s, MAX_BULLET));
    used += s.length;
  }
  return out;
}

const tagsFor = (lesson: any, ids: unknown[] = []): string[] => {
  const linked = new Set((lesson?.linkedMLOs || []).map(normaliseMloId));
  return ids.filter((id) => linked.has(normaliseMloId(id))).map(String);
};

/** Zero, one or two slides for the lesson's case; none when the lesson has no usable case. */
export function caseSlides(lesson: any, caseStudy?: any): RequiredSlide[] {
  const activity = lesson?.caseStudyActivity;
  const title = activity?.caseTitle || activity?.title || caseStudy?.title;
  if (!activity || !title) return [];

  const hooks = activity.assessmentHooks || caseStudy?.hooks || {};
  const scenario = scenarioExcerpt(caseStudy?.scenario);
  const facts: string[] = (hooks.keyFacts || [])
    .filter(Boolean)
    .slice(0, MAX_BULLETS)
    .map((f: string) => clip(f, MAX_BULLET));
  const decisions: string[] = (hooks.decisionPoints || [])
    .filter(Boolean)
    .slice(0, MAX_BULLETS)
    .map((d: string) => clip(d, MAX_BULLET));
  const who = [caseStudy?.organizationName, caseStudy?.industryContext].filter(Boolean).join(', ');
  const opening = scenario.length ? scenario : facts;
  const mlos = tagsFor(lesson, activity.linkedMLOs || caseStudy?.mloIds || []);
  const misconceptions: string[] = hooks.misconceptions || [];
  const outputs: string[] = activity.studentOutputExpectations || [];

  const build = (heading: string, bullets: string[], notes: string): RequiredSlide => ({
    slideNumber: 0,
    slideType: 'case_study',
    title: clip(heading, MAX_TITLE),
    content: {
      type: 'bullets',
      title: clip(heading, MAX_TITLE),
      content: bullets,
      notes,
      ...(mlos.length ? { mlos } : {}),
    },
    speakerNotes: notes,
  });

  const slides: RequiredSlide[] = [];
  if (opening.length) {
    slides.push(
      build(
        `Case: ${title}`,
        who ? [`Organisation: ${clip(who, 160)}`, ...opening] : opening,
        [
          activity.learningPurpose ? `Purpose: ${activity.learningPurpose}` : '',
          activity.instructorInstructions ? `Instructions: ${activity.instructorInstructions}` : '',
          misconceptions.length ? `Common misconceptions: ${misconceptions.join('; ')}` : '',
        ]
          .filter(Boolean)
          .join('\n') || `Introduce the case "${title}" before students take the decisions.`
      )
    );
  }
  if (decisions.length) {
    slides.push(
      build(
        `Decisions in the case: ${title}`,
        decisions,
        outputs.length
          ? `Students should produce: ${outputs.join('; ')}`
          : 'Give students time to take each decision and justify it from the case facts.'
      )
    );
  }
  return slides;
}

const OPTION_LABELS = 'ABCDEFGH';
const FORMATIVE_TITLES: Record<string, string> = {
  mcq: 'Knowledge check',
  quick_poll: 'Quick poll',
  discussion_question: 'Discussion question',
  reflection: 'Reflection',
};

/** The check to show: the first multiple-choice question that has options, else the first with a question. */
export function chooseFormativeCheck(lesson: any): any | undefined {
  const checks: any[] = (lesson?.formativeChecks || []).filter((c: any) => c?.question);
  return (
    checks.find((c) => c.type === 'mcq' && Array.isArray(c.options) && c.options.length >= 2) ||
    checks[0]
  );
}

/** One formative-check slide for the lesson, or nothing when it holds no check. */
export function formativeSlide(lesson: any, formatives: any[] = []): RequiredSlide | undefined {
  const check = chooseFormativeCheck(lesson);
  if (!check) return undefined;
  const heading = FORMATIVE_TITLES[check.type] || 'Knowledge check';
  const options: string[] = Array.isArray(check.options) ? check.options : [];
  const linked = normaliseMloId(check.linkedMLO);
  const step7 = formatives
    .filter((f) => (f?.alignedMLOs || []).some((m: string) => normaliseMloId(m) === linked))
    .slice(0, 2)
    .map((f) => `${f.title}${f.assessmentType ? ` (${f.assessmentType})` : ''}`);
  const notes = [
    check.correctAnswer ? `Answer: ${check.correctAnswer}` : '',
    check.explanation ? `Explanation: ${check.explanation}` : '',
    step7.length ? `Prepares students for the Step 7 formative: ${step7.join('; ')}` : '',
    check.duration ? `Allow about ${check.duration} minutes.` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const mlos = tagsFor(lesson, [check.linkedMLO]);
  return {
    slideNumber: 0,
    slideType: 'formative_check',
    title: heading,
    content: {
      type: 'bullets',
      title: heading,
      content: [
        clip(check.question, 400),
        ...options.map((o, i) => `${OPTION_LABELS[i] || i + 1}. ${clip(o, MAX_BULLET)}`),
      ],
      notes,
      ...(mlos.length ? { mlos } : {}),
    },
    speakerNotes: notes,
  };
}

/**
 * The deck with its case and formative slides added before the closing summary (at the end when
 * the deck has no summary), and the slides numbered again. A deck that already holds a slide of
 * either kind keeps what it has.
 */
export function withRequiredSlides<T extends { slideType: string; title?: string; content?: any }>(
  slides: T[],
  lesson: any,
  sources: { caseStudies?: any[]; formativeAssessments?: any[] } = {}
): any[] {
  const has = (type: string) => slides.some((s) => s.slideType === type);
  const added: RequiredSlide[] = [
    ...(has('case_study') ? [] : caseSlides(lesson, caseFor(lesson, sources.caseStudies))),
    ...(has('formative_check') ? [] : [formativeSlide(lesson, sources.formativeAssessments)]),
  ].filter((s): s is RequiredSlide => !!s);
  if (!added.length) return slides;

  const last = slides[slides.length - 1];
  const closes = !!last && SUMMARY_TITLE.test(String(last.content?.title || last.title || ''));
  const merged: any[] = closes ? [...slides.slice(0, -1), ...added, last] : [...slides, ...added];
  return merged.map((s, i) => ({ ...s, slideNumber: i + 1 }));
}

/**
 * What the deck writer needs from the rest of the workflow: the Step 4 outcome statements by
 * outcome id (for the coverage fallback), the Step 8 cases and the Step 7 formative assessments.
 */
export function deckSourcesFromWorkflow(workflow: any): {
  mloStatements: Record<string, string>;
  caseStudies: any[];
  formativeAssessments: any[];
} {
  const mloStatements: Record<string, string> = {};
  for (const module of workflow?.step4?.modules || []) {
    for (const mlo of module?.mlos || []) {
      if (mlo?.id && mlo?.statement) mloStatements[String(mlo.id)] = String(mlo.statement);
    }
  }
  return {
    mloStatements,
    caseStudies: workflow?.step8?.caseStudies || [],
    formativeAssessments: workflow?.step7?.formativeAssessments || [],
  };
}
