import mongoose, { Schema, Document } from 'mongoose';

export interface IFileUpload extends Document {
  programId?: mongoose.Types.ObjectId;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  storageType: 'render_disk' | 'cloudinary' | 'local';
  uploadedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FileUploadSchema = new Schema<IFileUpload>(
  {
    programId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Program',
      index: true 
    },
    filename: { 
      type: String, 
      required: true,
      trim: true 
    },
    originalName: { 
      type: String, 
      required: true,
      trim: true 
    },
    mimeType: { 
      type: String, 
      required: true,
      trim: true 
    },
    size: { 
      type: Number, 
      required: true,
      min: 0 
    },
    storagePath: { 
      type: String, 
      required: true,
      trim: true 
    },
    storageType: {
      type: String,
      enum: ['render_disk', 'cloudinary', 'local'],
      required: true,
    },
    uploadedBy: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true,
      index: true 
    },
  },
  { 
    timestamps: true,
    collection: 'fileUploads'
  }
);

// Compound indexes for common queries
FileUploadSchema.index({ uploadedBy: 1, createdAt: -1 });
FileUploadSchema.index({ programId: 1, createdAt: -1 });

// TTL index to auto-delete temporary files older than 7 days (604800 seconds)
// Only applies to files without programId (temporary files)
FileUploadSchema.index(
  { createdAt: 1 }, 
  { 
    expireAfterSeconds: 604800,
    partialFilterExpression: { programId: { $exists: false } }
  }
);

export const FileUpload = mongoose.model<IFileUpload>('FileUpload', FileUploadSchema);
