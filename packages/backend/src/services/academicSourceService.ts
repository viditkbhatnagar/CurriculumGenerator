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
  authors: string;
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
  limit?: number;
}

let lastRequestAt = 0;

async function paced<T>(fn: () => Promise<T>): Promise<T> {
  const wait = Math.max(0, REQUEST_SPACING_MS - (Date.now() - lastRequestAt));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
  return fn();
}

async function getJson(url: string, timeoutMs = 20000): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': `curriculum-generator/1.0 (mailto:${CONTACT})` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const formatAuthors = (work: any): string => {
  const names = (work.authorships || [])
    .slice(0, 4)
    .map((a: any) => a.author?.display_name)
    .filter(Boolean);
  if (names.length === 0) return 'Unknown';
  const more = (work.authorships || []).length > 4 ? ' et al.' : '';
  return names.join(', ') + more;
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
    evidence: { source: 'openalex', venueType: source?.type ?? null, openAlexId: work.id || '' },
  };
}

/** Search OpenAlex for works matching a topic. Returns [] rather than throwing. */
export async function searchAcademicSources(
  query: string,
  options: SearchOptions = {}
): Promise<AcademicSource[]> {
  const { fromYear, peerReviewedOnly = false, requireFullText = false, limit = 10 } = options;

  const filters = ['type:article'];
  if (fromYear) filters.push(`from_publication_date:${fromYear}-01-01`);
  if (requireFullText) filters.push('is_oa:true');
  filters.push('has_doi:true');

  const url =
    `${OPENALEX}/works?search=${encodeURIComponent(query)}` +
    `&filter=${filters.join(',')}` +
    `&sort=relevance_score:desc&per-page=${Math.min(50, limit * 3)}&mailto=${CONTACT}`;

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
  } = {}
): Promise<{ sources: AcademicSource[]; peerReviewedPercent: number; shortfall: string | null }> {
  const { target = 6, peerReviewedShare = 0.6, fromYear, requireFullText = false } = options;

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
      limit: 8,
    });
    for (const source of results) {
      const key = source.doi || source.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      (source.isPeerReviewed ? peerReviewed : other).push(source);
    }
    if (peerReviewed.length >= target) break;
  }

  const byImpact = (a: AcademicSource, b: AcademicSource) => b.citedByCount - a.citedByCount;
  peerReviewed.sort(byImpact);
  other.sort(byImpact);

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
