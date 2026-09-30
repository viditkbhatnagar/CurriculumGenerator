/**
 * A Step 4 topic, whichever shape it was stored in.
 *
 * Step 4 stores a module's topics as plain strings ("Kochi port operations"), while several
 * readers assumed objects with `title` and `hours`. The Word export printed every one of the
 * Logistics programme's 79 named topics as "Untitled topic", the slide-deck prompt received
 * "undefined (undefinedh)", the syllabus got empty topic titles, and canvas edits sent the
 * model topics with no names. Read topics through here instead.
 */

export interface NormalisedTopic {
  id?: string;
  title: string;
  description?: string;
  hours?: number;
  sequence: number;
}

export function topicTitle(topic: unknown): string {
  if (typeof topic === 'string') return topic.trim();
  if (topic && typeof topic === 'object') {
    const t = topic as { title?: unknown; name?: unknown; topic?: unknown };
    const title = t.title ?? t.name ?? t.topic;
    return typeof title === 'string' ? title.trim() : '';
  }
  return '';
}

export function normaliseTopic(topic: unknown, index: number): NormalisedTopic {
  const out: NormalisedTopic = { title: topicTitle(topic), sequence: index + 1 };
  if (topic && typeof topic === 'object') {
    const t = topic as { id?: unknown; description?: unknown; hours?: unknown; sequence?: unknown };
    if (typeof t.id === 'string') out.id = t.id;
    if (typeof t.description === 'string') out.description = t.description;
    if (typeof t.hours === 'number') out.hours = t.hours;
    if (typeof t.sequence === 'number') out.sequence = t.sequence;
  }
  return out;
}
