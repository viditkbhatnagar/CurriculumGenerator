import mongoose, { Schema, Document } from 'mongoose';
import type {
  OccupationCountry,
  OccupationRecord,
  OccupationSystem,
} from '../services/occupations/occupationParsers';

/**
 * One occupation from a national classification (India NCO 2015, US O*NET, UK SOC 2020,
 * Singapore SSOC 2024), with the vector it is matched by. Loaded from data/occupations by
 * occupationStore.syncOccupations; see data/occupations/SOURCES.md.
 */
export interface IOccupation extends Document, Omit<OccupationRecord, 'system' | 'country'> {
  system: OccupationSystem;
  country: OccupationCountry;
  /** The embedding, shortened to INDEX_DIMENSIONS (occupationIndex). */
  embedding: number[];
  /** Hash of the text and model the embedding was made from, so a sync redoes only changes. */
  textHash: string;
}

const OccupationSchema = new Schema<IOccupation>(
  {
    system: { type: String, required: true },
    country: { type: String, required: true, index: true },
    code: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    tasks: { type: [String], default: [] },
    alternateTitles: { type: [String], default: [] },
    group: { code: String, title: String },
    entryRoutes: { type: String },
    embedding: { type: [Number], select: false },
    textHash: { type: String },
  },
  { timestamps: true, collection: 'occupations' }
);

OccupationSchema.index({ system: 1, code: 1 }, { unique: true });

export const Occupation = mongoose.model<IOccupation>('Occupation', OccupationSchema);
