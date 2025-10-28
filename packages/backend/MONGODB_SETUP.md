# MongoDB Setup Guide

This guide covers the MongoDB setup for the Curriculum Generator App migration from PostgreSQL to MongoDB.

## Overview

Task 1 of the MongoDB migration has been completed. This includes:

1. ✅ Mongoose and dependencies installed
2. ✅ All 10 Mongoose models created with proper schemas
3. ✅ Indexes defined for optimal query performance
4. ✅ MongoDB connection service with connection pooling
5. ✅ Configuration updated to support MongoDB
6. ✅ Environment variables added for MongoDB

## What Was Created

### Models (packages/backend/src/models/)

All models are located in `packages/backend/src/models/` with the following structure:

1. **Program.ts** - Main curriculum programs
2. **Module.ts** - Course modules within programs
3. **LearningOutcome.ts** - Learning outcomes for modules
4. **KnowledgeBase.ts** - Document chunks with vector embeddings
5. **Assessment.ts** - Assessment questions
6. **SkillMapping.ts** - Skills mapped to programs
7. **GenerationJob.ts** - Background job tracking
8. **User.ts** - User accounts
9. **AuditLog.ts** - Audit trail (with 90-day TTL)
10. **FileUpload.ts** - File metadata (with 7-day TTL for temp files)
11. **index.ts** - Exports all models
12. **README.md** - Comprehensive documentation

### Database Connection (packages/backend/src/db/)

- **mongodb.ts** - MongoDB connection service with:
  - Connection pooling (5-20 connections)
  - Health check functionality
  - Transaction support
  - Graceful shutdown handling
  - Connection event monitoring

### Configuration Updates

- **config/index.ts** - Added MongoDB configuration:
  - `database.mongoUri` - MongoDB connection string
  - `openai.embeddingModel` - OpenAI embedding model
  - `openai.chatModel` - OpenAI chat model
  - `storage` - File storage configuration

- **.env.example** - Added environment variables:
  - `MONGODB_URI` - MongoDB connection string
  - `OPENAI_EMBEDDING_MODEL` - Embedding model name
  - `OPENAI_CHAT_MODEL` - Chat model name
  - `UPLOAD_DIR` - File upload directory
  - `MAX_FILE_SIZE` - Maximum file size

### Utilities

- **db/initMongoDB.ts** - Initialization script to:
  - Connect to MongoDB
  - Create all indexes
  - Display connection stats
  - Verify setup

## Installation

The required dependencies have been installed:

```bash
npm install mongoose @types/mongoose
```

## Configuration

### 1. Local Development

Add to your `.env` file:

```bash
# MongoDB Local
MONGODB_URI=mongodb://localhost:27017/curriculum_db

# Or MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/curriculum_db?retryWrites=true&w=majority

# OpenAI Configuration
OPENAI_EMBEDDING_MODEL=text-embedding-3-large
OPENAI_CHAT_MODEL=gpt-4-turbo

# File Storage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=52428800
```

### 2. MongoDB Atlas Setup (Production)

1. Create a MongoDB Atlas account at https://www.mongodb.com/cloud/atlas
2. Create a new cluster (M10 or higher for vector search)
3. Create a database user with read/write permissions
4. Whitelist your IP addresses or use 0.0.0.0/0 for development
5. Get your connection string and add it to `MONGODB_URI`

### 3. Initialize MongoDB

Run the initialization script to create indexes:

```bash
npm run mongodb:init
```

This will:
- Connect to MongoDB
- Create all indexes for optimal performance
- Display connection statistics
- Verify the setup

## Model Features

### Validation

All models include:
- Required field validation
- Type validation
- Custom validators (e.g., email format)
- Min/max constraints
- Enum validation

### Indexes

Indexes are defined for:
- Primary keys (automatic _id)
- Foreign keys (references)
- Frequently queried fields
- Compound indexes for common query patterns
- Unique indexes where needed
- TTL indexes for auto-cleanup

### Relationships

- **References**: Using ObjectId with `ref` for relationships
- **Population**: Use `.populate()` to load related documents
- **Embedded Documents**: Arrays for one-to-many relationships

### Special Features

1. **Vector Embeddings** (KnowledgeBase):
   - 1536-dimensional embeddings for OpenAI
   - Requires MongoDB Atlas Vector Search index (see below)

2. **TTL Indexes**:
   - AuditLog: Auto-deletes after 90 days
   - FileUpload: Auto-deletes temp files after 7 days

3. **Timestamps**:
   - All models have `createdAt` and `updatedAt` (except AuditLog)

## MongoDB Atlas Vector Search Setup

**IMPORTANT**: For the KnowledgeBase model to support vector search, you must create a vector search index in MongoDB Atlas.

### Via Atlas UI:

1. Go to your cluster → Search → Create Search Index
2. Select "JSON Editor"
3. Name: `knowledge_base_vector_index`
4. Collection: `knowledgeBase`
5. Use this configuration:

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

## Usage Examples

### Connecting to MongoDB

```typescript
import { mongodb } from './db/mongodb';

// Connect
await mongodb.connect();

// Health check
const isHealthy = await mongodb.healthCheck();

// Disconnect
await mongodb.disconnect();
```

### Using Models

```typescript
import { Program, Module } from './models';

// Create a program
const program = new Program({
  programName: 'Bachelor of Computer Science',
  qualificationLevel: 'Level 8',
  qualificationType: 'Bachelor Degree',
  totalCredits: 120,
  status: 'draft',
  createdBy: userId,
});
await program.save();

// Query with population
const modules = await Module.find({ programId: program._id })
  .populate('programId')
  .sort({ sequenceOrder: 1 });

// Update
await Program.findByIdAndUpdate(
  program._id,
  { status: 'published' },
  { new: true }
);

// Delete
await Program.findByIdAndDelete(program._id);
```

### Using Transactions

```typescript
import { mongodb } from './db/mongodb';
import { Program, Module } from './models';

await mongodb.transaction(async (session) => {
  const program = new Program({ /* ... */ });
  await program.save({ session });
  
  const module = new Module({ 
    programId: program._id,
    /* ... */
  });
  await module.save({ session });
});
```

## Connection Pooling

The MongoDB connection uses the following pool settings:

- **maxPoolSize**: 20 connections
- **minPoolSize**: 5 connections
- **socketTimeoutMS**: 45000ms (45 seconds)
- **serverSelectionTimeoutMS**: 5000ms (5 seconds)
- **heartbeatFrequencyMS**: 10000ms (10 seconds)

These settings are optimized for typical workloads. Adjust based on your needs.

## Next Steps

This completes Task 1 of the MongoDB migration. The next tasks are:

1. **Task 2**: Configure MongoDB Atlas and Vector Search
2. **Task 3**: Migrate database layer from PostgreSQL to MongoDB
3. **Task 4**: Replace Pinecone with MongoDB Atlas Vector Search
4. **Task 5**: Replace AWS S3 with Render Persistent Disk storage

## Troubleshooting

### Connection Issues

If you can't connect to MongoDB:

1. Check your `MONGODB_URI` is correct
2. Verify network access in MongoDB Atlas
3. Check firewall settings
4. Verify database user credentials

### Index Creation Issues

If indexes aren't created:

1. Run `npm run mongodb:init` manually
2. Check MongoDB logs for errors
3. Verify you have write permissions
4. For Atlas, check cluster tier supports indexes

### Model Validation Errors

If you get validation errors:

1. Check required fields are provided
2. Verify data types match schema
3. Check enum values are valid
4. Review custom validators

## Resources

- [Mongoose Documentation](https://mongoosejs.com/docs/)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [MongoDB Vector Search](https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-overview/)
- [Model Documentation](./src/models/README.md)

## Support

For issues or questions:

1. Check the model README: `packages/backend/src/models/README.md`
2. Review MongoDB logs
3. Check MongoDB Atlas monitoring
4. Review the design document: `.kiro/specs/mongodb-render-migration/design.md`
