import mongoose, { Schema, Document } from 'mongoose';

/**
 * CurriculumReview Model
 * Stage 5: Tracks SME review, refinements, approvals, and publication
 */

export interface ICurriculumReview extends Document {
  projectId: mongoose.Types.ObjectId;
  fullCurriculumId: mongoose.Types.ObjectId;

  reviewedBy: mongoose.Types.ObjectId; // SME
  reviewStatus: 'not_started' | 'in_review' | 'refinements_requested' | 'approved' | 'published';

  // Refinement requests from SME
  refinements: Array<{
    refinementId: string;
    materialType: string; // 'module_plan', 'case_study', 'assessment', 'slide_deck'
    materialId: string;
    requestedChange: string;
    appliedAt?: Date;
    appliedBy: string; // AI system
    status: 'pending' | 'applied' | 'rejected';
  }>;

  // SME approval signature
  approvalSignature?: {
    userId: mongoose.Types.ObjectId;
    timestamp: Date;
    ipAddress: string;
    digitalSignature: string;
  };

  // Publication approval (can add management layer later)
  publicationApproval?: {
    adminId: mongoose.Types.ObjectId;
    approvedAt: Date;
    notes?: string;
  };

  // Publication details
  publishedAt?: Date;
  publishedToLMS: boolean;
  lmsId?: string;
  lmsCourseUrl?: string;

  // Rejection details
  rejectionReason?: string;
  rejectedBy?: mongoose.Types.ObjectId;
  rejectedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const CurriculumReviewSchema = new Schema<ICurriculumReview>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'CurriculumProject',
      required: true,
      unique: true,
    },

    fullCurriculumId: {
      type: Schema.Types.ObjectId,
      ref: 'FullCurriculumPackage',
      required: true,
    },

    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    reviewStatus: {
      type: String,
      enum: ['not_started', 'in_review', 'refinements_requested', 'approved', 'published'],
      default: 'not_started',
      required: true,
    },

    refinements: [
      {
        refinementId: String,
        materialType: String,
        materialId: String,
        requestedChange: String,
        appliedAt: Date,
        appliedBy: String,
        status: {
          type: String,
          enum: ['pending', 'applied', 'rejected'],
          default: 'pending',
        },
      },
    ],

    approvalSignature: {
      userId: { type: Schema.Types.ObjectId, ref: 'User' },
      timestamp: Date,
      ipAddress: String,
      digitalSignature: String,
    },

    publicationApproval: {
      adminId: { type: Schema.Types.ObjectId, ref: 'User' },
      approvedAt: Date,
      notes: String,
    },

    publishedAt: Date,

    publishedToLMS: {
      type: Boolean,
      default: false,
    },

    lmsId: String,
    lmsCourseUrl: String,

    rejectionReason: String,
    rejectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectedAt: Date,
  },
  {
    timestamps: true,
    collection: 'curriculumreviews',
  }
);

// Indexes (projectId has unique constraint in field definition)
CurriculumReviewSchema.index({ reviewedBy: 1, reviewStatus: 1 });
CurriculumReviewSchema.index({ reviewStatus: 1 });
CurriculumReviewSchema.index({ publishedAt: -1 });

export const CurriculumReview = mongoose.model<ICurriculumReview>(
  'CurriculumReview',
  CurriculumReviewSchema
);
