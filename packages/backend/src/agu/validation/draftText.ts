/**
 * Every free-text field AGU writes into a course draft, found by walking the draft object.
 *
 * The claim scan used to read `draft.narrative`, a list the generator filled by hand with the
 * rationale, the briefs and the week themes. Outcome statements, lecture topics, run sheets,
 * monitored and independent activities, case titles and every later edit never reached it, so
 * "AACSB-accredited case" in any of them passed. Walking the object means a field added to the
 * draft tomorrow is scanned without anyone remembering to register it.
 *
 * What is left out is deliberate and short: the catalogue facts (the route restores them),
 * identifiers and fixed vocabulary (they name things, they make no claim), and the citation
 * details of a source. A paper titled "Accreditation of business schools" is somebody else's
 * title, not an AGU claim.
 *
 * Pure, no I/O.
 */
import { CourseDraft } from '../draft/types';

export interface DraftText {
  /** Where the text lives, e.g. "weeks[1].liveLecture.topics[0]", or a narrative field's name. */
  field: string;
  text: string;
}

export interface DraftTextResult {
  fields: DraftText[];
  /** Paths nested too deeply to read. A draft never nests that far; one that does is reported. */
  tooDeep: string[];
}

const MAX_DEPTH = 10;

/** Top-level keys the walk skips: catalogue facts, and the narrative, which is added by name. */
const TOP_LEVEL_SKIPPED = new Set(['locked', 'courseCode', 'catalogueVersion', 'narrative']);

/** Identifiers and fixed vocabulary. */
const NON_PROSE_KEY = /^(id|origin|component|access|bloomLevel|source|.*Ids?)$/;

const NOTHING_SKIPPED: ReadonlySet<string> = new Set();

/**
 * Keys that quote or cite somebody else's work, by the list they sit in. Inside `readings` the
 * whole bibliographic record; inside `evidence` the quoted passage and where it came from.
 */
const THIRD_PARTY_KEYS: Record<string, ReadonlySet<string>> = {
  readings: new Set([
    'citation',
    'link',
    'url',
    'doi',
    'authors',
    'author',
    'title',
    'sourceTitle',
    'venue',
    'publisher',
    'journal',
  ]),
  evidence: new Set(['quote', 'locator', 'link', 'url', 'doi', 'title']),
};

function walk(
  value: unknown,
  path: string,
  skipped: ReadonlySet<string>,
  depth: number,
  out: DraftTextResult
): void {
  if (typeof value === 'string') {
    if (value.trim()) out.fields.push({ field: path, text: value });
    return;
  }
  if (value === null || typeof value !== 'object') return;
  if (depth > MAX_DEPTH) {
    out.tooDeep.push(path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => walk(item, `${path}[${i}]`, skipped, depth + 1, out));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (depth === 0 && TOP_LEVEL_SKIPPED.has(key)) continue;
    if (skipped.has(key) || NON_PROSE_KEY.test(key)) continue;
    walk(child, path ? `${path}.${key}` : key, THIRD_PARTY_KEYS[key] ?? skipped, depth + 1, out);
  }
}

export function collectDraftText(draft: CourseDraft): DraftTextResult {
  const out: DraftTextResult = { fields: [], tooDeep: [] };
  if (draft === null || typeof draft !== 'object') return out;
  walk(draft, '', NOTHING_SKIPPED, 0, out);
  // The narrative holds free text that has no structured home (the rationale, the disclosures).
  // Each entry is reported under its own field name.
  for (const entry of Array.isArray(draft.narrative) ? draft.narrative : []) {
    if (typeof entry?.text !== 'string' || !entry.text.trim()) continue;
    const field = typeof entry.field === 'string' && entry.field ? entry.field : 'narrative';
    out.fields.push({ field, text: entry.text });
  }
  return out;
}
