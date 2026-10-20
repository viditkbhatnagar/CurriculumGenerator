/**
 * Client for the textbook knowledge library (/api/v3/knowledge). Types mirror
 * packages/backend/src/knowledge; only the fields the screens read are declared.
 */
import { fetchAPI } from './api';

const BASE = '/api/v3/knowledge';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export type Licence =
  | 'cc-by'
  | 'cc-by-sa'
  | 'cc-by-nc'
  | 'cc-by-nc-sa'
  | 'cc-by-nc-nd'
  | 'cc-by-nd'
  | 'institution-licensed'
  | 'free-personal-use'
  | 'unknown';

export const LICENCE_LABELS: Record<Licence, string> = {
  'cc-by': 'CC BY',
  'cc-by-sa': 'CC BY-SA',
  'cc-by-nc': 'CC BY-NC',
  'cc-by-nc-sa': 'CC BY-NC-SA',
  'cc-by-nc-nd': 'CC BY-NC-ND',
  'cc-by-nd': 'CC BY-ND',
  'institution-licensed': 'Institution licensed',
  'free-personal-use': 'Free for personal use',
  unknown: 'Licence not recorded',
};

export type BookStatus = 'queued' | 'reading' | 'extracting' | 'ready' | 'failed';
export type Importance = 'core' | 'supporting' | 'advanced' | 'optional';

export interface LibraryBook {
  id: string;
  title: string;
  authors: string[];
  edition: string;
  year?: number;
  publisher: string;
  licence: Licence;
  accessTier: 'teaching' | 'restricted';
  domainKeys: string[];
  programmes: string[];
  providedBy: string;
  sourceUrl: string;
  pageCount: number;
  status: BookStatus;
  error: string | null;
  progress?: { sectionsTotal: number; sectionsDone: number };
  stats?: {
    sections?: number;
    passages?: number;
    restrictedPassages?: number;
    conceptsExtracted?: number;
    conceptsNew?: number;
    conceptsMerged?: number;
    pagesCitedOutsideSection?: number;
  };
  updatedAt: string;
}

export interface OntologyDomain {
  key: string;
  name: string;
  areas: { code: string; name: string; subAreas: string[] }[];
}

export interface ConceptSource {
  role: 'primary' | 'supplementary' | 'critical' | 'additional';
  citation: string;
  treatment: 'mention' | 'treatment' | 'extended';
}

export interface Concept {
  _id: string;
  code: string;
  name: string;
  aliases: string[];
  domainKey: string;
  area: string;
  subArea: string;
  conceptType: string;
  level: string;
  definition: string;
  components: string[];
  formulae: { expression: string; meaning: string }[];
  applications: string[];
  misconceptions: string[];
  prerequisites: string[];
  related: string[];
  skillsEnabled: string[];
  assessmentPossibilities: string[];
  bookCount: number;
  prevalence: number;
  importance: Importance;
  sources?: ConceptSource[];
  similarity?: number;
}

export interface ConceptDetail extends Concept {
  evidence: (ConceptSource & {
    chapter: { number: string; title: string };
    section: { number: string; title: string };
    passages: { pages: string; excerpt: string }[];
  })[];
}

export interface NewBook {
  title: string;
  authors: string;
  edition?: string;
  year?: string;
  publisher?: string;
  licence: Licence;
  licenceStatement?: string;
  domainKeys: string[];
  programmes?: string;
  providedBy?: string;
  accessTier: 'teaching' | 'restricted';
  url?: string;
  file?: File;
}

const unwrap = <T>(res: { data: T }) => res.data;

export const getOntology = () => fetchAPI(`${BASE}/ontology`).then(unwrap<OntologyDomain[]>);
export const getBooks = () => fetchAPI(`${BASE}/books`).then(unwrap<LibraryBook[]>);
export const resumeBook = (id: string) =>
  fetchAPI(`${BASE}/books/${id}/ingest`, { method: 'POST', body: '{}' });

export function getConcepts(params: {
  q?: string;
  domain?: string;
  area?: string;
  importance?: Importance[];
  limit?: number;
}): Promise<Concept[]> {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.domain) qs.set('domain', params.domain);
  if (params.area) qs.set('area', params.area);
  if (params.importance?.length) qs.set('importance', params.importance.join(','));
  qs.set('limit', String(params.limit ?? 60));
  return fetchAPI(`${BASE}/concepts?${qs}`).then(unwrap<Concept[]>);
}

export const getConcept = (code: string) =>
  fetchAPI(`${BASE}/concepts/${encodeURIComponent(code)}`).then(unwrap<ConceptDetail>);

/** Add a book by upload (multipart) or by link (JSON). */
export async function addBook(book: NewBook): Promise<LibraryBook> {
  const fields: Record<string, string> = {
    title: book.title,
    authors: book.authors,
    edition: book.edition || '',
    year: book.year || '',
    publisher: book.publisher || '',
    licence: book.licence,
    licenceStatement: book.licenceStatement || '',
    domainKeys: book.domainKeys.join(','),
    programmes: book.programmes || '',
    providedBy: book.providedBy || '',
    accessTier: book.accessTier,
  };
  if (!book.file) {
    return fetchAPI(`${BASE}/books`, {
      method: 'POST',
      body: JSON.stringify({ ...fields, url: book.url }),
    }).then(unwrap<LibraryBook>);
  }
  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.append(k, v));
  form.append('file', book.file);
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const res = await fetch(`${API_BASE_URL}${BASE}/books`, {
    method: 'POST',
    body: form,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const body = await res.json().catch(() => ({ error: 'Upload failed' }));
  if (!res.ok) throw new Error(body.error || 'Upload failed');
  return body.data;
}

export interface ProgrammeLibrary {
  enabled: boolean;
  domainKeys: string[];
  areas?: string[];
  bookIds?: string[];
}

export const getProgrammeLibrary = (workflowId: string) =>
  fetchAPI(`${BASE}/programmes/${workflowId}`).then(unwrap<ProgrammeLibrary>);

export const setProgrammeLibrary = (workflowId: string, library: ProgrammeLibrary) =>
  fetchAPI(`${BASE}/programmes/${workflowId}`, {
    method: 'PUT',
    body: JSON.stringify(library),
  }).then(unwrap<ProgrammeLibrary>);

/**
 * Concepts by code, e.g. the ones a Step 4 module was built from. With a programme, only what
 * that programme may use: another institution's licensed books are left out.
 */
export const getConceptsByCodes = (codes: string[], programme?: string) =>
  codes.length
    ? fetchAPI(
        `${BASE}/concepts?codes=${encodeURIComponent(codes.join(','))}${
          programme ? `&programme=${encodeURIComponent(programme)}` : ''
        }`
      ).then(unwrap<Concept[]>)
    : Promise.resolve([] as Concept[]);
