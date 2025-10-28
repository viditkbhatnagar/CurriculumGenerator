import mongoose, { Schema, Document } from 'mongoose';

export interface IGenerationJob extends Document {
  programId: mongoose.Types.ObjectId;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  intermediateResults?: any;
  createdAt: Date;
  updatedAt: Date;
}

const GenerationJobSchema = new Schema<IGenerationJob>(
  {
    programId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Program', 
      required: true, 
      index: true 
    },
    status: {
      type: String,
      enum: ['queued', 'processing', 'completed', 'failed'],
      default: 'queued',
      index: true,
    },
    progress: { 
      type: Number, 
      default: 0, 
      min: 0, 
      max: 100 
    },
    startedAt: { 
      type: Date 
    },
    completedAt: { 
      type: Date 
    },
    errorMessage: { 
      type: String,
      trim: true 
    },
    intermediateResults: { 
      type: Schema.Types.Mixed 
    },
  },
  { 
    timestamps: true,
    collection: 'generationJobs'
  }
);

// Compound indexes for common queries
GenerationJobSchema.index({ programId: 1, status: 1 });
GenerationJobSchema.index({ status: 1, createdAt: -1 });
GenerationJobSchema.index({ createdAt: -1 });

export const GenerationJob = mongoose.model<IGenerationJob>(
  'GenerationJob',
  GenerationJobSchema
);
