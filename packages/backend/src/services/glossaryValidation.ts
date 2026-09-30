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
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Terms whose definition uses the term itself, such as "Liquidity risk: the risk that
 * liquidity...". A reader who needs the definition cannot use one that assumes it.
 */
export function circularDefinitions(terms: GlossaryTermLike[]): string[] {
  const circular: string[] = [];
  for (const t of terms || []) {
    const term = String(t?.term || '').trim();
    const definition = String(t?.definition || '');
    if (!term || !definition) continue;
    const pattern = new RegExp(`(^|[^A-Za-z0-9])${escapeRegExp(term)}($|[^A-Za-z0-9])`, 'i');
    if (pattern.test(definition)) circular.push(term);
  }
  return circular;
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
