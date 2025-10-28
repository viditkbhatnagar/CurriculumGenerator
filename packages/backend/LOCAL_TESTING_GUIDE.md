# Local Testing Guide for MongoDB & Render Migration

This guide walks you through setting up and testing the MongoDB and Render migration locally before deploying to production.

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- MongoDB Atlas account (free tier M0 works for testing)
- Redis installed locally OR use a cloud Redis service

## Table of Contents

1. [MongoDB Setup](#mongodb-setup)
2. [Redis Setup](#redis-setup)
3. [Environment Configuration](#environment-configuration)
4. [Connection Testing](#connection-testing)
5. [API Endpoint Testing](#api-endpoint-testing)
6. [Vector Search Testing](#vector-search-testing)
7. [Background Job Testing](#background-job-testing)
8. [Troubleshooting](#troubleshooting)

---

## MongoDB Setup

### Option 1: MongoDB Atlas (Recommended)

MongoDB Atlas is already configured in your `.env` file. Follow these steps to verify:

1. **Verify Connection String**
   ```bash
   # Check your .env file has MONGODB_URI set
   cat packages/backend/.env | grep MONGODB_URI
   ```

2. **Test Connection**
   ```bash
   cd packages/backend
   npm run test:mongodb
   ```

3. **Expected Output**
   ```
   ✓ Connected to MongoDB Atlas successfully
   ✓ Database 'curriculum_db' is accessible
   ✓ Collection operations (create, read, delete) working correctly
   ✓ Vector search index status checked
   ```

### Option 2: Local MongoDB Installation

If you prefer running MongoDB locally:

**macOS (using Homebrew):**
```bash
brew tap mongodb/brew
brew install mongodb-community@7.0
brew services start mongodb-community@7.0
```

**Linux (Ubuntu/Debian):**
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
```

**Update .env for local MongoDB:**
```bash
MONGODB_URI=mongodb://localhost:27017/curriculum_db
```

**Note:** Local MongoDB does not support vector search. Use MongoDB Atlas M10+ for vector search testing.

---

## Redis Setup

### Option 1: Local Redis Installation (Recommended for Development)

**macOS (using Homebrew):**
```bash
brew install redis
brew services start redis
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

**Verify Redis is Running:**
```bash
redis-cli ping
# Should return: PONG
```

**Update .env for local Redis:**
```bash
REDIS_URL=redis://localhost:6379
```

### Option 2: Cloud Redis (Upstash, Redis Cloud, etc.)

If you don't want to install Redis locally, use a free cloud Redis service:

**Upstash (Free Tier):**
1. Sign up at https://upstash.com
2. Create a new Redis database
3. Copy the Redis URL
4. Update your `.env`:
   ```bash
   REDIS_URL=rediss://default:your-password@your-endpoint.upstash.io:6379
   ```

### Test Redis Connection

```bash
cd packages/backend
npm run test:redis
```

**Expected Output:**
```
✓ Cache service connected
✓ Cache health check: HEALTHY
✓ Set cache value
✓ Retrieved cache value
✓ Session Redis client initialized
✓ Created session
```

---

## Environment Configuration

### 1. Update .env File

Ensure your `packages/backend/.env` has all required variables:

```bash
# Server Configuration
PORT=4000
NODE_ENV=development

# MongoDB Configuration (Already configured)
MONGODB_URI=mongodb+srv://viditkbhatnagar:NzRz8cXmmeFHKcm2@cluster0.c8ul7to.mongodb.net/curriculum_db?retryWrites=true&w=majority&appName=Cluster0

# Redis Configuration (Update this)
REDIS_URL=redis://localhost:6379

# OpenAI Configuration (Add your key)
OPENAI_API_KEY=sk-your-actual-openai-key-here
OPENAI_EMBEDDING_MODEL=text-embedding-3-large
OPENAI_CHAT_MODEL=gpt-4-turbo

# Auth0 Configuration (Optional for local testing)
AUTH0_DOMAIN=your-auth0-domain.auth0.com
AUTH0_AUDIENCE=your-api-audience

# File Storage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=52428800

# Security (Development defaults)
ENCRYPTION_KEY=dev-key-change-in-production-32ch
API_SIGNING_SECRET=dev-signing-secret-change-in-prod
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=1000

# Monitoring
SENTRY_DSN=
LOG_LEVEL=debug

# Disable mock data for real testing
USE_MOCK_DATA=false
```

### 2. Install Dependencies

```bash
cd packages/backend
npm install
```

### 3. Build the Project

```bash
npm run build
```

---

## Connection Testing

### Test All Connections

Run the comprehensive connection test suite:

```bash
cd packages/backend

# Test MongoDB connection
npm run test:mongodb

# Test Redis connection
npm run test:redis

# Test vector search (requires MongoDB Atlas M10+)
npm run test:vector-search
```

### Manual Connection Verification

**MongoDB:**
```bash
# Using mongosh (MongoDB Shell)
mongosh "mongodb+srv://cluster0.c8ul7to.mongodb.net/curriculum_db" --username viditkbhatnagar
```

**Redis:**
```bash
# Using redis-cli
redis-cli
> ping
PONG
> set test "hello"
OK
> get test
"hello"
> del test
(integer) 1
> exit
```

---

## API Endpoint Testing

### 1. Start the Backend Server

```bash
cd packages/backend
npm run dev
```

**Expected Output:**
```
🚀 Server running on port 4000
✓ MongoDB connected successfully
✓ Redis connected successfully
```

### 2. Test Health Endpoint

```bash
curl http://localhost:4000/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-10-28T...",
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

### 3. Test Program Creation

```bash
curl -X POST http://localhost:4000/api/programs \
  -H "Content-Type: application/json" \
  -d '{
    "programName": "Test Program",
    "qualificationLevel": "Bachelor",
    "qualificationType": "Degree",
    "totalCredits": 120,
    "industrySector": "Technology"
  }'
```

### 4. Test File Upload

```bash
curl -X POST http://localhost:4000/api/programs/upload \
  -F "file=@/path/to/test.xlsx" \
  -F "programId=your-program-id"
```

### 5. Test Knowledge Base Search

```bash
curl -X POST http://localhost:4000/api/knowledge-base/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "machine learning fundamentals",
    "domain": "Computer Science",
    "limit": 5
  }'
```

---

## Vector Search Testing

### Prerequisites

- MongoDB Atlas M10+ cluster (vector search not available on M0/M2/M5)
- Vector search index created in Atlas Search UI
- OpenAI API key configured

### 1. Create Vector Search Index

In MongoDB Atlas:
1. Go to your cluster → Search → Create Search Index
2. Use JSON Editor
3. Paste this configuration:

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

4. Name it: `knowledge_base_vector_index`
5. Select collection: `knowledgebases`

### 2. Run Vector Search Test

```bash
cd packages/backend
npm run test:vector-search
```

**Expected Output:**
```
✓ Vector search index found and active
✓ Inserted 4 test documents
✓ Vector search executed successfully
✓ Found 2 similar documents
✓ Results correctly ranked by similarity score
✓ All results above similarity threshold (0.75)
```

### 3. Test with Real Data

Ingest a test document:

```bash
curl -X POST http://localhost:4000/api/knowledge-base/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Introduction to machine learning algorithms and neural networks",
    "sourceType": "manual",
    "domain": "Computer Science",
    "credibilityScore": 90,
    "metadata": {
      "title": "ML Basics",
      "tags": ["AI", "ML"]
    }
  }'
```

Then search:

```bash
curl -X POST http://localhost:4000/api/knowledge-base/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "machine learning",
    "domain": "Computer Science"
  }'
```

---

## Background Job Testing

### 1. Start the Worker

In a separate terminal:

```bash
cd packages/backend
npm run worker
```

**Expected Output:**
```
🔧 Worker started
✓ MongoDB connected
✓ Redis connected
✓ Job queue initialized
⏳ Waiting for jobs...
```

### 2. Trigger a Curriculum Generation Job

```bash
curl -X POST http://localhost:4000/api/programs/{programId}/generate \
  -H "Content-Type: application/json"
```

### 3. Monitor Job Progress

```bash
curl http://localhost:4000/api/jobs/{jobId}
```

**Expected Response:**
```json
{
  "jobId": "...",
  "status": "processing",
  "progress": 45,
  "startedAt": "2025-10-28T..."
}
```

### 4. Check Worker Logs

The worker terminal should show:

```
📋 Processing job: {jobId}
✓ Step 1: Analyzing program structure
✓ Step 2: Generating learning outcomes
✓ Step 3: Creating assessments
✅ Job completed successfully
```

### 5. Test Job Failure and Retry

Simulate a failure by stopping MongoDB temporarily:

```bash
# Stop MongoDB
brew services stop mongodb-community  # macOS
# or
sudo systemctl stop mongod  # Linux

# Trigger a job (should fail)
curl -X POST http://localhost:4000/api/programs/{programId}/generate

# Check job status (should show 'failed')
curl http://localhost:4000/api/jobs/{jobId}

# Restart MongoDB
brew services start mongodb-community  # macOS
# or
sudo systemctl start mongod  # Linux

# Job should retry automatically
```

---

## Troubleshooting

### MongoDB Connection Issues

**Error: "MongoServerError: bad auth"**
- Solution: Check username/password in MONGODB_URI
- Verify database user exists in Atlas

**Error: "MongoNetworkError: connection timeout"**
- Solution: Add your IP to Atlas Network Access whitelist
- Or use 0.0.0.0/0 for testing (not recommended for production)

**Error: "Vector search not supported"**
- Solution: Upgrade to MongoDB Atlas M10+ cluster
- M0/M2/M5 tiers don't support vector search

### Redis Connection Issues

**Error: "ECONNREFUSED"**
- Solution: Ensure Redis is running
  ```bash
  # macOS
  brew services start redis
  
  # Linux
  sudo systemctl start redis-server
  ```

**Error: "NOAUTH Authentication required"**
- Solution: Update REDIS_URL with password
  ```bash
  REDIS_URL=redis://:password@localhost:6379
  ```

### OpenAI API Issues

**Error: "Invalid API key"**
- Solution: Get valid API key from https://platform.openai.com/api-keys
- Update OPENAI_API_KEY in .env

**Error: "Rate limit exceeded"**
- Solution: Wait a few minutes or upgrade OpenAI plan
- Implement request throttling in code

### File Upload Issues

**Error: "ENOENT: no such file or directory"**
- Solution: Create uploads directory
  ```bash
  mkdir -p packages/backend/uploads
  ```

**Error: "File too large"**
- Solution: Increase MAX_FILE_SIZE in .env
  ```bash
  MAX_FILE_SIZE=104857600  # 100MB
  ```

### Worker Not Processing Jobs

**Issue: Jobs stuck in "queued" status**
- Check worker is running: `ps aux | grep worker`
- Check Redis connection in worker logs
- Verify Bull queue configuration

**Issue: Jobs failing immediately**
- Check worker logs for error messages
- Verify MongoDB connection in worker
- Check OpenAI API key is valid

---

## Next Steps

Once all local tests pass:

1. ✅ MongoDB connection working
2. ✅ Redis connection working
3. ✅ API endpoints responding correctly
4. ✅ Vector search functioning (if using Atlas M10+)
5. ✅ Background jobs processing successfully

You're ready to:
- Deploy to Render (see DEPLOYMENT.md)
- Run end-to-end tests
- Perform load testing
- Set up monitoring and alerts

---

## Quick Reference Commands

```bash
# Test connections
npm run test:mongodb
npm run test:redis
npm run test:vector-search

# Start services
npm run dev          # Start API server
npm run worker       # Start background worker

# Database operations
npm run migrate      # Run MongoDB migrations
npm run create:indexes  # Create database indexes

# Testing
npm test            # Run all tests
npm run test:integration  # Run integration tests
npm run test:e2e    # Run end-to-end tests
```

---

## Support

If you encounter issues not covered in this guide:

1. Check the main documentation:
   - SETUP.md - General setup instructions
   - MONGODB_ATLAS_SETUP.md - MongoDB Atlas specific setup
   - REDIS_RENDER_SETUP.md - Redis configuration

2. Review error logs:
   ```bash
   tail -f packages/backend/logs/error.log
   ```

3. Enable debug logging:
   ```bash
   LOG_LEVEL=debug npm run dev
   ```
