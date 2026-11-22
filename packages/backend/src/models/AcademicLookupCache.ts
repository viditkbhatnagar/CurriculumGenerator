/**
 * Cached answers from the academic source databases (OpenAlex, Crossref), keyed by request.
 *
 * OpenAlex meters its API at $0.10 a day, about 100 searches, which is one full Step 5 run
 * for a 46-module programme. Logan Pacey's re-test on 21 November 2026 found every run of the
 * day failing or retrying on that allowance. A search is deterministic enough over a month
 * that repeating it is wasted spend, so each successful response is kept for 30 days and a
 * re-run (or a retry after the allowance ran out half way) only pays for what it has not
 * asked before.
 */
import mongoose, { Schema } from 'mongoose';

export const ACADEMIC_CACHE_TTL_DAYS = 30;

const AcademicLookupCacheSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    body: { type: Schema.Types.Mixed, required: true },
    // MongoDB removes the row once this passes.
    expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
  },
  { timestamps: true }
);

export const AcademicLookupCache: mongoose.Model<any> =
  mongoose.models.AcademicLookupCache ||
  mongoose.model<any>('AcademicLookupCache', AcademicLookupCacheSchema);
