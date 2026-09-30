/**
 * Whether the citations a lesson carries are ones Steps 5-6 verified.
 *
 * Both slide-deck citation checks passed without matching anything: with no sources in the
 * context they returned true ("assume valid"), and with sources they returned true if the
 * lesson listed any citation at all ("full validation would require source matching"). A
 * deck built with an empty source list therefore reported its citations valid.
 *
 * A citation matches a verified source when it carries the source's DOI, or its title, or
 * opens the same way as the source's own formatted citation. With no verified sources to
 * compare against the answer is null, not checked, rather than a pass.
 *
 * Pure, no imports, so it can be tested.
 */

export interface VerifiedSourceLike {
  citation?: string;
  title?: string;
  doi?: string;
}

const MIN_TITLE_CHARS = 20;
const TITLE_CHARS = 60;
const CITATION_PREFIX_CHARS = 40;

const normalise = (text: unknown): string =>
  String(text || '')
    .toLowerCase()
    .replace(/https?:\/\/(dx\.)?doi\.org\//g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function matches(citation: string, source: VerifiedSourceLike): boolean {
  const cited = normalise(citation);
  if (!cited) return false;
  const doi = normalise(source.doi);
  if (doi && cited.includes(doi)) return true;
  const title = normalise(source.title).slice(0, TITLE_CHARS).trim();
  if (title.length >= MIN_TITLE_CHARS && cited.includes(title)) return true;
  const own = normalise(source.citation).slice(0, CITATION_PREFIX_CHARS);
  return own.length >= MIN_TITLE_CHARS && cited.startsWith(own);
}

/** The citations that match no verified source. */
export function unmatchedCitations(citations: string[], sources: VerifiedSourceLike[]): string[] {
  return (citations || []).filter((c) => !(sources || []).some((s) => matches(c, s)));
}

/**
 * true when every citation matches a verified source; false when a lesson cites nothing or
 * cites something unverified; null when there are no verified sources to check against.
 */
export function citationsVerified(
  citations: string[],
  sources: VerifiedSourceLike[] | undefined
): boolean | null {
  if (!sources?.length) return null;
  const cited = (citations || []).filter((c) => !!String(c || '').trim());
  if (cited.length === 0) return false;
  return unmatchedCitations(cited, sources).length === 0;
}
