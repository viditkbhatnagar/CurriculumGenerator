# Pinecone to MongoDB Atlas Vector Search Migration Guide

This guide explains how to migrate embeddings from Pinecone to MongoDB Atlas Vector Search.

## Prerequisites

1. **MongoDB Atlas Cluster** (M10 or higher for vector search support)
2. **Vector Search Index** created in MongoDB Atlas
3. **Pinecone API Key** (if migrating existing data)
4. **Environment Variables** configured

## Step 1: Create MongoDB Atlas Vector Search Index

Before running the migration, you must create a vector search index in MongoDB Atlas.

### Using MongoDB Atlas UI:

1. Go to your MongoDB Atlas cluster
2. Navigate to "Search" tab
3. Click "Create Search Index"
4. Select "JSON Editor"
5. Use the following configuration:

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

6. Name the index: `knowledge_base_vector_index`
7. Select the database and collection: `knowledgeBase`
8. Click "Create Search Index"

### Using MongoDB CLI:

```bash
mongosh "mongodb+srv://your-cluster.mongodb.net" --apiVersion 1 --username <username>

use curriculum_db

db.knowledgeBase.createSearchIndex(
  "knowledge_base_vector_index",
  "vectorSearch",
  {
    "fields": [
      {
        "type": "vector",
        "path": "embedding",
        "numDimensions": 1536,
        "similarity": "cosine"
      }
    ]
  }
)
```

## Step 2: Configure Environment Variables

Ensure your `.env` file has the following variables:

```bash
# MongoDB Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/curriculum_db

# Pinecone Configuration (only needed for migration)
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_INDEX_NAME=curriculum-knowledge-base
```

## Step 3: Run the Migration Script

### Option 1: Migrate from Pinecone

If you have existing data in Pinecone:

```bash
cd packages/backend
npm run ts-node scripts/migrate-pinecone-to-mongodb.ts
```

The script will:
1. Connect to Pinecone and export all vectors
2. Transform vectors to MongoDB document format
3. Import vectors into MongoDB
4. Verify the migration

### Option 2: Start Fresh

If you don't have Pinecone data or want to start fresh:

1. Skip the migration script
2. Use the document ingestion pipeline to add new documents
3. The system will automatically store embeddings in MongoDB

## Step 4: Verify Vector Search

Test the vector search functionality:

```bash
npm run ts-node scripts/test-vector-search.ts
```

Or use the test script:

```typescript
import { vectorSearchService } from './src/services/vectorSearchService';

async function testVectorSearch() {
  const results = await vectorSearchService.search('machine learning', {
    limit: 5,
    minSimilarity: 0.75,
  });

  console.log(`Found ${results.length} results`);
  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.metadata.title}`);
    console.log(`   Similarity: ${result.similarityScore}`);
    console.log(`   Domain: ${result.domain}`);
  });
}

testVectorSearch();
```

## Step 5: Update Application Code

The application has been updated to use MongoDB vector search. Key changes:

1. **Vector Search Service** (`vectorSearchService.ts`)
   - Replaces Pinecone client
   - Uses MongoDB aggregation pipeline with `$vectorSearch`

2. **RAG Engine** (`ragEngine.ts`)
   - Updated to use `vectorSearchService`
   - No longer depends on Pinecone

3. **Knowledge Base Service** (`knowledgeBaseService.ts`)
   - Stores embeddings directly in MongoDB
   - Uses vector search for queries

## Step 6: Remove Pinecone Dependencies (Optional)

Once migration is complete and verified:

1. Remove Pinecone from `package.json`:
```bash
npm uninstall @pinecone-database/pinecone
```

2. Remove Pinecone environment variables from `.env`

3. Delete old vector database service:
```bash
rm src/services/vectorDatabaseService.ts
```

## Troubleshooting

### Vector Search Index Not Found

**Error:** `MongoServerError: Search index not found`

**Solution:** Ensure the vector search index is created in MongoDB Atlas with the correct name (`knowledge_base_vector_index`)

### Embedding Dimension Mismatch

**Error:** `Embedding must have exactly 1536 dimensions`

**Solution:** 
- Check that OpenAI embeddings are using `text-embedding-3-large` model
- Verify the vector search index is configured for 1536 dimensions

### Low Similarity Scores

**Issue:** Search results have low similarity scores

**Solution:**
- Adjust `minSimilarity` threshold (default: 0.75)
- Increase `numCandidates` in vector search pipeline
- Check embedding quality and content relevance

### Migration Script Fails

**Error:** Connection timeout or authentication error

**Solution:**
- Verify MongoDB URI is correct
- Check network access in MongoDB Atlas (whitelist IP)
- Ensure database user has read/write permissions

## Performance Optimization

### Index Configuration

For better performance, create additional indexes:

```javascript
// Compound indexes for filtering
db.knowledgeBase.createIndex({ domain: 1, credibilityScore: -1 });
db.knowledgeBase.createIndex({ domain: 1, publicationDate: -1 });
db.knowledgeBase.createIndex({ sourceType: 1, domain: 1 });
```

### Query Optimization

- Use `numCandidates` between 100-200 for good balance
- Limit results to necessary count (10-20)
- Apply filters before vector search when possible
- Cache frequently accessed queries

## Monitoring

Monitor vector search performance:

1. **MongoDB Atlas Metrics**
   - Query execution time
   - Index usage
   - Memory usage

2. **Application Metrics**
   - Search latency
   - Cache hit rate
   - Embedding generation time

## Next Steps

1. ✅ Create vector search index in MongoDB Atlas
2. ✅ Run migration script (if applicable)
3. ✅ Verify vector search functionality
4. ✅ Test application endpoints
5. ✅ Monitor performance
6. ✅ Remove Pinecone dependencies

## Support

For issues or questions:
- Check MongoDB Atlas documentation: https://www.mongodb.com/docs/atlas/atlas-vector-search/
- Review application logs
- Test with sample queries
