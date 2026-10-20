/**
 * The textbook knowledge library's three collections (Rejin's knowledge-base design of
 * 20 October 2026, section 17):
 *
 * - `kbbooks`: the original documents. One row per book edition, with licence, access tier and
 *   the file in S3, plus the table of contents read from it.
 * - `kbpassages`: the structured content. Book -> Chapter -> Section -> Page -> Passage; a
 *   passage never crosses a section and carries the book's printed page labels.
 * - `kbconcepts`: the knowledge objects. A concept is held once however many books teach it,
 *   with every book's treatment as evidence ("These 14 passages are all treatments of
 *   essentially the same concept. They become one knowledge cluster, with 14 supporting
 *   sources").
 *
 * The vector index is a retrieval mechanism over the concepts, not the library itself: see
 * knowledge/retrieval.
 */
import mongoose, { Schema } from 'mongoose';

export const LICENCES = [
  'cc-by',
  'cc-by-sa',
  'cc-by-nc',
  'cc-by-nc-sa',
  'cc-by-nc-nd',
  'cc-by-nd',
  'institution-licensed',
  'free-personal-use',
  'unknown',
] as const;
export type Licence = (typeof LICENCES)[number];

export type BookStatus = 'queued' | 'reading' | 'extracting' | 'ready' | 'failed';

export interface KbBookDoc {
  _id: mongoose.Types.ObjectId;
  title: string;
  authors: string[];
  edition: string;
  year?: number;
  publisher: string;
  isbn: string;
  /** Normalised title + first author: the same work across editions. */
  workKey: string;
  licence: Licence;
  licenceStatement: string;
  licenceUrl: string;
  sourceUrl: string;
  providedBy: string;
  /** "teaching" books feed generation; a "restricted" book (a test bank) never does. */
  accessTier: 'teaching' | 'restricted';
  domainKeys: string[];
  programmes: string[];
  fileId: string;
  fileSha256: string;
  fileBytes: number;
  pageCount: number;
  usedOutline: boolean;
  toc: {
    chapter: string;
    title: string;
    pages: string;
    sections: { number: string; title: string; pages: string; kind: string }[];
  }[];
  status: BookStatus;
  error?: string;
  progress: { sectionsTotal: number; sectionsDone: number; doneKeys: string[] };
  stats: {
    sections: number;
    passages: number;
    restrictedPassages: number;
    conceptsExtracted: number;
    conceptsNew: number;
    conceptsMerged: number;
    pagesCitedOutsideSection: number;
  };
  supersededBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const KbBookSchema = new Schema(
  {
    title: { type: String, required: true },
    authors: { type: [String], default: [] },
    edition: { type: String, default: '' },
    year: Number,
    publisher: { type: String, default: '' },
    isbn: { type: String, default: '' },
    workKey: { type: String, index: true },
    licence: { type: String, enum: LICENCES, default: 'unknown' },
    licenceStatement: { type: String, default: '' },
    licenceUrl: { type: String, default: '' },
    sourceUrl: { type: String, default: '' },
    providedBy: { type: String, default: '' },
    accessTier: { type: String, enum: ['teaching', 'restricted'], default: 'teaching' },
    domainKeys: { type: [String], default: [], index: true },
    programmes: { type: [String], default: [] },
    fileId: { type: String, default: '' },
    fileSha256: { type: String, index: true },
    fileBytes: { type: Number, default: 0 },
    pageCount: { type: Number, default: 0 },
    usedOutline: { type: Boolean, default: false },
    toc: { type: Schema.Types.Mixed, default: [] },
    status: { type: String, default: 'queued', index: true },
    error: String,
    progress: {
      type: Schema.Types.Mixed,
      default: () => ({ sectionsTotal: 0, sectionsDone: 0, doneKeys: [] }),
    },
    stats: { type: Schema.Types.Mixed, default: () => ({}) },
    supersededBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true, minimize: false }
);

export interface KbPassageDoc {
  _id: mongoose.Types.ObjectId;
  bookId: mongoose.Types.ObjectId;
  sectionKey: string;
  order: number;
  chapter: { number: string; title: string };
  section: { number: string; title: string };
  kind: string;
  restricted: boolean;
  text: string;
  pdfPageStart: number;
  pdfPageEnd: number;
  pageLabelStart: string;
  pageLabelEnd: string;
}

const KbPassageSchema = new Schema(
  {
    bookId: { type: Schema.Types.ObjectId, required: true, index: true },
    sectionKey: { type: String, required: true },
    order: { type: Number, default: 0 },
    chapter: { number: String, title: String },
    section: { number: String, title: String },
    kind: { type: String, default: 'body' },
    restricted: { type: Boolean, default: false, index: true },
    text: { type: String, required: true },
    pdfPageStart: Number,
    pdfPageEnd: Number,
    pageLabelStart: String,
    pageLabelEnd: String,
  },
  { timestamps: true }
);
KbPassageSchema.index({ bookId: 1, sectionKey: 1, order: 1 });

export type ConceptType =
  | 'theory'
  | 'framework'
  | 'model'
  | 'method'
  | 'technique'
  | 'algorithm'
  | 'procedure'
  | 'formula'
  | 'principle'
  | 'definition'
  | 'tool'
  | 'regulation';

export type Treatment = 'mention' | 'treatment' | 'extended';
export type EvidenceRole = 'primary' | 'supplementary' | 'critical' | 'additional';
export type Importance = 'core' | 'supporting' | 'advanced' | 'optional';

export interface ConceptEvidence {
  bookId: mongoose.Types.ObjectId;
  bookTitle: string;
  authors: string[];
  edition: string;
  year?: number;
  chapter: { number: string; title: string };
  section: { number: string; title: string };
  sectionKey: string;
  pageLabelStart: string;
  pageLabelEnd: string;
  treatment: Treatment;
  level: string;
  workedExamplePages: string[];
  critique: boolean;
  role: EvidenceRole;
}

export interface KbConceptDoc {
  _id: mongoose.Types.ObjectId;
  code: string;
  name: string;
  key: string;
  aliases: string[];
  aliasKeys: string[];
  aliasCodes?: string[];
  domainKey: string;
  area: string;
  subArea: string;
  conceptType: ConceptType;
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
  evidence: ConceptEvidence[];
  bookCount: number;
  prevalence: number;
  importance: Importance;
  embedding: number[];
  createdAt: Date;
  updatedAt: Date;
}

const KbConceptSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    key: { type: String, required: true, index: true },
    aliases: { type: [String], default: [] },
    aliasKeys: { type: [String], default: [], index: true },
    // Codes of concepts merged into this one by consolidation, so citations of them still resolve.
    aliasCodes: { type: [String], default: [], index: true },
    domainKey: { type: String, index: true },
    area: { type: String, index: true },
    subArea: { type: String, default: '' },
    conceptType: { type: String, default: 'definition' },
    level: { type: String, default: 'intermediate' },
    definition: { type: String, default: '' },
    components: { type: [String], default: [] },
    formulae: { type: Schema.Types.Mixed, default: [] },
    applications: { type: [String], default: [] },
    misconceptions: { type: [String], default: [] },
    prerequisites: { type: [String], default: [] },
    related: { type: [String], default: [] },
    skillsEnabled: { type: [String], default: [] },
    assessmentPossibilities: { type: [String], default: [] },
    evidence: { type: Schema.Types.Mixed, default: [] },
    bookCount: { type: Number, default: 0 },
    prevalence: { type: Number, default: 0 },
    importance: { type: String, default: 'optional', index: true },
    embedding: { type: [Number], default: [] },
  },
  { timestamps: true, minimize: false }
);
KbConceptSchema.index({ domainKey: 1, key: 1 });

/** Atomic per-prefix counters for concept codes (K-STR-0014). */
const KbCounterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } });

/** One row: a version stamp the in-memory concept index compares against. */
const KbMetaSchema = new Schema(
  { _id: String, version: { type: Number, default: 0 } },
  { strict: false }
);

export const KbBook = mongoose.model('KbBook', KbBookSchema, 'kbbooks');
export const KbPassage = mongoose.model('KbPassage', KbPassageSchema, 'kbpassages');
export const KbConcept = mongoose.model('KbConcept', KbConceptSchema, 'kbconcepts');
export const KbCounter = mongoose.model('KbCounter', KbCounterSchema, 'kbcounters');
export const KbMeta = mongoose.model('KbMeta', KbMetaSchema, 'kbmeta');
