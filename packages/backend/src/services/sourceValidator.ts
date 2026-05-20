/**
 * Validate + sanitize the payload for manually adding a source to
 * Step 5 (POST /api/v3/workflow/:id/step5/source). Kept in its own
 * module so the rules are unit-testable without the route.
 *
 * SMEs add resources the AI pipeline didn't surface — documents,
 * YouTube links, e-books, articles, physical books. We strip HTML,
 * drop control chars, trim, cap lengths. Required fields are enforced;
 * everything else falls back to a sensible default so the resulting
 * Source object is valid even from a minimal form.
 */

const STRING_MAX = 500;
const NOTES_MAX = 1500;
const AUTHORS_MAX = 20;
const AUTHOR_MAX = 200;
// How many files one source may carry — matches the upload route's cap.
const UPLOADED_FILES_MAX = 10;

// Descriptive resource kind — what the SME is actually adding. Distinct
// from the academic `category` enum (which the AGI pipeline uses).
const RESOURCE_TYPES = [
  'document',
  'video',
  'ebook',
  'article',
  'book',
  'webpage',
  'other',
] as const;
const SOURCE_TYPES = ['academic', 'applied', 'industry'] as const;
const COMPLEXITIES = ['introductory', 'intermediate', 'advanced'] as const;

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

export interface UploadedFileRef {
  fileId: string;
  filename: string;
  mimeType: string;
  size: number;
  storage?: 's3' | 'gridfs';
}

export interface SanitizedSource {
  moduleId: string;
  title: string;
  authors: string[];
  year: number;
  citation: string;
  resourceType: (typeof RESOURCE_TYPES)[number];
  type: (typeof SOURCE_TYPES)[number];
  complexityLevel: (typeof COMPLEXITIES)[number];
  publisher?: string;
  url?: string;
  doi?: string;
  isbn?: string;
  complianceNotes?: string;
  uploadedFile?: UploadedFileRef;
  uploadedFiles?: UploadedFileRef[];
}

/**
 * Validate the optional uploadedFile reference. The actual bytes already
 * live in GridFS (uploaded via POST /api/v3/files/upload) — here we only
 * sanity-check the pointer the client sends back. Returns undefined when
 * no file is attached; throws on a malformed object.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cleanUploadedFile(raw: any): UploadedFileRef | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object') {
    throw new Error('uploadedFile must be an object');
  }
  const fileId = cleanString(raw.fileId, 100);
  const filename = cleanString(raw.filename, 300);
  const mimeType = cleanString(raw.mimeType, 200);
  if (!fileId || !filename) {
    throw new Error('uploadedFile requires fileId and filename');
  }
  const size = typeof raw.size === 'number' && Number.isFinite(raw.size) ? raw.size : 0;
  const storage = raw.storage === 's3' || raw.storage === 'gridfs' ? raw.storage : undefined;
  return {
    fileId,
    filename,
    mimeType: mimeType || 'application/octet-stream',
    size,
    ...(storage ? { storage } : {}),
  };
}

/**
 * Validate the optional uploadedFiles array — the multi-file shape sent
 * by the current "add a source" form (an SME can attach several
 * documents to one source). Returns undefined when nothing is attached;
 * throws on a non-array or a malformed item.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cleanUploadedFiles(raw: any): UploadedFileRef[] | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw)) {
    throw new Error('uploadedFiles must be an array');
  }
  const cleaned: UploadedFileRef[] = [];
  for (const item of raw.slice(0, UPLOADED_FILES_MAX)) {
    const ref = cleanUploadedFile(item);
    if (ref) cleaned.push(ref);
  }
  return cleaned.length ? cleaned : undefined;
}

/**
 * Validate + sanitize. Throws a plain Error with a human-readable
 * message on the first failure — the route returns it as a 400.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function sanitizeSourcePayload(raw: any): SanitizedSource {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Source payload must be a JSON object');
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

  const resourceType = RESOURCE_TYPES.includes(raw.resourceType) ? raw.resourceType : null;
  if (!resourceType) {
    throw new Error(
      'resourceType must be one of: document, video, ebook, article, book, webpage, other'
    );
  }

  const type = SOURCE_TYPES.includes(raw.type) ? raw.type : 'applied';
  const complexityLevel = COMPLEXITIES.includes(raw.complexityLevel)
    ? raw.complexityLevel
    : 'intermediate';

  const publisher = cleanString(raw.publisher, STRING_MAX) || undefined;
  const url = cleanString(raw.url, 1000) || undefined;
  const doi = cleanString(raw.doi, 200) || undefined;
  const isbn = cleanString(raw.isbn, 40) || undefined;
  const complianceNotes = cleanString(raw.complianceNotes, NOTES_MAX) || undefined;
  const uploadedFile = cleanUploadedFile(raw.uploadedFile);
  const uploadedFiles = cleanUploadedFiles(raw.uploadedFiles);

  // Build an APA-ish citation if the client didn't send one. When there
  // are no authors (e.g. a webpage) the citation simply leads with the
  // year — "(2026). Title." — rather than a stray leading space.
  const providedCitation = cleanString(raw.citation, STRING_MAX);
  const authorPart = authors.length ? `${authors.join(', ')} ` : '';
  const citation =
    providedCitation || `${authorPart}(${yearNum}). ${title}.${publisher ? ` ${publisher}.` : ''}`;

  return {
    moduleId,
    title,
    authors,
    year: yearNum,
    citation,
    resourceType,
    type,
    complexityLevel,
    publisher,
    url,
    doi,
    isbn,
    complianceNotes,
    uploadedFile,
    uploadedFiles,
  };
}
