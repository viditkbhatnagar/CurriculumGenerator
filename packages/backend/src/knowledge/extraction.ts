/**
 * Knowledge objects from one section of a textbook.
 *
 * The model reads a section (with "[p. 112]" markers at each printed page) and lists the
 * concepts it teaches, each as the knowledge object of Rejin's design (section 6): type,
 * level, a paraphrased definition, components, formulae, applications, misconceptions,
 * prerequisites, related concepts, the skills it enables and how it could be assessed.
 *
 * What the model may not do is decide where a concept is: the pages it cites are checked
 * against the markers in the text it was given, and a page outside them is replaced by the
 * section's own span (design section 2: "The system would no longer need GPT to invent page
 * numbers"). Area and level are also checked against fixed lists.
 *
 * `parseExtraction` is pure, so it can be tested; the call itself is in knowledge/ingestBook.
 */
import type { ConceptType, Treatment } from './models';

export const CONCEPT_TYPES: ConceptType[] = [
  'theory',
  'framework',
  'model',
  'method',
  'technique',
  'algorithm',
  'procedure',
  'formula',
  'principle',
  'definition',
  'tool',
  'regulation',
];
export const LEVELS = ['introductory', 'intermediate', 'advanced'] as const;
const TREATMENTS: Treatment[] = ['mention', 'treatment', 'extended'];
/**
 * The first production book (Open Data Structures) gave 25 a section, down to "add(i, x) with
 * element shifting" and "backing array": implementation detail, not curriculum. 15 with the
 * granularity rule below keeps concepts at the level a syllabus names.
 */
export const MAX_CONCEPTS_PER_WINDOW = 15;

export interface ExtractedConcept {
  name: string;
  aliases: string[];
  conceptType: ConceptType;
  area: string;
  subArea: string;
  level: (typeof LEVELS)[number];
  definition: string;
  components: string[];
  formulae: { expression: string; meaning: string }[];
  applications: string[];
  misconceptions: string[];
  prerequisites: string[];
  related: string[];
  skillsEnabled: string[];
  assessmentPossibilities: string[];
  treatment: Treatment;
  pageStart: string;
  pageEnd: string;
  /** False when the model's pages were not among the section's and the span was used instead. */
  pagesVerified: boolean;
  workedExamplePages: string[];
  critique: boolean;
}

export interface ExtractionContext {
  bookTitle: string;
  authors: string[];
  edition: string;
  chapter: string;
  section: string;
  sectionKind: string;
  areas: string[];
  /** Sub-areas offered per area name. */
  subAreas?: Record<string, string[]>;
}

/** "Array-Based Lists" and "array-based lists" are one sub-area: sentence case, acronyms kept. */
export function normaliseSubArea(text: string): string {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const acronym = (w: string) => /^[A-Z0-9]{2,}s?$/.test(w);
  return words
    .map((w, i) =>
      acronym(w) ? w : i === 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase()
    )
    .join(' ');
}

export function extractionSystemPrompt(): string {
  return `You build a structured index of what a textbook teaches, for a curriculum design system.
Read the section you are given and list the distinct concepts it TEACHES: theories, frameworks,
models, methods, techniques, algorithms, procedures, formulae, principles, key definitions,
tools and regulations. Return JSON only.

Rules:
- GRANULARITY: list concepts at the level a course syllabus or a textbook index would name them:
  a theory, framework, model, method, algorithm, principle or key term a learner is expected to
  know or use (e.g. "Amortised analysis", "Dynamic array", "Porter's Five Forces", "Net present
  value"). Do NOT list code-level operations, variable or function names, single steps of a
  procedure, details of a worked example, or properties too narrow to teach on their own: put
  those in the parent concept's "components". Usually 3-12 per section.
- Only concepts this text actually explains. Skip things merely named in passing unless the text
  defines them; mark those "mention".
- Use the concept's standard academic name (e.g. "Porter's Five Forces", "Net present value",
  "Gradient descent"), not a sentence. Put abbreviations and other names in "aliases".
- "definition": 1-3 sentences in your own words, faithful to THIS text. Do not copy sentences, and
  do not add facts the text does not give.
- Every list item is short (under 25 words). Leave a list empty rather than inventing content.
- "pageStart"/"pageEnd": the printed page labels from the [p. X] markers where the concept is
  taught. Use only labels that appear in the text. "workedExamplePages": labels of worked examples.
- "treatment": "extended" if the text develops the concept at length (several paragraphs, with
  examples or derivations), "treatment" if it explains it properly, "mention" if only named.
- "critique": true if the text mainly criticises, qualifies or gives limitations of the concept.
- "area": exactly one of the areas listed. "subArea": one of that area's listed sub-areas where one
  fits; otherwise a short topic name in sentence case.
- "level": "introductory", "intermediate" or "advanced", judged by how the text treats it.
- At most ${MAX_CONCEPTS_PER_WINDOW} concepts; prefer the important ones.`;
}

export function extractionUserPrompt(ctx: ExtractionContext, window: string): string {
  return `BOOK: ${ctx.bookTitle}${ctx.edition ? ` (${ctx.edition})` : ''}${ctx.authors.length ? ` by ${ctx.authors.join(', ')}` : ''}
CHAPTER: ${ctx.chapter}
SECTION: ${ctx.section}${ctx.sectionKind !== 'body' ? ` (${ctx.sectionKind} section: list only concepts it teaches, not questions)` : ''}

AREAS (choose one per concept; sub-areas in brackets):
${ctx.areas.map((a) => `- ${a}${ctx.subAreas?.[a]?.length ? ` [${ctx.subAreas[a].join('; ')}]` : ''}`).join('\n')}

Return:
{"concepts":[{"name":"","aliases":[],"conceptType":"${CONCEPT_TYPES.join('|')}","area":"","subArea":"","level":"introductory|intermediate|advanced","definition":"","components":[],"formulae":[{"expression":"","meaning":""}],"applications":[],"misconceptions":[],"prerequisites":[],"related":[],"skillsEnabled":["verb phrase, e.g. Calculate NPV for a project"],"assessmentPossibilities":[],"treatment":"mention|treatment|extended","pageStart":"","pageEnd":"","workedExamplePages":[],"critique":false}]}

TEXT:
${window}`;
}

const str = (v: unknown, max = 600) =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';

/**
 * A page as the model gave it: a number, "p. 112", "pp. 112-118". The first live production
 * book had every page rejected because the model answered with numbers.
 */
function pageOf(v: unknown): { start: string; end: string } {
  const text = typeof v === 'number' ? String(v) : typeof v === 'string' ? v : '';
  const bare = text.replace(/^\s*p{1,2}\.?\s*/i, '').trim();
  const [start, end] = bare.split(/\s*[-–—]\s*/);
  return { start: (start || '').slice(0, 20), end: (end || '').slice(0, 20) };
}

const list = (v: unknown, maxItems = 8, maxLen = 200) =>
  Array.isArray(v)
    ? Array.from(new Set(v.map((x) => str(x, maxLen)).filter(Boolean))).slice(0, maxItems)
    : [];

/**
 * The model's reply as checked knowledge objects. `pageLabels` are the labels present in the
 * text it was given, in order; `areas` the area names offered.
 */
export function parseExtraction(
  raw: unknown,
  pageLabels: string[],
  areas: string[]
): ExtractedConcept[] {
  let data: any = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  const items: any[] = Array.isArray(data?.concepts) ? data.concepts : [];
  const known = new Set(pageLabels);
  const first = pageLabels[0] || '';
  const last = pageLabels[pageLabels.length - 1] || first;
  const areaByName = new Map(areas.map((a) => [a.toLowerCase(), a]));
  const seen = new Set<string>();
  const out: ExtractedConcept[] = [];

  for (const item of items) {
    const name = str(item?.name, 120);
    if (!name || name.split(' ').length > 12) continue;
    const dedupe = name.toLowerCase();
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    const from = pageOf(item?.pageStart);
    const to = pageOf(item?.pageEnd);
    let pageStart = from.start;
    let pageEnd = to.start || from.end || pageStart;
    const pagesVerified = known.has(pageStart) && known.has(pageEnd);
    if (!pagesVerified) {
      pageStart = first;
      pageEnd = last;
    } else if (pageLabels.indexOf(pageEnd) < pageLabels.indexOf(pageStart)) {
      [pageStart, pageEnd] = [pageEnd, pageStart];
    }

    const type = str(item?.conceptType, 30).toLowerCase() as ConceptType;
    const level = str(item?.level, 20).toLowerCase() as ExtractedConcept['level'];
    const treatment = str(item?.treatment, 20).toLowerCase() as Treatment;
    out.push({
      name,
      aliases: list(item?.aliases, 6, 80).filter((a) => a.toLowerCase() !== dedupe),
      conceptType: CONCEPT_TYPES.includes(type) ? type : 'definition',
      area: areaByName.get(str(item?.area, 80).toLowerCase()) || 'Other',
      subArea: normaliseSubArea(str(item?.subArea, 80)),
      level: (LEVELS as readonly string[]).includes(level) ? level : 'intermediate',
      definition: str(item?.definition, 700),
      components: list(item?.components, 10),
      formulae: (Array.isArray(item?.formulae) ? item.formulae : [])
        .map((f: any) => ({ expression: str(f?.expression, 200), meaning: str(f?.meaning, 200) }))
        .filter((f: any) => f.expression)
        .slice(0, 6),
      applications: list(item?.applications),
      misconceptions: list(item?.misconceptions, 6),
      prerequisites: list(item?.prerequisites, 8, 120),
      related: list(item?.related, 10, 120),
      skillsEnabled: list(item?.skillsEnabled, 6),
      assessmentPossibilities: list(item?.assessmentPossibilities, 6),
      treatment: TREATMENTS.includes(treatment) ? treatment : 'treatment',
      pageStart,
      pageEnd,
      pagesVerified,
      workedExamplePages: (Array.isArray(item?.workedExamplePages) ? item.workedExamplePages : [])
        .map((p: unknown) => pageOf(p).start)
        .filter((p: string) => known.has(p))
        .slice(0, 10),
      critique: item?.critique === true,
    });
    if (out.length >= MAX_CONCEPTS_PER_WINDOW) break;
  }
  return out;
}
