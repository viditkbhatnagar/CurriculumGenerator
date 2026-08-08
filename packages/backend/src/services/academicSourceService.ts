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
 * Does this title announce its own retraction?
 *
 * A cheap backstop for the registry checks, and the only check available for sources
 * that carry no DOI at all. Publishers mark retractions in the title itself, either as
 * a leading marker ("RETRACTED: ...", "RETRACTED ARTICLE: ...") or a trailing
 * parenthetical ("... (Retracted)").
 *
 * Deliberately narrow. A bare /retract/ substring test was measured against 50 works
 * from this programme's own subject fields and produced 15 false positives, flagging
 * both topology papers where "retract" is a technical noun ("Retracts of hypercubes")
 * and meta-research legitimately about retraction ("Why and how do journals retract
 * articles?"). "withdrawn" and "removed" are not matched: both registries already
 * report them, and neither had a measured negative sample to justify the risk.
 */
export function looksRetracted(title: string): boolean {
  const text = String(title || '')
    // Publishers sometimes wrap the marker in markup: "<i>Retracted</i>: ...".
    .replace(/<[^>]+>/g, '')
    .trim();
  return (
    /^\s*retracted\b[^:\-–]{0,24}?\s*(?::|-|–|\b(?=article\b))/i.test(text) ||
    /\(\s*retracted\s*\)\s*$/i.test(text)
  );
}

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
  // Defence in depth behind the is_retracted filter, and the only guard that applies
  // when a work arrives from anywhere other than a filtered search. Compared against
  // `true` rather than tested for truthiness so an absent field never drops good work.
  if (work.is_retracted === true) return null;
  if (looksRetracted(work.display_name)) {
    loggingService.warn('Dropped a source whose title announces a retraction', {
      title: String(work.display_name).slice(0, 160),
      doi: work.doi || null,
    });
    return null;
  }
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

  /**
   * A field carrying under this share of the programme's literature is noise.
   *
   * Set with margin deliberately. In the Business Administration distribution
   * Medicine sits at roughly 4% — high enough that a 4% bar would have re-admitted
   * the clinical papers this filter exists to exclude. At 8% that programme
   * resolves to Social Sciences, Business/Management and Economics, which is what
   * a business degree should cite. The cost is losing a genuinely adjacent field
   * that happens to fall below the bar; a module short of sources says so, which
   * is recoverable, whereas an off-topic citation reads as authoritative.
   */
  const MIN_SHARE = 0.08;
  const MAX_FIELDS = 6;

  /**
   * Never confine a search to one or two fields. A flat distribution used to
   * collapse to the single largest, which put a Business Administration degree
   * entirely inside Psychology — on-topic-looking, but with every
   * business-and-management journal excluded.
   */
  const MIN_FIELDS = 3;

  const ranked = groups.map((g: any) => String(g.key).replace('https://openalex.org/', ''));
  const kept = groups
    .filter((g: any) => g.count / total >= MIN_SHARE)
    .slice(0, MAX_FIELDS)
    .map((g: any) => String(g.key).replace('https://openalex.org/', ''));

  for (const field of ranked) {
    if (kept.length >= MIN_FIELDS) break;
    if (!kept.includes(field)) kept.push(field);
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
  // Never return retracted work. OpenAlex populates is_retracted on every work and
  // accepts it as a server-side filter, so this costs nothing and reclaims a slot in
  // the fixed 50-result page instead of spending one on a paper that must be discarded.
  filters.push('is_retracted:false');

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

  // Two queries per module, not five.
  //
  // The daily OpenAlex allowance is $0.10, and a works request costs $0.001 - about 100
  // requests a day. This loop used to allow five per module, so a 46-module programme
  // could ask for 231 and cross the ceiling mid-run. That does not fail cleanly: once a
  // 429 arrives every remaining module silently ends up with no academic sources, and
  // the step only throws if the whole programme got none, so a half-empty curriculum
  // gets saved looking finished. Capping the fan-out keeps the worst case at 93.
  const MAX_QUERIES_PER_MODULE = 2;
  const queries = [moduleTitle, ...topics]
    .filter((q) => typeof q === 'string' && q.trim().length > 3)
    .slice(0, MAX_QUERIES_PER_MODULE);

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
  //
  // Peer-reviewed candidates fill the list first, up to the target. The previous
  // expression was `peerReviewed.slice(0, Math.max(wantPeerReviewed, target - other.length))`,
  // which capped peer-reviewed picks at `target - other.length` whenever any
  // non-peer-reviewed candidate existed: with a target of 6 and two others in hand it
  // took 4 peer-reviewed papers and gave the last two slots away, no matter how many
  // peer-reviewed candidates were sitting unused. That is why so many modules reported
  // exactly 67% — four of six — rather than what the search actually found.
  const chosen = peerReviewed.slice(0, target);
  const usedOther: AcademicSource[] = [];
  for (const source of other) {
    if (chosen.length >= target) break;
    chosen.push(source);
    usedOther.push(source);
  }

  const actualPeerReviewed = chosen.filter((s) => s.isPeerReviewed).length;
  const percent = chosen.length ? Math.round((actualPeerReviewed / chosen.length) * 100) : 0;

  // Two different shortfalls, reported separately because they mean different things:
  // not enough peer-reviewed work exists on the topic, versus the list had to be padded
  // with material that is open but unrefereed (the SME's "unknown/unclear academic
  // source - review before proceeding" case).
  const shortfalls: string[] = [];
  if (percent < peerReviewedShare * 100) {
    shortfalls.push(
      `Only ${actualPeerReviewed} of ${chosen.length} sources for "${moduleTitle}" are peer-reviewed (${percent}%). Searching found no more that met the filters.`
    );
  }
  if (usedOther.length > 0) {
    shortfalls.push(
      `${usedOther.length} source(s) for "${moduleTitle}" are open but not peer-reviewed and should be reviewed before use: ${usedOther
        .map((s) => `"${s.title}"`)
        .join(', ')}.`
    );
  }

  return {
    sources: chosen,
    peerReviewedPercent: percent,
    shortfall: shortfalls.length ? shortfalls.join(' ') : null,
  };
}
