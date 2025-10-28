# Caching and Performance Optimization Guide

This document describes the caching and performance optimization implementation for the Curriculum Generator App.

## Overview

The application implements a comprehensive caching strategy using Redis to improve performance and reduce load on external services (OpenAI API, database, etc.).

## Cache Service

### Location
`packages/backend/src/services/cacheService.ts`

### Features
- **Multiple Cache Namespaces**: Different TTL strategies for different data types
- **Automatic Reconnection**: Handles Redis connection failures gracefully
- **Batch Operations**: Support for `mget` and `mset` for efficient bulk operations
- **Pattern Deletion**: Clear multiple cache entries matching a pattern
- **Health Monitoring**: Built-in health checks and statistics

### Cache Namespaces and TTLs

| Namespace | TTL | Use Case |
|-----------|-----|----------|
| `API_RESPONSE` | 5 minutes | API endpoint responses |
| `KNOWLEDGE_BASE` | 1 hour | Knowledge base search results |
| `GENERATED_CONTENT` | 24 hours | LLM-generated curriculum content |
| `EMBEDDINGS` | 7 days | Text embeddings (rarely change) |
| `LLM_RESPONSE` | 1 hour | LLM API responses |

### Usage Examples

```typescript
import { cacheService, CacheNamespace } from './services/cacheService';

// Simple get/set
await cacheService.set('my-key', { data: 'value' }, {
  namespace: CacheNamespace.API_RESPONSE,
  ttl: 300, // 5 minutes
});

const value = await cacheService.get('my-key', {
  namespace: CacheNamespace.API_RESPONSE,
});

// Get or set pattern (cache-aside)
const data = await cacheService.getOrSet(
  'expensive-operation',
  async () => {
    // Expensive operation here
    return await fetchDataFromDatabase();
  },
  { namespace: CacheNamespace.API_RESPONSE, ttl: 600 }
);

// Batch operations
await cacheService.mset([
  { key: 'key1', value: 'value1' },
  { key: 'key2', value: 'value2' },
], { namespace: CacheNamespace.EMBEDDINGS });

const values = await cacheService.mget(['key1', 'key2'], {
  namespace: CacheNamespace.EMBEDDINGS,
});

// Clear namespace
await cacheService.clearNamespace(CacheNamespace.API_RESPONSE);
```

## Cache Middleware

### Location
`packages/backend/src/middleware/cache.ts`

### Features
- **Automatic Response Caching**: Caches GET request responses
- **Cache Invalidation**: Automatically invalidates cache on mutations
- **Custom Key Generation**: Flexible cache key generation
- **Conditional Caching**: Cache only when specific conditions are met

### Usage in Routes

```typescript
import { cacheMiddleware, invalidateCacheMiddleware } from '../middleware/cache';
import { CacheNamespace } from '../services/cacheService';

// Cache GET requests for 5 minutes
router.get('/programs', cacheMiddleware({ ttl: 300 }), async (req, res) => {
  // Route handler
});

// Invalidate cache on mutations
router.post('/programs', 
  invalidateCacheMiddleware(['*'], CacheNamespace.API_RESPONSE),
  async (req, res) => {
    // Route handler
  }
);

// Conditional caching
router.get('/data',
  conditionalCache(
    (req) => req.query.cache === 'true',
    { ttl: 600 }
  ),
  async (req, res) => {
    // Route handler
  }
);
```

## RAG Engine Caching

### Location
`packages/backend/src/services/ragEngine.ts`

### Implementation
The RAG engine caches semantic search results to avoid repeated vector database queries.

```typescript
// Automatic caching in semantic search
const results = await ragEngine.semanticSearch(query, options);
// Results are cached for 1 hour
```

### Cache Key Generation
Cache keys are generated using MD5 hash of query + options to ensure uniqueness.

## Embedding Caching

### Location
`packages/backend/src/services/embeddingService.ts`

### Implementation
Embeddings are cached for 7 days since they rarely change for the same text.

```typescript
// Automatic caching in embedding generation
const embedding = await embeddingService.generateQueryEmbedding(query);
// Embedding is cached for 7 days
```

### Benefits
- Reduces OpenAI API calls
- Improves response time for repeated queries
- Reduces costs

## LLM Batch Service

### Location
`packages/backend/src/services/llmBatchService.ts`

### Features
- **Request Batching**: Groups multiple LLM requests together
- **Automatic Caching**: Caches LLM responses
- **Debouncing**: Waits for more requests before processing batch

### Usage

```typescript
import { llmBatchService } from './services/llmBatchService';

// Requests are automatically batched
const content = await llmBatchService.generateContent(
  'Generate curriculum content for...',
  'You are a curriculum expert...',
  { temperature: 0.7 }
);

// Structured output with caching
const skillMappings = await llmBatchService.generateStructuredOutput(
  'Generate skill mappings...',
  'Return JSON with skill mappings...',
  { temperature: 0.7 }
);
```

### Configuration
- **Batch Size**: 5 requests per batch
- **Batch Delay**: 100ms debounce
- **Cache TTL**: 1 hour

## Database Connection Pooling

### Location
`packages/backend/src/db/index.ts`

### Configuration
```typescript
const pool = new Pool({
  connectionString: config.database.url,
  max: 20, // Maximum 20 connections
  idleTimeoutMillis: 30000, // 30 seconds
  connectionTimeoutMillis: 2000, // 2 seconds
});
```

### Best Practices
- Always release connections after use
- Use transactions for multi-query operations
- Monitor connection pool usage

## Database Indexes

### Location
`packages/backend/migrations/1761636883000_add-performance-indexes.js`

### Indexes Added
- **Programs**: `status`, `created_by`, `created_at`, composite indexes
- **Modules**: `program_id + sequence_order`
- **Learning Outcomes**: `bloom_level`, `knowledge_skill_competency`
- **Knowledge Base**: `publication_date`, `credibility_score`, `domain + publication_date`, full-text search
- **Assessments**: `learning_outcome_id`, `question_type`, `difficulty`
- **Generation Jobs**: `program_id + status`, `started_at`, `completed_at`
- **Users**: `role`, `auth_provider_id`, `last_login`
- **Audit Logs**: `action`, `resource_type`, `user_id + created_at`

### Running Migrations
```bash
npm run migrate:up
```

## Performance Monitoring

### Health Check Endpoint
```bash
GET /health
```

Response includes cache statistics:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "cache": {
    "connected": true,
    "dbSize": 1234,
    "memoryUsed": "2.5M"
  }
}
```

### Cache Statistics
```typescript
const stats = await cacheService.getStats();
console.log(stats);
// {
//   connected: true,
//   dbSize: 1234,
//   memoryUsed: "2.5M"
// }
```

## Best Practices

### 1. Cache Invalidation
Always invalidate cache when data changes:
```typescript
// After updating a program
await cacheService.deletePattern(`program:${programId}:*`, {
  namespace: CacheNamespace.API_RESPONSE,
});
```

### 2. Cache Key Design
Use hierarchical keys for easy invalidation:
```typescript
// Good
`program:${programId}:modules`
`program:${programId}:curriculum`

// Bad
`${programId}_modules`
```

### 3. TTL Selection
- **Frequently changing data**: 5 minutes
- **Moderately stable data**: 1 hour
- **Rarely changing data**: 24 hours or more

### 4. Graceful Degradation
Always handle cache failures gracefully:
```typescript
const cached = await cacheService.get(key);
if (cached) {
  return cached;
}
// Fallback to database/API
const data = await fetchFromSource();
await cacheService.set(key, data); // Cache for next time
return data;
```

### 5. Avoid Cache Stampede
Use the `getOrSet` pattern to prevent multiple simultaneous requests:
```typescript
const data = await cacheService.getOrSet(
  key,
  async () => await expensiveOperation(),
  { ttl: 600 }
);
```

## Performance Targets

Based on Requirements 12.1 and 12.4:

- **API Response Time**: < 2 seconds (p95)
- **Curriculum Generation**: < 5 minutes for 120-hour programs
- **Concurrent Users**: 100+ supported
- **Database Query Time**: < 100ms (p95)
- **Cache Hit Rate**: > 70% for repeated queries

## Troubleshooting

### Redis Connection Issues
```typescript
// Check Redis connection
const isHealthy = await cacheService.healthCheck();
if (!isHealthy) {
  console.error('Redis is not healthy');
}
```

### Cache Not Working
1. Verify Redis is running: `redis-cli ping`
2. Check environment variable: `REDIS_URL`
3. Review logs for connection errors
4. Verify cache middleware is applied to routes

### High Memory Usage
```typescript
// Clear specific namespace
await cacheService.clearNamespace(CacheNamespace.API_RESPONSE);

// Or clear all cache
await cacheService.clearNamespace(CacheNamespace.API_RESPONSE);
await cacheService.clearNamespace(CacheNamespace.KNOWLEDGE_BASE);
// ... etc
```

## Future Enhancements

1. **Cache Warming**: Pre-populate cache with frequently accessed data
2. **Distributed Caching**: Use Redis Cluster for horizontal scaling
3. **Cache Analytics**: Track hit/miss rates and optimize TTLs
4. **Smart Invalidation**: Use pub/sub for coordinated cache invalidation
5. **Compression**: Compress large cached values to save memory
