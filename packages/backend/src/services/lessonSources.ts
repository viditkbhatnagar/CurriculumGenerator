/**
 * The sources a lesson is written from.
 *
 * Logan's review and next steps (16 October 2026), Phase 1: Step 10 told the lesson writer only
 * "READING MATERIALS: N sources available" and at most two citations, so the teaching content
 * came from the model's memory, and the readings were attached to the plan afterwards by
 * matching outcomes, which made it look grounded when it was not.
 *
 * The writer is now given the lesson's readings with what Step 6 says to read in them (sections,
 * focus, why), the source's abstract where Step 5 stored one, and passages from any textbook
 * ingested for the programme (Step 5.5); it is told to teach from them, cite them as [S1], [S2],
 * and say where the topic goes beyond them. The lesson records what it was given (`groundedIn`).
 *
 * Pure, so it can be tested.
 */

export interface LessonSource {
  sourceId?: string;
  citation: string;
  sections?: string;
  focus?: string[];
  why?: string;
  abstract?: string;
}

export interface BookPassage {
  source: string;
  content: string;
}

/** At most this many readings per lesson, so the prompt stays within budget. */
export const MAX_LESSON_SOURCES = 4;
const ABSTRACT_CHARS = 700;
const PASSAGE_CHARS = 900;

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const list = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(text).filter(Boolean) : text(v) ? [text(v)] : [];

/**
 * The lesson's readings: core readings linked to its outcomes first, then supplementary ones,
 * each once, with the Step 5 source's abstract joined in by source id.
 */
export function lessonSourcesFor(
  mloIds: string[],
  readingLists: any[],
  topicSources: any[] = [],
  max = MAX_LESSON_SOURCES
): LessonSource[] {
  const wanted = new Set(mloIds);
  const byId = new Map<string, any>(
    (topicSources || []).filter((s) => s?.id).map((s) => [String(s.id), s])
  );
  const seen = new Set<string>();
  const out: LessonSource[] = [];
  for (const kind of ['coreReadings', 'supplementaryReadings']) {
    for (const lists of readingLists || []) {
      for (const r of lists?.[kind] || []) {
        const links: string[] = r?.mloIds || r?.linkedMLOs || [];
        if (!links.some((id) => wanted.has(id))) continue;
        const key = String(r.sourceId || r.citation || '');
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const source = r.sourceId ? byId.get(String(r.sourceId)) : undefined;
        out.push({
          sourceId: r.sourceId,
          citation: text(r.citation) || text(source?.citation) || text(r.title),
          sections: text(r.specificChapters) || undefined,
          focus: list(r.focusAreas),
          why: text(r.whyThisReading) || undefined,
          abstract: text(source?.abstract).slice(0, ABSTRACT_CHARS) || undefined,
        });
        if (out.length >= max) return out;
      }
    }
  }
  return out;
}

/** The block of the lesson prompt that gives the writer its sources and how to use them. */
export function lessonSourcesBlock(sources: LessonSource[], passages: BookPassage[] = []): string {
  if (!sources.length && !passages.length) {
    return `
SOURCES FOR THIS LESSON: none of the programme's readings is linked to this lesson's outcomes.
Write from established knowledge of the subject, and begin pedagogicalGuidance with
"No programme reading covers this lesson:" so the subject expert can check it.
`;
  }
  const lines: string[] = ['\nSOURCES FOR THIS LESSON (teach from these):'];
  sources.forEach((s, i) => {
    lines.push(`[S${i + 1}] ${s.citation}`);
    if (s.sections) lines.push(`    What to read: ${s.sections}`);
    if (s.focus?.length) lines.push(`    Focus: ${s.focus.slice(0, 4).join('; ')}`);
    if (s.why) lines.push(`    Why it matters: ${s.why}`);
    if (s.abstract) lines.push(`    Abstract: ${s.abstract}`);
  });
  passages.forEach((p, i) => {
    lines.push(`[B${i + 1}] From ${p.source}:\n    ${p.content.slice(0, PASSAGE_CHARS)}`);
  });
  lines.push(
    `RULES FOR SOURCES:
- Draw the lesson's definitions, frameworks, models and examples from these sources, and name the
  source in the activity descriptions as [S1], [S2] or [B1].
- Do not cite any other source.
- Where the lesson's topic goes beyond these sources, end pedagogicalGuidance with
  "Beyond the readings:" and what was added, so the subject expert can check it.`
  );
  return lines.join('\n') + '\n';
}
