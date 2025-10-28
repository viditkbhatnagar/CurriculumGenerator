import mongoose, { Schema, Document } from 'mongoose';

export interface IProgram extends Document {
  programName: string;
  qualificationLevel: string;
  qualificationType: string;
  totalCredits: number;
  industrySector?: string;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'published';
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProgramSchema = new Schema<IProgram>(
  {
    programName: { 
      type: String, 
      required: true, 
      index: true,
      trim: true 
    },
    qualificationLevel: { 
      type: String, 
      required: true,
      trim: true 
    },
    qualificationType: { 
      type: String, 
      required: true,
      trim: true 
    },
    totalCredits: { 
      type: Number, 
      required: true, 
      default: 120,
      min: 0 
    },
    industrySector: { 
      type: String,
      trim: true 
    },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'under_review', 'approved', 'published'],
      default: 'draft',
      index: true,
    },
    createdBy: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: false, // Optional for dev mode
      index: true 
    },
  },
  { 
    timestamps: true,
    collection: 'programs'
  }
);

// Compound indexes for common queries
ProgramSchema.index({ createdBy: 1, status: 1 });
ProgramSchema.index({ createdBy: 1, createdAt: -1 });

export const Program = mongoose.model<IProgram>('Program', ProgramSchema);
