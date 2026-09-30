/**
 * A stored AGU course draft: one catalogue course being developed by faculty.
 *
 * Its own collection, one document per course draft, so a course's package never shares the
 * 16MB document ceiling with anything else (the v3 workflow keeps a whole programme in one
 * document and has hit that limit). Status is derived from the stored findings, never set
 * optimistically: a draft with blocking findings is 'needs_faculty', and a failed generation
 * stays 'failed' with its error recorded.
 */
import mongoose, { Document, Schema } from 'mongoose';
import { CourseDraft, Finding } from '../draft/types';
import { FacultyInputs, OfferedSource } from '../generation/outlinePrompt';

export type DraftStatus =
  | 'created'
  | 'generating'
  | 'failed'
  | 'needs_faculty'
  | 'ready_for_review'
  | 'faculty_accepted';

export interface StageRun {
  stage: 'outline' | 'repair' | 'faculty_edit';
  status: 'running' | 'succeeded' | 'failed';
  startedAt: Date;
  finishedAt?: Date;
  model?: string;
  promptVersion?: string;
  sourcesOffered?: number;
  guidancePassages?: number;
  readingsDropped?: number;
  blockingFindings?: number;
  error?: string;
}

export interface IAguCourseDraft extends Document {
  courseCode: string;
  catalogueVersion: string;
  version: number;
  status: DraftStatus;
  facultyInputs: FacultyInputs;
  draft?: CourseDraft;
  findings: Finding[];
  sourcesOffered: OfferedSource[];
  stageRuns: StageRun[];
  acceptedBy?: string;
  acceptedAt?: Date;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StageRunSchema = new Schema<StageRun>(
  {
    stage: { type: String, required: true },
    status: { type: String, required: true },
    startedAt: { type: Date, required: true },
    finishedAt: Date,
    model: String,
    promptVersion: String,
    sourcesOffered: Number,
    guidancePassages: Number,
    readingsDropped: Number,
    blockingFindings: Number,
    error: String,
  },
  { _id: false }
);

const AguCourseDraftSchema = new Schema<IAguCourseDraft>(
  {
    courseCode: { type: String, required: true, index: true },
    catalogueVersion: { type: String, required: true },
    version: { type: Number, default: 1 },
    status: { type: String, default: 'created', index: true },
    facultyInputs: { type: Schema.Types.Mixed, default: {} },
    draft: { type: Schema.Types.Mixed },
    findings: { type: Schema.Types.Mixed, default: [] },
    sourcesOffered: { type: Schema.Types.Mixed, default: [] },
    stageRuns: { type: [StageRunSchema], default: [] },
    acceptedBy: String,
    acceptedAt: Date,
    createdBy: String,
  },
  { timestamps: true, collection: 'agucoursedrafts' }
);

export const AguCourseDraft = mongoose.model<IAguCourseDraft>(
  'AguCourseDraft',
  AguCourseDraftSchema
);
