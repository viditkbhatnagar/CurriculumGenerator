/**
 * The rules a Step 11 slide deck is checked against: how many slides, and whether it teaches
 * every outcome the lesson is linked to.
 *
 * Logan Pacey's email of 17 November 2026 on the Diploma in Logistics pilot (workflow
 * 6af5a0a3b706bd9a5b7af54a) found that Step 11 reported checks that could not be passed or
 * that contradicted one another:
 * - four slide-count rules were in force at once: the prompt asked for 12-18 slides, each deck
 *   was flagged against 10-20, the step-level check used 8-15 (so 60 of the 61 pilot decks
 *   "failed"), and the page promised 15-35;
 * - the outcome check looked for a slide of type "objectives", which the model is never asked
 *   to write and the slide builder never produces, and it matched objective text, not the
 *   outcomes the lesson is linked to, so it could never pass.
 *
 * One pair of constants now serves every place, and outcome coverage is computed here, in code,
 * from the outcomes each slide is tagged with, falling back to the words of the outcome's
 * statement on the slide.
 *
 * Pure functions only, and no imports, so that a test can load it.
 */

/** Slides in a finished deck, the AI-written slides and the ones added in code together. */
export const DECK_MIN_SLIDES = 12;
export const DECK_MAX_SLIDES = 20;

/** Slides added in code after the model writes the deck: one formative check, up to two for a case. */
export const FORMATIVE_SLIDES_ADDED = 1;
export const CASE_SLIDES_ADDED_MAX = 2;

/** What the model is asked for, so that the finished deck lands inside DECK_MIN..DECK_MAX. */
export const MODEL_MIN_SLIDES = DECK_MIN_SLIDES - FORMATIVE_SLIDES_ADDED;
export const MODEL_MAX_SLIDES = DECK_MAX_SLIDES - FORMATIVE_SLIDES_ADDED - CASE_SLIDES_ADDED_MAX;

export const slideCountValid = (count: number): boolean =>
  Number.isFinite(count) && count >= DECK_MIN_SLIDES && count <= DECK_MAX_SLIDES;

export const SUMMARY_TITLE = /summary|takeaway|recap|wrap[- ]?up|key points|conclusion/i;

interface SlideLike {
  slideType?: string;
  title?: string;
  content?: any;
}

export interface MloCoverage {
  /** False when the lesson is linked to no outcome, so there is nothing to check against. */
  checked: boolean;
  covered: string[];
  missing: string[];
  /** Outcomes found through a slide's own tag, and through the words of the statement. */
  viaTags: string[];
  viaText: string[];
}

/** "M3-LO2", "m3 lo2" and "M3_LO2" are the same outcome. */
export const normaliseMloId = (id: unknown): string =>
  String(id ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

/** Words of an outcome statement that say what it is about, not how well. */
const NOT_SIGNIFICANT = new Set(
  (
    'which their there these those should would could about between within using under over ' +
    'across through while where when into from with that this than then also each other such ' +
    'learners learner students student module ability able explain describe analyse analyze ' +
    'evaluate apply demonstrate identify discuss compare create design assess critically ' +
    'understand outline appropriate effective effectively relevant key'
  ).split(' ')
);

/** Five-letter stems of the significant words, so "logistics" and "logistical" meet. */
export function significantStems(text: string): string[] {
  const stems = String(text || '')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length >= 5 && !NOT_SIGNIFICANT.has(w))
    .map((w) => w.slice(0, 5));
  return [...new Set(stems)];
}

/** What a student reads on a slide: every text in its content except the notes and tags. */
export function slideStudentText(slide: SlideLike): string {
  const parts: string[] = [String(slide?.title || '')];
  const walk = (value: unknown, key = ''): void => {
    if (key === 'notes' || key === 'mlos') return;
    if (typeof value === 'string') parts.push(value);
    else if (Array.isArray(value)) value.forEach((v) => walk(v));
    else if (value && typeof value === 'object') {
      Object.entries(value as Record<string, unknown>).forEach(([k, v]) => walk(v, k));
    }
  };
  walk(slide?.content);
  return parts.join(' ').toLowerCase();
}

/** Whether the key words of a statement appear together on one slide. */
export function statementOnSlide(statement: string, slide: SlideLike): boolean {
  const stems = significantStems(statement);
  if (!stems.length) return false;
  const text = slideStudentText(slide);
  const found = stems.filter((s) => text.includes(s)).length;
  const needed = stems.length < 2 ? stems.length : Math.max(2, Math.ceil(stems.length / 2));
  return found >= needed;
}

/**
 * Which of a lesson's linked outcomes the deck teaches. An outcome is covered when a slide other
 * than the cover is tagged with it (content.mlos), or, failing a tag, when a slide shows the key
 * words of the outcome's statement. A tag naming an outcome the lesson is not linked to counts
 * for nothing.
 */
export function deckMloCoverage(
  lesson: { linkedMLOs?: string[] },
  slides: SlideLike[],
  statements: Record<string, string> = {}
): MloCoverage {
  const linked = [...new Set((lesson?.linkedMLOs || []).filter(Boolean).map(String))];
  if (!linked.length) return { checked: false, covered: [], missing: [], viaTags: [], viaText: [] };

  const body = (slides || []).filter((s) => s?.slideType !== 'title');
  const byNormId = new Map(Object.entries(statements).map(([id, s]) => [normaliseMloId(id), s]));
  const tagged = new Set(
    body.flatMap((s) => (Array.isArray(s?.content?.mlos) ? s.content.mlos : []).map(normaliseMloId))
  );

  const viaTags: string[] = [];
  const viaText: string[] = [];
  for (const id of linked) {
    if (tagged.has(normaliseMloId(id))) viaTags.push(id);
    else {
      const statement = byNormId.get(normaliseMloId(id));
      if (statement && body.some((s) => statementOnSlide(statement, s))) viaText.push(id);
    }
  }
  const covered = linked.filter((id) => viaTags.includes(id) || viaText.includes(id));
  return {
    checked: true,
    covered,
    missing: linked.filter((id) => !covered.includes(id)),
    viaTags,
    viaText,
  };
}

/** A deck passes only when the lesson has linked outcomes and every one of them is covered. */
export const mloCoverageOk = (c: MloCoverage): boolean => c.checked && c.missing.length === 0;

/** What is wrong with a deck's shape, in words the model can be told, or nothing. */
export function deckShapeIssues(
  slides: SlideLike[],
  lesson: { linkedMLOs?: string[] },
  statements: Record<string, string> = {}
): string[] {
  const issues: string[] = [];
  const count = (slides || []).length;
  if (!slideCountValid(count)) {
    issues.push(
      `The deck has ${count} slides; it must have ${DECK_MIN_SLIDES} to ${DECK_MAX_SLIDES}` +
        ` once a formative check and any case slides are added, so write ${MODEL_MIN_SLIDES} to ${MODEL_MAX_SLIDES}.`
    );
  }
  const coverage = deckMloCoverage(lesson, slides, statements);
  if (coverage.checked && coverage.missing.length) {
    issues.push(
      `No slide teaches these outcomes: ${coverage.missing.join(', ')}. Add or tag a slide for each.`
    );
  }
  return issues;
}
