/**
 * Checks on the Step 9 glossary that used to be declared rather than run.
 *
 * `noCircularDefinitions` and `ukEnglishConsistent` were the constant `true` ("Assumed"), and
 * the screen showed both as green ticks for every glossary ever generated. Each is now
 * measured on the stored terms. `allAssessmentTermsIncluded` has no independent list of
 * assessment terms to compare against (the generator marks its own terms as assessment
 * terms), so it is reported as not checked rather than as passed.
 *
 * Pure, no imports, so it can be tested: workflowService cannot be imported by a test.
 */

export interface GlossaryTermLike {
  term?: string;
  definition?: string;
  isAcronym?: boolean;
  acronymExpansion?: string;
  acronymForm?: string;
  acronym?: string;
  usedInAssessment?: boolean;
  priority?: string;
  sources?: string[];
  sourceModules?: string[];
  relatedTerms?: string[];
  broaderTerms?: string[];
  narrowerTerms?: string[];
  synonyms?: string[];
  [key: string]: any;
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const wholeWord = (name: string): RegExp =>
  new RegExp(`(^|[^A-Za-z0-9])${escapeRegExp(name)}($|[^A-Za-z0-9])`, 'i');

const norm = (text: unknown): string =>
  String(text || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

/** The names an entry is known by: the term, its acronym and its expansion. */
function namesOf(t: GlossaryTermLike): string[] {
  const names = [t.term, t.acronymExpansion, t.acronymForm, t.acronym]
    .map((n) => String(n || '').trim())
    .filter(Boolean);
  return Array.from(new Set(names.map((n) => n.toLowerCase()))).map(
    (low) => names.find((n) => n.toLowerCase() === low) as string
  );
}

/**
 * The definition with its genus-differentia opening taken off: "An outlier is a value that..."
 * becomes "a value that...". What remains is the explanation, and it is the explanation that must
 * not lean on the term. A definition that does not open with the term is returned whole.
 */
const COPULA =
  '(?:is|are|was|refers to|means|describes|denotes|represents|measures|shows|indicates|involves|covers|consists of|comprises|occurs|can be)';
function explanationOf(definition: string, names: string[]): string {
  if (!names.length) return definition;
  const alt = names
    .slice()
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join('|');
  const opening = new RegExp(
    `^\\s*(?:(?:a|an|the)\\s+)?(?:${alt})\\s*(?:\\([^)]*\\)\\s*)?(?:${COPULA}\\b|[:\\u2014-])\\s*`,
    'i'
  );
  return definition.replace(opening, '');
}

/** True when the first `words` words of the explanation mention the name. */
const restsOn = (explanation: string, name: string, words: number): boolean =>
  wholeWord(name).test(explanation.split(/\s+/).slice(0, words).join(' '));

/**
 * Terms whose definition is genuinely circular: it defines the term by itself, or two entries
 * define each other.
 *
 * Logan Pacey's re-test of 2 November 2026 flagged 17 of 29 definitions, every one an ordinary
 * "An outlier is a value..." or "A dashboard is a visual display...". Naming the term in order to
 * say what kind of thing it is is how a definition is written; the earlier check, which flagged
 * any definition containing its term, could not tell that from "X means X". Now the opening
 * "A/An/The <term> is/are/refers to" is removed first, and the term (or its acronym or expansion)
 * must still not be what the rest rests on. Two entries are mutually circular when each one's
 * explanation rests on the other: an acronym and its expansion, as "KPI" and "Key performance
 * indicator" did.
 */
export function circularDefinitions(terms: GlossaryTermLike[]): string[] {
  const entries = (terms || [])
    .map((t) => ({
      t,
      term: String(t?.term || '').trim(),
      explanation: '',
      names: [] as string[],
    }))
    .filter((e) => e.term && String(e.t?.definition || '').trim());
  for (const e of entries) {
    e.names = namesOf(e.t);
    e.explanation = explanationOf(String(e.t.definition), e.names);
  }
  const circular = new Set<string>();
  for (const e of entries) {
    if (e.names.some((n) => wholeWord(n).test(e.explanation))) circular.add(e.term);
  }
  for (const a of entries) {
    for (const b of entries) {
      if (a === b || (circular.has(a.term) && circular.has(b.term))) continue;
      const aliases = a.names.some((n) => b.names.some((m) => norm(n) === norm(m)));
      // An acronym and its expansion share a name: resting on the other at all is circular.
      // Two unrelated entries only count when the explanation opens with the other.
      const aRests = b.names.some((n) => restsOn(a.explanation, n, aliases ? 40 : 6));
      const bRests = a.names.some((n) => restsOn(b.explanation, n, aliases ? 40 : 6));
      if (aRests && bRests) {
        circular.add(a.term);
        circular.add(b.term);
      }
    }
  }
  return entries.map((e) => e.term).filter((t) => circular.has(t));
}

/**
 * One entry per concept. The model writes "KPI" in one module and "Key performance indicator"
 * in another, and exact-name de-duplication kept both (29 terms in the 2 November 2026 re-test,
 * two of them the same thing). An acronym entry is folded into the entry of its expansion: the
 * full form is kept as the term, the acronym is stored in `acronym`, and sources, modules and
 * cross-references are merged. An acronym whose expansion has no entry of its own stays.
 */
export function mergeAcronymEntries<T extends GlossaryTermLike>(terms: T[]): T[] {
  const byName = new Map<string, number>();
  const out: T[] = terms.map((t) => ({ ...t }));
  out.forEach((t, i) => byName.set(norm(t.term), i));
  const drop = new Set<number>();
  const union = (a?: string[], b?: string[]) => Array.from(new Set([...(a || []), ...(b || [])]));
  out.forEach((short, i) => {
    const expansion = norm(short.acronymExpansion);
    if (!short.isAcronym || !expansion || drop.has(i)) return;
    const j = byName.get(expansion);
    if (j === undefined || j === i || drop.has(j)) return;
    const full = out[j];
    full.acronym = full.acronym || String(short.term);
    full.acronymForm = full.acronymForm || String(short.term);
    full.isAcronym = false;
    for (const f of ['sources', 'sourceModules', 'relatedTerms', 'broaderTerms', 'narrowerTerms']) {
      (full as any)[f] = union((full as any)[f], (short as any)[f]);
    }
    full.synonyms = union(full.synonyms, short.synonyms);
    if (short.usedInAssessment) full.usedInAssessment = true;
    if (short.priority === 'must_include') full.priority = 'must_include';
    drop.add(i);
  });
  return out.filter((_, i) => !drop.has(i));
}

export interface CrossReferenceResult<T> {
  terms: T[];
  /** References removed because they named no glossary entry. */
  dropped: number;
}

/**
 * Keep related, broader and narrower terms only where they name another entry (by term or by
 * acronym), written as that entry's term. The prompt only said "array of related term names", so
 * 27 of 29 entries pointed at words with no entry and the glossary failed its own cross-reference
 * check. Synonyms are alternative names in plain text, not links, so they are left as written.
 */
export function filterCrossReferences<T extends GlossaryTermLike>(
  terms: T[]
): CrossReferenceResult<T> {
  const canonical = new Map<string, string>();
  for (const t of terms) {
    for (const n of namesOf(t)) canonical.set(norm(n), String(t.term));
  }
  let dropped = 0;
  const keep = (self: string, list?: string[]): string[] => {
    const seen = new Set<string>();
    const kept: string[] = [];
    for (const ref of list || []) {
      const target = canonical.get(norm(ref));
      if (!target || norm(target) === norm(self)) {
        dropped += 1;
      } else if (!seen.has(target)) {
        seen.add(target);
        kept.push(target);
      }
    }
    return kept;
  };
  const filtered = terms.map((t) => ({
    ...t,
    relatedTerms: keep(String(t.term), t.relatedTerms),
    broaderTerms: keep(String(t.term), t.broaderTerms),
    narrowerTerms: keep(String(t.term), t.narrowerTerms),
  }));
  return { terms: filtered, dropped };
}

/**
 * US spellings with an unambiguous UK counterpart. Matched case-sensitively on lower-case
 * words only, so proper nouns ("Department of Defense", "World Trade Center") are not counted.
 * "-ize" endings are left out: Oxford spelling uses them, so they are not an error in UK text.
 */
const US_SPELLINGS =
  /\b(colors?|behaviors?|behavioral|favors?|favorable|favorite|labor|honor|centers?|centered|theaters?|defense|analyzed?|analyzes|analyzing|catalogs?|traveled|traveling|modeled|modeling|enrollment|fulfill)\b/g;

/** Each term whose definition uses a US spelling, with the words found. */
export function usSpellings(terms: GlossaryTermLike[]): { term: string; words: string[] }[] {
  const found: { term: string; words: string[] }[] = [];
  for (const t of terms || []) {
    const words = String(t?.definition || '').match(US_SPELLINGS) || [];
    if (words.length > 0) found.push({ term: String(t?.term || ''), words: [...new Set(words)] });
  }
  return found;
}
