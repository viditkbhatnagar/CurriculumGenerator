/**
 * A reviewer's feedback on one step of one programme, logged as they build it.
 *
 * Rejin asked (21 October 2026) that Dr Sherin and Logan build programmes on their own up to
 * Step 7 and record, step by step, what changed and whether the output is satisfactory. Each
 * entry is one reviewer's view at one moment; a step can collect several as it is regenerated.
 */

import mongoose, { Schema, Document } from 'mongoose';

export type Satisfaction = 'yes' | 'partly' | 'no';

export interface IStepFeedback extends Document {
  workflowId: mongoose.Types.ObjectId;
  stepNumber: number;
  reviewerName: string;
  satisfactory: Satisfaction;
  whatChanged: string;
  comments: string;
  createdAt: Date;
  updatedAt: Date;
}

const StepFeedbackSchema = new Schema<IStepFeedback>(
  {
    workflowId: {
      type: Schema.Types.ObjectId,
      ref: 'CurriculumWorkflow',
      required: true,
      index: true,
    },
    stepNumber: { type: Number, required: true },
    reviewerName: { type: String, required: true },
    satisfactory: { type: String, enum: ['yes', 'partly', 'no'], required: true },
    whatChanged: { type: String, default: '' },
    comments: { type: String, default: '' },
  },
  { timestamps: true }
);

StepFeedbackSchema.index({ createdAt: -1 });

export const StepFeedback = mongoose.model<IStepFeedback>(
  'StepFeedback',
  StepFeedbackSchema,
  'stepfeedback'
);
