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
  slides?: Array<{ content?: unknown }>;
}

/**
 * The AI-written deck to serve for a lesson, if Step 11 holds one that still fits it: the same
 * lesson, under the same title, with its slide content present (archived decks keep only stubs
 * until hydrated from S3). Anything else is served as an outline built from the lesson plan.
 */
export function storedDeckFor(lesson: any, decks: StoredDeck[]): StoredDeck | undefined {
  const deck = (decks || []).find((d) => d?.lessonId && d.lessonId === lesson?.lessonId);
  if (!deck) return undefined;
  if (deck.lessonTitle && lesson?.lessonTitle && deck.lessonTitle !== lesson.lessonTitle) {
    return undefined;
  }
  const slides = deck.slides || [];
  return slides.length && slides.every((s) => s?.content !== undefined) ? deck : undefined;
}
