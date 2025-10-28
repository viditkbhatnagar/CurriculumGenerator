# MongoDB Models

This directory contains all Mongoose models for the Curriculum Generator App. These models define the schema, validation rules, and indexes for MongoDB collections.

## Models Overview

### Core Models

1. **Program** - Main program/curriculum entity
   - Fields: programName, qualificationLevel, qualificationType, totalCredits, industrySector, status, createdBy
   - Indexes: programName, status, createdBy, compound indexes for common queries
   - Status values: draft, submitted, under_review, approved, published

2. **Module** - Course modules within a program
   - Fields: programId, moduleCode, moduleTitle, hours, moduleAim, coreElective, sequenceOrder
   - Indexes: programId, compound index on (programId, sequenceOrder), unique index on (programId, moduleCode)
   - Core/Elective: core, elective

3. **LearningOutcome** - Learning outcomes for modules
   - Fields: moduleId, outcomeText, assessmentCriteria, knowledgeSkillCompetency, bloomLevel
   - Indexes: moduleId, knowledgeSkillCompetency, compound indexes
   - KSC values: knowledge, skill, competency

4. **Assessment** - Assessment questions for modules
   - Fields: moduleId, questionType, questionText, options, correctAnswer, explanation, difficulty, learningOutcomeId
   - Indexes: moduleId, questionType, difficulty, compound indexes
   - Question types: mcq, case_study, essay, practical
   - Difficulty: easy, medium, hard

5. **SkillMapping** - Skills mapped to programs
   - Fields: programId, skillName, domain, activities, kpis, linkedOutcomes, assessmentCriteria
   - Indexes: programId, skillName, domain, compound indexes
   - Contains embedded arrays for activities and KPIs

### Knowledge Base & AI

6. **KnowledgeBase** - Document chunks with embeddings for RAG
   - Fields: content, sourceUrl, sourceType, publicationDate, domain, credibilityScore, metadata, embedding
   - Indexes: domain, credibilityScore, publicationDate, sourceType, compound indexes
   - Embedding: 1536-dimensional vector for OpenAI text-embedding-3-large
   - **Important**: Vector search index must be created in MongoDB Atlas (see below)

### Job Management

7. **GenerationJob** - Background job tracking for curriculum generation
   - Fields: programId, status, progress, startedAt, completedAt, errorMessage, intermediateResults
   - Indexes: programId, status, createdAt, compound indexes
   - Status values: queued, processing, completed, failed

### User Management

8. **User** - User accounts
   - Fields: email, role, authProviderId, profile, lastLogin
   - Indexes: email (unique), authProviderId (unique), role
   - Roles: administrator, sme, student
   - Email validation included

9. **AuditLog** - Audit trail for system actions
   - Fields: userId, action, resourceType, resourceId, details, ipAddress, userAgent
   - Indexes: userId, action, resourceType/resourceId, compound indexes
   - **TTL Index**: Auto-deletes logs older than 90 days

10. **FileUpload** - File upload metadata
    - Fields: programId, filename, originalName, mimeType, size, storagePath, storageType, uploadedBy
    - Indexes: uploadedBy, programId, compound indexes
    - Storage types: render_disk, cloudinary, local
    - **TTL Index**: Auto-deletes temporary files (without programId) older than 7 days

## Usage Examples

### Creating a Program

```typescript
import { Program } from './models';

const program = new Program({
  programName: 'Bachelor of Computer Science',
  qualificationLevel: 'Level 8',
  qualificationType: 'Bachelor Degree',
  totalCredits: 120,
  industrySector: 'Information Technology',
  status: 'draft',
  createdBy: userId,
});

await program.save();
```

### Querying with Population

```typescript
import { Module } from './models';

// Get modules with program details
const modules = await Module.find({ programId })
  .populate('programId')
  .sort({ sequenceOrder: 1 });
```

### Using Transactions

```typescript
import { mongodb } from '../db/mongodb';
import { Program, Module } from './models';

await mongodb.transaction(async (session) => {
  const program = new Program({ /* ... */ });
  await program.save({ session });
  
  const module = new Module({ programId: program._id, /* ... */ });
  await module.save({ session });
});
```

### Vector Search (Knowledge Base)

```typescript
import { KnowledgeBase } from './models';

// Note: This requires MongoDB Atlas Vector Search index
const results = await KnowledgeBase.aggregate([
  {
    $vectorSearch: {
      index: 'knowledge_base_vector_index',
      path: 'embedding',
      queryVector: queryEmbedding, // 1536-dimensional array
      numCandidates: 100,
      limit: 10,
    }
  },
  {
    $addFields: {
      similarityScore: { $meta: 'vectorSearchScore' }
    }
  },
  {
    $match: {
      similarityScore: { $gte: 0.75 },
      domain: 'Computer Science'
    }
  }
]);
```

## MongoDB Atlas Vector Search Setup

For the KnowledgeBase model to support vector search, you must create a vector search index in MongoDB Atlas:

### Via Atlas UI:
1. Go to your cluster → Search → Create Search Index
2. Select "JSON Editor"
3. Use this configuration:

```json
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

4. Name the index: `knowledge_base_vector_index`
5. Select the `knowledgeBase` collection

### Via MongoDB CLI:
```javascript
db.knowledgeBase.createSearchIndex(
  "knowledge_base_vector_index",
  {
    mappings: {
      dynamic: false,
      fields: {
        embedding: {
          type: "knnVector",
          dimensions: 1536,
          similarity: "cosine"
        },
        domain: { type: "string" },
        credibilityScore: { type: "number" },
        publicationDate: { type: "date" }
      }
    }
  }
);
```

## Index Management

All models have indexes defined in their schemas. These indexes are automatically created when the application connects to MongoDB. However, for production deployments:

1. Indexes are created automatically on first connection
2. For large collections, consider creating indexes manually before data import
3. Monitor index usage with MongoDB Atlas Performance Advisor
4. TTL indexes (AuditLog, FileUpload) require MongoDB to run cleanup tasks

## Connection Pooling

The MongoDB connection is managed by `src/db/mongodb.ts` with the following pool settings:

- **maxPoolSize**: 20 connections
- **minPoolSize**: 5 connections
- **socketTimeoutMS**: 45000ms
- **serverSelectionTimeoutMS**: 5000ms

These settings are optimized for the expected load. Adjust based on your deployment tier and traffic patterns.

## Best Practices

1. **Always use transactions** for operations that modify multiple collections
2. **Use lean()** for read-only queries to improve performance
3. **Use select()** to limit returned fields when you don't need all data
4. **Use indexes** - all common query patterns have indexes defined
5. **Validate data** - all models have validation rules, but add application-level validation too
6. **Handle errors** - wrap database operations in try-catch blocks
7. **Use sessions** for transactions to ensure ACID properties

## Migration from PostgreSQL

These models replace the PostgreSQL schema. Key differences:

- **Embedded documents** instead of separate tables for some relationships
- **Arrays** for one-to-many relationships (e.g., assessmentCriteria)
- **ObjectId** instead of integer IDs
- **Flexible schema** allows for easier evolution
- **Vector embeddings** stored directly in documents

## Testing

When writing tests for models:

```typescript
import { mongodb } from '../db/mongodb';
import { Program } from './models';

beforeAll(async () => {
  await mongodb.connect();
});

afterAll(async () => {
  await mongodb.disconnect();
});

afterEach(async () => {
  // Clean up test data
  await Program.deleteMany({});
});
```
