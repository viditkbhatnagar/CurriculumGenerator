# Render Deployment Guide

This guide walks you through deploying the Curriculum Generator App to Render using the provided `render.yaml` blueprint.

## Prerequisites

Before deploying to Render, ensure you have:

1. **GitHub Repository** - Code pushed to a GitHub repository
2. **Render Account** - Sign up at [render.com](https://render.com)
3. **MongoDB Atlas Cluster** - M10 or higher tier with vector search enabled
4. **OpenAI API Key** - From [platform.openai.com](https://platform.openai.com)
5. **Auth0 Account** - For authentication (optional but recommended)
6. **Sentry Account** - For error tracking (optional but recommended)

## Deployment Steps

### Step 1: Prepare MongoDB Atlas

1. **Create MongoDB Atlas Cluster**
   - Log in to [MongoDB Atlas](https://cloud.mongodb.com)
   - Create a new cluster (M10 or higher for vector search)
   - Choose the same region as your Render services (e.g., Oregon)

2. **Configure Network Access**
   - Go to Network Access in Atlas
   - Click "Add IP Address"
   - Select "Allow Access from Anywhere" (0.0.0.0/0)
   - Note: Render uses dynamic IPs, so you need to allow all IPs

3. **Create Database User**
   - Go to Database Access
   - Create a new user with read/write permissions
   - Save the username and password securely

4. **Get Connection String**
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your database user password
   - Replace `<dbname>` with `curriculum_db`

5. **Create Vector Search Index**
   - Go to Atlas Search
   - Create a new search index on the `knowledgeBase` collection
   - Use the following configuration:
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

### Step 2: Deploy to Render Using Blueprint

1. **Connect GitHub Repository**
   - Log in to Render
   - Click "New" → "Blueprint"
   - Connect your GitHub account if not already connected
   - Select your repository

2. **Configure Blueprint**
   - Render will detect the `render.yaml` file
   - Review the services that will be created:
     - `curriculum-frontend` - Next.js web service
     - `curriculum-api` - Express API web service
     - `curriculum-worker` - Background worker
     - `curriculum-redis` - Redis database

3. **Set Environment Variables**
   
   Before deploying, you need to set the following environment variables that are marked as `sync: false` in the blueprint:

   **For curriculum-frontend:**
   - `NEXT_PUBLIC_AUTH0_DOMAIN` - Your Auth0 domain (e.g., `your-domain.auth0.com`)
   - `NEXT_PUBLIC_AUTH0_CLIENT_ID` - Your Auth0 client ID

   **For curriculum-api:**
   - `MONGODB_URI` - Your MongoDB Atlas connection string
   - `OPENAI_API_KEY` - Your OpenAI API key
   - `AUTH0_DOMAIN` - Your Auth0 domain
   - `AUTH0_AUDIENCE` - Your Auth0 API audience
   - `SENTRY_DSN` - Your Sentry DSN (optional)

   **For curriculum-worker:**
   - `MONGODB_URI` - Same as API
   - `OPENAI_API_KEY` - Same as API
   - `ENCRYPTION_KEY` - Will be auto-generated, but copy from API service
   - `SENTRY_DSN` - Same as API (optional)

4. **Deploy Blueprint**
   - Click "Apply" to create all services
   - Render will start building and deploying all services
   - This may take 5-10 minutes for the initial deployment

### Step 3: Verify Deployment

1. **Check Service Status**
   - Go to the Render dashboard
   - Verify all services show "Live" status
   - Check the logs for any errors

2. **Test Health Endpoints**
   ```bash
   # Test API health
   curl https://curriculum-api.onrender.com/health
   
   # Should return:
   # {
   #   "status": "healthy",
   #   "services": {
   #     "database": { "status": "healthy" },
   #     "cache": { "status": "healthy" }
   #   }
   # }
   ```

3. **Test Frontend**
   - Open the frontend URL in your browser
   - Verify the application loads correctly
   - Test authentication if configured

4. **Test API Endpoints**
   ```bash
   # Test API root
   curl https://curriculum-api.onrender.com/api
   
   # Should return:
   # { "message": "Curriculum Generator API" }
   ```

### Step 4: Configure Auto-Deploy

Auto-deploy is already enabled in the blueprint. Any push to the `main` branch will trigger automatic deployments.

To deploy from a different branch:
1. Go to each service settings
2. Update the "Branch" field
3. Save changes

### Step 5: Configure Persistent Disk

The persistent disk for file uploads is automatically configured in the blueprint:
- Mount path: `/app/uploads`
- Size: 10GB
- Attached to: `curriculum-api` service

To increase disk size:
1. Go to the `curriculum-api` service
2. Click on "Disks" tab
3. Adjust the size as needed
4. Save changes

## Environment Variables Reference

### Required Variables

| Variable | Service | Description | Example |
|----------|---------|-------------|---------|
| `MONGODB_URI` | API, Worker | MongoDB Atlas connection string | `mongodb+srv://user:pass@cluster.mongodb.net/curriculum_db` |
| `OPENAI_API_KEY` | API, Worker | OpenAI API key | `sk-...` |
| `AUTH0_DOMAIN` | Frontend, API | Auth0 domain | `your-domain.auth0.com` |
| `AUTH0_AUDIENCE` | API | Auth0 API audience | `https://your-api.com` |
| `NEXT_PUBLIC_AUTH0_CLIENT_ID` | Frontend | Auth0 client ID | `abc123...` |

### Auto-Generated Variables

| Variable | Service | Description |
|----------|---------|-------------|
| `ENCRYPTION_KEY` | API | 32-character encryption key (auto-generated) |
| `API_SIGNING_SECRET` | API | API signing secret (auto-generated) |

### Optional Variables

| Variable | Service | Description | Default |
|----------|---------|-------------|---------|
| `SENTRY_DSN` | API, Worker | Sentry error tracking DSN | None |
| `LOG_LEVEL` | API, Worker | Logging level | `info` |
| `OPENAI_CHAT_MODEL` | API, Worker | OpenAI model to use | `gpt-4-turbo` |

### Auto-Configured Variables

These are automatically set by Render:
- `REDIS_URL` - Redis connection string (from Redis add-on)
- `NEXT_PUBLIC_API_URL` - API URL (from API service)
- `CORS_ORIGINS` - Frontend URL (from frontend service)

## Service Plans

### Recommended Plans

**Development/Testing:**
- Frontend: Starter ($7/month)
- API: Standard ($25/month)
- Worker: Starter ($7/month)
- Redis: Starter ($7/month)
- **Total: ~$46/month**

**Production:**
- Frontend: Standard ($25/month)
- API: Pro ($85/month)
- Worker: Standard ($25/month)
- Redis: Standard ($25/month)
- **Total: ~$160/month**

### Scaling Considerations

1. **API Service**
   - Start with Standard plan
   - Scale to Pro if handling >100 concurrent users
   - Enable auto-scaling for traffic spikes

2. **Worker Service**
   - Start with Starter plan
   - Scale to Standard if processing >10 jobs concurrently
   - Add multiple worker instances for high load

3. **Redis**
   - Starter plan sufficient for most use cases
   - Upgrade to Standard if cache hit rate drops
   - Monitor memory usage in Render dashboard

4. **Persistent Disk**
   - Start with 10GB
   - Monitor usage in Render dashboard
   - Increase as needed (charged per GB)

## Monitoring and Logs

### Accessing Logs

1. **Service Logs**
   - Go to service in Render dashboard
   - Click "Logs" tab
   - View real-time logs
   - Filter by log level

2. **Health Checks**
   - Render automatically monitors health endpoints
   - View health check history in service dashboard
   - Configure alerts for health check failures

3. **Metrics**
   - View CPU and memory usage in dashboard
   - Monitor request rates and response times
   - Set up alerts for resource thresholds

### Sentry Integration

If Sentry is configured:
1. Errors are automatically captured
2. View errors in Sentry dashboard
3. Set up alerts for error spikes
4. Track error trends over time

## Troubleshooting

### Service Won't Start

**Symptoms:** Service shows "Deploy failed" or keeps restarting

**Solutions:**
1. Check build logs for compilation errors
2. Verify all required environment variables are set
3. Check MongoDB connection string is correct
4. Verify MongoDB Atlas network access allows Render IPs

### Health Check Failing

**Symptoms:** Service shows "Unhealthy" status

**Solutions:**
1. Check service logs for errors
2. Verify MongoDB connection: `curl https://your-api.onrender.com/health`
3. Check Redis connection status
4. Verify environment variables are correct

### Worker Not Processing Jobs

**Symptoms:** Jobs stuck in queue, not being processed

**Solutions:**
1. Check worker logs for errors
2. Verify Redis connection
3. Verify MongoDB connection
4. Check worker service is running (not sleeping)
5. Verify Bull queue configuration

### File Uploads Failing

**Symptoms:** File upload returns error or files disappear

**Solutions:**
1. Verify persistent disk is attached to API service
2. Check disk usage (may be full)
3. Verify upload directory permissions
4. Check file size limits (max 50MB)

### Slow Performance

**Symptoms:** API responses are slow, timeouts

**Solutions:**
1. Check MongoDB Atlas performance metrics
2. Verify indexes are created (run migration)
3. Scale up service plan
4. Enable Redis caching
5. Check for slow queries in logs

## Database Migrations

Migrations run automatically during deployment as part of the build command:
```bash
npm run build && npm run migrate:up
```

To run migrations manually:
1. Go to API service in Render
2. Click "Shell" tab
3. Run: `npm run migrate:up`

To check migration status:
```bash
npm run migrate:status
```

## Rollback Procedure

If a deployment fails or causes issues:

1. **Rollback via Render Dashboard**
   - Go to service in Render
   - Click "Deploys" tab
   - Find previous successful deploy
   - Click "Rollback to this deploy"

2. **Rollback via Git**
   - Revert the commit: `git revert <commit-hash>`
   - Push to main branch
   - Render will auto-deploy the reverted version

3. **Rollback Database Migration**
   ```bash
   # In Render shell
   npm run migrate:down
   ```

## Security Best Practices

1. **Environment Variables**
   - Never commit secrets to Git
   - Use Render's environment variable management
   - Rotate secrets regularly

2. **Network Security**
   - MongoDB Atlas: Use IP whitelist (0.0.0.0/0 for Render)
   - Enable HTTPS (automatic on Render)
   - Configure CORS properly

3. **Access Control**
   - Limit team access to production services
   - Use separate environments for dev/staging/prod
   - Enable audit logging in Render

4. **Monitoring**
   - Set up Sentry for error tracking
   - Monitor health endpoints
   - Set up alerts for critical issues

## Cost Optimization

1. **Use Starter Plans for Development**
   - Downgrade non-production services
   - Use free tier for testing

2. **Optimize Worker Usage**
   - Scale down during low-traffic periods
   - Use cron jobs instead of always-on workers if possible

3. **Monitor Resource Usage**
   - Check CPU and memory usage regularly
   - Downgrade if consistently under-utilized
   - Upgrade only when needed

4. **Optimize Database Queries**
   - Use indexes effectively
   - Implement caching
   - Reduce unnecessary queries

## Support and Resources

- **Render Documentation:** https://render.com/docs
- **Render Community:** https://community.render.com
- **MongoDB Atlas Support:** https://www.mongodb.com/cloud/atlas/support
- **OpenAI Support:** https://help.openai.com

## Next Steps

After successful deployment:

1. **Configure Auth0**
   - Set up Auth0 application
   - Configure callback URLs
   - Test authentication flow

2. **Set Up Monitoring**
   - Configure Sentry
   - Set up health check alerts
   - Monitor resource usage

3. **Test Application**
   - Run end-to-end tests
   - Test curriculum generation
   - Verify file uploads work

4. **Configure Custom Domain** (Optional)
   - Add custom domain in Render
   - Configure DNS records
   - Enable automatic HTTPS

5. **Set Up CI/CD** (Optional)
   - Configure GitHub Actions
   - Add automated tests
   - Set up deployment gates

## Conclusion

Your Curriculum Generator App is now deployed on Render! The application will automatically deploy on every push to the main branch, and all services are configured with health checks and monitoring.

For questions or issues, refer to the troubleshooting section or contact support.
