import mongoose, { Schema, Document } from 'mongoose';

export interface ISkillMapping extends Document {
  programId: mongoose.Types.ObjectId;
  skillName: string;
  domain: string;
  activities: Array<{
    name: string;
    description: string;
    unitLink: string;
    durationHours: number;
    assessmentType: string;
    resources: string[];
  }>;
  kpis: Array<{
    name: string;
    metric: string;
    threshold: number | string;
  }>;
  linkedOutcomes: mongoose.Types.ObjectId[];
  assessmentCriteria: string[];
  createdAt: Date;
  updatedAt: Date;
}

const SkillMappingSchema = new Schema<ISkillMapping>(
  {
    programId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Program', 
      required: true, 
      index: true 
    },
    skillName: { 
      type: String, 
      required: true,
      trim: true,
      index: true 
    },
    domain: { 
      type: String, 
      required: true,
      trim: true,
      index: true 
    },
    activities: [
      {
        name: { 
          type: String, 
          required: true,
          trim: true 
        },
        description: { 
          type: String, 
          required: true 
        },
        unitLink: { 
          type: String, 
          required: true,
          trim: true 
        },
        durationHours: { 
          type: Number, 
          required: true,
          min: 0 
        },
        assessmentType: { 
          type: String, 
          required: true,
          trim: true 
        },
        resources: [{ 
          type: String,
          trim: true 
        }],
      },
    ],
    kpis: [
      {
        name: { 
          type: String, 
          required: true,
          trim: true 
        },
        metric: { 
          type: String, 
          required: true,
          trim: true 
        },
        threshold: { 
          type: Schema.Types.Mixed, 
          required: true 
        },
      },
    ],
    linkedOutcomes: [{ 
      type: Schema.Types.ObjectId, 
      ref: 'LearningOutcome' 
    }],
    assessmentCriteria: [{ 
      type: String,
      trim: true 
    }],
  },
  { 
    timestamps: true,
    collection: 'skillMappings'
  }
);

// Compound indexes for common queries
SkillMappingSchema.index({ programId: 1, domain: 1 });
SkillMappingSchema.index({ programId: 1, skillName: 1 });

export const SkillMapping = mongoose.model<ISkillMapping>(
  'SkillMapping',
  SkillMappingSchema
);
