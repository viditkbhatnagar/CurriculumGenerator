# Design Document

## Overview

This design document outlines the migration strategy from a Docker-based PostgreSQL architecture to a MongoDB-based system deployed on Render. The migration maintains all existing functionality while simplifying deployment and leveraging MongoDB's flexible document model for curriculum data. The system will use MongoDB Atlas for both primary data storage and vector search, OpenAI for all AI operations, and Render's managed services for hosting, Redis, and persistent storage.

## Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "Render Platform"
        subgraph "Web Services"
            Frontend[Next.js Frontend<br/>Render Web Service]
            API[Node.js API<br/>Render Web Service]
        end
        
        subgraph "Background Services"
            Worker[Curriculum Worker<br/>Render Background Worker]
        end
        
        subgraph "Managed Services"
            RenderRedis[Render Redis]
            RenderDisk[Render Persistent Disk]
        end
    end
    
    subgraph "External Services"
        MongoDB[(MongoDB Atlas<br/>Database + Vector Search)]
        OpenAI[OpenAI API<br/>GPT-4 + Embeddings]
        Sentry[Sentry<br/>Error Tracking]
    end
    
    Frontend --> API
    API --> MongoDB
    API --> RenderRedis
    API --> RenderDisk
    API --> OpenAI
    Worker --> MongoDB
    Worker --> RenderRedis
    Worker --> OpenAI
    API --> Sentry
    Worker --> Sentry
```

### Technology Stack Changes

**Database Layer:**
- ~~PostgreSQL~~ → **MongoDB Atlas** (managed cloud database)
- ~~Pinecone~~ → **MongoDB Atlas Vector Search** (integrated vector capabilities)
- Connection: Mongoose ODM for schema and validation

**Deployment Platform:**
- ~~Docker + AWS ECS~~ → **Render Web Services + Background Workers**
- ~~AWS S3~~ → **Render Persistent Disk** (or Cloudinary for large files)
- ~~AWS CloudWatch~~ → **Render Logs + Sentry**

**Caching & Queue:**
- ~~Self-hosted Redis~~ → **Render Redis Add-on**
- Bull queue continues to work with Render Redis

**AI Services:**
- OpenAI GPT-4/GPT-4-turbo for content generation (no change)
- OpenAI text-embedding-3-large for embeddings (no change)
- Remove any alternative embedding services



## MongoDB Schema Design

### Mongoose Models

#### Program Model
```typescript
import mongoose, { Schema, Document } from 'mongoose';

interface IProgram extends Document {
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

const ProgramSchema = new Schema<IProgram>({
  programName: { type: String, required: true, index: true },
  qualificationLevel: { type: String, required: true },
  qualificationType: { type: String, required: true },
  totalCredits: { type: Number, required: true, default: 120 },
  industrySector: { type: String },
  status: { 
    type: String, 
    enum: ['draft', 'submitted', 'under_review', 'approved', 'published'],
    default: 'draft',
    index: true
  },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

export const Program = mongoose.model<IProgram>('Program', ProgramSchema);
```

#### Module Model (Embedded in Program or Separate)
```typescript
interface IModule extends Document {
  programId: mongoose.Types.ObjectId;
  moduleCode: string;
  moduleTitle: string;
  hours: number;
  moduleAim?: string;
  coreElective: 'core' | 'elective';
  sequenceOrder: number;
  createdAt: Date;
}

const ModuleSchema = new Schema<IModule>({
  programId: { type: Schema.Types.ObjectId, ref: 'Program', required: true, index: true },
  moduleCode: { type: String, required: true },
  moduleTitle: { type: String, required: true },
  hours: { type: Number, required: true },
  moduleAim: { type: String },
  coreElective: { type: String, enum: ['core', 'elective'], required: true },
  sequenceOrder: { type: Number, required: true },
}, { timestamps: true });

export const Module = mongoose.model<IModule>('Module', ModuleSchema);
```


#### Learning Outcome Model
```typescript
interface ILearningOutcome extends Document {
  moduleId: mongoose.Types.ObjectId;
  outcomeText: string;
  assessmentCriteria: string[];
  knowledgeSkillCompetency: 'knowledge' | 'skill' | 'competency';
  bloomLevel: string;
  createdAt: Date;
}

const LearningOutcomeSchema = new Schema<ILearningOutcome>({
  moduleId: { type: Schema.Types.ObjectId, ref: 'Module', required: true, index: true },
  outcomeText: { type: String, required: true },
  assessmentCriteria: [{ type: String }],
  knowledgeSkillCompetency: { 
    type: String, 
    enum: ['knowledge', 'skill', 'competency'],
    required: true 
  },
  bloomLevel: { type: String, required: true },
}, { timestamps: true });

export const LearningOutcome = mongoose.model<ILearningOutcome>('LearningOutcome', LearningOutcomeSchema);
```

#### Knowledge Base Model (with Vector Embeddings)
```typescript
interface IKnowledgeBase extends Document {
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
  embedding: number[]; // 1536 dimensions for OpenAI
  createdAt: Date;
}

const KnowledgeBaseSchema = new Schema<IKnowledgeBase>({
  content: { type: String, required: true },
  sourceUrl: { type: String },
  sourceType: { 
    type: String, 
    enum: ['pdf', 'docx', 'url', 'manual'],
    required: true 
  },
  publicationDate: { type: Date },
  domain: { type: String, required: true, index: true },
  credibilityScore: { 
    type: Number, 
    required: true, 
    min: 0, 
    max: 100 
  },
  metadata: {
    title: { type: String },
    author: { type: String },
    tags: [{ type: String }],
    chunkIndex: { type: Number, required: true },
    totalChunks: { type: Number, required: true },
  },
  embedding: { 
    type: [Number], 
    required: true,
    validate: {
      validator: (v: number[]) => v.length === 1536,
      message: 'Embedding must have exactly 1536 dimensions'
    }
  },
}, { timestamps: true });

// Vector search index will be created in MongoDB Atlas
export const KnowledgeBase = mongoose.model<IKnowledgeBase>('KnowledgeBase', KnowledgeBaseSchema);
```


#### Assessment Model
```typescript
interface IAssessment extends Document {
  moduleId: mongoose.Types.ObjectId;
  questionType: 'mcq' | 'case_study' | 'essay' | 'practical';
  questionText: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  learningOutcomeId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const AssessmentSchema = new Schema<IAssessment>({
  moduleId: { type: Schema.Types.ObjectId, ref: 'Module', required: true, index: true },
  questionType: { 
    type: String, 
    enum: ['mcq', 'case_study', 'essay', 'practical'],
    required: true 
  },
  questionText: { type: String, required: true },
  options: [{ type: String }],
  correctAnswer: { type: String },
  explanation: { type: String },
  difficulty: { 
    type: String, 
    enum: ['easy', 'medium', 'hard'],
    required: true 
  },
  learningOutcomeId: { type: Schema.Types.ObjectId, ref: 'LearningOutcome' },
}, { timestamps: true });

export const Assessment = mongoose.model<IAssessment>('Assessment', AssessmentSchema);
```

#### Skill Mapping Model
```typescript
interface ISkillMapping extends Document {
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
}

const SkillMappingSchema = new Schema<ISkillMapping>({
  programId: { type: Schema.Types.ObjectId, ref: 'Program', required: true, index: true },
  skillName: { type: String, required: true },
  domain: { type: String, required: true },
  activities: [{
    name: { type: String, required: true },
    description: { type: String, required: true },
    unitLink: { type: String, required: true },
    durationHours: { type: Number, required: true },
    assessmentType: { type: String, required: true },
    resources: [{ type: String }],
  }],
  kpis: [{
    name: { type: String, required: true },
    metric: { type: String, required: true },
    threshold: { type: Schema.Types.Mixed, required: true },
  }],
  linkedOutcomes: [{ type: Schema.Types.ObjectId, ref: 'LearningOutcome' }],
  assessmentCriteria: [{ type: String }],
}, { timestamps: true });

export const SkillMapping = mongoose.model<ISkillMapping>('SkillMapping', SkillMappingSchema);
```


#### Generation Job Model
```typescript
interface IGenerationJob extends Document {
  programId: mongoose.Types.ObjectId;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  intermediateResults?: any;
  createdAt: Date;
}

const GenerationJobSchema = new Schema<IGenerationJob>({
  programId: { type: Schema.Types.ObjectId, ref: 'Program', required: true, index: true },
  status: { 
    type: String, 
    enum: ['queued', 'processing', 'completed', 'failed'],
    default: 'queued',
    index: true
  },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  startedAt: { type: Date },
  completedAt: { type: Date },
  errorMessage: { type: String },
  intermediateResults: { type: Schema.Types.Mixed },
}, { timestamps: true });

export const GenerationJob = mongoose.model<IGenerationJob>('GenerationJob', GenerationJobSchema);
```

#### User Model
```typescript
interface IUser extends Document {
  email: string;
  role: 'administrator' | 'sme' | 'student';
  authProviderId: string;
  profile: {
    firstName?: string;
    lastName?: string;
    organization?: string;
  };
  lastLogin?: Date;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true, index: true },
  role: { 
    type: String, 
    enum: ['administrator', 'sme', 'student'],
    required: true,
    index: true
  },
  authProviderId: { type: String, required: true, unique: true },
  profile: {
    firstName: { type: String },
    lastName: { type: String },
    organization: { type: String },
  },
  lastLogin: { type: Date },
}, { timestamps: true });

export const User = mongoose.model<IUser>('User', UserSchema);
```

#### Audit Log Model
```typescript
interface IAuditLog extends Document {
  userId?: mongoose.Types.ObjectId;
  action: string;
  resourceType?: string;
  resourceId?: mongoose.Types.ObjectId;
  details: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  action: { type: String, required: true, index: true },
  resourceType: { type: String },
  resourceId: { type: Schema.Types.ObjectId },
  details: { type: Schema.Types.Mixed },
  ipAddress: { type: String },
  userAgent: { type: String },
}, { timestamps: true });

// TTL index to auto-delete logs older than 90 days
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
```


#### File Upload Model
```typescript
interface IFileUpload extends Document {
  programId?: mongoose.Types.ObjectId;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  storagePath: string;
  storageType: 'render_disk' | 'cloudinary' | 'local';
  uploadedBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

const FileUploadSchema = new Schema<IFileUpload>({
  programId: { type: Schema.Types.ObjectId, ref: 'Program' },
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  storagePath: { type: String, required: true },
  storageType: { 
    type: String, 
    enum: ['render_disk', 'cloudinary', 'local'],
    required: true 
  },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

// TTL index to auto-delete temporary files older than 7 days
FileUploadSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

export const FileUpload = mongoose.model<IFileUpload>('FileUpload', FileUploadSchema);
```

## MongoDB Atlas Vector Search Configuration

### Creating Vector Search Index

In MongoDB Atlas UI or via CLI:

```javascript
{
  "mappings": {
    "dynamic": false,
    "fields": {
      "embedding": {
        "type": "knnVector",
        "dimensions": 1536,
        "similarity": "cosine"
      },
      "domain": {
        "type": "string"
      },
      "credibilityScore": {
        "type": "number"
      },
      "publicationDate": {
        "type": "date"
      }
    }
  }
}
```

### Vector Search Query Example

```typescript
async function semanticSearch(
  queryEmbedding: number[],
  options: {
    domain?: string;
    minSimilarity?: number;
    limit?: number;
  }
) {
  const pipeline = [
    {
      $vectorSearch: {
        index: 'knowledge_base_vector_index',
        path: 'embedding',
        queryVector: queryEmbedding,
        numCandidates: 100,
        limit: options.limit || 10,
      }
    },
    {
      $addFields: {
        similarityScore: { $meta: 'vectorSearchScore' }
      }
    },
    {
      $match: {
        similarityScore: { $gte: options.minSimilarity || 0.75 },
        ...(options.domain && { domain: options.domain })
      }
    },
    {
      $sort: { credibilityScore: -1, similarityScore: -1 }
    }
  ];

  return await KnowledgeBase.aggregate(pipeline);
}
```


## Render Deployment Architecture

### Service Configuration

#### 1. Frontend Web Service

**Service Type:** Web Service  
**Build Command:** `cd packages/frontend && npm install && npm run build`  
**Start Command:** `cd packages/frontend && npm start`  
**Environment:** Node 18+  
**Auto-Deploy:** Yes (on main branch push)

**Environment Variables:**
```
NEXT_PUBLIC_API_URL=https://your-api.onrender.com
NEXT_PUBLIC_AUTH0_DOMAIN=your-domain.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=your-client-id
```

**Health Check Path:** `/`

#### 2. Backend API Web Service

**Service Type:** Web Service  
**Build Command:** `cd packages/backend && npm install && npm run build && npm run migrate`  
**Start Command:** `cd packages/backend && npm start`  
**Environment:** Node 18+  
**Auto-Deploy:** Yes (on main branch push)

**Environment Variables:**
```
PORT=4000
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/curriculum_db
REDIS_URL=redis://red-xxxxx:6379
OPENAI_API_KEY=sk-xxxxx
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_AUDIENCE=your-api-audience
ENCRYPTION_KEY=your-32-char-key
API_SIGNING_SECRET=your-signing-secret
CORS_ORIGINS=https://your-frontend.onrender.com
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
```

**Health Check Path:** `/health`

**Persistent Disk:**
- Mount Path: `/app/uploads`
- Size: 10GB (adjust based on needs)

#### 3. Background Worker Service

**Service Type:** Background Worker  
**Build Command:** `cd packages/backend && npm install && npm run build`  
**Start Command:** `cd packages/backend && npm run worker`  
**Environment:** Node 18+  
**Auto-Deploy:** Yes (on main branch push)

**Environment Variables:** (Same as API service)

**Scaling:** Configure based on job queue depth

### Render Redis Add-on

**Plan:** Starter or higher based on cache needs  
**Connection:** Automatic via REDIS_URL environment variable  
**Usage:**
- Bull job queue
- API response caching
- Session storage

### MongoDB Atlas Configuration

**Cluster:** M10 or higher (for vector search support)  
**Region:** Same as Render services for low latency  
**Network Access:** Add Render IP addresses to whitelist  
**Database User:** Create with read/write permissions  
**Connection String:** Use in MONGODB_URI environment variable

**Vector Search Requirements:**
- Atlas Search enabled
- Create vector search index on knowledgeBase collection
- Minimum M10 cluster tier


## Migration Strategy

### Phase 1: Database Migration

1. **Export PostgreSQL Data**
   - Export all tables to JSON format
   - Maintain relationships and foreign keys

2. **Transform Data Structure**
   - Convert relational data to document model
   - Embed related data where appropriate
   - Maintain references for large collections

3. **Import to MongoDB**
   - Create collections with Mongoose models
   - Import transformed data
   - Verify data integrity

4. **Create Indexes**
   - Create compound indexes for common queries
   - Set up vector search index
   - Configure TTL indexes for auto-cleanup

### Phase 2: Code Migration

1. **Replace Database Layer**
   - Replace `pg` with `mongoose`
   - Update all queries to use Mongoose methods
   - Replace SQL transactions with MongoDB transactions

2. **Update Vector Search**
   - Replace Pinecone client with MongoDB aggregation
   - Update similarity search logic
   - Test vector search performance

3. **Update File Storage**
   - Replace S3 client with local file system
   - Update file upload/download logic
   - Configure Render persistent disk

4. **Update Configuration**
   - Replace PostgreSQL connection with MongoDB
   - Update Redis connection for Render
   - Remove AWS-specific configuration

### Phase 3: Deployment Setup

1. **Create Render Services**
   - Set up frontend web service
   - Set up backend API web service
   - Set up background worker service

2. **Configure Environment Variables**
   - Add all required environment variables
   - Configure secrets securely
   - Set up health check endpoints

3. **Set Up MongoDB Atlas**
   - Create cluster and database
   - Configure network access
   - Create vector search index
   - Import migrated data

4. **Add Render Redis**
   - Provision Redis add-on
   - Update connection strings
   - Test cache functionality

### Phase 4: Testing & Validation

1. **Functional Testing**
   - Test all API endpoints
   - Verify curriculum generation
   - Test file uploads and downloads
   - Verify vector search accuracy

2. **Performance Testing**
   - Load test API endpoints
   - Test concurrent curriculum generation
   - Verify response times meet targets

3. **Integration Testing**
   - Test frontend-backend integration
   - Test worker job processing
   - Verify WebSocket connections

### Phase 5: Documentation

1. **Create Setup Guide** (SETUP.md)
2. **Create Deployment Guide** (DEPLOYMENT.md)
3. **Create Architecture Guide** (ARCHITECTURE.md)
4. **Create Workflow Guide** (WORKFLOW.md)
5. **Update README with new instructions**


## Updated Service Interfaces

### Database Service

```typescript
// packages/backend/src/db/index.ts
import mongoose from 'mongoose';
import config from '../config';

class Database {
  private connection: typeof mongoose | null = null;

  async connect(): Promise<void> {
    try {
      this.connection = await mongoose.connect(config.database.uri, {
        maxPoolSize: 20,
        minPoolSize: 5,
        socketTimeoutMS: 45000,
        serverSelectionTimeoutMS: 5000,
      });

      console.log('MongoDB connected successfully');

      // Handle connection events
      mongoose.connection.on('error', (err) => {
        console.error('MongoDB connection error:', err);
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('MongoDB disconnected');
      });

    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      process.exit(1);
    }
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await mongoose.disconnect();
      console.log('MongoDB disconnected');
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const state = mongoose.connection.readyState;
      return state === 1; // 1 = connected
    } catch (error) {
      console.error('Database health check failed', error);
      return false;
    }
  }

  // Transaction support
  async transaction<T>(callback: (session: mongoose.ClientSession) => Promise<T>): Promise<T> {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const result = await callback(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
}

export const db = new Database();
export default db;
```

### Vector Search Service

```typescript
// packages/backend/src/services/vectorSearchService.ts
import { KnowledgeBase } from '../models/KnowledgeBase';
import { OpenAIService } from './openaiService';

interface SearchOptions {
  domain?: string;
  minSimilarity?: number;
  limit?: number;
  recencyWeight?: number;
}

export class VectorSearchService {
  private openai: OpenAIService;

  constructor() {
    this.openai = new OpenAIService();
  }

  async search(query: string, options: SearchOptions = {}) {
    // Generate query embedding
    const queryEmbedding = await this.openai.generateEmbedding(query);

    // Build aggregation pipeline
    const pipeline: any[] = [
      {
        $vectorSearch: {
          index: 'knowledge_base_vector_index',
          path: 'embedding',
          queryVector: queryEmbedding,
          numCandidates: 100,
          limit: options.limit || 10,
        }
      },
      {
        $addFields: {
          similarityScore: { $meta: 'vectorSearchScore' }
        }
      }
    ];

    // Add filters
    const matchStage: any = {
      similarityScore: { $gte: options.minSimilarity || 0.75 }
    };

    if (options.domain) {
      matchStage.domain = options.domain;
    }

    // Filter by recency (within 5 years)
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    matchStage.publicationDate = { $gte: fiveYearsAgo };

    pipeline.push({ $match: matchStage });

    // Sort by credibility and similarity
    pipeline.push({
      $sort: { credibilityScore: -1, similarityScore: -1 }
    });

    // Execute search
    const results = await KnowledgeBase.aggregate(pipeline);

    return results.map(doc => ({
      content: doc.content,
      source: {
        url: doc.sourceUrl,
        title: doc.metadata.title,
        publicationDate: doc.publicationDate,
        credibilityScore: doc.credibilityScore,
      },
      similarityScore: doc.similarityScore,
    }));
  }

  async multiQuerySearch(queries: string[], options: SearchOptions = {}) {
    const allResults = await Promise.all(
      queries.map(q => this.search(q, options))
    );

    // Deduplicate and merge results
    const seen = new Set();
    const merged = [];

    for (const results of allResults) {
      for (const result of results) {
        const key = result.source.url || result.content.substring(0, 100);
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(result);
        }
      }
    }

    // Sort by similarity score
    return merged.sort((a, b) => b.similarityScore - a.similarityScore);
  }
}
```


### File Storage Service

```typescript
// packages/backend/src/services/fileStorageService.ts
import fs from 'fs/promises';
import path from 'path';
import { FileUpload } from '../models/FileUpload';
import config from '../config';

export class FileStorageService {
  private uploadDir: string;

  constructor() {
    // Use Render persistent disk mount point in production
    this.uploadDir = config.nodeEnv === 'production' 
      ? '/app/uploads'
      : path.join(process.cwd(), 'uploads');
  }

  async initialize(): Promise<void> {
    // Ensure upload directory exists
    await fs.mkdir(this.uploadDir, { recursive: true });
  }

  async saveFile(
    file: Express.Multer.File,
    userId: string,
    programId?: string
  ): Promise<IFileUpload> {
    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${timestamp}-${file.originalname}`;
    const filepath = path.join(this.uploadDir, filename);

    // Save file to disk
    await fs.writeFile(filepath, file.buffer);

    // Create database record
    const fileUpload = new FileUpload({
      programId,
      filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      storagePath: filepath,
      storageType: config.nodeEnv === 'production' ? 'render_disk' : 'local',
      uploadedBy: userId,
    });

    await fileUpload.save();
    return fileUpload;
  }

  async getFile(fileId: string): Promise<Buffer> {
    const fileUpload = await FileUpload.findById(fileId);
    if (!fileUpload) {
      throw new Error('File not found');
    }

    return await fs.readFile(fileUpload.storagePath);
  }

  async deleteFile(fileId: string): Promise<void> {
    const fileUpload = await FileUpload.findById(fileId);
    if (!fileUpload) {
      throw new Error('File not found');
    }

    // Delete from disk
    try {
      await fs.unlink(fileUpload.storagePath);
    } catch (error) {
      console.error('Failed to delete file from disk:', error);
    }

    // Delete from database
    await FileUpload.findByIdAndDelete(fileId);
  }

  async cleanupOldFiles(): Promise<void> {
    // MongoDB TTL index will auto-delete records
    // This method cleans up orphaned files on disk
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const oldFiles = await FileUpload.find({
      createdAt: { $lt: sevenDaysAgo },
      programId: { $exists: false } // Only temporary files
    });

    for (const file of oldFiles) {
      try {
        await fs.unlink(file.storagePath);
      } catch (error) {
        console.error(`Failed to delete file ${file.filename}:`, error);
      }
    }
  }
}
```

### OpenAI Service (Consolidated)

```typescript
// packages/backend/src/services/openaiService.ts
import OpenAI from 'openai';
import config from '../config';

export class OpenAIService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
      timeout: 30000,
      maxRetries: 3,
    });
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: 'text-embedding-3-large',
        input: text,
        dimensions: 1536,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error('OpenAI embedding generation failed:', error);
      throw error;
    }
  }

  async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    // Process in batches of 100
    const batchSize = 100;
    const results: number[][] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      
      const response = await this.client.embeddings.create({
        model: 'text-embedding-3-large',
        input: batch,
        dimensions: 1536,
      });

      results.push(...response.data.map(d => d.embedding));
    }

    return results;
  }

  async generateContent(
    prompt: string,
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    } = {}
  ): Promise<string> {
    const {
      model = 'gpt-4-turbo',
      temperature = 0.7,
      maxTokens = 2000,
      stream = false,
    } = options;

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: maxTokens,
        stream,
      });

      if (stream) {
        throw new Error('Streaming not supported in this method');
      }

      return response.choices[0].message.content || '';
    } catch (error) {
      console.error('OpenAI content generation failed:', error);
      throw error;
    }
  }

  async generateStructuredContent<T>(
    prompt: string,
    schema: any
  ): Promise<T> {
    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      });

      const content = response.choices[0].message.content || '{}';
      return JSON.parse(content) as T;
    } catch (error) {
      console.error('OpenAI structured generation failed:', error);
      throw error;
    }
  }
}
```


## Configuration Updates

### Updated Config File

```typescript
// packages/backend/src/config/index.ts
import dotenv from 'dotenv';

dotenv.config();

interface Config {
  port: number;
  nodeEnv: string;
  database: {
    uri: string;
  };
  redis: {
    url: string;
  };
  openai: {
    apiKey: string;
    embeddingModel: string;
    chatModel: string;
  };
  auth0: {
    domain: string;
    audience: string;
  };
  storage: {
    type: 'render_disk' | 'local';
    uploadDir: string;
    maxFileSize: number;
  };
  monitoring: {
    sentryDsn: string;
    logLevel: string;
  };
  security: {
    corsOrigins: string[];
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
    encryptionKey: string;
    apiSigningSecret: string;
  };
}

const config: Config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/curriculum_db',
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    embeddingModel: 'text-embedding-3-large',
    chatModel: process.env.OPENAI_CHAT_MODEL || 'gpt-4-turbo',
  },
  
  auth0: {
    domain: process.env.AUTH0_DOMAIN || '',
    audience: process.env.AUTH0_AUDIENCE || '',
  },
  
  storage: {
    type: process.env.NODE_ENV === 'production' ? 'render_disk' : 'local',
    uploadDir: process.env.UPLOAD_DIR || '/app/uploads',
    maxFileSize: 50 * 1024 * 1024, // 50MB
  },
  
  monitoring: {
    sentryDsn: process.env.SENTRY_DSN || '',
    logLevel: process.env.LOG_LEVEL || 'info',
  },
  
  security: {
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    encryptionKey: process.env.ENCRYPTION_KEY || 'default-dev-key-change-in-production',
    apiSigningSecret: process.env.API_SIGNING_SECRET || 'default-signing-secret',
  },
};

// Validate required configuration
if (config.nodeEnv === 'production') {
  const required = [
    'MONGODB_URI',
    'REDIS_URL',
    'OPENAI_API_KEY',
    'AUTH0_DOMAIN',
    'AUTH0_AUDIENCE',
    'ENCRYPTION_KEY',
  ];

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
}

export default config;
```

### Updated Environment Variables

```bash
# packages/backend/.env.example

# Server Configuration
PORT=4000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/curriculum_db?retryWrites=true&w=majority

# Redis Configuration (Render Redis)
REDIS_URL=redis://red-xxxxx:6379

# OpenAI Configuration
OPENAI_API_KEY=sk-xxxxx
OPENAI_CHAT_MODEL=gpt-4-turbo

# Auth0 Configuration
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_AUDIENCE=your-api-audience

# File Storage Configuration
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE=52428800

# Security Configuration
ENCRYPTION_KEY=your-32-character-encryption-key-here
API_SIGNING_SECRET=your-api-signing-secret-here
CORS_ORIGINS=https://your-frontend.onrender.com,http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Monitoring Configuration
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
LOG_LEVEL=info

# Session Configuration
SESSION_TIMEOUT_SECONDS=1800
```

## Performance Considerations

### MongoDB Optimization

1. **Indexing Strategy**
   - Compound indexes for common query patterns
   - Text indexes for full-text search
   - Geospatial indexes if location-based features added
   - TTL indexes for auto-cleanup

2. **Connection Pooling**
   - Min pool size: 5 connections
   - Max pool size: 20 connections
   - Adjust based on Render service tier

3. **Query Optimization**
   - Use projection to limit returned fields
   - Implement pagination for large result sets
   - Use aggregation pipeline for complex queries
   - Cache frequently accessed data in Redis

4. **Vector Search Performance**
   - Use appropriate numCandidates (100-200)
   - Limit results to necessary count
   - Filter before vector search when possible
   - Monitor query performance and adjust indexes

### Render Optimization

1. **Service Scaling**
   - Start with Standard tier for API
   - Scale workers based on job queue depth
   - Use auto-scaling for traffic spikes

2. **Caching Strategy**
   - Cache API responses in Redis
   - Use CDN for static assets
   - Implement browser caching headers

3. **Resource Management**
   - Monitor memory usage
   - Optimize bundle sizes
   - Use compression middleware

## Security Considerations

### MongoDB Security

1. **Authentication**
   - Use strong passwords
   - Enable MongoDB authentication
   - Use connection string with credentials

2. **Network Security**
   - Whitelist Render IP addresses
   - Use VPC peering if available
   - Enable TLS/SSL for connections

3. **Data Protection**
   - Encrypt sensitive fields at application level
   - Use MongoDB encryption at rest
   - Regular backups to separate location

### Render Security

1. **Environment Variables**
   - Store secrets in Render dashboard
   - Never commit secrets to Git
   - Rotate secrets regularly

2. **HTTPS**
   - Render provides automatic HTTPS
   - Enforce HTTPS in production
   - Use secure cookies

3. **Access Control**
   - Limit team access to production
   - Use separate environments for dev/staging/prod
   - Enable audit logging

This design provides a complete blueprint for migrating to MongoDB and Render while maintaining all functionality and improving deployment simplicity.
