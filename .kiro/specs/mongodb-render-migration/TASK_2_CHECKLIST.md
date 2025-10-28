# Task 2: MongoDB Atlas Configuration Checklist

This checklist guides you through configuring MongoDB Atlas and Vector Search for the Curriculum Generator App migration.

## Overview

**Task**: Configure MongoDB Atlas and Vector Search  
**Status**: Ready to execute  
**Estimated Time**: 15-20 minutes  
**Requirements**: 1.5, 2.1, 2.2, 2.3

## Prerequisites

- [ ] MongoDB Atlas account created (https://www.mongodb.com/cloud/atlas/register)
- [ ] Credit card on file (required for M10+ clusters, even with free credits)
- [ ] Access to create and configure clusters

## Step-by-Step Checklist

### Phase 1: Create MongoDB Atlas Cluster

- [ ] **1.1** Log in to MongoDB Atlas dashboard
- [ ] **1.2** Click "Build a Database" or "Create" button
- [ ] **1.3** Select "Dedicated Clusters" option
- [ ] **1.4** Choose cluster tier: **M10** or higher (required for vector search)
- [ ] **1.5** Select cloud provider (AWS recommended)
- [ ] **1.6** Select region (choose closest to Render deployment location)
  - Recommended: `us-east-1` (US East - N. Virginia)
- [ ] **1.7** Name cluster: `curriculum-cluster` (or your preference)
- [ ] **1.8** Click "Create Cluster"
- [ ] **1.9** Wait for cluster creation (7-10 minutes)
- [ ] **1.10** Verify cluster status shows "Active"

**Documentation**: See `MONGODB_ATLAS_SETUP.md` Step 1

### Phase 2: Configure Network Access

- [ ] **2.1** Navigate to "Network Access" under Security section
- [ ] **2.2** Click "Add IP Address"
- [ ] **2.3** For development: Click "Add Current IP Address"
- [ ] **2.4** For production: Click "Allow Access from Anywhere" (0.0.0.0/0)
  - Note: This allows Render services to connect
- [ ] **2.5** Click "Confirm"
- [ ] **2.6** Verify IP address appears in whitelist

**Documentation**: See `MONGODB_ATLAS_SETUP.md` Step 2

### Phase 3: Create Database User

- [ ] **3.1** Navigate to "Database Access" under Security section
- [ ] **3.2** Click "Add New Database User"
- [ ] **3.3** Select "Password" authentication method
- [ ] **3.4** Enter username: `curriculum_app_user` (or your choice)
- [ ] **3.5** Click "Autogenerate Secure Password" or enter strong password
- [ ] **3.6** **IMPORTANT**: Copy and save password securely
- [ ] **3.7** Select "Read and write to any database" privilege
- [ ] **3.8** Click "Add User"
- [ ] **3.9** Verify user appears in Database Access list

**Documentation**: See `MONGODB_ATLAS_SETUP.md` Step 3

### Phase 4: Set Up Database and Collections

- [ ] **4.1** Navigate to "Database" in Atlas dashboard
- [ ] **4.2** Click "Browse Collections" on your cluster
- [ ] **4.3** Click "Add My Own Data"
- [ ] **4.4** Database name: `curriculum_db`
- [ ] **4.5** Collection name: `programs`
- [ ] **4.6** Click "Create"
- [ ] **4.7** Verify database and collection appear in list

**Note**: Other collections will be created automatically by Mongoose

**Documentation**: See `MONGODB_ATLAS_SETUP.md` Step 4

### Phase 5: Create Vector Search Index

- [ ] **5.1** In cluster view, click the "Search" tab
- [ ] **5.2** Click "Create Search Index"
- [ ] **5.3** Select "JSON Editor" configuration method
- [ ] **5.4** Enter index name: `knowledge_base_vector_index`
- [ ] **5.5** Select database: `curriculum_db`
- [ ] **5.6** Select collection: `knowledgebases`
  - If collection doesn't exist, create it first or proceed (it will be created later)
- [ ] **5.7** Paste the vector search index JSON definition:

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
        "type": "string",
        "indexOptions": "offsets"
      },
      "credibilityScore": {
        "type": "number"
      },
      "publicationDate": {
        "type": "date"
      },
      "sourceType": {
        "type": "string"
      },
      "metadata.tags": {
        "type": "string"
      }
    }
  }
}
```

- [ ] **5.8** Click "Next"
- [ ] **5.9** Review configuration
- [ ] **5.10** Click "Create Search Index"
- [ ] **5.11** Wait for index status to change from "Building" to "Active" (2-5 minutes)
- [ ] **5.12** Verify index status shows "Active" or "Ready"

**Documentation**: See `MONGODB_ATLAS_SETUP.md` Step 5

### Phase 6: Get Connection String

- [ ] **6.1** Navigate to "Database" in Atlas dashboard
- [ ] **6.2** Click "Connect" button on your cluster
- [ ] **6.3** Choose "Connect your application"
- [ ] **6.4** Select Driver: "Node.js"
- [ ] **6.5** Select Version: "4.1 or later"
- [ ] **6.6** Copy the connection string
- [ ] **6.7** Replace `<username>` with your database username
- [ ] **6.8** Replace `<password>` with your database password
- [ ] **6.9** Add database name after the host: `/curriculum_db`
- [ ] **6.10** If password has special characters, URL-encode them:
  - `@` → `%40`
  - `:` → `%3A`
  - `/` → `%2F`
  - `?` → `%3F`
  - `#` → `%23`

**Example connection string**:
```
mongodb+srv://curriculum_app_user:YOUR_PASSWORD@curriculum-cluster.xxxxx.mongodb.net/curriculum_db?retryWrites=true&w=majority
```

**Documentation**: See `MONGODB_ATLAS_SETUP.md` Step 6

### Phase 7: Configure Local Environment

- [ ] **7.1** Navigate to `packages/backend` directory
- [ ] **7.2** Create or update `.env` file
- [ ] **7.3** Add `MONGODB_URI` environment variable with your connection string:

```bash
MONGODB_URI=mongodb+srv://curriculum_app_user:YOUR_PASSWORD@curriculum-cluster.xxxxx.mongodb.net/curriculum_db?retryWrites=true&w=majority
```

- [ ] **7.4** Verify `.env` file is in `.gitignore` (should already be)
- [ ] **7.5** Save the file

**Documentation**: See `MONGODB_ATLAS_SETUP.md` Step 7

### Phase 8: Test Connection from Local Environment

- [ ] **8.1** Open terminal in `packages/backend` directory
- [ ] **8.2** Ensure dependencies are installed: `npm install`
- [ ] **8.3** Run connection test: `npm run test:mongodb-connection`
- [ ] **8.4** Verify output shows:
  - ✓ Connected to MongoDB Atlas successfully
  - ✓ Database 'curriculum_db' is accessible
  - ✓ Collection operations working correctly
  - ✓ Vector search index status (Active or note about creation)
- [ ] **8.5** If any checks fail, review troubleshooting section
- [ ] **8.6** Verify connection details are displayed correctly

**Expected Output**:
```
🔍 Testing MongoDB Atlas Connection...

✓ Connected to MongoDB Atlas successfully
✓ Database 'curriculum_db' is accessible
✓ Collection operations (create, read, delete) working correctly
✓ Vector search index 'knowledge_base_vector_index' is active

📊 Connection Details:
   Host: curriculum-cluster.xxxxx.mongodb.net
   Database: curriculum_db
   MongoDB Version: 7.x.x
   Collections: 1

📋 Test Summary: 4/4 tests passed

✅ All checks passed! MongoDB Atlas is configured correctly.
```

**Documentation**: See `MONGODB_ATLAS_SETUP.md` Step 8

### Phase 9: Create Performance Indexes

- [ ] **9.1** Run index creation script: `npm run create:indexes`
- [ ] **9.2** Verify indexes are created successfully
- [ ] **9.3** Check output shows created/skipped counts
- [ ] **9.4** Verify no failed index creations

**Expected Output**:
```
📝 Creating indexes...

✓ programs.programName_1 - created
✓ programs.status_1 - created
✓ modules.programId_1 - created
...

📊 Summary:
   Created: 30+
   Skipped: 0
   Failed: 0

✅ All indexes created successfully!
```

**Documentation**: See `MONGODB_ATLAS_SETUP.md` Step 9

### Phase 10: Test Vector Search (Optional but Recommended)

- [ ] **10.1** Run vector search test: `npm run test:vector-search`
- [ ] **10.2** Verify test documents are inserted
- [ ] **10.3** Verify vector search query executes
- [ ] **10.4** Verify results are returned and ranked
- [ ] **10.5** Verify test cleanup completes

**Expected Output**:
```
🔍 Testing MongoDB Atlas Vector Search...

✓ Connected to MongoDB
📋 Checking for vector search index...
✓ Vector search index found and active

📝 Inserting test documents with embeddings...
✓ Inserted 4 test documents

🔎 Performing vector similarity search...
✓ Vector search executed successfully
✓ Found 2 similar documents

📊 Search Results:
   1. Machine Learning Fundamentals
      Similarity: 0.9876
   2. Deep Learning Advanced Topics
      Similarity: 0.9654

✓ Results correctly ranked by similarity score
✓ All results above similarity threshold (0.75)

🧹 Cleaning up test documents...
✓ Removed 4 test documents

✅ Vector Search tests completed successfully!
```

**Documentation**: See `MONGODB_ATLAS_SETUP.md` Step 10

## Verification Checklist

After completing all steps, verify:

- [ ] MongoDB Atlas cluster is running (status: Active)
- [ ] Cluster tier is M10 or higher
- [ ] Network access is configured (IP whitelist)
- [ ] Database user is created with correct permissions
- [ ] Database `curriculum_db` exists
- [ ] Vector search index `knowledge_base_vector_index` is Active
- [ ] Connection string is saved in `.env` file
- [ ] Local connection test passes all checks
- [ ] Performance indexes are created
- [ ] Vector search test passes (optional)

## Troubleshooting

### Connection Issues

**Problem**: `MongoServerError: bad auth`
- **Solution**: Verify username and password are correct
- Check password is URL-encoded if it contains special characters
- Verify user has correct permissions in Database Access

**Problem**: `MongooseServerSelectionError: connection timed out`
- **Solution**: Check IP whitelist in Network Access
- Verify your IP address is allowed
- Try allowing access from anywhere (0.0.0.0/0) temporarily

**Problem**: `ENOTFOUND` error
- **Solution**: Check connection string format
- Verify cluster name is correct
- Ensure cluster is running (not paused)

### Vector Search Issues

**Problem**: `$vectorSearch is not supported`
- **Solution**: Upgrade cluster to M10 or higher
- M0/M2/M5 tiers don't support vector search

**Problem**: `Index not found`
- **Solution**: Verify index was created in Atlas Search
- Check index name matches exactly: `knowledge_base_vector_index`
- Wait for index to finish building (check status in Atlas)

**Problem**: Index status is "Building"
- **Solution**: Wait 2-5 minutes for index to complete
- Refresh Atlas Search page to check status
- Index must be "Active" or "Ready" before use

## Documentation References

- **Quick Start**: `MONGODB_ATLAS_QUICKSTART.md`
- **Detailed Setup**: `MONGODB_ATLAS_SETUP.md`
- **Requirements**: `.kiro/specs/mongodb-render-migration/requirements.md`
- **Design**: `.kiro/specs/mongodb-render-migration/design.md`

## Scripts Created

- `npm run test:mongodb-connection` - Test MongoDB Atlas connection
- `npm run create:indexes` - Create performance indexes
- `npm run test:vector-search` - Test vector search functionality

## Next Steps

After completing this task:

1. ✅ Task 2 complete: MongoDB Atlas configured
2. → Mark task as complete in tasks.md
3. → Proceed to Task 3: Migrate database layer from PostgreSQL to MongoDB
4. → Begin implementing Mongoose models

## Task Completion Criteria

This task is complete when:

- [x] MongoDB Atlas cluster created (M10+)
- [x] Network access configured
- [x] Database user created
- [x] Database and collections set up
- [x] Vector search index created and active
- [x] Connection string obtained and configured
- [x] Local connection test passes
- [x] Performance indexes created
- [x] Documentation reviewed

**Estimated Total Time**: 15-20 minutes

---

**Status**: Ready to execute  
**Last Updated**: 2025-10-28
