# MongoDB Atlas Setup Checklist

## Your Cluster Information
- **Cluster URL**: `cluster0.c8ul7to.mongodb.net`
- **Database Name**: `curriculum_db` (will be created automatically)

## ✅ Step-by-Step Setup

### 1. Configure Database User (In MongoDB Atlas)

Go to your MongoDB Atlas dashboard:

1. Click on **"Database Access"** in the left sidebar
2. Check if you have a database user created
   - If yes, note down the username
   - If no, click **"Add New Database User"**:
     - Choose **Password** authentication
     - Username: `curriculum_user` (or your choice)
     - Password: Generate a strong password (save it!)
     - Database User Privileges: **Read and write to any database**
     - Click **"Add User"**

### 2. Configure Network Access (In MongoDB Atlas)

1. Click on **"Network Access"** in the left sidebar
2. Click **"Add IP Address"**
3. For development, click **"Allow Access from Anywhere"** (0.0.0.0/0)
   - This adds `0.0.0.0/0` to the IP Access List
   - For production, you'll want to restrict this
4. Click **"Confirm"**

### 3. Update Your `.env` File (Already Done!)

The `.env` file has been updated with the template. Now replace the placeholders:

```bash
# Open packages/backend/.env and replace:
# <db_username> with your actual database username
# <db_password> with your actual database password

# Example:
MONGODB_URI=mongodb+srv://curriculum_user:MySecurePass123@cluster0.c8ul7to.mongodb.net/curriculum_db?retryWrites=true&w=majority&appName=Cluster0
```

**Important Notes:**
- If your password contains special characters (like `@`, `:`, `/`, `?`, `#`, `[`, `]`), you need to URL encode them:
  - `@` becomes `%40`
  - `:` becomes `%3A`
  - `/` becomes `%2F`
  - `?` becomes `%3F`
  - `#` becomes `%23`
  - Example: `Pass@123` becomes `Pass%40123`

### 4. Test Your Connection

```bash
cd packages/backend

# Create a quick test script
cat > test-mongo-connection.js << 'EOF'
require('dotenv').config();
const mongoose = require('mongoose');

async function testConnection() {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Successfully connected to MongoDB Atlas!');
    console.log('📊 Database:', mongoose.connection.name);
    console.log('🌐 Host:', mongoose.connection.host);
    
    await mongoose.disconnect();
    console.log('✅ Connection test complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Check if username and password are correct');
    console.error('2. Verify IP address is whitelisted in Network Access');
    console.error('3. Ensure special characters in password are URL encoded');
    process.exit(1);
  }
}

testConnection();
EOF

# Run the test
node test-mongo-connection.js
```

### 5. Run Migrations to Create Collections

Once the connection test passes:

```bash
# Check migration status
npm run migrate:status

# Run migrations to create all collections and indexes
npm run migrate:up
```

This will create:
- ✅ `programs` collection
- ✅ `modules` collection
- ✅ `learningoutcomes` collection
- ✅ `knowledgebases` collection
- ✅ `assessments` collection
- ✅ `skillmappings` collection
- ✅ `generationjobs` collection
- ✅ `users` collection
- ✅ `auditlogs` collection
- ✅ `fileuploads` collection

Plus all indexes and validation rules!

### 6. Verify Collections in MongoDB Atlas

1. Go to MongoDB Atlas dashboard
2. Click **"Browse Collections"** on your cluster
3. You should see the `curriculum_db` database
4. Click on it to see all 10 collections

### 7. Create Vector Search Index (Manual Step)

This is required for the RAG/knowledge base functionality:

1. In MongoDB Atlas, go to your cluster
2. Click **"Browse Collections"**
3. Select `curriculum_db` → `knowledgebases` collection
4. Click on the **"Search Indexes"** tab
5. Click **"Create Search Index"**
6. Choose **"JSON Editor"**
7. Paste this configuration:

```json
{
  "mappings": {
    "dynamic": true,
    "fields": {
      "embedding": {
        "dimensions": 3072,
        "similarity": "cosine",
        "type": "knnVector"
      }
    }
  }
}
```

8. Name the index: `vector_index`
9. Click **"Create Search Index"**
10. Wait for the index to build (takes 2-5 minutes)

### 8. Start Your Application

```bash
# Start the backend server
npm run dev

# In another terminal, start the worker
npm run dev:worker
```

## 🎉 You're Done!

Your application is now connected to MongoDB Atlas and ready to use.

## Troubleshooting

### Connection Timeout
- Check Network Access in Atlas - ensure your IP is whitelisted
- Try "Allow Access from Anywhere" (0.0.0.0/0) for testing

### Authentication Failed
- Verify username and password are correct
- Check for special characters that need URL encoding
- Ensure user has "Read and write to any database" privileges

### Database Not Found
- This is normal! The database is created automatically on first write
- Run migrations to create it: `npm run migrate:up`

### Migration Fails
- Ensure connection test passes first
- Check that you have write permissions
- Verify the database name in your connection string

## Quick Reference

```bash
# Test connection
node test-mongo-connection.js

# Check migration status
npm run migrate:status

# Run migrations
npm run migrate:up

# Rollback migrations (if needed)
npm run migrate:down

# Start development
npm run dev
```

## Security Notes

- ✅ Never commit `.env` file to git
- ✅ Use different credentials for dev/staging/production
- ✅ Rotate passwords regularly
- ✅ Restrict IP access in production
- ✅ Use strong passwords (16+ characters)
