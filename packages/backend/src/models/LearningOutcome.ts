import mongoose, { Schema, Document } from 'mongoose';

export interface ILearningOutcome extends Document {
  moduleId: mongoose.Types.ObjectId;
  outcomeText: string;
  assessmentCriteria: string[];
  knowledgeSkillCompetency: 'knowledge' | 'skill' | 'competency';
  bloomLevel: string;
  createdAt: Date;
  updatedAt: Date;
}

const LearningOutcomeSchema = new Schema<ILearningOutcome>(
  {
    moduleId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Module', 
      required: true, 
      index: true 
    },
    outcomeText: { 
      type: String, 
      required: true,
      trim: true 
    },
    assessmentCriteria: [{ 
      type: String,
      trim: true 
    }],
    knowledgeSkillCompetency: {
      type: String,
      enum: ['knowledge', 'skill', 'competency'],
      required: true,
      index: true
    },
    bloomLevel: { 
      type: String, 
      required: true,
      trim: true 
    },
  },
  { 
    timestamps: true,
    collection: 'learningOutcomes'
  }
);

// Compound indexes for common queries
LearningOutcomeSchema.index({ moduleId: 1, knowledgeSkillCompetency: 1 });

export const LearningOutcome = mongoose.model<ILearningOutcome>(
  'LearningOutcome',
  LearningOutcomeSchema
);
