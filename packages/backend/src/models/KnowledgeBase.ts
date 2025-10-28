import mongoose, { Schema, Document } from 'mongoose';

export interface IKnowledgeBase extends Document {
  content: string;
  sourceUrl?: string;
  sourceType: 'pdf' | 'docx' | 'url' | 'manual';
  publicationDate?: Date;
  domain: string;
  credibilityScore: number;
  metadata: {
    title?: string;
    author?: string;
    tags: string[];
    chunkIndex: number;
    totalChunks: number;
  };
  embedding: number[];
  createdAt: Date;
  updatedAt: Date;
}

const KnowledgeBaseSchema = new Schema<IKnowledgeBase>(
  {
    content: { 
      type: String, 
      required: true 
    },
    sourceUrl: { 
      type: String,
      trim: true 
    },
    sourceType: {
      type: String,
      enum: ['pdf', 'docx', 'url', 'manual'],
      required: true,
      index: true
    },
    publicationDate: { 
      type: Date,
      index: true 
    },
    domain: { 
      type: String, 
      required: true, 
      index: true,
      trim: true 
    },
    credibilityScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      index: true
    },
    metadata: {
      title: { 
        type: String,
        trim: true 
      },
      author: { 
        type: String,
        trim: true 
      },
      tags: [{ 
        type: String,
        trim: true 
      }],
      chunkIndex: { 
        type: Number, 
        required: true,
        min: 0 
      },
      totalChunks: { 
        type: Number, 
        required: true,
        min: 1 
      },
    },
    embedding: {
      type: [Number],
      required: true,
      validate: {
        validator: (v: number[]) => v.length === 1536,
        message: 'Embedding must have exactly 1536 dimensions',
      },
    },
  },
  { 
    timestamps: true,
    collection: 'knowledgeBase'
  }
);

// Compound indexes for common queries
KnowledgeBaseSchema.index({ domain: 1, credibilityScore: -1 });
KnowledgeBaseSchema.index({ domain: 1, publicationDate: -1 });
KnowledgeBaseSchema.index({ sourceType: 1, domain: 1 });

// Note: Vector search index must be created in MongoDB Atlas UI or via API
// Index name: knowledge_base_vector_index
// Field: embedding
// Type: knnVector
// Dimensions: 1536
// Similarity: cosine

export const KnowledgeBase = mongoose.model<IKnowledgeBase>(
  'KnowledgeBase',
  KnowledgeBaseSchema
);
