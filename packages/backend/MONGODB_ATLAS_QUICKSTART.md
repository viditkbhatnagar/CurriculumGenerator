# MongoDB Atlas Quick Start

Quick reference for setting up MongoDB Atlas for the Curriculum Generator App.

## Prerequisites

- MongoDB Atlas account: https://www.mongodb.com/cloud/atlas/register
- For vector search: M10+ cluster tier required

## Quick Setup Steps

### 1. Create Cluster (5 min)

1. Log in to MongoDB Atlas
2. Click **"Build a Database"**
3. Choose **Dedicated** → **M10** tier
4. Select region (same as Render deployment)
5. Name cluster: `curriculum-cluster`
6. Click **"Create"**

### 2. Configure Access (2 min)

**Network Access:**
1. Go to **Network Access**
2. Click **"Add IP Address"**
3. Select **"Allow Access from Anywhere"** (0.0.0.0/0)

**Database User:**
1. Go to **Database Access**
2. Click **"Add New Database User"**
3. Username: `curriculum_app_user`
4. Password: Generate strong password (save it!)
5. Privileges: **"Read and write to any database"**

### 3. Get Connection String (1 min)

1. Click **"Connect"** on your cluster
2. Choose **"Connect your application"**
3. Copy connection string
4. Replace `<username>` and `<password>`
5. Add database name: `/curriculum_db`

**Example:**
```
mongodb+srv://curriculum_app_user:YOUR_PASSWORD@curriculum-cluster.xxxxx.mongodb.net/curriculum_db?retryWrites=true&w=majority
```

### 4. Create Vector Search Index (3 min)

1. Go to **Search** tab in your cluster
2. Click **"Create Search Index"**
3. Choose **"JSON Editor"**
4. Index name: `knowledge_base_vector_index`
5. Database: `curriculum_db`
6. Collection: `knowledgebases`
7. Paste this JSON:

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

8. Click **"Create Search Index"**
9. Wait for status: **"Active"** (2-5 minutes)

### 5. Configure Environment (1 min)

Add to `packages/backend/.env`:

```bash
MONGODB_URI=mongodb+srv://curriculum_app_user:YOUR_PASSWORD@curriculum-cluster.xxxxx.mongodb.net/curriculum_db?retryWrites=true&w=majority
```

### 6. Test Connection (1 min)

```bash
cd packages/backend
npm run test:mongodb-connection
```

Expected output:
```
✓ Connected to MongoDB Atlas successfully
✓ Database 'curriculum_db' is accessible
✓ Collection operations working correctly
✓ Vector search index is active
✅ All checks passed!
```

### 7. Create Indexes (1 min)

```bash
npm run create:indexes
```

### 8. Test Vector Search (1 min)

```bash
npm run test:vector-search
```

## Total Setup Time: ~15 minutes

## Troubleshooting

### Connection Failed
- Check IP whitelist (Network Access)
- Verify username/password
- URL-encode special characters in password

### Vector Search Not Working
- Ensure cluster is M10 or higher
- Verify index status is "Active"
- Check index name matches: `knowledge_base_vector_index`

### Index Creation Failed
- Verify database user has write permissions
- Check connection string includes database name
- Ensure collections exist (run app once to create)

## Next Steps

✅ MongoDB Atlas configured  
→ Proceed to Task 3: Migrate database layer  
→ Implement Mongoose models  
→ Update services to use MongoDB

## Resources

- Full setup guide: `MONGODB_ATLAS_SETUP.md`
- Atlas docs: https://docs.atlas.mongodb.com/
- Vector search: https://www.mongodb.com/docs/atlas/atlas-vector-search/

## Cost Estimate

**M10 Cluster:**
- ~$57/month (AWS us-east-1)
- ~$0.08/hour
- Includes: 2GB RAM, 10GB storage, vector search

**Free Tier (M0):**
- $0/month
- No vector search support
- Good for development only
