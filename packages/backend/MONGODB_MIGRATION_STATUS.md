# MongoDB Migration Status

## Task 3: Migrate database layer from PostgreSQL to MongoDB

### ✅ Completed Subtasks

#### 3.1 Replace database connection and query methods
- ✅ Updated `src/db/index.ts` to use Mongoose instead of PostgreSQL
- ✅ Removed PostgreSQL Pool and replaced with Mongoose connection
- ✅ Implemented transaction support using Mongoose sessions
- ✅ Updated health check to use Mongoose connection state
- ✅ Updated `src/config/index.ts` to remove PostgreSQL URL
- ✅ Updated `src/services/healthCheckService.ts` to use MongoDB health check
- ✅ Updated `src/index.ts` to connect to MongoDB on startup
- ✅ Updated `src/worker.ts` to connect to MongoDB before processing jobs
- ✅ Added graceful shutdown handlers for MongoDB

#### 3.3 Create MongoDB migration scripts
- ✅ Installed `migrate-mongo` package
- ✅ Created `migrate-mongo-config.js` configuration file
- ✅ Created migrations directory structure
- ✅ Created initial schema setup migration (`20250128000001-initial-schema-setup.js`)
  - Creates all collections with validation rules
  - Creates all necessary indexes
  - Includes TTL indexes for auto-cleanup
  - Provides rollback functionality
- ✅ Updated package.json scripts for MongoDB migrations

### 🔄 In Progress Subtasks

#### 3.2 Update all service files to use Mongoose models

**Completed Services:**
- ✅ `userService.ts` - Fully migrated to use User model
- ✅ `auditService.ts` - Fully migrated to use AuditLog model

**Services Requiring Migration:**

1. **programService.ts** (446 lines) - HIGH PRIORITY
   - Used extensively in routes
   - Methods to migrate:
     - `createProgram()` - Create new program
     - `getProgram()` - Get program by ID
     - `getProgramWithDetails()` - Get program with modules and outcomes
     - `listPrograms()` - List programs with filters
     - `updateProgram()` - Update program details
     - `deleteProgram()` - Delete program
     - `storeParsedData()` - Store parsed Excel data
   - Models needed: Program, Module, LearningOutcome

2. **uploadService.ts** - MEDIUM PRIORITY
   - Methods to migrate:
     - File upload handling
     - File metadata storage
   - Models needed: FileUpload, Program, Module

3. **knowledgeBaseService.ts** - HIGH PRIORITY
   - Methods to migrate:
     - Document ingestion
     - Embedding storage
     - Semantic search
   - Models needed: KnowledgeBase
   - Note: Will need to integrate with MongoDB Atlas Vector Search

4. **curriculumGeneratorService.ts** - HIGH PRIORITY
   - Methods to migrate:
     - Job creation and tracking
     - Curriculum generation pipeline
   - Models needed: GenerationJob, Program, Module, LearningOutcome

5. **skillBookGenerator.ts** - MEDIUM PRIORITY
   - Already imports `db` from '../db'
   - Needs to be updated to use SkillMapping model

6. **qualityAssuranceService.ts** - MEDIUM PRIORITY
   - Uses PostgreSQL for validation queries
   - Needs to be updated to use Mongoose models

7. **documentExportService.ts** - LOW PRIORITY
   - Uses PostgreSQL for data retrieval
   - Needs to be updated to use Mongoose models

### Migration Pattern for Services

Here's the pattern to follow when migrating services:

```typescript
// OLD (PostgreSQL)
import { Pool } from 'pg';
import { getPool } from '../db';

const pool = getPool();
const result = await pool.query('SELECT * FROM programs WHERE id = $1', [id]);
return result.rows[0];

// NEW (Mongoose)
import { Program } from '../models/Program';

const program = await Program.findById(id);
return program;
```

### Common Migration Patterns

#### 1. Create Operations
```typescript
// OLD
const result = await pool.query(
  'INSERT INTO programs (name, level) VALUES ($1, $2) RETURNING *',
  [name, level]
);

// NEW
const program = new Program({ name, level });
await program.save();
```

#### 2. Read Operations
```typescript
// OLD
const result = await pool.query('SELECT * FROM programs WHERE id = $1', [id]);

// NEW
const program = await Program.findById(id);
```

#### 3. Update Operations
```typescript
// OLD
const result = await pool.query(
  'UPDATE programs SET name = $1 WHERE id = $2 RETURNING *',
  [name, id]
);

// NEW
const program = await Program.findByIdAndUpdate(
  id,
  { name },
  { new: true }
);
```

#### 4. Delete Operations
```typescript
// OLD
await pool.query('DELETE FROM programs WHERE id = $1', [id]);

// NEW
await Program.findByIdAndDelete(id);
```

#### 5. List with Pagination
```typescript
// OLD
const result = await pool.query(
  'SELECT * FROM programs ORDER BY created_at DESC LIMIT $1 OFFSET $2',
  [limit, offset]
);

// NEW
const programs = await Program.find()
  .sort({ createdAt: -1 })
  .limit(limit)
  .skip(offset);
```

#### 6. Transactions
```typescript
// OLD
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO programs ...');
  await client.query('INSERT INTO modules ...');
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}

// NEW
import { db } from '../db';

await db.transaction(async (session) => {
  const program = new Program({ ... });
  await program.save({ session });
  
  const module = new Module({ ... });
  await module.save({ session });
});
```

### Next Steps

1. **Migrate programService.ts** - This is the most critical service
2. **Migrate knowledgeBaseService.ts** - Required for RAG functionality
3. **Migrate curriculumGeneratorService.ts** - Required for core functionality
4. **Migrate uploadService.ts** - Required for file handling
5. **Update remaining services** - Lower priority services
6. **Test all migrations** - Ensure all functionality works with MongoDB
7. **Update route handlers** - Some routes may need adjustments

### Testing Checklist

After migrating each service:
- [ ] Run TypeScript compiler to check for errors
- [ ] Test CRUD operations
- [ ] Test pagination and filtering
- [ ] Test transactions (if applicable)
- [ ] Test error handling
- [ ] Update any related tests

### Setup Instructions

1. **Set up MongoDB Atlas** (see `MONGODB_ATLAS_SETUP.md`)
   - Create a free cluster
   - Configure database user and network access
   - Get connection string

2. **Configure Environment Variables**
   ```bash
   # packages/backend/.env
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/curriculum_db?retryWrites=true&w=majority
   ```

3. **Run Migrations**
   ```bash
   cd packages/backend
   npm run migrate:up
   ```

4. **Create Vector Search Index** (Manual step in Atlas UI)
   - Required for knowledge base RAG functionality
   - See Step 8 in `MONGODB_ATLAS_SETUP.md`

### Notes

- All Mongoose models are already created in `src/models/`
- Models include proper validation and indexes
- MongoDB connection is already configured
- Migration scripts are ready to run
- Using MongoDB Atlas (cloud) - no local MongoDB installation needed
- Remember to create vector search index in MongoDB Atlas for knowledgeBase collection
