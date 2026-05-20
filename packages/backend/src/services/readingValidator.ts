/**
 * Validate + sanitize the payload for manually adding a reading to
 * Step 6 (POST /api/v3/workflow/:id/step6/reading). Kept in its own
 * module so the rules are unit-testable without spinning up the route.
 *
 * Reads, like activities, are SME-authored free text — we strip HTML,
 * drop control characters, trim, and cap lengths. Required fields are
 * enforced; everything else falls back to a sensible default so the
 * resulting ReadingItem is valid even from a minimal form.
 */

const STRING_MAX = 500;
const NOTES_MAX = 1500;
const AUTHORS_MAX = 20;
const AUTHOR_MAX = 200;

const CATEGORIES = ['core', 'supplementary'] as const;
const CONTENT_TYPES = [
  'textbook_chapter',
  'journal_article',
  'online_article',
  'report',
  'case_study',
  'video',
  'other',
] as const;
const READING_TYPES = ['academic', 'applied', 'industry'] as const;
const COMPLEXITIES = ['introductory', 'intermediate', 'advanced'] as const;
const ASSESSMENT_RELEVANCE = ['high', 'medium', 'low'] as const;

function cleanString(raw: unknown, maxLen = STRING_MAX): string | null {
  if (typeof raw !== 'string') return null;
  const stripped = raw
    .replace(/<[^>]*>/g, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .trim();
  if (!stripped) return null;
  return stripped.length > maxLen ? stripped.slice(0, maxLen) : stripped;
}

function cleanAuthors(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const cleaned: string[] = [];
  for (const a of raw.slice(0, AUTHORS_MAX)) {
    const s = cleanString(a, AUTHOR_MAX);
    if (s) cleaned.push(s);
  }
  return cleaned;
}

export interface SanitizedReading {
  moduleId: string;
  title: string;
  authors: string[];
  year: number;
  citation: string;
  category: (typeof CATEGORIES)[number];
  contentType: (typeof CONTENT_TYPES)[number];
  readingType: (typeof READING_TYPES)[number];
  complexity: (typeof COMPLEXITIES)[number];
  estimatedReadingMinutes: number;
  assessmentRelevance: (typeof ASSESSMENT_RELEVANCE)[number];
  doi?: string;
  url?: string;
  specificChapters?: string;
  pageRange?: string;
  notes?: string;
  suggestedWeek?: string;
  linkedMLOs: string[];
}

/**
 * Validate + sanitize. Throws a plain Error with a human-readable
 * message on the first failure — the route returns it as a 400.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sanitizeReadingPayload(raw: any): SanitizedReading {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Reading payload must be a JSON object');
  }

  const title = cleanString(raw.title);
  if (!title) throw new Error('title is required');

  // Authors are optional — a webpage / video resource often has no
  // clear author. Stored as-is when present, empty array otherwise.
  const authors = cleanAuthors(raw.authors);

  const yearNum = typeof raw.year === 'string' ? parseInt(raw.year, 10) : raw.year;
  if (
    typeof yearNum !== 'number' ||
    !Number.isFinite(yearNum) ||
    yearNum < 1800 ||
    yearNum > 2100
  ) {
    throw new Error('year must be a number between 1800 and 2100');
  }

  const moduleId = cleanString(raw.moduleId, 100);
  if (!moduleId) throw new Error('moduleId is required');

  const category = CATEGORIES.includes(raw.category) ? raw.category : null;
  if (!category) throw new Error('category must be "core" or "supplementary"');

  const contentType = CONTENT_TYPES.includes(raw.contentType) ? raw.contentType : 'other';
  const readingType = READING_TYPES.includes(raw.readingType) ? raw.readingType : 'academic';
  const complexity = COMPLEXITIES.includes(raw.complexity) ? raw.complexity : 'intermediate';
  const assessmentRelevance = ASSESSMENT_RELEVANCE.includes(raw.assessmentRelevance)
    ? raw.assessmentRelevance
    : 'medium';

  const estimatedReadingMinutesRaw =
    typeof raw.estimatedReadingMinutes === 'string'
      ? parseInt(raw.estimatedReadingMinutes, 10)
      : raw.estimatedReadingMinutes;
  const estimatedReadingMinutes =
    typeof estimatedReadingMinutesRaw === 'number' && Number.isFinite(estimatedReadingMinutesRaw)
      ? Math.max(0, Math.min(600, Math.round(estimatedReadingMinutesRaw)))
      : 60;

  const linkedMLOs = Array.isArray(raw.linkedMLOs)
    ? raw.linkedMLOs
        .map((m: unknown) => cleanString(m, 100))
        .filter((s: string | null): s is string => !!s)
        .slice(0, 30)
    : [];

  const doi = cleanString(raw.doi, 200) || undefined;
  const url = cleanString(raw.url, 1000) || undefined;
  const specificChapters = cleanString(raw.specificChapters, STRING_MAX) || undefined;
  const pageRange = cleanString(raw.pageRange, 100) || undefined;
  const notes = cleanString(raw.notes, NOTES_MAX) || undefined;
  const suggestedWeek = cleanString(raw.suggestedWeek, 100) || undefined;

  // Build a citation if the client didn't send one — APA-ish.
  const providedCitation = cleanString(raw.citation, STRING_MAX);
  const authorPart = authors.length ? `${authors.join(', ')} ` : '';
  const citation = providedCitation || `${authorPart}(${yearNum}). ${title}.`;

  return {
    moduleId,
    title,
    authors,
    year: yearNum,
    citation,
    category,
    contentType,
    readingType,
    complexity,
    estimatedReadingMinutes,
    assessmentRelevance,
    doi,
    url,
    specificChapters,
    pageRange,
    notes,
    suggestedWeek,
    linkedMLOs,
  };
}
