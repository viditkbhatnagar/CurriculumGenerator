/**
 * What a lesson gives the slide writer (pptGenerationService.generateLessonSlidesWithLLM),
 * and which deck a download serves for each lesson.
 *
 * Dr Sherin Thomas, 12 October 2026: the decks were "predominantly faculty delivery
 * instructions rather than actual teaching presentations". Two causes:
 * - every download rebuilt each deck from a template that copies the lesson plan's lecturer
 *   instructions onto slides, so the AI-written decks Step 11 produced (and paid for) were never
 *   served;
 * - the slide writer read the lesson's activities and case from field names the lessons do not
 *   have (`activitySequence`, `caseStudyActivity.title`), so it was shown neither.
 *
 * Pure, so it can be tested.
 */

/** The lesson's activities as the slide writer should see them: what is taught, not how. */
export function activitiesForSlides(lesson: any): string {
  const activities: any[] = Array.isArray(lesson?.activities) ? lesson.activities : [];
  if (!activities.length) return 'No activities specified';
  return [...activities]
    .sort((a, b) => (a?.sequenceOrder ?? 0) - (b?.sequenceOrder ?? 0))
    .map((a) => {
      const head = `- ${a?.type || 'activity'}: ${a?.title || 'Activity'}${a?.duration ? ` (${a.duration} min)` : ''}`;
      const detail = String(a?.description || '').trim();
      return detail ? `${head}\n  ${detail}` : head;
    })
    .join('\n');
}

/** The topic the lesson teaches, with its subtopics. */
export function topicForSlides(lesson: any): string {
  const t = lesson?.topicCoverage;
  if (!t?.exactTopic) return 'Not specified';
  const subs: string[] = Array.isArray(t.subtopics) ? t.subtopics.filter(Boolean) : [];
  return subs.length ? `${t.exactTopic}\nSubtopics: ${subs.join('; ')}` : t.exactTopic;
}

/** The lesson's case, under the field names lessons actually store. */
export function caseForSlides(lesson: any): string {
  const c = lesson?.caseStudyActivity;
  const title = c?.caseTitle || c?.title;
  if (!title) return 'No case study for this lesson';
  const facts: string[] = c?.assessmentHooks?.keyFacts || [];
  const decisions: string[] = c?.assessmentHooks?.decisionPoints || [];
  return [
    `Title: ${title}`,
    c?.learningPurpose ? `Purpose: ${c.learningPurpose}` : '',
    facts.length ? `Key facts: ${facts.join('; ')}` : '',
    decisions.length ? `Decision points: ${decisions.join('; ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** A Step 11 deck as stored, with enough to decide whether it still fits its lesson. */
export interface StoredDeck {
  deckId?: string;
  lessonId?: string;
  lessonTitle?: string;
  generatedBy?: string;
  slides?: Array<{ content?: unknown; title?: string }>;
}

export const MIN_COMPLETE_SLIDES = 10;
const SUMMARY_TITLE = /summary|takeaway|recap|wrap[- ]?up|key points|conclusion/i;

/**
 * Whether a deck is whole: at least MIN_COMPLETE_SLIDES slides, ending with its summary. A deck
 * whose answer was cut off at the token budget stops mid-lesson, without the summary the
 * instructions put last.
 */
export function deckComplete(slides: Array<{ title?: string; content?: unknown }>): boolean {
  const last: any = slides?.[slides.length - 1];
  const title = String(last?.content?.title || last?.title || '');
  return (slides?.length || 0) >= MIN_COMPLETE_SLIDES && SUMMARY_TITLE.test(title);
}

/**
 * The AI-written deck to serve for a lesson, if Step 11 holds one that still fits it: the same
 * lesson, under the same title, with its slide content present (archived decks keep only stubs
 * until hydrated from S3). Anything else is served as an outline built from the lesson plan.
 */
export function storedDeckFor(lesson: any, decks: StoredDeck[]): StoredDeck | undefined {
  const deck = (decks || []).find((d) => d?.lessonId && d.lessonId === lesson?.lessonId);
  if (!deck || deck.generatedBy === 'outline') return undefined;
  if (deck.lessonTitle && lesson?.lessonTitle && deck.lessonTitle !== lesson.lessonTitle) {
    return undefined;
  }
  const slides = deck.slides || [];
  return slides.length && slides.every((s) => s?.content !== undefined) ? deck : undefined;
}

/**
 * Why a stored deck should be written again, if it should:
 * - incomplete: cut off before its summary;
 * - outline: built from the lesson plan, not written as teaching slides;
 * - names CIPD: Dr Sherin ruled CIPD out (September 2026), and slides still attributed
 *   frameworks to it ("CIPD PESTLE").
 */
export function deckProblems(deck: StoredDeck): string[] {
  const slides = deck?.slides || [];
  const text = JSON.stringify(slides);
  const problems: string[] = [];
  if (!deckComplete(slides)) problems.push('incomplete');
  if (deck?.generatedBy === 'outline' || /"Instructor:/.test(text)) problems.push('outline');
  if (/\bCIPD\b/.test(text)) problems.push('names CIPD');
  return problems;
}

/**
 * Whether a newly written deck should replace the stored one. Only an AI-written deck that fixes
 * something and breaks nothing does: an outline (the AI call failed) never replaces a deck, and
 * a deck rewritten in full replaces a sound one only if it is sound too.
 */
export function replacesDeck(stored: StoredDeck, fresh: StoredDeck): boolean {
  if (fresh?.generatedBy !== 'ai') return false;
  const before = deckProblems(stored);
  const after = deckProblems(fresh);
  return (
    after.every((p) => before.includes(p)) && (after.length === 0 || after.length < before.length)
  );
}

const CIPD_CITATION = /^[\s•*-]*CIPD\.?\s*\(\d{4}\)/;

/**
 * Text, or any object or array of text, with CIPD taken out. The lesson plans still name it in
 * objectives, topics and materials ("Apply the CIPD PESTLE framework", "CIPD. (2024). PESTLE
 * analysis factsheet"), and a slide writer shown those repeats them, so CIPD is removed from what
 * the writer is given and from what it returns:
 * - an attribution keeps the framework ("the CIPD PESTLE framework" → "the PESTLE framework");
 * - a CIPD citation, as a line or a list item, is dropped;
 * - "(CIPD, 2024)" in a sentence is dropped.
 * Whatever remains is caught by deckProblems.
 */
export function withoutCIPD<T>(value: T): T {
  if (typeof value === 'string') {
    return value
      .split('\n')
      .filter((line) => !CIPD_CITATION.test(line))
      .join('\n')
      .replace(/\s*\(CIPD[^)]*\)/g, '')
      .replace(/\b(the\s+)?CIPD(?:'s|’s)?\s+(?=\S)/g, (_m, the) => the || '') as T;
  }
  if (Array.isArray(value)) {
    return value
      .filter((v) => !(typeof v === 'string' && CIPD_CITATION.test(v)))
      .map((v) => withoutCIPD(v)) as T;
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, withoutCIPD(v)])
    ) as T;
  }
  return value;
}
