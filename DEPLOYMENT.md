# Render Deployment Guide

This guide covers deploying the Curriculum Generator App to Render with MongoDB Atlas.

## Prerequisites

- GitHub account with repository access
- Render account (free tier available)
- MongoDB Atlas account (M10+ cluster for vector search)
- OpenAI API key
- Auth0 account configured

## Architecture Overview

The application deploys as three separate Render services:

1. **Frontend Web Service** - Next.js application
2. **Backend API Web Service** - Node.js/Express API
3. **Background Worker** - Async job processor

Plus two managed add-ons:
- **Render Redis** - Caching and job queue
- **Persistent Disk** - File storage

## Step 1: Set Up MongoDB Atlas

### Create Production Cluster

1. Log in to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Create a new cluster:
   - **Tier:** M10 or higher (required for vector search)
   - **Region:** Choose same region as Render services (e.g., us-east-1)
   - **Cluster Name:** curriculum-prod

3. Create database user:
   - Username: `curriculum_app`
   - Password: Generate strong password (save securely)
   - Permissions: Read and write to any database

4. Configure network access:
   - Click "Network Access" → "Add IP Address"
   - Add `0.0.0.0/0` (allow access from anywhere)
   - Note: Render uses dynamic IPs, so we allow all IPs and rely on authentication

5. Get connection string:
   - Click "Connect" → "Connect your application"
   - Copy connection string
   - Replace `<password>` with your database user password
   - Example: `mongodb+srv://curriculum_app:PASSWORD@curriculum-prod.xxxxx.mongodb.net/curriculum_db`

### Create Vector Search Index

1. Go to your cluster → "Search" tab
2. Click "Create Search Index"
3. Choose "JSON Editor"
4. Database: `curriculum_db`, Collection: `knowledgebases`
5. Index Name: `knowledge_base_vector_index`
6. Configuration:

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

7. Click "Create Search Index" (takes 5-10 minutes to build)

## Step 2: Prepare Repository

### Ensure Build Configuration

Verify these files exist in your repository:

**packages/backend/package.json** should have:
```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "worker": "node dist/worker.js",
    "migrate": "migrate-mongo up"
  }
}
```

**packages/frontend/package.json** should have:
```json
{
  "scripts": {
    "build": "next build",
    "start": "next start"
  }
}
```

### Create render.yaml (Optional)

Create `render.yaml` in repository root for infrastructure as code:

```yaml
services:
  # Frontend Web Service
  - type: web
    name: curriculum-frontend
    env: node
    region: oregon
    plan: starter
    buildCommand: cd packages/frontend && npm install && npm run build
    startCommand: cd packages/frontend && npm start
    envVars:
      - key: NEXT_PUBLIC_API_URL
        sync: false
      - key: NEXT_PUBLIC_AUTH0_DOMAIN
        sync: false
      - key: NEXT_PUBLIC_AUTH0_CLIENT_ID
        sync: false
    healthCheckPath: /

  # Backend API Web Service
  - type: web
    name: curriculum-api
    env: node
    region: oregon
    plan: standard
    buildCommand: cd packages/backend && npm install && npm run build && npm run migrate
    startCommand: cd packages/backend && npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 4000
      - key: MONGODB_URI
        sync: false
      - key: REDIS_URL
        fromService:
          type: redis
          name: curriculum-redis
          property: connectionString
      - key: OPENAI_API_KEY
        sync: false
      - key: AUTH0_DOMAIN
        sync: false
      - key: AUTH0_AUDIENCE
        sync: false
      - key: ENCRYPTION_KEY
        generateValue: true
      - key: API_SIGNING_SECRET
        generateValue: true
      - key: CORS_ORIGINS
        sync: false
      - key: SENTRY_DSN
        sync: false
    healthCheckPath: /health
    disk:
      name: uploads
      mountPath: /app/uploads
      sizeGB: 10

  # Background Worker
  - type: worker
    name: curriculum-worker
    env: node
    region: oregon
    plan: standard
    buildCommand: cd packages/backend && npm install && npm run build
    startCommand: cd packages/backend && npm run worker
    envVars:
      - key: NODE_ENV
        value: production
      - key: MONGODB_URI
        sync: false
      - key: REDIS_URL
        fromService:
          type: redis
          name: curriculum-redis
          property: connectionString
      - key: OPENAI_API_KEY
        sync: false

databases:
  - name: curriculum-redis
    plan: starter
    region: oregon
```

## Step 3: Create Render Services

### Option A: Using Render Dashboard (Recommended for first deployment)

#### 3.1 Create Redis Instance

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New" → "Redis"
3. Name: `curriculum-redis`
4. Plan: Starter (or higher based on needs)
5. Region: Oregon (or your preferred region)
6. Click "Create Redis"
7. Save the connection string (Internal Redis URL)

#### 3.2 Create Backend API Service

1. Click "New" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name:** `curriculum-api`
   - **Region:** Oregon (same as Redis)
   - **Branch:** `main`
   - **Root Directory:** Leave empty
   - **Environment:** Node
   - **Build Command:** `cd packages/backend && npm install && npm run build && npm run migrate`
   - **Start Command:** `cd packages/backend && npm start`
   - **Plan:** Standard ($25/month)

4. Add environment variables (click "Advanced" → "Add Environment Variable"):

```
NODE_ENV=production
PORT=4000
MONGODB_URI=mongodb+srv://curriculum_app:PASSWORD@curriculum-prod.xxxxx.mongodb.net/curriculum_db
REDIS_URL=<paste-redis-internal-url>
OPENAI_API_KEY=sk-your-openai-key
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_AUDIENCE=your-api-audience
ENCRYPTION_KEY=<generate-32-char-random-string>
API_SIGNING_SECRET=<generate-random-string>
CORS_ORIGINS=https://curriculum-frontend.onrender.com
SENTRY_DSN=<your-sentry-dsn>
LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
SESSION_TIMEOUT_SECONDS=1800
```

5. Add Persistent Disk:
   - Click "Add Disk"
   - Name: `uploads`
   - Mount Path: `/app/uploads`
   - Size: 10 GB

6. Configure Health Check:
   - Path: `/health`
   - Click "Create Web Service"

#### 3.3 Create Background Worker Service

1. Click "New" → "Background Worker"
2. Connect same GitHub repository
3. Configure:
   - **Name:** `curriculum-worker`
   - **Region:** Oregon
   - **Branch:** `main`
   - **Environment:** Node
   - **Build Command:** `cd packages/backend && npm install && npm run build`
   - **Start Command:** `cd packages/backend && npm run worker`
   - **Plan:** Standard

4. Add environment variables (same as API except no CORS_ORIGINS needed)

5. Click "Create Background Worker"

#### 3.4 Create Frontend Service

1. Click "New" → "Web Service"
2. Connect same GitHub repository
3. Configure:
   - **Name:** `curriculum-frontend`
   - **Region:** Oregon
   - **Branch:** `main`
   - **Environment:** Node
   - **Build Command:** `cd packages/frontend && npm install && npm run build`
   - **Start Command:** `cd packages/frontend && npm start`
   - **Plan:** Starter

4. Add environment variables:

```
NEXT_PUBLIC_API_URL=https://curriculum-api.onrender.com
NEXT_PUBLIC_AUTH0_DOMAIN=your-domain.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=your-client-id
```

5. Click "Create Web Service"

### Option B: Using render.yaml

1. Push `render.yaml` to your repository
2. Go to Render Dashboard → "New" → "Blueprint"
3. Connect your repository
4. Render will detect render.yaml and create all services
5. Fill in the environment variables marked as `sync: false`

## Step 4: Configure Auth0 for Production

1. Go to your Auth0 application settings
2. Add production URLs to:
   - **Allowed Callback URLs:** `https://curriculum-frontend.onrender.com/callback`
   - **Allowed Logout URLs:** `https://curriculum-frontend.onrender.com`
   - **Allowed Web Origins:** `https://curriculum-frontend.onrender.com`
   - **Allowed Origins (CORS):** `https://curriculum-frontend.onrender.com`

3. Update API settings:
   - Ensure API identifier matches AUTH0_AUDIENCE in environment variables

## Step 5: Update CORS in Backend

After frontend deploys, update the CORS_ORIGINS environment variable in the API service:

```
CORS_ORIGINS=https://curriculum-frontend.onrender.com,https://your-custom-domain.com
```

## Step 6: Verify Deployment

### Check Service Status

1. Go to Render Dashboard
2. Verify all services show "Live" status
3. Check logs for any errors

### Test Health Endpoints

```bash
# Test API health
curl https://curriculum-api.onrender.com/health

# Expected response:
# {"status":"ok","database":"connected","redis":"connected"}
```

### Test Frontend

1. Open `https://curriculum-frontend.onrender.com`
2. Verify page loads
3. Test login functionality
4. Test basic navigation

### Test API Endpoints

```bash
# Test authentication (should return 401)
curl https://curriculum-api.onrender.com/api/programs

# Test with authentication token
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://curriculum-api.onrender.com/api/programs
```

## Step 7: Set Up Custom Domain (Optional)

### For Frontend

1. Go to frontend service settings
2. Click "Custom Domains"
3. Add your domain (e.g., `app.yourdomain.com`)
4. Add CNAME record in your DNS:
   - Name: `app`
   - Value: `curriculum-frontend.onrender.com`
5. Wait for SSL certificate to provision (automatic)

### For API

1. Go to API service settings
2. Add custom domain (e.g., `api.yourdomain.com`)
3. Add CNAME record in DNS
4. Update NEXT_PUBLIC_API_URL in frontend environment variables

## Step 8: Configure Auto-Deploy

Auto-deploy is enabled by default for the main branch. To configure:

1. Go to service settings
2. Under "Build & Deploy"
3. Configure:
   - **Auto-Deploy:** Yes
   - **Branch:** main
4. Optional: Set up deploy hooks for notifications

## Monitoring and Maintenance

### View Logs

1. Go to service in Render Dashboard
2. Click "Logs" tab
3. Filter by log level or search

### Monitor Performance

1. Go to service → "Metrics" tab
2. View:
   - CPU usage
   - Memory usage
   - Request count
   - Response times

### Set Up Alerts

1. Go to service settings
2. Click "Notifications"
3. Add email or Slack webhook
4. Configure alert conditions:
   - Service down
   - High error rate
   - High resource usage

### Database Backups

MongoDB Atlas automatically backs up your data:

1. Go to Atlas cluster
2. Click "Backup" tab
3. Configure backup schedule
4. Test restore procedure

### Scaling

#### Vertical Scaling (More Resources)

1. Go to service settings
2. Change plan to higher tier
3. Click "Save Changes"

#### Horizontal Scaling (More Instances)

1. Go to service settings
2. Under "Scaling"
3. Increase instance count
4. Configure auto-scaling rules

## Troubleshooting

### Service Won't Start

**Check build logs:**
1. Go to service → "Events" tab
2. Look for build errors
3. Common issues:
   - Missing dependencies
   - TypeScript compilation errors
   - Environment variable issues

**Check runtime logs:**
1. Go to service → "Logs" tab
2. Look for startup errors
3. Common issues:
   - Database connection failures
   - Redis connection failures
   - Missing environment variables

### Database Connection Issues

**Error: "MongoServerSelectionTimeoutError"**
- Verify MONGODB_URI is correct
- Check MongoDB Atlas network access allows 0.0.0.0/0
- Verify database user credentials

### Redis Connection Issues

**Error: "Redis connection failed"**
- Verify REDIS_URL is correct
- Check Redis instance is running
- Verify Redis plan supports required connections

### High Memory Usage

1. Check for memory leaks in code
2. Optimize database queries
3. Implement pagination
4. Upgrade to higher plan

### Slow Response Times

1. Check database query performance
2. Verify indexes are created
3. Enable Redis caching
4. Consider CDN for static assets
5. Optimize OpenAI API calls

## Rollback Procedure

If deployment fails:

1. Go to service → "Events" tab
2. Find previous successful deploy
3. Click "Rollback to this deploy"
4. Confirm rollback

## Cost Optimization

### Render Costs

- **Frontend (Starter):** $7/month
- **API (Standard):** $25/month
- **Worker (Standard):** $25/month
- **Redis (Starter):** $10/month
- **Persistent Disk (10GB):** $1/month
- **Total:** ~$68/month

### MongoDB Atlas Costs

- **M10 Cluster:** ~$57/month
- **Backups:** Included
- **Data Transfer:** Usually free for moderate usage

### OpenAI Costs

- **GPT-4-turbo:** $0.01/1K input tokens, $0.03/1K output tokens
- **Embeddings:** $0.00013/1K tokens
- Monitor usage in OpenAI dashboard

### Cost Reduction Tips

1. Use GPT-3.5-turbo for non-critical tasks
2. Implement aggressive caching
3. Batch OpenAI API calls
4. Use smaller MongoDB cluster for staging
5. Scale down services during low-traffic periods

## Security Best Practices

1. **Rotate secrets regularly:**
   - ENCRYPTION_KEY
   - API_SIGNING_SECRET
   - Database passwords

2. **Monitor access logs:**
   - Review Auth0 logs
   - Check for suspicious API activity

3. **Keep dependencies updated:**
   ```bash
   npm audit
   npm update
   ```

4. **Enable rate limiting:**
   - Already configured in environment variables
   - Monitor for abuse

5. **Use environment-specific configs:**
   - Never commit secrets to Git
   - Use Render environment variables

## Support and Resources

- [Render Documentation](https://render.com/docs)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [Auth0 Documentation](https://auth0.com/docs)

For application-specific issues, contact the development team or create a GitHub issue.
