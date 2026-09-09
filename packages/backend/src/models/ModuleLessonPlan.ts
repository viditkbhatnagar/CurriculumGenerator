/**
 * One module's lesson plans, stored outside the workflow document.
 *
 * Step 10 writes roughly 18KB per lesson and a module of 45 contact hours holds 30 of them,
 * so a module's plan is about 560KB. A 46-module programme therefore needs some 26MB for
 * Step 10 alone — against MongoDB's hard 16MB document limit, which the whole workflow
 * (Steps 1-13) has to fit inside.
 *
 * The Bachelor in Business Administration reached 16,776,571 bytes of the 16,777,216
 * available: 645 bytes of headroom. Every write then failed, and because the progress
 * callback logged the failure and continued, generation carried on making OpenAI calls that
 * could no longer be saved. The result was silent truncation that got worse as the document
 * filled — modules 1-6 kept all 30 lessons, then 19, 19, 8, 7, 5, 1, and finally nothing at
 * all. Each truncated module still showed as generated, so nobody could see the loss.
 *
 * Trimming the payload was never going to be enough. The bulk is `activities` (8KB) and
 * `instructorNotes` (3.3KB) per lesson: real teaching content, not duplication. The lesson
 * bodies had to leave the document.
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IModuleLessonPlan extends Document {
  workflowId: mongoose.Types.ObjectId;
  moduleId: string;
  moduleCode: string;
  moduleTitle: string;
  moduleDescription?: string;
  totalContactHours: number;
  totalLessons: number;
  /**
   * How many lessons this module is being generated to hold.
   *
   * Recorded by the generator itself on the first saved lesson rather than recomputed by
   * readers, so "is this module finished?" cannot drift from the plan the generator is
   * actually working to. Completeness is `lessons.length >= plannedLessonCount`; the previous
   * test was whether the module had an entry at all, which is why a module holding one lesson
   * of thirty counted as done.
   */
  plannedLessonCount: number;
  lessons: any[];
  pptDecks: any[];
  updatedAt: Date;
  createdAt: Date;
}

const ModuleLessonPlanSchema = new Schema<IModuleLessonPlan>(
  {
    workflowId: {
      type: Schema.Types.ObjectId,
      ref: 'CurriculumWorkflow',
      required: true,
      index: true,
    },
    moduleId: { type: String, required: true },
    moduleCode: { type: String, default: '' },
    moduleTitle: { type: String, default: '' },
    moduleDescription: { type: String, default: '' },
    totalContactHours: { type: Number, default: 0 },
    totalLessons: { type: Number, default: 0 },
    plannedLessonCount: { type: Number, default: 0 },
    // Mixed for the same reason step10 is Mixed on the workflow: the lesson shape is the
    // generator's to define, and a schema here would only reject content it did not predict.
    lessons: { type: Schema.Types.Mixed, default: [] },
    pptDecks: { type: Schema.Types.Mixed, default: [] },
  },
  { timestamps: true, collection: 'modulelessonplans' }
);

// One plan per module per workflow. Unique so a concurrent re-run updates the row rather
// than adding a second copy that would double the module's lessons on read.
ModuleLessonPlanSchema.index({ workflowId: 1, moduleId: 1 }, { unique: true });

export const ModuleLessonPlan = mongoose.model<IModuleLessonPlan>(
  'ModuleLessonPlan',
  ModuleLessonPlanSchema
);
