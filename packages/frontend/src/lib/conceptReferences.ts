/**
 * Readable textbook references in place of library concept codes.
 *
 * Steps 1 to 4 stored text such as "(K-DBS-0001, K-DBS-0003)" or "K-MKT-0440" because the
 * prompts asked the model to name concept codes; Logan Pacey's re-test of 2 November 2026 found
 * no readable book reference on those screens. New runs cite "[Ault et al., Principles of Data
 * Science, ch. 1]"; text already stored still holds codes, which the backend resolves
 * (GET /api/v3/knowledge/references) and this module swaps in for display. Pure and framework
 * free; the fetching is in useConceptReferences.
 */

export interface ConceptReference {
  code: string;
  reference: string;
}

const CODE = /K-[A-Z]{3}-\d{4}/g;
/** A bracket or parenthesis holding nothing but codes: "(K-DBS-0001, K-DBS-0003)". */
const CODE_GROUP = /([([])\s*K-[A-Z]{3}-\d{4}(?:\s*[,;&]\s*K-[A-Z]{3}-\d{4})*\s*([)\]])/g;

/** The distinct concept codes in a text, in order of appearance. */
export function findConceptCodes(text: string | undefined | null): string[] {
  if (!text) return [];
  return Array.from(new Set(text.match(CODE) || []));
}

/**
 * The text with each code replaced by its reference. A group made only of codes becomes one
 * bracket of distinct references ("(Ault et al., Principles of Data Science, ch. 1)"); a code
 * with no known reference is left as it was rather than dropped.
 */
export function replaceConceptCodes(
  text: string,
  references: Record<string, string> | ReadonlyMap<string, string>
): string {
  const lookup = (code: string) =>
    references instanceof Map ? references.get(code) : (references as Record<string, string>)[code];
  const grouped = text.replace(CODE_GROUP, (whole, open: string, close: string) => {
    const codes = whole.match(CODE) || [];
    const refs = codes.map(lookup);
    if (refs.some((r) => !r)) return whole;
    return `${open}${Array.from(new Set(refs)).join('; ')}${close}`;
  });
  return grouped.replace(CODE, (code) => lookup(code) || code);
}
