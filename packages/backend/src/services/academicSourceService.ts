/**
 * Real academic sources, looked up rather than written.
 *
 * Step 5 used to ask the model to produce citations. Model-written citations do
 * not survive checking: of ten DOIs sampled from a generated Business
 * Administration curriculum, six did not exist, three resolved to unrelated
 * papers — one SSRN identifier was reused for two different "sources", and
 * actually belongs to a paper on stream modelling — and one was correct. A
 * bibliography like that flows into reading lists, lesson plans, assignments and
 * exams, so the fix is not to ask for better citations but to stop inventing
 * them.
 *
 * Everything here comes from OpenAlex, which is free, needs no key, indexes
 * ~250M works, and reports for each one whether it appeared in a peer-reviewed
 * journal and whether a full text is legally free to read. Crossref is used to
 * confirm a DOI when one is supplied. Both ask callers to identify themselves by
 * email for their "polite pool"; without it they throttle harder.
 */
import { loggingService } from './loggingService';

const OPENALEX = 'https://api.openalex.org';
const CROSSREF = 'https://api.crossref.org';
const CONTACT = process.env.ACADEMIC_API_CONTACT || 'curriculum@learnerseducation.com';

/** OpenAlex asks for <10 req/s on the polite pool; stay well inside it. */
const REQUEST_SPACING_MS = 150;

export interface AcademicSource {
  title: string;
  /**
   * One entry per author, APA 7 surname-initial form. An array rather than a
   * joined string because that is what the rest of the workflow expects: the
   * Step 5 view renders `authors.join(', ')`, and the Step 6 reading-list prompt
   * does the same. A string here type-checks against `any` step data and then
   * fails at runtime.
   */
  authors: string[];
  year: number | null;
  venue: string;
  publisher: string;
  doi: string | null;
  /** Landing page for the work. */
  url: string;
  /** Direct link to a legally free full text, when one exists. */
  pdfUrl: string | null;
  isPeerReviewed: boolean;
  isOpenAccess: boolean;
  citedByCount: number;
  /** OpenAlex's subject classification, recorded so off-topic drift is auditable. */
  subjectField: string | null;
  /** Present so a caller can show why a source was considered credible. */
  evidence: { source: 'openalex'; venueType: string | null; openAlexId: string };
}

export interface SearchOptions {
  /** Only works published in or after this year. */
  fromYear?: number;
  /** Require a peer-reviewed journal venue. */
  peerReviewedOnly?: boolean;
  /** Require a free full text the learner can actually open. */
  requireFullText?: boolean;
  /**
   * OpenAlex subject field ids ("fields/14") to confine results to. Without
   * this a search for a module called "Introduction to Management &
   * Organisations" returns clinical medicine, because "management" in the
   * medical literature means managing a disease and those papers are cited
   * orders of magnitude more often than any business article. See
   * {@link deriveSubjectFields}.
   */
  subjectFields?: string[];
  limit?: number;
}

let lastRequestAt = 0;

async function paced<T>(fn: () => Promise<T>): Promise<T> {
  const wait = Math.max(0, REQUEST_SPACING_MS - (Date.now() - lastRequestAt));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
  return fn();
}

/**
 * Raised when the lookup service will not answer any more requests today.
 *
 * OpenAlex meters its API: a works search costs $0.001 against a small daily
 * allowance, and a 46-module programme spends roughly one allowance per full
 * Step 5 run. Once it is gone every subsequent call returns 429 until midnight
 * UTC, so there is no point retrying the remaining modules — and, more
 * importantly, this must not be mistaken for "no sources exist". Falling back to
 * model-written citations here would quietly reintroduce the fabrications this
 * service exists to prevent.
 */
export class SourceLookupUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SourceLookupUnavailable';
  }
}

async function getJson(url: string, timeoutMs = 20000): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': `curriculum-generator/1.0 (mailto:${CONTACT})` },
    });
    if (res.status === 429) {
      const resetSeconds = Number(res.headers.get('x-ratelimit-reset') || 0);
      const hours = resetSeconds ? Math.ceil(resetSeconds / 3600) : null;
      throw new SourceLookupUnavailable(
        'The academic source database (OpenAlex) has reached its daily request allowance' +
          (hours ? `, which resets in about ${hours}h.` : '.')
      );
    }
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    if (error instanceof SourceLookupUnavailable) throw error;
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * "Jane A. Smith" -> "Smith, J. A.", the form APA 7 reference lists use.
 *
 * Corporate authors ("World Health Organization") have no surname to invert and
 * are returned unchanged.
 */
const toApaName = (displayName: string): string => {
  const parts = String(displayName).trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] || '';

  const surname = parts[parts.length - 1];
  const initials = parts
    .slice(0, -1)
    .map((part) => `${part[0].toUpperCase()}.`)
    .join(' ');
  return `${surname}, ${initials}`;
};

/** APA 7 lists up to 20 authors before eliding; beyond that it abbreviates. */
const MAX_LISTED_AUTHORS = 20;

const formatAuthors = (work: any): string[] => {
  const names = (work.authorships || [])
    .map((a: any) => a.author?.display_name)
    .filter(Boolean)
    .map(toApaName)
    .filter(Boolean);
  return names.length > 0 ? names.slice(0, MAX_LISTED_AUTHORS) : ['Unknown'];
};

/** Join an author list the way a reference list reads. */
export const citationAuthors = (authors: string[]): string => {
  if (authors.length === 0) return 'Unknown';
  if (authors.length === 1) return authors[0];
  if (authors.length > 6) return `${authors[0]} et al.`;
  return `${authors.slice(0, -1).join(', ')}, & ${authors[authors.length - 1]}`;
};

/**
 * A work counts as peer-reviewed when it appeared in a journal or conference
 * proceedings. Preprint servers and repositories host unrefereed material, so
 * they are excluded however reputable they are — that distinction is the whole
 * point of the figure the university is asking us to report.
 */
const isPeerReviewedVenue = (work: any): boolean => {
  const source = work.primary_location?.source;
  const venueType = source?.type;
  if (!venueType) return false;
  if (work.type === 'preprint') return false;
  if (source?.is_in_doaj) return true;
  return venueType === 'journal' || venueType === 'conference';
};

function toSource(work: any): AcademicSource | null {
  if (!work?.display_name) return null;
  const source = work.primary_location?.source;
  const oa = work.open_access || {};
  const doi = work.doi ? String(work.doi).replace(/^https?:\/\/doi\.org\//, '') : null;

  return {
    title: String(work.display_name).trim(),
    authors: formatAuthors(work),
    year: work.publication_year ?? null,
    venue: source?.display_name || '',
    publisher: source?.host_organization_name || source?.display_name || '',
    doi,
    url: work.doi || work.primary_location?.landing_page_url || '',
    pdfUrl: oa.oa_url || work.best_oa_location?.pdf_url || null,
    isPeerReviewed: isPeerReviewedVenue(work),
    isOpenAccess: !!oa.is_oa,
    citedByCount: work.cited_by_count || 0,
    subjectField: work.primary_topic?.field?.display_name || null,
    evidence: { source: 'openalex', venueType: source?.type ?? null, openAlexId: work.id || '' },
  };
}

/**
 * Work out which subject fields a programme belongs to, so module searches can
 * be confined to them.
 *
 * This deliberately uses `group_by`, which aggregates over every matching work
 * rather than the first page of results. Tallying the fields of the top 50 hits
 * does not work: those hits are exactly the polluted ones, so a business
 * programme "derives" Medicine from its own bad results and then admits more of
 * them. Aggregate counts across hundreds of thousands of works are not swayed by
 * a handful of heavily-cited outliers.
 *
 * One request per programme. Returns [] if it cannot tell, which leaves search
 * unconstrained rather than wrongly narrowed.
 */
export async function deriveSubjectFields(programmeText: string): Promise<string[]> {
  const text = String(programmeText || '')
    .trim()
    .slice(0, 300);
  if (text.length < 4) return [];

  const url =
    `${OPENALEX}/works?search=${encodeURIComponent(text)}` +
    `&filter=type:article&group_by=primary_topic.field.id&mailto=${CONTACT}`;

  const data = await paced(() => getJson(url));
  const groups = (data?.group_by || []).filter((g: any) => g.key && g.key !== 'unknown');
  if (groups.length === 0) return [];

  const total = groups.reduce((sum: number, g: any) => sum + (g.count || 0), 0);
  if (total === 0) return [];

  /** A field carrying under this share of the programme's literature is noise. */
  const MIN_SHARE = 0.04;
  const MAX_FIELDS = 8;

  const kept = groups
    .filter((g: any) => g.count / total >= MIN_SHARE)
    .slice(0, MAX_FIELDS)
    .map((g: any) => String(g.key).replace('https://openalex.org/', ''));

  // Always keep the strongest field, even if the distribution is very flat.
  if (kept.length === 0) {
    kept.push(String(groups[0].key).replace('https://openalex.org/', ''));
  }

  loggingService.info('Derived subject fields for programme', {
    programme: text.slice(0, 60),
    fields: kept,
  });
  return kept;
}

/** Search OpenAlex for works matching a topic. Returns [] rather than throwing. */
export async function searchAcademicSources(
  query: string,
  options: SearchOptions = {}
): Promise<AcademicSource[]> {
  const {
    fromYear,
    peerReviewedOnly = false,
    requireFullText = false,
    subjectFields,
    limit = 10,
  } = options;

  const filters = ['type:article'];
  if (fromYear) filters.push(`from_publication_date:${fromYear}-01-01`);
  if (requireFullText) filters.push('is_oa:true');
  if (subjectFields?.length) filters.push(`primary_topic.field.id:${subjectFields.join('|')}`);
  filters.push('has_doi:true');

  const url =
    `${OPENALEX}/works?search=${encodeURIComponent(query)}` +
    `&filter=${filters.join(',')}` +
    // A request costs the same whatever the page size, and the metered daily
    // allowance is small, so always take the largest page and filter locally.
    `&sort=relevance_score:desc&per-page=50&mailto=${CONTACT}`;

  const data = await paced(() => getJson(url));
  if (!data?.results) {
    loggingService.warn('OpenAlex returned nothing for query', { query });
    return [];
  }

  let sources = data.results.map(toSource).filter(Boolean) as AcademicSource[];
  if (peerReviewedOnly) sources = sources.filter((s) => s.isPeerReviewed);
  if (requireFullText) sources = sources.filter((s) => !!s.pdfUrl);

  return sources.slice(0, limit);
}

/**
 * Confirm a DOI exists and return what it actually is.
 *
 * Used to check citations that came from anywhere other than a lookup. A DOI
 * resolving is not enough — the earlier fabrications included real DOIs
 * attached to the wrong papers — so the caller gets the true title back and can
 * compare it against what was claimed.
 */
export async function verifyDoi(
  doi: string
): Promise<{ exists: boolean; title?: string; year?: number }> {
  const clean = String(doi)
    .replace(/^https?:\/\/doi\.org\//, '')
    .trim();
  if (!clean) return { exists: false };

  const data = await paced(() =>
    getJson(`${CROSSREF}/works/${encodeURIComponent(clean)}?mailto=${CONTACT}`)
  );
  const message = data?.message;
  if (!message) return { exists: false };

  return {
    exists: true,
    title: Array.isArray(message.title) ? message.title[0] : message.title,
    year: message.published?.['date-parts']?.[0]?.[0],
  };
}

/** How close two titles are, 0-1, for checking a DOI matches its claimed work. */
export function titleSimilarity(a: string, b: string): number {
  const words = (s: string) =>
    new Set(
      String(s)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3)
    );
  const left = words(a);
  const right = words(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const w of left) if (right.has(w)) shared += 1;
  return shared / Math.min(left.size, right.size);
}

/**
 * Assemble sources for one module, aiming at a peer-reviewed share.
 *
 * Several queries are run because a single phrase rarely covers a module, and
 * peer-reviewed results are taken first so the target is met by what is actually
 * found rather than by relabelling. Falling short is reported, not papered over.
 */
export async function gatherModuleSources(
  moduleTitle: string,
  topics: string[],
  options: {
    target?: number;
    peerReviewedShare?: number;
    fromYear?: number;
    requireFullText?: boolean;
    subjectFields?: string[];
  } = {}
): Promise<{ sources: AcademicSource[]; peerReviewedPercent: number; shortfall: string | null }> {
  const {
    target = 6,
    peerReviewedShare = 0.6,
    fromYear,
    requireFullText = false,
    subjectFields,
  } = options;

  const queries = [moduleTitle, ...topics.slice(0, 4)].filter(
    (q) => typeof q === 'string' && q.trim().length > 3
  );

  const seen = new Set<string>();
  const peerReviewed: AcademicSource[] = [];
  const other: AcademicSource[] = [];

  for (const query of queries) {
    const results = await searchAcademicSources(query, {
      fromYear,
      requireFullText,
      subjectFields,
      limit: 50,
    });
    for (const source of results) {
      const key = source.doi || source.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      (source.isPeerReviewed ? peerReviewed : other).push(source);
    }
    if (peerReviewed.length >= target) break;
  }

  // Kept in relevance order. Sorting by citation count was what surfaced
  // clinical practice guidelines for a module called "Introduction to
  // Management & Organisations": the most-cited open-access papers matching
  // almost any query are biomedical, by a wide margin. Relevance is what a
  // reading list needs; the subject-field filter supplies the credibility floor.
  const wantPeerReviewed = Math.ceil(target * peerReviewedShare);
  const chosen = [...peerReviewed.slice(0, Math.max(wantPeerReviewed, target - other.length))];
  for (const source of other) {
    if (chosen.length >= target) break;
    chosen.push(source);
  }

  const actualPeerReviewed = chosen.filter((s) => s.isPeerReviewed).length;
  const percent = chosen.length ? Math.round((actualPeerReviewed / chosen.length) * 100) : 0;

  return {
    sources: chosen,
    peerReviewedPercent: percent,
    shortfall:
      percent < peerReviewedShare * 100
        ? `Only ${actualPeerReviewed} of ${chosen.length} sources for "${moduleTitle}" are peer-reviewed (${percent}%). Searching found no more that met the filters.`
        : null,
  };
}
