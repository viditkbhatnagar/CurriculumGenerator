# Synthetic Data Guide

This guide explains how to use the synthetic data layer to develop and test the application without needing a database connection.

## Overview

The synthetic data layer provides an in-memory data store that mimics MongoDB functionality. This allows you to:

- ✅ Develop and test without MongoDB installed
- ✅ Quickly iterate on features with instant data resets
- ✅ Run tests without database dependencies
- ✅ Demo the application with realistic sample data
- ✅ Switch to real MongoDB when ready with minimal code changes

## Quick Start

### 1. Enable Mock Data Mode

Set the environment variable in your `.env` file:

```bash
USE_MOCK_DATA=true
```

### 2. Start the Application

```bash
npm run dev
```

The application will automatically:
- Initialize synthetic data
- Create sample users, programs, modules, etc.
- Work exactly like it would with a real database

### 3. Run Examples

See the data service in action:

```bash
npm run data:examples
```

This will run through various examples showing how to:
- Query data
- Create new records
- Update existing records
- Work with relationships

## What's Included

### Sample Data

The synthetic data includes:

**Users (2)**
- 1 Administrator (admin@example.com)
- 1 SME (sme@example.com)

**Programs (1)**
- Bachelor of Computer Science
  - Level 8, 120 credits
  - Status: draft

**Modules (3)**
- CS101: Introduction to Programming (core)
- CS102: Data Structures and Algorithms (core)
- CS201: Web Development (elective)

**Learning Outcomes (3)**
- Programming skills
- Fundamental concepts
- Data structure implementation

**Assessments (3)**
- MCQ question (easy)
- Essay question (medium)
- Practical question (hard)

**Knowledge Base (2)**
- Python programming entry
- Data structures entry
- Each with 1536-dimensional mock embeddings

**Other Data**
- 1 Skill Mapping
- 1 Generation Job (completed)
- 1 File Upload
- 1 Audit Log

### API Compatibility

The mock repository provides the same interface as Mongoose models:

```typescript
// These work identically with mock or real data
await Model.find(query)
await Model.findOne(query)
await Model.findById(id)
await Model.create(data)
await Model.findByIdAndUpdate(id, update, options)
await Model.findOneAndUpdate(query, update, options)
await Model.findByIdAndDelete(id)
await Model.deleteMany(query)
await Model.countDocuments(query)
await Model.exists(query)
await Model.distinct(field, query)
await Model.aggregate(pipeline)
```

## Usage in Your Code

### Option 1: Use Data Service (Recommended)

The data service automatically switches between mock and real data:

```typescript
import { initializeDataService, getModel } from './data';

// Initialize (call once at app startup)
await initializeDataService();

// Get models (works with both mock and real data)
const Program = getModel('Program');
const Module = getModel('Module');

// Use normally
const programs = await Program.find({ status: 'draft' });
const newProgram = await Program.create({ /* ... */ });
```

### Option 2: Direct Import

For convenience, you can import models directly:

```typescript
import { Program, Module, User } from './data';

// These are functions that return the appropriate model
const programs = await Program().find();
const modules = await Module().find();
```

### Checking Data Mode

```typescript
import { isUsingMockData, getDataMode } from './data';

if (isUsingMockData()) {
  console.log('Using synthetic data');
} else {
  console.log('Using real database');
}

// Or
const mode = getDataMode(); // 'mock' or 'database'
```

## Switching to Real MongoDB

When you're ready to use a real database:

### 1. Update Environment Variable

```bash
USE_MOCK_DATA=false
MONGODB_URI=mongodb://localhost:27017/curriculum_db
```

### 2. Start MongoDB

```bash
# Local MongoDB
mongod

# Or use MongoDB Atlas (cloud)
# Just update MONGODB_URI with your Atlas connection string
```

### 3. Initialize MongoDB

```bash
npm run mongodb:init
```

### 4. Restart Application

```bash
npm run dev
```

That's it! Your code doesn't need to change. The data service automatically uses MongoDB instead of mock data.

## Development Workflow

### Typical Development Flow

1. **Start with Mock Data**
   ```bash
   USE_MOCK_DATA=true npm run dev
   ```
   - Develop features quickly
   - Test UI/UX with sample data
   - No database setup needed

2. **Test with Real Data**
   ```bash
   USE_MOCK_DATA=false npm run dev
   ```
   - Verify database queries work
   - Test with larger datasets
   - Check performance

3. **Deploy to Production**
   ```bash
   USE_MOCK_DATA=false
   MONGODB_URI=mongodb+srv://...
   ```
   - Always use real database in production
   - Never use mock data in production

### Resetting Data

When using mock data, you can reset to initial state:

```typescript
import { resetSyntheticData } from './data';

// Reset all data to initial sample data
resetSyntheticData();
```

Or restart the application - data is in-memory so it resets automatically.

## Testing

### Unit Tests

Use mock data for fast unit tests:

```typescript
import { initializeDataService, resetDataService, getModel } from '../data';

describe('Program Service', () => {
  beforeAll(async () => {
    process.env.USE_MOCK_DATA = 'true';
    await initializeDataService();
  });

  beforeEach(async () => {
    await resetDataService(); // Reset to clean state
  });

  it('should create a program', async () => {
    const Program = getModel('Program');
    const program = await Program.create({
      programName: 'Test Program',
      // ...
    });
    expect(program._id).toBeDefined();
  });
});
```

### Integration Tests

Use real database for integration tests:

```typescript
describe('Program API Integration', () => {
  beforeAll(async () => {
    process.env.USE_MOCK_DATA = 'false';
    await initializeDataService();
  });

  // Test with real MongoDB
});
```

## API Examples

### Creating Records

```typescript
const Program = getModel('Program');
const User = getModel('User');

// Get a user
const user = await User.findOne({ role: 'administrator' });

// Create a program
const program = await Program.create({
  programName: 'Bachelor of Engineering',
  qualificationLevel: 'Level 8',
  qualificationType: 'Bachelor Degree',
  totalCredits: 120,
  industrySector: 'Engineering',
  status: 'draft',
  createdBy: user._id,
});
```

### Querying Records

```typescript
const Program = getModel('Program');

// Find all
const all = await Program.find();

// Find with filter
const drafts = await Program.find({ status: 'draft' });

// Find one
const program = await Program.findOne({ programName: 'Bachelor of Computer Science' });

// Find by ID
const byId = await Program.findById(programId);

// Count
const count = await Program.countDocuments({ status: 'draft' });

// Check existence
const exists = await Program.exists({ programName: 'Test' });
```

### Updating Records

```typescript
const Program = getModel('Program');

// Update by ID
const updated = await Program.findByIdAndUpdate(
  programId,
  { status: 'published' },
  { new: true } // Return updated document
);

// Update one matching query
const updated2 = await Program.findOneAndUpdate(
  { programName: 'Test' },
  { status: 'archived' },
  { new: true }
);
```

### Deleting Records

```typescript
const Program = getModel('Program');

// Delete by ID
await Program.findByIdAndDelete(programId);

// Delete one matching query
await Program.findOneAndDelete({ programName: 'Test' });

// Delete many
await Program.deleteMany({ status: 'draft' });
```

### Working with Relationships

```typescript
const Program = getModel('Program');
const Module = getModel('Module');

// Get program
const program = await Program.findOne({ status: 'draft' });

// Get modules for this program
const modules = await Module.find({ programId: program._id });

// Create module for program
const newModule = await Module.create({
  programId: program._id,
  moduleCode: 'CS301',
  moduleTitle: 'Advanced Topics',
  hours: 120,
  coreElective: 'core',
  sequenceOrder: 4,
});
```

### Aggregation

```typescript
const Assessment = getModel('Assessment');

// Simple aggregation
const results = await Assessment.aggregate([
  { $match: { difficulty: 'easy' } },
  { $sort: { createdAt: -1 } },
  { $limit: 10 },
]);
```

## Limitations

### Mock Data Limitations

The mock repository has some limitations compared to real MongoDB:

1. **No Complex Aggregations**: Only basic aggregation pipeline stages are supported
2. **No Transactions**: Transaction support is simulated but not enforced
3. **No Indexes**: Index definitions are ignored (no performance impact in-memory)
4. **No Vector Search**: Vector search queries won't work with mock data
5. **No Population**: `.populate()` returns data as-is without resolving references
6. **In-Memory Only**: Data is lost when application restarts
7. **No Concurrency**: Not suitable for testing concurrent operations

### When to Use Real Database

Use real MongoDB when you need to:
- Test vector search functionality
- Test complex aggregation pipelines
- Test transaction behavior
- Test with large datasets
- Test performance and indexing
- Test concurrent operations
- Persist data between restarts

## Health Check

Check data service health:

```typescript
import { dataServiceHealthCheck } from './data';

const health = await dataServiceHealthCheck();
console.log(health);

// Mock mode:
// {
//   healthy: true,
//   mode: 'mock',
//   details: { message: 'Using synthetic in-memory data' }
// }

// Database mode:
// {
//   healthy: true,
//   mode: 'database',
//   details: { host: 'localhost', database: 'curriculum_db', ... }
// }
```

## Troubleshooting

### Mock Data Not Loading

If synthetic data isn't initialized:

```typescript
import { initializeSyntheticData } from './data';

// Manually initialize
initializeSyntheticData();
```

### Data Not Persisting

Remember: Mock data is in-memory only. It resets when the application restarts. This is by design for development/testing.

### Switching Modes Not Working

Make sure to:
1. Update `.env` file with `USE_MOCK_DATA=true` or `false`
2. Restart the application
3. Check logs for "Using MOCK DATA" or "Using REAL DATABASE"

### Model Not Found Error

Make sure you're using the correct model name:

```typescript
// Correct
const Program = getModel('Program');

// Incorrect
const Program = getModel('program'); // lowercase won't work
```

## Best Practices

1. **Start with Mock Data**: Develop features with mock data first
2. **Test with Real Data**: Verify with real MongoDB before deploying
3. **Never Use Mock in Production**: Always set `USE_MOCK_DATA=false` in production
4. **Reset Between Tests**: Call `resetDataService()` between test cases
5. **Check Data Mode**: Use `isUsingMockData()` to conditionally handle features
6. **Document Limitations**: Note any features that require real database

## Next Steps

1. Start the app with mock data: `USE_MOCK_DATA=true npm run dev`
2. Explore the sample data through your API
3. Test your features with synthetic data
4. When ready, switch to real MongoDB: `USE_MOCK_DATA=false`
5. Deploy to production with MongoDB Atlas

## Resources

- [Synthetic Data Implementation](./src/data/syntheticData.ts)
- [Mock Repository](./src/data/mockRepository.ts)
- [Data Service](./src/data/dataService.ts)
- [Usage Examples](./src/examples/dataServiceUsage.example.ts)
- [MongoDB Setup Guide](./MONGODB_SETUP.md)
