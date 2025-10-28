# Backend Scripts

This directory contains utility scripts for database setup, testing, and maintenance.

## MongoDB Atlas Scripts

### test-mongodb-connection.ts

Tests the connection to MongoDB Atlas and verifies configuration.

**Usage:**
```bash
npm run test:mongodb-connection
```

**What it tests:**
- ✓ Connection to MongoDB Atlas
- ✓ Database access permissions
- ✓ Collection operations (create, read, delete)
- ✓ Vector search index availability
- ✓ Connection details and statistics

**Prerequisites:**
- `MONGODB_URI` set in `.env` file
- MongoDB Atlas cluster running
- Network access configured

**Output:**
```
🔍 Testing MongoDB Atlas Connection...

✓ Connected to MongoDB Atlas successfully
✓ Database 'curriculum_db' is accessible
✓ Collection operations working correctly
✓ Vector search index 'knowledge_base_vector_index' is active

📊 Connection Details:
   Host: cluster.mongodb.net
   Database: curriculum_db
   Collections: 10

✅ All checks passed!
```

---

### create-indexes.ts

Creates all necessary database indexes for optimal query performance.

**Usage:**
```bash
npm run create:indexes
```

**What it creates:**
- Program indexes (programName, status, createdBy, createdAt)
- Module indexes (programId, moduleCode, sequenceOrder)
- Learning outcome indexes (moduleId, knowledgeSkillCompetency)
- Knowledge base indexes (domain, credibilityScore, publicationDate)
- Assessment indexes (moduleId, questionType, difficulty)
- Skill mapping indexes (programId, domain, skillName)
- Generation job indexes (programId, status, createdAt)
- User indexes (email, authProviderId, role)
- Audit log indexes (userId, action, createdAt with TTL)
- File upload indexes (programId, uploadedBy, createdAt with TTL)

**Prerequisites:**
- `MONGODB_URI` set in `.env` file
- MongoDB connection working
- Database and collections exist (or will be created)

**Output:**
```
📝 Creating indexes...

✓ programs.programName_1 - created
✓ programs.status_1 - created
✓ modules.programId_1 - created
...

📊 Summary:
   Created: 30
   Skipped: 0
   Failed: 0

✅ All indexes created successfully!
```

**Note:** Vector search index must be created separately in Atlas Search UI.

---

### test-vector-search.ts

Tests MongoDB Atlas Vector Search functionality with mock embeddings.

**Usage:**
```bash
npm run test:vector-search
```

**What it tests:**
- ✓ Vector search index exists and is active
- ✓ Document insertion with embeddings
- ✓ Vector similarity search queries
- ✓ Result ranking by similarity score
- ✓ Similarity threshold filtering
- ✓ Cleanup of test data

**Prerequisites:**
- `MONGODB_URI` set in `.env` file
- MongoDB Atlas M10+ cluster (vector search support)
- Vector search index created and active
- Index name: `knowledge_base_vector_index`

**Output:**
```
🔍 Testing MongoDB Atlas Vector Search...

✓ Connected to MongoDB
✓ Vector search index found and active
✓ Inserted 4 test documents
✓ Vector search executed successfully
✓ Found 2 similar documents

📊 Search Results:
   1. Machine Learning Fundamentals
      Similarity: 0.9876
   2. Deep Learning Advanced Topics
      Similarity: 0.9654

✓ Results correctly ranked
✓ All results above threshold (0.75)

✅ Vector Search tests completed successfully!
```

---

## Other Scripts

### test-monitoring.sh

Tests monitoring and alerting functionality.

**Usage:**
```bash
./scripts/test-monitoring.sh
```

**What it tests:**
- Health check endpoints
- Metrics collection
- Alert triggering
- Error tracking

---

## Script Development

### Adding New Scripts

1. Create TypeScript file in `scripts/` directory
2. Add shebang: `#!/usr/bin/env ts-node`
3. Import required dependencies
4. Implement script logic
5. Add error handling
6. Add to `package.json` scripts section

**Example:**
```typescript
#!/usr/bin/env ts-node

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function myScript() {
  try {
    await mongoose.connect(process.env.MONGODB_URI!);
    // Script logic here
    console.log('✓ Script completed');
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

myScript();
```

### Running Scripts Directly

Scripts can be run directly with tsx:

```bash
tsx scripts/my-script.ts
```

Or via npm scripts (recommended):

```bash
npm run my-script
```

---

## Troubleshooting

### Script Fails to Connect

**Error:** `MONGODB_URI is not set`
- **Solution:** Create `.env` file with `MONGODB_URI` variable

**Error:** `Connection timed out`
- **Solution:** Check network access in MongoDB Atlas
- Verify IP whitelist includes your IP

### Script Fails with Permission Error

**Error:** `Permission denied`
- **Solution:** Make script executable: `chmod +x scripts/script-name.ts`

### TypeScript Errors

**Error:** `Cannot find module`
- **Solution:** Install dependencies: `npm install`
- Ensure `tsx` is installed: `npm install -D tsx`

---

## Best Practices

1. **Always use environment variables** for sensitive data
2. **Add error handling** for all database operations
3. **Clean up resources** (disconnect from database)
4. **Provide clear output** with status indicators (✓, ✗, ⚠️)
5. **Exit with appropriate code** (0 for success, 1 for failure)
6. **Document prerequisites** and expected behavior
7. **Test scripts locally** before committing

---

## Related Documentation

- MongoDB Atlas Setup: `../MONGODB_ATLAS_SETUP.md`
- Quick Start Guide: `../MONGODB_ATLAS_QUICKSTART.md`
- Task Checklist: `../../../.kiro/specs/mongodb-render-migration/TASK_2_CHECKLIST.md`
