import mongoose, { Schema, Document } from 'mongoose';

/**
 * Book Intelligence — the structured, source-grounded decomposition of a single
 * textbook that a curriculum workflow sourced in Step 5. Produced by the
 * "Step 5.5 / Book Ingestion" stage. See docs/book-ingestion/.
 *
 * The registry lives here (navigation, governance, citation); each node's
 * paraphrased content is ALSO embedded into the existing vector knowledge base
 * (KnowledgeBase collection) so Steps 6–13 can retrieve it. Both layers key on
 * bookId (= this document's _id) and nodeId.
 */

export type BookIngestionStatus =
  | 'queued'
  | 'parsing'
  | 'decomposing'
  | 'embedding'
  | 'needs_review'
  | 'ready'
  | 'failed';

export interface BookIntelligenceNode {
  nodeId: string;
  nodeType: string; // Concept | Claim | Framework | Example | Mechanism | Definition | …
  title: string;
  oneSentenceMeaning: string;
  detailedContent: string; // faithful paraphrase (never verbatim pages)
  sourceLocation: string; // "Book → Chapter → Section → Page"
  mloIds: string[]; // curriculum outcomes this node serves
  relatedNodeIds?: string[];
  tags?: string[];
  evidenceStrength?: string;
  confidence: 'High' | 'Medium' | 'Low';
  derivationType: string; // Direct extraction | Faithful paraphrase | Interpretation | …
  scope?: 'core' | 'peripheral';
  reviewStatus?: 'auto' | 'needs_review' | 'approved';
  embeddingId?: string; // id in the vector KB (KnowledgeBase collection)
}

export interface IBookIntelligence extends Document {
  workflowId: mongoose.Types.ObjectId;
  step5SourceId: string; // the exact Step 5 source this decomposes
  bookTitle: string;
  authors?: string;
  publisher?: string;
  year?: number;
  rightsMode: 'private' | 'internal' | 'educational' | 'commercial' | 'public';
  depth: 'essential' | 'standard' | 'comprehensive' | 'forensic';
  mappedMloIds: string[]; // outcomes the book was sourced for (scoping)
  bookFileId?: string; // S3/GridFS id of the uploaded book file (fetched by the queue job)

  status: BookIngestionStatus;
  lastError?: { message: string; timestamp: Date } | null;

  // Flexible decomposition payload (mirrors the prompt's branches).
  bookRecord?: any;
  sourceMap?: any; // { chapters: [{ id, title, pageRange, ... }] }
  nodes: BookIntelligenceNode[];
  edges: Array<{ from: string; to: string; type: string }>;
  reviewQueue: any[];
  qualityReport?: any;

  // Per-chapter checkpoint so an interrupted ingest resumes instead of
  // restarting (mirrors the Step 13 step13Draft pattern).
  ingestDraft?: {
    chaptersDone?: string[]; // chapter ids already decomposed
    savedAt?: Date;
  };

  createdAt: Date;
  updatedAt: Date;
}

const BookIntelligenceSchema = new Schema<IBookIntelligence>(
  {
    workflowId: {
      type: Schema.Types.ObjectId,
      ref: 'CurriculumWorkflow',
      required: true,
      index: true,
    },
    step5SourceId: { type: String, required: true },
    bookTitle: { type: String, required: true },
    authors: String,
    publisher: String,
    year: Number,
    rightsMode: {
      type: String,
      enum: ['private', 'internal', 'educational', 'commercial', 'public'],
      default: 'internal',
    },
    depth: {
      type: String,
      enum: ['essential', 'standard', 'comprehensive', 'forensic'],
      default: 'standard',
    },
    mappedMloIds: { type: [String], default: [] },
    bookFileId: String,

    status: {
      type: String,
      enum: ['queued', 'parsing', 'decomposing', 'embedding', 'needs_review', 'ready', 'failed'],
      default: 'queued',
      index: true,
    },
    lastError: { type: Schema.Types.Mixed, default: null },

    bookRecord: { type: Schema.Types.Mixed },
    sourceMap: { type: Schema.Types.Mixed },
    // Mixed arrays — typed on the interface, loose in the schema.
    nodes: { type: [Schema.Types.Mixed], default: [] } as any,
    edges: { type: [Schema.Types.Mixed], default: [] } as any,
    reviewQueue: { type: [Schema.Types.Mixed], default: [] } as any,
    qualityReport: { type: Schema.Types.Mixed },
    ingestDraft: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

// One decomposition per (workflow, source) — re-ingesting replaces it.
BookIntelligenceSchema.index({ workflowId: 1, step5SourceId: 1 }, { unique: true });

export const BookIntelligence = mongoose.model<IBookIntelligence>(
  'BookIntelligence',
  BookIntelligenceSchema
);
