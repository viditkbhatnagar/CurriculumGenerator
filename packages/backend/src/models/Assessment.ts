import mongoose, { Schema, Document } from 'mongoose';

export interface IAssessment extends Document {
  moduleId: mongoose.Types.ObjectId;
  questionType: 'mcq' | 'case_study' | 'essay' | 'practical';
  questionText: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  learningOutcomeId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const AssessmentSchema = new Schema<IAssessment>(
  {
    moduleId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Module', 
      required: true, 
      index: true 
    },
    questionType: {
      type: String,
      enum: ['mcq', 'case_study', 'essay', 'practical'],
      required: true,
      index: true
    },
    questionText: { 
      type: String, 
      required: true 
    },
    options: [{ 
      type: String,
      trim: true 
    }],
    correctAnswer: { 
      type: String,
      trim: true 
    },
    explanation: { 
      type: String,
      trim: true 
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      required: true,
      index: true
    },
    learningOutcomeId: { 
      type: Schema.Types.ObjectId, 
      ref: 'LearningOutcome',
      index: true 
    },
  },
  { 
    timestamps: true,
    collection: 'assessments'
  }
);

// Compound indexes for common queries
AssessmentSchema.index({ moduleId: 1, difficulty: 1 });
AssessmentSchema.index({ moduleId: 1, questionType: 1 });

export const Assessment = mongoose.model<IAssessment>('Assessment', AssessmentSchema);
