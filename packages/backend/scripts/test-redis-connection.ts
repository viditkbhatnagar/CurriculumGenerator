/**
 * Test Redis Connection Script
 * Verifies Redis connectivity for Render deployment
 */

import dotenv from 'dotenv';
import { cacheService, CacheNamespace } from '../src/services/cacheService';
import { initRedisClient, createSession, getSession, deleteSession, closeRedisClient } from '../src/services/sessionService';
import config from '../src/config';

dotenv.config();

async function testRedisConnection() {
  console.log('='.repeat(60));
  console.log('Redis Connection Test for Render');
  console.log('='.repeat(60));
  console.log();

  // Check configuration
  console.log('Configuration:');
  console.log(`  Redis URL: ${config.redis.url ? '✓ Configured' : '✗ Not configured'}`);
  console.log(`  TLS Enabled: ${config.redis.tls ? '✓ Yes' : '✗ No'}`);
  console.log(`  Max Retries: ${config.redis.maxRetries}`);
  console.log(`  Retry Delay: ${config.redis.retryDelay}ms`);
  console.log(`  Environment: ${config.nodeEnv}`);
  console.log();

  if (!config.redis.url) {
    console.error('❌ Redis URL not configured. Please set REDIS_URL environment variable.');
    process.exit(1);
  }

  try {
    // Test 1: Cache Service Connection
    console.log('Test 1: Cache Service Connection');
    console.log('-'.repeat(60));
    
    await cacheService.connect();
    console.log('✓ Cache service connected');

    const cacheHealthy = await cacheService.healthCheck();
    console.log(`✓ Cache health check: ${cacheHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);

    const stats = await cacheService.getStats();
    console.log(`✓ Cache stats: ${stats.dbSize} keys, ${stats.memoryUsed} memory used`);
    console.log();

    // Test 2: Cache Operations
    console.log('Test 2: Cache Operations');
    console.log('-'.repeat(60));

    const testKey = 'render-test-' + Date.now();
    const testValue = {
      message: 'Hello from Render Redis',
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
    };

    await cacheService.set(testKey, testValue, {
      namespace: CacheNamespace.API_RESPONSE,
      ttl: 60,
    });
    console.log('✓ Set cache value');

    const retrieved = await cacheService.get<typeof testValue>(testKey, {
      namespace: CacheNamespace.API_RESPONSE,
    });
    console.log('✓ Retrieved cache value:', retrieved);

    const exists = await cacheService.exists(testKey, {
      namespace: CacheNamespace.API_RESPONSE,
    });
    console.log(`✓ Key exists: ${exists}`);

    await cacheService.delete(testKey, { namespace: CacheNamespace.API_RESPONSE });
    console.log('✓ Deleted cache value');
    console.log();

    // Test 3: Session Service
    console.log('Test 3: Session Service');
    console.log('-'.repeat(60));

    await initRedisClient();
    console.log('✓ Session Redis client initialized');

    const sessionId = 'test-session-' + Date.now();
    const sessionData = {
      userId: 'test-user-123',
      email: 'test@render.com',
      role: 'administrator',
      lastActivity: new Date().toISOString(),
    };

    await createSession(sessionId, sessionData, 300);
    console.log('✓ Created session');

    const session = await getSession(sessionId);
    console.log('✓ Retrieved session:', session);

    await deleteSession(sessionId);
    console.log('✓ Deleted session');
    console.log();

    // Test 4: Performance Test
    console.log('Test 4: Performance Test');
    console.log('-'.repeat(60));

    const iterations = 100;
    const startTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      await cacheService.set(`perf-test-${i}`, { value: i }, {
        namespace: CacheNamespace.API_RESPONSE,
        ttl: 60,
      });
    }

    const writeTime = Date.now() - startTime;
    console.log(`✓ Wrote ${iterations} keys in ${writeTime}ms (${(writeTime / iterations).toFixed(2)}ms per write)`);

    const readStartTime = Date.now();

    for (let i = 0; i < iterations; i++) {
      await cacheService.get(`perf-test-${i}`, {
        namespace: CacheNamespace.API_RESPONSE,
      });
    }

    const readTime = Date.now() - readStartTime;
    console.log(`✓ Read ${iterations} keys in ${readTime}ms (${(readTime / iterations).toFixed(2)}ms per read)`);

    // Cleanup
    await cacheService.deletePattern('perf-test-*', {
      namespace: CacheNamespace.API_RESPONSE,
    });
    console.log('✓ Cleaned up test keys');
    console.log();

    // Final Summary
    console.log('='.repeat(60));
    console.log('✅ All Redis tests passed successfully!');
    console.log('='.repeat(60));
    console.log();
    console.log('Summary:');
    console.log(`  - Cache service: WORKING`);
    console.log(`  - Session service: WORKING`);
    console.log(`  - Performance: ${(writeTime / iterations).toFixed(2)}ms write, ${(readTime / iterations).toFixed(2)}ms read`);
    console.log(`  - TLS: ${config.redis.tls ? 'ENABLED' : 'DISABLED'}`);
    console.log();

  } catch (error) {
    console.error();
    console.error('❌ Redis test failed:');
    console.error(error);
    console.error();
    process.exit(1);
  } finally {
    // Cleanup
    try {
      await cacheService.disconnect();
      await closeRedisClient();
      console.log('✓ Disconnected from Redis');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

// Run the test
testRedisConnection()
  .then(() => {
    console.log('Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
  });
