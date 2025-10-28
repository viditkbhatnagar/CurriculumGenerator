import mongoose, { Schema, Document } from 'mongoose';

export interface IModule extends Document {
  programId: mongoose.Types.ObjectId;
  moduleCode: string;
  moduleTitle: string;
  hours: number;
  moduleAim?: string;
  coreElective: 'core' | 'elective';
  sequenceOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const ModuleSchema = new Schema<IModule>(
  {
    programId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Program', 
      required: true, 
      index: true 
    },
    moduleCode: { 
      type: String, 
      required: true,
      trim: true 
    },
    moduleTitle: { 
      type: String, 
      required: true,
      trim: true 
    },
    hours: { 
      type: Number, 
      required: true,
      min: 0 
    },
    moduleAim: { 
      type: String,
      trim: true 
    },
    coreElective: { 
      type: String, 
      enum: ['core', 'elective'], 
      required: true 
    },
    sequenceOrder: { 
      type: Number, 
      required: true,
      min: 0 
    },
  },
  { 
    timestamps: true,
    collection: 'modules'
  }
);

// Compound indexes for common queries
ModuleSchema.index({ programId: 1, sequenceOrder: 1 });
ModuleSchema.index({ programId: 1, moduleCode: 1 }, { unique: true });

export const Module = mongoose.model<IModule>('Module', ModuleSchema);
