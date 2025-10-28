/**
 * Redis Render Integration Tests
 * Tests Redis connectivity, caching, job queue, and session management with Render Redis
 */

import { cacheService, CacheNamespace } from '../services/cacheService';
import { initRedisClient, createSession, getSession, deleteSession, closeRedisClient } from '../services/sessionService';
import config from '../config';

describe('Redis Render Integration', () => {
  beforeAll(async () => {
    // Skip tests if Redis is not configured
    if (!config.redis.url) {
      console.log('Redis not configured, skipping Redis tests');
      return;
    }

    try {
      // Initialize Redis connections
      await cacheService.connect();
      await initRedisClient();
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
    }
  });

  afterAll(async () => {
    if (!config.redis.url) {
      return;
    }

    try {
      await cacheService.disconnect();
      await closeRedisClient();
    } catch (error) {
      console.error('Failed to disconnect from Redis:', error);
    }
  });

  describe('Cache Service', () => {
    it('should connect to Redis successfully', async () => {
      if (!config.redis.url) {
        return;
      }

      const isHealthy = await cacheService.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should set and get values from cache', async () => {
      if (!config.redis.url) {
        return;
      }

      const testKey = 'test-key-' + Date.now();
      const testValue = { message: 'Hello from Render Redis', timestamp: Date.now() };

      await cacheService.set(testKey, testValue, {
        namespace: CacheNamespace.API_RESPONSE,
        ttl: 60,
      });

      const retrieved = await cacheService.get<typeof testValue>(testKey, {
        namespace: CacheNamespace.API_RESPONSE,
      });

      expect(retrieved).toEqual(testValue);

      // Cleanup
      await cacheService.delete(testKey, { namespace: CacheNamespace.API_RESPONSE });
    });

    it('should handle cache expiration', async () => {
      if (!config.redis.url) {
        return;
      }

      const testKey = 'expire-test-' + Date.now();
      const testValue = { data: 'expires soon' };

      await cacheService.set(testKey, testValue, {
        namespace: CacheNamespace.API_RESPONSE,
        ttl: 1, // 1 second
      });

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1500));

      const retrieved = await cacheService.get(testKey, {
        namespace: CacheNamespace.API_RESPONSE,
      });

      expect(retrieved).toBeNull();
    });

    it('should use getOrSet pattern correctly', async () => {
      if (!config.redis.url) {
        return;
      }

      const testKey = 'get-or-set-' + Date.now();
      let factoryCalled = 0;

      const factory = async () => {
        factoryCalled++;
        return { computed: true, count: factoryCalled };
      };

      // First call should invoke factory
      const result1 = await cacheService.getOrSet(testKey, factory, {
        namespace: CacheNamespace.API_RESPONSE,
        ttl: 60,
      });

      expect(result1.computed).toBe(true);
      expect(factoryCalled).toBe(1);

      // Second call should use cache
      const result2 = await cacheService.getOrSet(testKey, factory, {
        namespace: CacheNamespace.API_RESPONSE,
        ttl: 60,
      });

      expect(result2.computed).toBe(true);
      expect(factoryCalled).toBe(1); // Factory not called again

      // Cleanup
      await cacheService.delete(testKey, { namespace: CacheNamespace.API_RESPONSE });
    });

    it('should get cache statistics', async () => {
      if (!config.redis.url) {
        return;
      }

      const stats = await cacheService.getStats();

      expect(stats).toHaveProperty('connected');
      expect(stats).toHaveProperty('dbSize');
      expect(stats).toHaveProperty('memoryUsed');
      expect(stats.connected).toBe(true);
    });
  });

  describe('Session Service', () => {
    it('should create and retrieve sessions', async () => {
      if (!config.redis.url) {
        return;
      }

      const sessionId = 'test-session-' + Date.now();
      const sessionData = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'administrator',
        lastActivity: new Date().toISOString(),
      };

      await createSession(sessionId, sessionData, 300); // 5 minutes

      const retrieved = await getSession(sessionId);

      expect(retrieved).toBeTruthy();
      expect(retrieved?.userId).toBe(sessionData.userId);
      expect(retrieved?.email).toBe(sessionData.email);
      expect(retrieved?.role).toBe(sessionData.role);

      // Cleanup
      await deleteSession(sessionId);
    });

    it('should handle session expiration', async () => {
      if (!config.redis.url) {
        return;
      }

      const sessionId = 'expire-session-' + Date.now();
      const sessionData = {
        userId: 'user-456',
        email: 'expire@example.com',
        role: 'sme',
        lastActivity: new Date().toISOString(),
      };

      await createSession(sessionId, sessionData, 1); // 1 second

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1500));

      const retrieved = await getSession(sessionId);

      expect(retrieved).toBeNull();
    });

    it('should delete sessions', async () => {
      if (!config.redis.url) {
        return;
      }

      const sessionId = 'delete-session-' + Date.now();
      const sessionData = {
        userId: 'user-789',
        email: 'delete@example.com',
        role: 'student',
        lastActivity: new Date().toISOString(),
      };

      await createSession(sessionId, sessionData, 300);

      const deleted = await deleteSession(sessionId);
      expect(deleted).toBe(true);

      const retrieved = await getSession(sessionId);
      expect(retrieved).toBeNull();
    });
  });

  describe('Redis Configuration', () => {
    it('should have correct Redis configuration for Render', () => {
      expect(config.redis).toHaveProperty('url');
      expect(config.redis).toHaveProperty('tls');
      expect(config.redis).toHaveProperty('maxRetries');
      expect(config.redis).toHaveProperty('retryDelay');

      // In production, TLS should be enabled
      if (config.nodeEnv === 'production') {
        expect(config.redis.tls).toBe(true);
      }
    });

    it('should handle Redis connection failures gracefully', async () => {
      if (!config.redis.url) {
        return;
      }

      // This test verifies that the service doesn't crash on connection issues
      // The actual connection might fail, but it should be handled gracefully
      const isHealthy = await cacheService.healthCheck();
      expect(typeof isHealthy).toBe('boolean');
    });
  });
});
