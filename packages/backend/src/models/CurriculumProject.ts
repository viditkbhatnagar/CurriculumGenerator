import mongoose, { Schema, Document } from 'mongoose';

/**
 * CurriculumProject Model
 * Tracks curriculum development projects through the 5-stage workflow
 * Stage 1: Prompt Selection
 * Stage 2: AI Research & SME Review
 * Stage 3: Resource Cost Evaluation
 * Stage 4: Curriculum Generation
 * Stage 5: Final Review & Launch
 */

export interface ICurriculumProject extends Document {
  promptId: mongoose.Types.ObjectId;
  smeId: mongoose.Types.ObjectId;
  projectName: string;
  courseCode: string; // e.g., "CHRP"

  // Current workflow state
  status:
    | 'prompt_selected'
    | 'research'
    | 'cost_review'
    | 'generation'
    | 'final_review'
    | 'published'
    | 'cancelled';
  currentStage: number; // 1-5

  // Stage progress tracking
  stageProgress: {
    stage1?: {
      completedAt: Date;
      promptSelected: mongoose.Types.ObjectId;
    };
    stage2?: {
      startedAt?: Date;
      completedAt?: Date;
      preliminaryPackageId?: mongoose.Types.ObjectId;
      chatMessageCount?: number;
      refinementCount?: number;
    };
    stage3?: {
      startedAt?: Date;
      completedAt?: Date;
      hasPaidResources?: boolean;
      costEvaluationId?: mongoose.Types.ObjectId;
      totalCost?: number;
      approved?: boolean;
    };
    stage4?: {
      startedAt?: Date;
      completedAt?: Date;
      fullCurriculumId?: mongoose.Types.ObjectId;
      materialsGenerated?: {
        modulePlans: number;
        caseStudies: number;
        simulations: number;
        mcqSets: number;
        slideDecks: number;
      };
    };
    stage5?: {
      startedAt?: Date;
      completedAt?: Date;
      reviewId?: mongoose.Types.ObjectId;
      refinementsRequested?: number;
      approvedAt?: Date;
      publishedAt?: Date;
      publishedToLMS?: boolean;
      lmsCourseId?: string;
    };
  };

  // Timeline tracking
  timeline: {
    promptSelectionTime?: number; // minutes
    researchTime?: number; // minutes
    costReviewTime?: number; // minutes
    generationTime?: number; // minutes
    finalReviewTime?: number; // minutes
    totalTime?: number; // minutes
  };

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  cancelledAt?: Date;
  cancelReason?: string;
}

const CurriculumProjectSchema = new Schema<ICurriculumProject>(
  {
    promptId: {
      type: Schema.Types.ObjectId,
      ref: 'CoursePrompt',
      required: true,
      index: true,
    },

    smeId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    projectName: {
      type: String,
      required: true,
      trim: true,
    },

    courseCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    status: {
      type: String,
      enum: [
        'prompt_selected',
        'research',
        'cost_review',
        'generation',
        'final_review',
        'published',
        'cancelled',
      ],
      default: 'prompt_selected',
      required: true,
      index: true,
    },

    currentStage: {
      type: Number,
      min: 1,
      max: 5,
      default: 1,
      required: true,
      index: true,
    },

    stageProgress: {
      stage1: {
        completedAt: Date,
        promptSelected: { type: Schema.Types.ObjectId, ref: 'CoursePrompt' },
      },
      stage2: {
        startedAt: Date,
        completedAt: Date,
        preliminaryPackageId: { type: Schema.Types.ObjectId, ref: 'PreliminaryCurriculumPackage' },
        chatMessageCount: { type: Number, default: 0 },
        refinementCount: { type: Number, default: 0 },
      },
      stage3: {
        startedAt: Date,
        completedAt: Date,
        hasPaidResources: Boolean,
        costEvaluationId: { type: Schema.Types.ObjectId, ref: 'ResourceCostEvaluation' },
        totalCost: Number,
        approved: Boolean,
      },
      stage4: {
        startedAt: Date,
        completedAt: Date,
        fullCurriculumId: { type: Schema.Types.ObjectId, ref: 'FullCurriculumPackage' },
        materialsGenerated: {
          modulePlans: { type: Number, default: 0 },
          caseStudies: { type: Number, default: 0 },
          simulations: { type: Number, default: 0 },
          mcqSets: { type: Number, default: 0 },
          slideDecks: { type: Number, default: 0 },
        },
      },
      stage5: {
        startedAt: Date,
        completedAt: Date,
        reviewId: { type: Schema.Types.ObjectId, ref: 'CurriculumReview' },
        refinementsRequested: { type: Number, default: 0 },
        approvedAt: Date,
        publishedAt: Date,
        publishedToLMS: { type: Boolean, default: false },
        lmsCourseId: String,
      },
    },

    timeline: {
      promptSelectionTime: Number,
      researchTime: Number,
      costReviewTime: Number,
      generationTime: Number,
      finalReviewTime: Number,
      totalTime: Number,
    },

    completedAt: Date,
    cancelledAt: Date,
    cancelReason: String,
  },
  {
    timestamps: true,
    collection: 'curriculumprojects',
  }
);

// Compound indexes for efficient queries
CurriculumProjectSchema.index({ smeId: 1, status: 1 });
CurriculumProjectSchema.index({ status: 1, currentStage: 1 });
CurriculumProjectSchema.index({ courseCode: 1, createdAt: -1 });
CurriculumProjectSchema.index({ createdAt: -1 });

// Virtual for duration calculation
CurriculumProjectSchema.virtual('duration').get(function () {
  if (this.stageProgress?.stage5?.completedAt && this.createdAt) {
    return Math.round(
      (this.stageProgress.stage5.completedAt.getTime() - this.createdAt.getTime()) / 60000
    ); // minutes
  }
  return null;
});

// Method to advance to next stage
CurriculumProjectSchema.methods.advanceStage = async function (stageData: any = {}) {
  if (this.currentStage >= 5) {
    throw new Error('Project is already at final stage');
  }

  const nextStage = this.currentStage + 1;
  this.currentStage = nextStage;

  // Update status based on stage
  const statusMap: Record<number, string> = {
    2: 'research',
    3: 'cost_review',
    4: 'generation',
    5: 'final_review',
  };

  this.status = statusMap[nextStage] as any;

  // Mark previous stage as complete
  const stageKey = `stage${this.currentStage - 1}` as keyof typeof this.stageProgress;
  if (this.stageProgress[stageKey]) {
    (this.stageProgress[stageKey] as any).completedAt = new Date();
  }

  // Start new stage
  const newStageKey = `stage${this.currentStage}` as keyof typeof this.stageProgress;
  if (!this.stageProgress[newStageKey]) {
    (this.stageProgress as any)[newStageKey] = {};
  }
  (this.stageProgress[newStageKey] as any).startedAt = new Date();

  // Merge any additional stage data
  Object.assign((this.stageProgress as any)[newStageKey], stageData);

  return this.save();
};

// Method to update stage progress
CurriculumProjectSchema.methods.updateStageProgress = async function (progressData: any) {
  const stageKey = `stage${this.currentStage}` as keyof typeof this.stageProgress;

  if (!this.stageProgress[stageKey]) {
    (this.stageProgress as any)[stageKey] = {};
  }

  Object.assign((this.stageProgress as any)[stageKey], progressData);
  return this.save();
};

// Method to mark project as published
CurriculumProjectSchema.methods.markPublished = async function (lmsCourseId?: string) {
  this.status = 'published';
  this.currentStage = 5;
  this.completedAt = new Date();

  if (!this.stageProgress.stage5) {
    this.stageProgress.stage5 = {} as any;
  }

  this.stageProgress.stage5.completedAt = new Date();
  this.stageProgress.stage5.publishedAt = new Date();
  this.stageProgress.stage5.publishedToLMS = !!lmsCourseId;

  if (lmsCourseId) {
    this.stageProgress.stage5.lmsCourseId = lmsCourseId;
  }

  // Calculate total time
  this.timeline.totalTime = this.duration;

  return this.save();
};

export const CurriculumProject = mongoose.model<ICurriculumProject>(
  'CurriculumProject',
  CurriculumProjectSchema
);
