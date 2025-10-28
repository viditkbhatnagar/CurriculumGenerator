# Redis Configuration for Render

This guide explains how to configure and use Redis with Render for the Curriculum Generator application.

## Overview

The application uses Redis for three main purposes:
1. **Caching** - API responses, knowledge base queries, and generated content
2. **Job Queue** - Background job processing with Bull
3. **Session Management** - User session storage

## Render Redis Setup

### 1. Add Redis to Your Render Service

1. Go to your Render dashboard
2. Navigate to your web service or background worker
3. Click on "Environment" tab
4. Add a Redis instance:
   - Click "Add Redis"
   - Choose a plan (Starter or higher)
   - Render will automatically create a `REDIS_URL` environment variable

### 2. Configure Environment Variables

Add these environment variables to your Render service:

```bash
# Automatically provided by Render when you add Redis
REDIS_URL=rediss://red-xxxxx:6379

# Optional: Override TLS setting (auto-enabled in production)
REDIS_TLS=true

# Optional: Configure retry behavior
REDIS_MAX_RETRIES=3
REDIS_RETRY_DELAY=1000
```

**Important Notes:**
- Render Redis URLs use `rediss://` (with TLS) instead of `redis://`
- TLS is automatically enabled in production environments
- The application handles TLS configuration automatically

## Local Development

For local development, you can use a local Redis instance:

```bash
# Install Redis locally
# macOS:
brew install redis
brew services start redis

# Ubuntu/Debian:
sudo apt-get install redis-server
sudo systemctl start redis

# Set environment variable
REDIS_URL=redis://localhost:6379
REDIS_TLS=false
```

## Configuration Details

### TLS/SSL Configuration

The application automatically configures TLS for Render Redis:

- **Production**: TLS is enabled by default
- **Development**: TLS is disabled by default
- **Override**: Set `REDIS_TLS=true` to force TLS in any environment

### Connection Settings

- **Max Retries**: 3 attempts (configurable via `REDIS_MAX_RETRIES`)
- **Retry Delay**: 1000ms with exponential backoff (configurable via `REDIS_RETRY_DELAY`)
- **Connect Timeout**: 10 seconds
- **Reconnect Strategy**: Exponential backoff up to 5 seconds

### Self-Signed Certificates

Render Redis uses self-signed certificates. The application is configured to accept these:

```typescript
{
  tls: {
    rejectUnauthorized: false
  }
}
```

## Testing Redis Connection

### Manual Test Script

Run the Redis connection test script:

```bash
cd packages/backend
npm run test:redis
```

This will test:
- Cache service connectivity
- Session management
- Performance benchmarks
- TLS configuration

### Automated Tests

Run the Redis integration tests:

```bash
cd packages/backend
npm test -- redis-render.test.ts
```

## Usage Examples

### Cache Service

```typescript
import { cacheService, CacheNamespace } from './services/cacheService';

// Set a value
await cacheService.set('my-key', { data: 'value' }, {
  namespace: CacheNamespace.API_RESPONSE,
  ttl: 300, // 5 minutes
});

// Get a value
const value = await cacheService.get('my-key', {
  namespace: CacheNamespace.API_RESPONSE,
});

// Get or compute
const result = await cacheService.getOrSet('my-key', async () => {
  return await expensiveOperation();
}, {
  namespace: CacheNamespace.KNOWLEDGE_BASE,
  ttl: 3600, // 1 hour
});
```

### Session Management

```typescript
import { createSession, getSession, deleteSession } from './services/sessionService';

// Create session
await createSession('session-id', {
  userId: 'user-123',
  email: 'user@example.com',
  role: 'administrator',
  lastActivity: new Date().toISOString(),
}, 1800); // 30 minutes

// Get session
const session = await getSession('session-id');

// Delete session
await deleteSession('session-id');
```

### Job Queue

```typescript
import { jobQueueService } from './services/jobQueueService';

// Add job to queue
const job = await jobQueueService.addJob('curriculum_generation', {
  programId: 'program-123',
  userId: 'user-456',
});

// Get job status
const status = await jobQueueService.getJobStatus('curriculum_generation', job.id);

// Get queue statistics
const stats = await jobQueueService.getQueueStats('curriculum_generation');
```

## Cache Namespaces and TTLs

The application uses different cache namespaces with appropriate TTLs:

| Namespace | TTL | Use Case |
|-----------|-----|----------|
| `api` | 5 minutes | API response caching |
| `kb` | 1 hour | Knowledge base queries |
| `content` | 24 hours | Generated curriculum content |
| `embeddings` | 7 days | Vector embeddings |
| `llm` | 1 hour | LLM responses |

## Monitoring

### Health Checks

The application includes Redis health checks:

```bash
curl http://localhost:4000/health
```

Response includes Redis status:

```json
{
  "status": "healthy",
  "services": {
    "cache": {
      "status": "healthy",
      "responseTime": 5
    }
  }
}
```

### Cache Statistics

Get cache statistics:

```typescript
const stats = await cacheService.getStats();
console.log(stats);
// {
//   connected: true,
//   dbSize: 1234,
//   memoryUsed: '2.5M'
// }
```

## Troubleshooting

### Connection Issues

**Problem**: Cannot connect to Redis

**Solutions**:
1. Verify `REDIS_URL` is set correctly
2. Check if Redis service is running on Render
3. Verify network connectivity
4. Check Render service logs for connection errors

### TLS/SSL Errors

**Problem**: TLS handshake failures

**Solutions**:
1. Ensure `REDIS_TLS=true` in production
2. Verify using `rediss://` URL scheme
3. Check that `rejectUnauthorized: false` is configured

### Performance Issues

**Problem**: Slow Redis operations

**Solutions**:
1. Check Redis plan (upgrade if needed)
2. Monitor cache hit rates
3. Adjust TTL values
4. Use batch operations (`mget`, `mset`)
5. Check network latency between services

### Memory Issues

**Problem**: Redis running out of memory

**Solutions**:
1. Upgrade Redis plan
2. Reduce TTL values
3. Implement cache eviction policies
4. Clean up old keys regularly

## Graceful Degradation

The application is designed to work without Redis:

- **Cache Service**: Falls back to direct database queries
- **Session Service**: Throws error (Redis required for sessions)
- **Job Queue**: Throws error (Redis required for background jobs)

To disable Redis-dependent features:
1. Remove or leave `REDIS_URL` empty
2. The application will log warnings but continue running
3. Background jobs will not be processed

## Best Practices

1. **Always use TLS in production** - Enabled by default
2. **Set appropriate TTLs** - Balance between freshness and performance
3. **Monitor cache hit rates** - Optimize caching strategy
4. **Use namespaces** - Organize keys logically
5. **Handle connection failures** - Application includes retry logic
6. **Clean up old keys** - Use TTL indexes and cleanup jobs
7. **Test locally** - Use local Redis for development
8. **Monitor memory usage** - Upgrade plan if needed

## Additional Resources

- [Render Redis Documentation](https://render.com/docs/redis)
- [Bull Queue Documentation](https://github.com/OptimalBits/bull)
- [Redis Node Client](https://github.com/redis/node-redis)
- [Redis Best Practices](https://redis.io/docs/manual/patterns/)
