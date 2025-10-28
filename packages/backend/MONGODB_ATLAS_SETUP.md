# MongoDB Atlas Setup Guide

## Overview

This project uses MongoDB Atlas, a fully managed cloud database service. This guide will help you set up your MongoDB Atlas cluster and connect your application.

## Step 1: Create MongoDB Atlas Account

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)
2. Sign up for a free account (M0 tier is sufficient for development)
3. Verify your email address

## Step 2: Create a Cluster

1. Click "Build a Database"
2. Choose deployment option:
   - **FREE (M0)** - Good for development/testing
   - **Shared (M2/M5)** - Good for small production apps
   - **Dedicated** - For production workloads
3. Select your cloud provider and region (choose closest to your users)
4. Name your cluster (e.g., `curriculum-cluster`)
5. Click "Create Cluster"

## Step 3: Configure Database Access

1. Go to "Database Access" in the left sidebar
2. Click "Add New Database User"
3. Choose authentication method: **Password**
4. Create username and strong password (save these!)
5. Set user privileges: **Read and write to any database**
6. Click "Add User"

## Step 4: Configure Network Access

1. Go to "Network Access" in the left sidebar
2. Click "Add IP Address"
3. For development:
   - Click "Allow Access from Anywhere" (0.0.0.0/0)
   - Or add your specific IP address
4. For production:
   - Add your Render.com IP addresses
   - Or use VPC peering for better security
5. Click "Confirm"

## Step 5: Get Connection String

1. Go to "Database" in the left sidebar
2. Click "Connect" on your cluster
3. Choose "Connect your application"
4. Select:
   - Driver: **Node.js**
   - Version: **5.5 or later**
5. Copy the connection string (looks like):
   ```
   mongodb+srv://<username>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority
   ```

## Step 6: Configure Environment Variables

Create or update `.env` file in `packages/backend/`:

```bash
# MongoDB Atlas Configuration
MONGODB_URI=mongodb+srv://your-username:your-password@your-cluster.mongodb.net/curriculum_db?retryWrites=true&w=majority

# Optional: Specify database name separately
MONGODB_DATABASE=curriculum_db

# Other configurations...
PORT=4000
NODE_ENV=development
```

**Important:** Replace:
- `your-username` with your database username
- `your-password` with your database password
- `your-cluster` with your cluster name
- `curriculum_db` with your desired database name

## Step 7: Run Migrations

Once your `.env` is configured:

```bash
cd packages/backend

# Check migration status
npm run migrate:status

# Run migrations to create collections and indexes
npm run migrate:up

# Verify collections were created
# (You can check in MongoDB Atlas UI under "Browse Collections")
```

## Step 8: Create Vector Search Index (Required for RAG)

After running migrations, you need to manually create a vector search index for the knowledge base:

1. Go to MongoDB Atlas Dashboard
2. Click on your cluster → "Browse Collections"
3. Select `curriculum_db` database → `knowledgebases` collection
4. Click on "Search Indexes" tab
5. Click "Create Search Index"
6. Choose "JSON Editor"
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
9. Click "Create Search Index"
10. Wait for index to build (usually takes a few minutes)

## Verify Connection

Test your connection:

```bash
cd packages/backend

# Create a test script
cat > test-connection.js << 'EOF'
require('dotenv').config();
const mongoose = require('mongoose');

async function testConnection() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Successfully connected to MongoDB Atlas!');
    console.log('Database:', mongoose.connection.name);
    console.log('Host:', mongoose.connection.host);
    
    // List collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\nCollections:', collections.map(c => c.name).join(', '));
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();
EOF

# Run the test
node test-connection.js
```

## MongoDB Atlas Features

### Monitoring
- View real-time metrics in Atlas dashboard
- Set up alerts for performance issues
- Monitor query performance

### Backups
- Automatic backups (available on M10+ clusters)
- Point-in-time recovery
- Download backup snapshots

### Performance Advisor
- Suggests indexes based on query patterns
- Identifies slow queries
- Recommends schema improvements

## Connection String Formats

### Standard Connection String
```
mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
```

### With Additional Options
```
mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority&maxPoolSize=20&minPoolSize=5
```

### For Render.com Deployment
```
mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority&ssl=true
```

## Security Best Practices

1. **Use Strong Passwords**
   - At least 16 characters
   - Mix of letters, numbers, and symbols
   - Use a password manager

2. **Restrict Network Access**
   - Only allow IPs that need access
   - Use VPC peering for production
   - Regularly review access list

3. **Enable Encryption**
   - Atlas encrypts data at rest by default
   - Use TLS/SSL for connections (enabled by default)

4. **Rotate Credentials**
   - Change passwords regularly
   - Use different credentials for dev/staging/prod

5. **Monitor Access**
   - Review audit logs regularly
   - Set up alerts for suspicious activity

## Troubleshooting

### Connection Timeout
- Check if your IP is whitelisted in Network Access
- Verify firewall isn't blocking port 27017
- Check if cluster is running (not paused)

### Authentication Failed
- Verify username and password are correct
- Check if user has proper permissions
- Ensure password doesn't contain special characters that need URL encoding

### Database Not Found
- Database is created automatically on first write
- Run migrations to create collections
- Check database name in connection string

### Slow Queries
- Check Performance Advisor in Atlas
- Review and add recommended indexes
- Consider upgrading cluster tier

## Cost Optimization

### Free Tier (M0)
- 512 MB storage
- Shared RAM
- Good for development/testing
- No credit card required

### Paid Tiers
- Start at $9/month (M2)
- Scale based on usage
- Set up billing alerts
- Monitor storage and compute usage

## Support Resources

- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [MongoDB University](https://university.mongodb.com/) - Free courses
- [Community Forums](https://www.mongodb.com/community/forums/)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/mongodb-atlas)

## Next Steps

After setup:
1. ✅ Run migrations: `npm run migrate:up`
2. ✅ Create vector search index (see Step 8)
3. ✅ Test connection with your application
4. ✅ Start development: `npm run dev`
5. ✅ Monitor performance in Atlas dashboard
