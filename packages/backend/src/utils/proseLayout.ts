/**
 * Laying out approved text for a Word document without changing a word of it.
 *
 * The export used to send every passage over 500 characters to GPT-4o-mini to "break it into
 * paragraphs", with instructions that included "remove duplicate sentences". That let approved
 * curriculum text be reworded after approval; Rejin's audit (16 October 2026) asked for
 * "deterministic formatting only, with zero semantic rewriting". This is that: the passage is
 * split where its author split it, and otherwise between sentences, and its words are kept as
 * written and in order.
 *
 * Pure, so it can be tested.
 */

export interface LaidOut {
  paragraphs: string[];
  bullets: string[];
}

/** A line written as a list item: "•", "-", "*", "–", "1.", "1)", "a)" and the like. */
const LIST_ITEM = /^\s*(?:[•*\-–▪◦]|\d{1,2}[.)]|[a-z][.)])\s+(?=\S)/i;

/** Sentences per paragraph when the author gave no breaks. */
const SENTENCES_PER_PARAGRAPH = 4;

/** Prose as paragraphs: the author's blank lines, or else groups of a few sentences. */
export function paragraphsOf(text: string): string[] {
  const trimmed = (text || '').trim();
  if (!trimmed) return [];
  const byBlankLine = trimmed
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (byBlankLine.length > 1) return byBlankLine;
  const sentences = trimmed.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [
    trimmed,
  ];
  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length; i += SENTENCES_PER_PARAGRAPH) {
    paragraphs.push(
      sentences
        .slice(i, i + SENTENCES_PER_PARAGRAPH)
        .join('')
        .trim()
    );
  }
  return paragraphs.filter(Boolean);
}

/**
 * A passage laid out for the document. When most of its lines are written as list items, those
 * become bullets (without their markers) and any other lines are kept as paragraphs before them;
 * otherwise it is prose.
 */
export function layoutProse(text: string): LaidOut {
  const trimmed = (text || '').trim();
  if (!trimmed) return { paragraphs: [], bullets: [] };
  const lines = trimmed
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const items = lines.filter((l) => LIST_ITEM.test(l));
  if (items.length >= 2 && items.length * 2 >= lines.length) {
    return {
      paragraphs: lines.filter((l) => !LIST_ITEM.test(l)),
      bullets: items.map((l) => l.replace(LIST_ITEM, '').trim()),
    };
  }
  return { paragraphs: paragraphsOf(trimmed), bullets: [] };
}
