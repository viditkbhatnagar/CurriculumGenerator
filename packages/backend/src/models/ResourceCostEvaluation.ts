import mongoose, { Schema, Document } from 'mongoose';

/**
 * ResourceCostEvaluation Model
 * Stage 3: Tracks paid resources and cost evaluation
 * Simplified version - management approval workflow to be added later
 */

export interface IResourceCostEvaluation extends Document {
  projectId: mongoose.Types.ObjectId;

  resources: Array<{
    resourceName: string;
    resourceType: 'textbook' | 'software' | 'database' | 'tool' | 'license' | 'subscription';
    vendor: string;
    costPerStudent: number;
    estimatedStudents: number;
    totalCost: number;
    isRecurring: boolean;
    recurringPeriod?: 'monthly' | 'annually';
    justification: string;
    detectedIn: string; // Which section of preliminary package
    alternatives: Array<{
      name: string;
      cost: number;
      quality: string; // e.g., "85% functionality"
      limitations: string;
      recommended: boolean;
    }>;
  }>;

  totalEstimatedCost: number;
  hasPaidResources: boolean;

  // Management decision (simplified for now, full workflow later)
  managementDecision: 'pending' | 'approved' | 'rejected' | 'auto_approved';
  decidedBy?: mongoose.Types.ObjectId; // ref: User
  decidedAt?: Date;
  decisionNotes?: string;

  // Final resources after any substitutions
  finalResources: Array<{
    resourceName: string;
    cost: number;
    type: string;
    isAlternative: boolean;
  }>;

  // Track if instructional plan changed due to substitutions
  instructionalPlanChanged: boolean;
  revisedPackageId?: mongoose.Types.ObjectId; // ref: PreliminaryCurriculumPackage

  createdAt: Date;
  updatedAt: Date;
}

const ResourceCostEvaluationSchema = new Schema<IResourceCostEvaluation>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'CurriculumProject',
      required: true,
      unique: true,
    },

    resources: [
      {
        resourceName: { type: String, required: true },
        resourceType: {
          type: String,
          enum: ['textbook', 'software', 'database', 'tool', 'license', 'subscription'],
          required: true,
        },
        vendor: String,
        costPerStudent: { type: Number, default: 0 },
        estimatedStudents: { type: Number, default: 100 },
        totalCost: { type: Number, required: true },
        isRecurring: { type: Boolean, default: false },
        recurringPeriod: { type: String, enum: ['monthly', 'annually'] },
        justification: String,
        detectedIn: String,
        alternatives: [
          {
            name: String,
            cost: { type: Number, default: 0 },
            quality: String,
            limitations: String,
            recommended: { type: Boolean, default: false },
          },
        ],
      },
    ],

    totalEstimatedCost: {
      type: Number,
      required: true,
      default: 0,
    },

    hasPaidResources: {
      type: Boolean,
      required: true,
      default: false,
    },

    managementDecision: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'auto_approved'],
      default: 'auto_approved', // Auto-approve for now, add workflow later
    },

    decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    decidedAt: Date,
    decisionNotes: String,

    finalResources: [
      {
        resourceName: String,
        cost: Number,
        type: String,
        isAlternative: { type: Boolean, default: false },
      },
    ],

    instructionalPlanChanged: {
      type: Boolean,
      default: false,
    },

    revisedPackageId: { type: Schema.Types.ObjectId, ref: 'PreliminaryCurriculumPackage' },
  },
  {
    timestamps: true,
    collection: 'resourcecostevaluations',
  }
);

// Indexes (projectId has unique constraint in field definition)
ResourceCostEvaluationSchema.index({ managementDecision: 1 });
ResourceCostEvaluationSchema.index({ preliminaryPackageId: 1 });
ResourceCostEvaluationSchema.index({ totalEstimatedCost: 1 });
ResourceCostEvaluationSchema.index({ createdAt: -1 });

export const ResourceCostEvaluation = mongoose.model<IResourceCostEvaluation>(
  'ResourceCostEvaluation',
  ResourceCostEvaluationSchema
);
