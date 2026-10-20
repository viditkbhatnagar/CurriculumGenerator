/**
 * One module's Step 12 assignment packs, stored outside the workflow document.
 *
 * A module's three delivery variants come to 30-50KB (about 12KB each on the BBA, 16KB the
 * largest), so a 46-module programme needs around 1.7MB for Step 12. On 20 October 2026 the
 * BBA's document stood at 15.32MB of MongoDB's 16MB limit, with 110 of its 138 variants still
 * to be regenerated: replacing them would have added 1.2-1.6MB against 1.46MB of headroom.
 * Step 10 burst the limit the same way (see ModuleLessonPlan); the packs leave the document
 * before they can.
 *
 * The workflow keeps a stub per module (services/step12Store): ids, titles and each variant's
 * assignmentId, which is all the completeness rule reads. Content is read through
 * `withPacks`, which every reader of pack content goes through.
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IModuleAssignmentPack extends Document {
  workflowId: mongoose.Types.ObjectId;
  moduleId: string;
  moduleCode: string;
  moduleTitle: string;
  variants: Record<string, any>;
  updatedAt: Date;
  createdAt: Date;
}

const ModuleAssignmentPackSchema = new Schema<IModuleAssignmentPack>(
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
    variants: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, minimize: false }
);

ModuleAssignmentPackSchema.index({ workflowId: 1, moduleId: 1 }, { unique: true });

export const ModuleAssignmentPack = mongoose.model<IModuleAssignmentPack>(
  'ModuleAssignmentPack',
  ModuleAssignmentPackSchema,
  'moduleassignmentpacks'
);
